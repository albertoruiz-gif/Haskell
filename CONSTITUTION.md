# CONSTITUTION.md — Principios y Reglas del Agente de IA

**Proyecto:** Haskell (Plataforma Comercial Efficax)
**Versión:** 1.0 — reparada y anclada al repo real (2026-07-31)
**Relación con la metodología:** este documento es el contrato operativo de corto plazo para cualquier agente de IA que trabaje en este repositorio. El marco completo de fases, gates y roles vive en `Metodologia_Efficax_Spec_Driven_Development.md` (E-SDD); acá se aplica solo el subconjunto ligero descrito en la sección 7 — sin especificación no se implementa una regla de negocio nueva o modificada, sin la ceremonia de los 7 gates formales.

> Nota de reparación: la versión anterior de este archivo tenía un preámbulo meta ("esto es un CONSTITUTION.md...") y, después del cierre real del documento, un volcado de notas de investigación sin integrar (Specmatic, spec-conformance gates, agente verificador, rol DRI). Ese contenido se separó a [`docs/CI_MEJORAS_FUTURAS.md`](docs/CI_MEJORAS_FUTURAS.md) — lo aprovechable para este repo (ideas de endurecimiento del pipeline) quedó ahí; lo que era filosofía general de organización (rol DRI) no se trasladó por no ser accionable sobre este código. Los comandos y la estructura de carpetas de la versión anterior eran de una plantilla genérica (`npm run test:contract`, `/src/generated`, `/src/custom`) que no existen en Haskell — se reemplazaron por lo que de verdad hay en este repo.

## 1. Misión y filosofía

- **La especificación es la fuente de verdad.** El código es un subproducto de la especificación, no al revés.
- **Validación automática antes que revisión manual.** Usar lint y type-checking (`tsc --noEmit`) como primera línea de verificación; cuando exista, correr la suite de tests. No sustituir esto por una lectura humana línea por línea.
- **Preferir cómputo e IA para garantizar corrección, no horas-hombre.** Si una duda se puede resolver corriendo el type-checker o un test, se corre — no se asume.

## 2. Comandos ejecutables (reales, verificados en este repo)

El host no tiene Node.js instalado — todo corre vía Docker Compose. **El agente nunca debe adivinar flags ni asumir comandos de otro stack.**

**Levantar el entorno local** (desde `infra/`):
```
docker compose up -d --build
```
Postgres en `:5432`, backend NestJS en `:3000`, frontend Next.js en `:3001`.

**Backend** (dentro del contenedor):
```
docker compose exec backend npm run lint
docker compose exec backend npm test
docker compose exec backend npm run build
docker compose exec backend npx prisma migrate dev --name <descripcion>
docker compose exec backend npx prisma generate
docker compose exec backend npm run seed:catalogo   # o seed:demo / seed:roles / seed:inventario
```

**Frontend** (dentro del contenedor):
```
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

**Gotcha conocida:** `ts-node` falla para cualquier archivo bajo `backend/prisma/` en esta imagen Docker (bug preexistente de la imagen, no del código). Para validar un seed o script nuevo ahí sin poder ejecutarlo:
```
docker compose exec backend npx tsc --noEmit prisma/seeds/<archivo>.seed.ts --esModuleInterop --skipLibCheck --target ES2021 --module commonjs
```

**Estado real de las pruebas:** `jest` está configurado en el backend (`npm test`), pero hoy no existe ningún archivo `*.spec.ts`. Esto es una deuda, no un hecho a imitar: cualquier cambio que toque una regla crítica (invariante, transición de estado, cálculo de comisión o de stock) debe empezar a cerrar ese vacío agregando su propio test — no asumir que "no hay tests que romper".

**No existen** `npm run test:contract`, Specmatic, ni las carpetas `/src/generated` o `/src/custom` de una plantilla genérica. No inventar estos comandos ni esta estructura.

**CI/CD real** (`.github/workflows/ci-cd.yml`, dispara en `push`/`pull_request` a `main`): lint + build + test (matrix backend/frontend) → CodeQL (SAST) → `npm audit` + Trivy (SCA de dependencias) → gitleaks (secret-scan) → build y escaneo Trivy de la imagen Docker → despliegue a QA (EKS) → despliegue a producción con aprobación manual (GitHub Environments). Ideas de endurecimiento adicional (spec-conformance gates, contract testing, agente verificador adversarial) están documentadas como propuesta futura en `docs/CI_MEJORAS_FUTURAS.md`, no implementadas todavía.

## 3. Estructura real del proyecto

- `backend/src/modules/<feature>/` — un módulo NestJS por capacidad (`*.controller.ts`, `*.service.ts`, `*.module.ts`, `dto/`). Módulos existentes: `afiliacion`, `auth`, `campaigns`, `catalog`, `catalogos-digitales`, `gerentes-comerciales`, `health`, `integraciones`, `inventario`, `lideres`, `odoo`, `operaciones`, `orders`, `payments`, `pricing`.
- `backend/src/common/` — guards y decorators compartidos (`roles`, `service-key`, `public`) y configs de multer.
- `backend/src/config/` — módulo de configuración, `PrismaService`, `SecretsService` (AWS Secrets Manager en producción).
- `backend/prisma/schema.prisma`, `migrations/` (nunca se edita una migración ya aplicada; se crea una nueva), `seeds/` (cada seed exporta `async function seedX(prisma: PrismaClient)` + bloque `if (require.main === module)`, y se registra como script `seed:*` en `package.json`).
- `frontend/src/app/` — rutas de Next.js App Router; `frontend/src/components/`; `frontend/src/lib/`.
- `docs/` — documentación de arquitectura y operación ya existente: `ARQUITECTURA.md`, `DEVSECOPS.md`, `DESPLIEGUE_AWS.md`, `RFD_ADENDA_v0.3.md`, `PLAN_AGENTE_WHATSAPP_IA.md`.
- `docs/specs/` — **nuevo a partir de ahora**: una carpeta `SPEC-XXX-nombre/` por funcionalidad con reglas de negocio no triviales, usando la plantilla de `Metodologia_Efficax_Spec_Driven_Development.md` §6.
- `infra/docker-compose.yml` — entorno local; `infra/k8s/` — manifiestos de despliegue a EKS.
- `.github/workflows/ci-cd.yml` — pipeline real descrito en la sección 2.

## 4. Estándares de ingeniería

- **Tipado estricto:** TypeScript en modo estricto en ambos proyectos; preferir enums y discriminated unions para que un estado inválido (un `EstadoPedido` o `EstadoLote` que no exista) no compile.
- **Invariantes de negocio con nombre:** toda regla crítica (p. ej. "el stock disponible nunca es negativo", "una reserva FEFO no se duplica", "un pedido entregado no vuelve a pendiente de pago") se identifica como en la Metodología E-SDD (`INV-XXX`) y debe tener una prueba — aunque hoy la suite esté vacía, ese es el objetivo a partir de ahora.
- **No duplicar lógica de negocio** entre controlador, servicio y frontend — un único lugar calcula cada regla (ej. `stockDisponible` se deriva de los lotes, nunca se vuelve a hardcodear en otra capa).
- **Antes de dar un cambio por terminado:** correr lint y, cuando el archivo no se pueda ejecutar directamente (gotcha de `ts-node` en `prisma/`), al menos `tsc --noEmit`.

## 5. Flujo de trabajo en Git

- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, etc.), como ya se viene haciendo.
- **Ramas:** hoy el trabajo se integra directo a `main` (el pipeline ya dispara build + scan + deploy a QA en cada push a main). Para un cambio grande o riesgoso, usar una rama `task/[id]-[descripcion-breve]` y abrir PR — el mismo pipeline corre también sobre `pull_request`.
- **Nunca incluir en un commit** archivos de datos crudos ajenos al código (ej. `catalogo_haskell_digital_editable (1).zip`) salvo pedido explícito.
- **Confirmar con el usuario antes de cualquier `git push`** — regla ya vigente en este proyecto.

## 6. Límites y autonomía (sistema de 3 niveles)

### ✅ Siempre hacer
- Correr `npm run lint` y, si aplica, `npm test` / `tsc --noEmit` antes de reportar un cambio como terminado.
- Convertir cualquier alta de datos de prueba (usuarios, lotes, pedidos demo) en un seed reutilizable bajo `backend/prisma/seeds/` — nunca dejarla como un comando suelto de PowerShell/curl.
- Crear una migración de Prisma nueva cuando cambie el schema; nunca editar a mano una migración ya aplicada.
- Actualizar `docs/` o el `SPEC-XXX` correspondiente cuando la implementación revele que el plan original estaba incompleto.

### ⚠️ Preguntar primero
- Agregar o actualizar dependencias en `backend/package.json` o `frontend/package.json`.
- Cambiar `backend/prisma/schema.prisma` de forma que afecte datos ya existentes, o cualquier migración destructiva.
- Modificar `.github/workflows/ci-cd.yml`, `infra/docker-compose.yml` o `infra/k8s/`.
- Cambiar una regla de negocio ya implementada (estados, invariantes, cálculo de comisiones/stock) sin antes registrar el cambio en la especificación correspondiente.
- Cualquier `git push` a `origin/main`.

### 🚫 Nunca hacer
- Nunca subir secretos, llaves de API o credenciales (usar `backend/.env`, nunca commitear el `.env` real — sí `.env.example`).
- Nunca borrar o comentar un test que falla para poder mergear — diagnosticar la causa, o documentar explícitamente por qué el escenario deja de aplicar.
- Nunca editar archivos dentro de `node_modules/` ni una migración ya aplicada.
- Nunca ignorar un error de TypeScript o una advertencia del compilador.
- Nunca incluir el archivo `catalogo_haskell_digital_editable (1).zip` (u otros adjuntos de datos crudos) en un commit.

## 7. Especificación antes de código (versión ligera de E-SDD)

Para cualquier funcionalidad nueva o cambio de regla de negocio no trivial (estados, permisos, cálculos de dinero o stock):

1. Antes de programar, se redacta un `SPEC-XXX.md` corto en `docs/specs/` con al menos: actores y permisos, estados, matriz de transiciones, invariantes (`INV-XXX`) y criterios de aceptación Given/When/Then — usando la plantilla de `Metodologia_Efficax_Spec_Driven_Development.md` §6.
2. Un cambio de regla de negocio empieza en el `SPEC-XXX.md`, nunca directo en el código.
3. No se aplican las 8 fases ni los 7 gates formales de la Metodología completa — no hay Product Owner ni QA dedicados en este proyecto todavía. El equivalente de esas aprobaciones es la confirmación explícita del usuario en el chat, según el tier "Preguntar primero" de la sección 6.
4. Cambios pequeños y de bajo riesgo (fix puntual, ajuste de estilos, texto) no requieren `SPEC-XXX.md`.

---
*Este documento es un artefacto vivo. Si el agente comete errores recurrentes por falta de contexto, actualizar esta Constitución de inmediato — no solo el código.*
