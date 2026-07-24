# Plataforma Comercial Multicanal

Implementación base del RFD v0.2 (más adenda v0.3, ver `docs/RFD_ADENDA_v0.3.md`): plataforma web para asesores/vendedores/líderes de los canales Salones de Belleza, Retail y Comercio Minorista, con campañas y catálogos virtuales por canal, carrito con pago Yape vía Culqi Checkout Custom, picking/packing/despacho, e integración con Odoo 19 Online.

Identidad visual adaptada de la marca Haskell Cosméticos (verde musgo/bosque, acento magenta, tarjetas redondeadas, fotografía cálida).

## Estructura del repositorio

```
plataforma-comercial-multicanal/
├── backend/           NestJS + TypeScript + Prisma (API, reglas de negocio, integración Odoo/Culqi)
├── frontend/           Next.js + React + Tailwind (catálogo, carrito, backoffice, PWA)
├── infra/              docker-compose local + manifiestos Kubernetes para AWS EKS
├── .github/workflows/  pipeline CI/CD con gates DevSecOps
└── docs/               arquitectura, adenda RFD, guía de despliegue AWS, DevSecOps
```

## Decisiones clave adoptadas en este scaffold

- **Comisión del asesor configurable.** El 80% del RFD original pasa a ser un parámetro (`porcentajeAsesor`) editable por el administrador a nivel global y por campaña/canal, con 80% como valor por defecto y bitácora de auditoría en cada cambio. Ver `docs/RFD_ADENDA_v0.3.md` (ajusta RN-008 y DP-006).
- **Ofertas por día/semana/mes.** Se añade un tipo de promoción con vigencia acotada (`OFERTA_TEMPORAL`) dentro del catálogo de campaña, editable por el administrador, además de las promociones ya previstas en el RFD (RF-043/DP-017).
- **Integración con Odoo 19 Online:** vía API externa JSON-RPC/XML-RPC (JSON-2), la web consulta y escribe — no hay webhooks salientes de Odoo porque Odoo Online no permite código custom sin Odoo.sh. Ver `docs/ARQUITECTURA.md`.
- **Red:** Odoo Online es SaaS con endpoint HTTPS público — no requiere VPN. El backend se conecta por salida HTTPS estándar, con IP fija opcional (NAT Gateway) si Odoo se configura luego con IP allowlisting.
- **Secretos:** AWS Secrets Manager, inyectados en runtime a los pods vía Secrets Store CSI Driver (nunca en código ni en variables de entorno del pipeline en texto plano).
- **Sin Terraform:** el despliegue a AWS se hace con AWS CLI + `eksctl` + manifiestos Kubernetes planos, documentado paso a paso en `docs/DESPLIEGUE_AWS.md`.
- **DevSecOps:** el repositorio de referencia del curso (`cursos-tecylab/DVO20JUN26`) no es accesible públicamente (devolvió 404) — se aplicaron prácticas estándar de la industria (SAST, SCA, secret scanning, escaneo de imagen, aprobación manual a producción). Si el repo es privado o el nombre es distinto, compartilo y ajusto el pipeline a su contenido específico.

## Próximos pasos para vos

1. Conectá esta carpeta a tu VS Code (o copiala) y corré `npm install` en `backend/` y `frontend/`.
2. Cargá los valores reales en `backend/.env` (o mejor, directo en AWS Secrets Manager cuando tengas cuenta de AWS) — ver `backend/.env.example`.
3. Generá tu API key de Odoo 19 Online (Ajustes → Cuenta → Seguridad → Nueva clave API) y probá la conexión con `backend/src/modules/odoo`.
4. Revisá `docs/RFD_ADENDA_v0.3.md` y las 22 decisiones pendientes del RFD (DP-001 a DP-022) — varias bloquean reglas específicas (redondeo, SLA, comprobantes).
5. Cuando contrates la cuenta de AWS, seguí `docs/DESPLIEGUE_AWS.md`.

## Módulos backend implementados

- `auth` — login JWT, hash de contraseñas, guard global (RF-001 a RF-003); alta/baja/reactivación de usuarios con bitácora de auditoría (`PATCH /auth/usuarios/:id/desactivar` y `/reactivar`).
- `pricing` — % del asesor configurable, cálculo de precio y total Culqi (adenda v0.3).
- `campaigns` — campañas, catálogos por canal, aprobación segregada, ofertas temporales (RF-040 a RF-050, adenda v0.3), con controller propio (`POST /campaigns`, `/campaigns/:id/catalogos`, `/campaigns/catalogos/:id/aprobar|observar|publicar|suspender`, `/campaigns/ofertas`) — el listado `GET /campaigns/catalogos` no filtra por canal del JWT, pensado para uso administrativo.
- `catalog` — catálogo publicado filtrado por canal en servidor (RF-011 a RF-013, RF-048); administración de productos vía `GET/POST /catalogo/admin/lineas`, `PATCH /catalogo/admin/lineas/:id/precio` y subida de foto (`POST /catalogo/admin/lineas/:id/foto`, servida en `/uploads/catalogo/...`).
- `odoo` — cliente JSON-RPC genérico + mapeos de ventas/inventario/CRM/contabilidad/cobranzas (8.2).
- `orders` — carrito → pedido con snapshot histórico, envío a Odoo (RF-014 a RF-022, RF-036).
- `payments` — cargo Culqi, idempotencia, límite Yape (RF-018 a RF-021).
- `afiliacion` — alta individual (con apellidos, DNI, dirección completa incl. país, teléfono, fecha de nacimiento) y carga masiva Excel con preview de válidos/errores (RF-006 a RF-009); listado de asesores (`GET /afiliacion`).
- `operaciones` — picking, packing, asignación de transportista, entrega/entrega fallida, cálculo de SLA (RF-024 a RF-030).

## Panel de administrador

Se agregó un panel funcional en el frontend (pestaña **Gestión**), protegido por login:

- **Login** (`/login`) — guarda el JWT en `localStorage`; sin sesión, cualquier ruta redirige ahí (`components/auth/AuthGate.tsx`).
- **Asesores** — alta con los campos completos (Nombre, Apellidos, Teléfono, Fecha de nacimiento, DNI, Dirección, Distrito, Provincia, Departamento, País con default "Perú"), listado, y baja/reactivación.
- **Catálogo/Precios** — alta de producto (SKU, categoría, precio) dentro de un catálogo publicado, edición de precio, subida de foto.
- **Ofertas** — creación y listado de ofertas temporales (día/semana/mes, % descuento o precio fijo) tipo pop-up sobre un catálogo publicado.

Primer acceso: no hay registro público de administradores a propósito. Se crea con el seed (ver abajo).

## Cómo correr en local (desarrollo)

Si no tenés Node.js instalado, todo el stack corre igual vía Docker (así se probó en este entorno):

```powershell
# Red compartida
docker network create haskell-net

# Postgres
docker run --name haskell-postgres --network haskell-net -d -p 5432:5432 `
  -e POSTGRES_USER=plataforma -e POSTGRES_PASSWORD=plataforma -e POSTGRES_DB=plataforma_dev `
  -v haskell-pgdata:/var/lib/postgresql/data postgres:16-alpine

# Backend (copiá backend/.env.example a backend/.env y ajustá DATABASE_URL al host "haskell-postgres")
docker run --name haskell-backend-dev --network haskell-net -d -p 3002:3000 `
  -v "${PWD}/backend:/app" -w /app node:20-alpine sh -c "apk add --no-cache openssl && npm install && npx prisma migrate dev && npm run start:dev"

# Primer usuario ADMINISTRADOR (ver backend/prisma/seed.ts — variables SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD opcionales)
docker exec haskell-backend-dev npx prisma db seed

# Frontend (backend/.env.local con NEXT_PUBLIC_API_URL=http://localhost:3002/api)
docker run --name haskell-frontend-dev -d -p 3000:3000 -v "${PWD}/frontend:/app" -w /app node:20-alpine sh -c "npm install && npm run dev"
```

Con Node.js instalado localmente, es el flujo estándar: `npm install` + `npm run start:dev` en `backend/` y `npm install` + `npm run dev` en `frontend/`.

## Lo que falta (fuera de este scaffold)

- `notificaciones` — correo/WhatsApp de afiliación, pago, despacho, entrega (RF-037).
- `analitica` — paneles y exportaciones (RF-031 a RF-033).
- Comprobantes electrónicos (RF-023) — depende de decidir proveedor CPE (DP-005).
- Flujo de recuperación de clave (RF-001) y MFA de administradores (RNF-007).
- Job programado de publicación/vencimiento automático de catálogos (RF-047).
- Mapeo real SKU web ↔ `product.product` de Odoo (hoy hay un TODO explícito en `orders.service.ts`; el alta de producto en el panel de administrador crea la línea de catálogo directo, sin sincronizar contra Odoo todavía).
- Pruebas automatizadas (Jest) — la estructura ya soporta `npm test` pero no hay specs escritos todavía.
- Conectar `/catalogo` (vista del asesor) al backend real — hoy sigue con datos de ejemplo hardcodeados; el panel de administrador sí es funcional de punta a punta.
- Volumen persistente para `backend/uploads/` en `infra/docker-compose.yml` y Kubernetes — las fotos de producto no sobreviven a recrear el contenedor en esos entornos (en el contenedor de desarrollo con bind mount sí persisten).

Priorizá lo que falta según las Fases 0-5 del RFD (sección 15) y las 25 decisiones pendientes de `docs/RFD_ADENDA_v0.3.md` — varias bloquean reglas exactas (redondeo, SLA, evidencia de entrega, comprobantes).
