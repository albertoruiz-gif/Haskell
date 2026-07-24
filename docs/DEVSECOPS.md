# DevSecOps

## Nota sobre el repo de referencia

Se intentó usar `https://github.com/cursos-tecylab/DVO20JUN26.git` como base. El clon público falló con 404 (repo privado, borrado, o el nombre/organización no coincide exactamente). El pipeline de este scaffold usa prácticas estándar equivalentes. Pasame el link correcto o hacelo público temporalmente y ajusto `.github/workflows/ci-cd.yml` a su contenido exacto.

## Gates del pipeline (`.github/workflows/ci-cd.yml`)

| Etapa | Herramienta | Bloquea el merge/deploy si... |
|---|---|---|
| Lint + tipado | ESLint, `tsc --noEmit` | Hay errores de tipo o estilo |
| Pruebas unitarias | Jest (backend y frontend) | Falla algún test |
| SAST | CodeQL (GitHub nativo) | Detecta vulnerabilidad de código (inyección, XSS, etc.) |
| SCA (dependencias) | `npm audit --audit-level=high` + Trivy filesystem scan | Dependencia con CVE alto/crítico |
| Secretos | Gitleaks | Detecta credenciales o llaves en el diff |
| Build de imagen | Docker Buildx | Falla el build |
| Escaneo de imagen | Trivy image scan | CVE crítico en la imagen final |
| Push a ECR | AWS CLI vía OIDC (sin access keys) | — |
| Despliegue a QA | `kubectl apply` | Automático tras pasar todo lo anterior |
| Despliegue a producción | `kubectl apply` | Requiere aprobación manual (GitHub Environment protegido) |

## Principios aplicados

- **Sin secretos estáticos**: GitHub Actions se autentica a AWS vía OIDC (rol IAM de confianza), no hay `AWS_ACCESS_KEY_ID` guardada como secret de repo.
- **Mínimo privilegio**: el rol IAM del pipeline solo tiene permisos de ECR push y `kubectl` sobre el namespace `plataforma` (no admin de la cuenta).
- **Shift-left**: SAST y secret scanning corren en cada pull request, no solo antes de producción.
- **Trazabilidad**: cada imagen se etiqueta con el SHA del commit; el pipeline genera un SBOM (`syft` + Trivy) adjunto al release.
- **Aprobación humana antes de producción**, tal como exige RFD 11.4 (paso 5).
- **Rollback documentado**: `kubectl rollout undo deployment/<nombre> -n plataforma` revierte al ReplicaSet anterior; se documenta como paso manual en caso de fallo post-despliegue (RFD 11.4, paso 7).
