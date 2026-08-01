# Despliegue en AWS (sin Terraform)

Todo con AWS CLI + `eksctl` + `kubectl`, sin herramientas de Infraestructura como Código adicionales. Ejecutá esto una vez que la cuenta de AWS esté contratada.

> **Nota (2026-08-01):** dado el tamaño actual del equipo (dos personas), se decidió posponer EKS/Kubernetes — este documento queda como referencia para cuando la escala lo justifique. El plan vigente para Test y Producción es más simple: dos instancias EC2 corriendo el mismo `docker compose` que ya se usa en local, sin cluster, sin RDS (Postgres en Docker en cada servidor), acceso por AWS Systems Manager (sin SSH expuesto), región `us-east-1`. Se documentará aparte cuando esté armado.

## Odoo por ambiente — checklist obligatorio antes de cargar credenciales reales

**Producción** es el único ambiente que debe apuntar al Odoo real (`Haskell_Distribuidor`, con su `ODOO_COMPANY_ID`). **Desarrollo y Testeo tienen que apuntar a una base de Odoo duplicada** (Odoo Online → Ajustes → Base de datos → Duplicar), nunca a la real — de lo contrario, un pedido de prueba baja stock real y ensucia la contabilidad real. Se recomienda una sola copia duplicada compartida entre Desarrollo y Testeo (equipo chico, bajo riesgo de choque), no una por ambiente.

Antes de dar por buena una copia duplicada:
- Confirmar el `ODOO_URL`/`ODOO_DB` que asignó Odoo a la copia (suele cambiar respecto al original).
- Verificar si el API key técnico se copió junto con la base o si hay que regenerarlo dentro de la copia.
- Cada ambiente tiene su propio `.env` con su propio set de `ODOO_URL`/`ODOO_DB`/`ODOO_API_KEY`/`ODOO_COMPANY_ID` — nunca se reutilizan las credenciales de Producción en Testeo o Desarrollo, ni al revés.

## 0. Prerrequisitos

```bash
aws configure                 # access key de tu usuario IAM (solo para setup inicial, no para el pipeline)
aws --version                 # AWS CLI v2
eksctl version                # https://eksctl.io
kubectl version --client
```

## 1. Crear el clúster EKS

```bash
eksctl create cluster \
  --name plataforma-comercial \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.medium \
  --nodes 2 --nodes-min 2 --nodes-max 4 \
  --managed
```

Esto crea VPC, subnets, NAT Gateway (salida con IP fija, útil si Odoo luego exige IP allowlisting) y el nodegroup administrado.

## 2. Crear los repositorios de imágenes (ECR)

```bash
aws ecr create-repository --repository-name plataforma/backend
aws ecr create-repository --repository-name plataforma/frontend
```

## 3. Base de datos PostgreSQL (RDS, no en el clúster)

```bash
aws rds create-db-instance \
  --db-instance-identifier plataforma-pg \
  --engine postgres \
  --db-instance-class db.t3.micro \
  --allocated-storage 20 \
  --master-username plataforma_admin \
  --manage-master-user-password \
  --vpc-security-group-ids <sg-de-tu-vpc-eks> \
  --no-publicly-accessible
```

`--manage-master-user-password` hace que RDS guarde la contraseña directamente en AWS Secrets Manager — no la manejás vos en ningún momento (RNF-005/RNF-006).

## 4. Secretos en AWS Secrets Manager

```bash
aws secretsmanager create-secret --name plataforma/odoo \
  --secret-string '{"url":"https://tu-instancia.odoo.com","db":"tu-instancia","apiKey":"..."}'

aws secretsmanager create-secret --name plataforma/culqi \
  --secret-string '{"publicKey":"...","privateKey":"...","rsaId":"...","rsaPublicKey":"..."}'
```

## 5. Secrets Store CSI Driver (para que los pods lean Secrets Manager)

```bash
helm repo add aws-secrets-manager https://aws.github.io/secrets-store-csi-driver-provider-aws
helm repo add secrets-store-csi-driver https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts
helm install csi-secrets-store secrets-store-csi-driver/secrets-store-csi-driver --namespace kube-system
helm install csi-secrets-store-provider-aws aws-secrets-manager/secrets-store-csi-driver-provider-aws --namespace kube-system
```

Los pods montan los secretos vía `infra/k8s/secretproviderclass.yaml` — nunca se guardan en variables de entorno de GitHub ni en el repo.

## 6. OIDC para que GitHub Actions despliegue sin credenciales estáticas

```bash
eksctl utils associate-iam-oidc-provider --cluster plataforma-comercial --approve

aws iam create-role --role-name github-actions-deploy \
  --assume-role-policy-document file://trust-policy-github-oidc.json

aws iam attach-role-policy --role-name github-actions-deploy \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
```

`trust-policy-github-oidc.json` limita el rol a tu repo de GitHub específico (`repo:albertoruiz-gif/<nombre-repo>:*`). El pipeline (`.github/workflows/ci-cd.yml`) usa `aws-actions/configure-aws-credentials` con este rol — no hay access keys guardadas como secret de GitHub.

## 7. Ingress (ALB)

```bash
eksctl create iamserviceaccount \
  --cluster plataforma-comercial --namespace kube-system \
  --name aws-load-balancer-controller --attach-policy-arn <policy-alb-controller> --approve

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system --set clusterName=plataforma-comercial
```

Luego `kubectl apply -f infra/k8s/ingress.yaml` expone `pedidos.tudominio.pe` y `api.tudominio.pe` (dominios propuestos en RFD 11.1) mediante un Application Load Balancer.

## 8. Primer despliegue manual (luego lo hace el pipeline)

```bash
kubectl create namespace plataforma
kubectl apply -f infra/k8s/
```

## Orden recomendado

1. Cluster + ECR + RDS (una sola vez, manual).
2. Secrets Manager + CSI driver (una sola vez, manual).
3. OIDC + rol IAM para GitHub Actions (una sola vez, manual).
4. De ahí en más, cada push a `main` que pase los gates de `.github/workflows/ci-cd.yml` construye, escanea y despliega solo.
