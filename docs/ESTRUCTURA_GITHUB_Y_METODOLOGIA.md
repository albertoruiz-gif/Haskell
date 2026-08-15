# Estructura de GitHub, Spec-Driven Development y DevSecOps — Haskell

**Propósito:** documento único, detallado, de cómo está organizado el repositorio en GitHub, qué metodología de desarrollo se sigue (spec-driven, versión ligera de E-SDD) y qué prácticas de DevSecOps se aplican de verdad — no las que dice un documento aspiracional, sino las que se ejecutaron y se pueden verificar en el historial de commits y en el pipeline real.

**Última actualización:** 2026-08-15. Todo lo que sigue fue verificado contra el repositorio real en esa fecha (`git log`, `git remote`, `.gitignore`, `.github/workflows/ci-cd.yml`), no copiado de un documento anterior sin chequear.

---

## 1. Estructura de GitHub

### 1.1 Datos del repositorio

| Dato | Valor |
|---|---|
| Remoto | `https://github.com/albertoruiz-gif/Haskell.git` |
| Rama por defecto | `main` — es la **única** rama que existe hoy (local y remota); no hay ramas de feature abiertas |
| Commits totales | 97 (al momento de escribir esto) |
| Convención de mensajes | Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) |
| Acceso a servidores | AWS Systems Manager (SSM Session Manager) — nunca SSH, el puerto 22 no está expuesto |
| Despliegue real | Manual, vía SSM, a 2 EC2 (Testeo y Producción) — **no** es el pipeline de GitHub Actions el que despliega (ver §3.5) |

### 1.2 Estructura de carpetas (verificada, no la de una plantilla genérica)

```
Haskell/
├── .github/workflows/ci-cd.yml    → pipeline de CI/CD real (ver §3.1)
├── .claude/                        → configuración local del agente de IA (settings.local.json, gitignorado)
├── backend/
│   ├── src/
│   │   ├── modules/<feature>/      → un módulo NestJS por capacidad, 21 módulos hoy:
│   │   │                             afiliacion, auth, campaigns, catalog, catalogos-digitales,
│   │   │                             clientes, configuracion, gerentes-comerciales, health,
│   │   │                             indicadores, integraciones, inventario, libro-reclamaciones,
│   │   │                             lideres, odoo, operaciones, orders, payments, premios,
│   │   │                             pricing, tarifas, transportistas
│   │   │                             Cada módulo: *.controller.ts, *.service.ts, *.module.ts,
│   │   │                             dto/, y (donde hay lógica crítica) *.spec.ts junto al código.
│   │   ├── common/                 → guards y decorators compartidos (roles, scope, service-key, public)
│   │   └── config/                 → PrismaService, SecretsService (AWS Secrets Manager en producción)
│   ├── prisma/
│   │   ├── schema.prisma           → schema único, una fuente de verdad
│   │   ├── migrations/             → nunca se edita una migración ya aplicada — siempre una nueva
│   │   └── seeds/                  → cada seed exporta seedX(prisma) + bloque if (require.main === module)
│   ├── scripts/                    → scripts de verificación manual (ej. test-odoo-connection.ts)
│   └── Dockerfile                  → multi-stage, runtime endurecido (ver §3.3)
├── frontend/
│   ├── src/app/                    → rutas de Next.js App Router
│   ├── src/components/             → agrupados por dominio (admin/, auth/, cart/, catalogo/, ui/...)
│   ├── src/lib/                    → helpers compartidos (api.ts, auth.ts, numeroPedido.ts...)
│   └── Dockerfile
├── docs/                           → toda la documentación de arquitectura, operación y metodología
│   ├── POLITICAS_DESARROLLO.md     → resumen ejecutivo de metodología + auditoría + checklist
│   ├── LECCIONES_APRENDIDAS_INTEGRACIONES.md → gotchas técnicos reales (AWS/SSM, Odoo, Culqi...)
│   ├── DEVSECOPS.md                → gates del pipeline (ver §3.1)
│   ├── ARQUITECTURA.md, DESPLIEGUE_AWS.md, RFD_ADENDA_v0.3.md
│   └── specs/                      → convención para SPEC-XXX.md por funcionalidad (ver §2.6 — existe
│                                      la carpeta, todavía no se usó en la práctica)
├── infra/
│   ├── docker-compose.yml          → local y las 2 EC2 (mismo archivo, distintas variables de entorno)
│   └── k8s/                        → manifiestos de EKS — **no se usan hoy**, quedaron de un plan anterior
├── mcp-odoo-server/                → servidor MCP para integración con Odoo desde herramientas de IA
├── whatsapp-bot/                   → microservicio del bot de WhatsApp (Hasky), Docker separado
├── catalogo-haskell/               → datos fuente del catálogo (Excel, imágenes, scripts de carga)
├── CONSTITUTION.md                 → contrato operativo del agente de IA (ver §2)
└── README.md
```

### 1.3 Estrategia de ramas

No se usa un modelo de ramas tipo Git Flow. La práctica real:

- **Todo el trabajo se integra directo a `main`.** No hay `develop`, no hay ramas de release.
- `CONSTITUTION.md` §5 deja la puerta abierta a una rama `task/[id]-[descripcion-breve]` + Pull Request para un cambio grande o riesgoso, pero **en la práctica no se usó ni una sola vez** — el equipo es una persona (Alberto) más el agente de IA, y cada cambio se verifica localmente (lint, `tsc --noEmit`, tests) antes de subirlo directo a `main`.
- El pipeline de GitHub Actions dispara tanto en `push` a `main` como en `pull_request` — está preparado para el flujo de ramas si el equipo crece, pero hoy corre siempre sobre pushes directos.

### 1.4 Convención de commits (Conventional Commits, con ejemplos reales del log)

```
feat(EP-21): Clientes y linea de credito (Salones de Belleza / Retail) - backend
fix(docker): elimina CVEs HIGH/CRITICAL del escaneo Trivy de imagenes
fix(ci): agrega JWT_SECRET/TOTP_ENCRYPTION_KEY al job de test, causa real de los ultimos 5 fallos de CI
test(EP-19): cobertura de pricing (calculo de dinero) e inventario (FEFO)
docs: marca resuelto el cron de limpieza de disco (aplicado en Testeo y Produccion)
chore: agrega al .gitignore el zip de catalogo digital pendiente
```

Reglas seguidas en la práctica:
- **Prefijo obligatorio** (`feat`, `fix`, `test`, `docs`, `chore`), y cuando aplica, la épica entre paréntesis (`feat(EP-21): ...`) — así el historial de commits sirve como bitácora de qué épica avanzó cuándo, sin necesitar un sistema de tickets aparte.
- **El cuerpo del commit explica el porqué, no solo el qué** — especialmente en fixes no triviales. Ejemplo real (commit `1a5d964`): el mensaje no dice solo "agrega variables de entorno al CI", explica que la causa raíz venía de `jwt.strategy.spec.ts` siendo fail-closed por diseño, que nadie lo había notado porque el entorno local siempre tenía `.env`, y que se verificó reproduciendo el escenario exacto de CI en local antes de subir el fix.
- **Cuerpo con checklist de verificación cuando aplica** — commits de cambios grandes (`feat(EP-21)...`) documentan en el propio mensaje qué se corrió antes de subir (`Suite completa: 77/77 en verde, lint limpio, tsc sin errores`), no solo qué cambió.
- Nunca se usa `git add -A` a ciegas — siempre `git status` primero, y se agregan archivos específicos.

### 1.5 Qué nunca se commitea (verificado contra el historial completo, no solo el estado actual)

Archivos como `certificado.p12`, `haskell-prod.pem`, `Clave_Sunat.txt` y cualquier `.env` real conviven en la carpeta local del proyecto (necesarios para operar) pero están cubiertos por `.gitignore`. Esto no se dio por sentado — se verificó con:

```
git log --all --full-history -- "certificado.p12" "haskell-prod.pem" "Clave_Sunat.txt" "backend/.env"
```

Resultado: **historial vacío** — ninguno de estos archivos estuvo jamás en un commit, en ninguna rama, en ningún punto del historial. `.gitignore` cubre explícitamente: `.env`, `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.cer`, `*.crt`, `Clave_Sunat.txt`, y patrones de archivos temporales.

### 1.6 Flujo real de trabajo (lo que pasa en la práctica, no lo aspiracional)

```
1. Editar código
2. Verificar localmente: tsc --noEmit → jest (suite completa, no solo lo nuevo) → lint → build
3. git status (nunca -A a ciegas) → git add <archivos específicos>
4. git commit con mensaje Conventional Commits + contexto del porqué
5. git push origin main
6. Desplegar a Testeo (SSM) → verificar con curl/consulta SQL real, no asumir que "compiló" = "funciona"
7. Desplegar a Producción (SSM) → verificar igual
```

El pipeline de GitHub Actions corre **en paralelo** a este flujo (se dispara solo con el push), pero no es un gate que bloquee el despliegue real — el despliegue real es manual y ocurre después de la verificación local, no depende de que termine el pipeline. Ver §3.5 para el detalle de por qué el pipeline y el despliegue real son caminos separados.

---

## 2. Spec-Driven Development (versión ligera de E-SDD)

### 2.1 Los tres documentos de gobernanza y cómo se relacionan

| Documento | Dónde vive | Rol |
|---|---|---|
| `Metodologia_Efficax_Spec_Driven_Development.md` | Fuera del repo (`C:\Users\Lenovo ideaPad\Desktop\SDD\`) | El marco **completo** de Efficax (E-SDD): 8 fases, 7 gates formales, roles dedicados (Product Owner, QA, Arquitecto), ADRs, plantilla de especificación. Pensado para un equipo completo. |
| `CONSTITUTION.md` | Raíz de este repo | El **contrato operativo real** — una versión ligera de E-SDD, sin los 7 gates formales ni roles dedicados porque no existen en este proyecto. Es la que aplica día a día. |
| `docs/POLITICAS_DESARROLLO.md` | `docs/` | Resume los dos anteriores + agrega la práctica real de auditoría y el checklist de despliegue, que no estaban en ningún lado. |

**Regla de precedencia:** si algo de un documento más nuevo contradice a `CONSTITUTION.md`, gana `CONSTITUTION.md` — se actualiza ese archivo primero.

### 2.2 Principio rector

> La especificación es la fuente de verdad. El código es un subproducto de la especificación, no al revés.

En este proyecto, sin Product Owner ni QA dedicados, el equivalente de una especificación formal validada por un gate es: **antes de programar algo grande o con reglas de negocio no triviales, presentar opciones concretas con una recomendación y pedir decisiones puntuales al usuario** (usando la herramienta `AskUserQuestion` cuando son 1 a 4 decisiones concretas).

### 2.3 Ejemplos reales de este ciclo en la práctica

**EP-18 (2FA obligatorio para roles administrativos):** antes de escribir una sola línea de código, se preguntó explícitamente: ¿TOTP o SMS?, ¿para qué roles?, ¿obligatorio con plazo de gracia o desde el día uno?, ¿cómo se recupera una cuenta que perdió el segundo factor? Recién con esas cuatro respuestas se diseñó el schema (`totpSecret`, `totpActivadoEn`, `totpGraciaHasta`) y se empezó a programar.

**EP-21 (Clientes y línea de crédito):** dos rondas de preguntas antes de tocar código — la primera sobre quién aprueba el crédito y qué canales aplican; la segunda, en prosa libre del usuario, sobre el flujo completo (solicitud de línea → contado como fallback para clientes sin historial → depósito bancario o link de pago). El diseño final (`Cliente`, `SolicitudCredito`, `RegistroCobro`, reglas de "solo contado" para clientes morosos) salió directo de esas respuestas, no de una suposición del agente.

**Auditoría de seguridad (2026-08-10):** no se corrigió nada "porque parecía inseguro" — se leyó el código real, se listaron hallazgos concretos con un escenario de falla específico (ej. "sin rate limiting, un script puede probar 1000 contraseñas por minuto contra `/auth/login`"), y cada corrección crítica se verificó en vivo (7 intentos de login reales para confirmar que el bloqueo de cuenta corta exactamente en el intento configurado, no solo lectura de código).

### 2.4 Sistema de 3 niveles de autonomía

**✅ Siempre hacer, sin preguntar:**
- Correr `tsc --noEmit` (backend y frontend) y la suite completa de `jest` antes de dar un cambio por terminado.
- Convertir cualquier alta de datos de prueba en un seed reutilizable en `backend/prisma/seeds/` — nunca un comando suelto.
- Crear una migración nueva de Prisma cuando cambia el schema — nunca editar una ya aplicada.
- Actualizar `docs/` cuando la implementación revele que el plan original estaba incompleto.

**⚠️ Preguntar primero (confirmación explícita en el chat):**
- Agregar o actualizar dependencias de `package.json`.
- Cambiar el schema de forma que afecte datos ya existentes, o cualquier migración destructiva.
- Modificar el pipeline de CI/CD, `docker-compose.yml` o los manifiestos de `infra/k8s/`.
- Cambiar una regla de negocio ya implementada sin antes registrarla en la especificación.
- Acciones difíciles de revertir o de cara al usuario final: tocar precios/stock reales, cambiar credenciales de pago, DNS en producción.
- Cualquier `git push` a `origin/main`.

**🚫 Nunca hacer:**
- Subir secretos, llaves o credenciales al repo.
- Borrar o comentar un test que falla para poder avanzar — diagnosticar la causa o documentar por qué el escenario dejó de aplicar.
- Editar `node_modules/` o una migración ya aplicada.
- Ignorar un error de TypeScript o una advertencia del compilador.
- Incluir archivos de datos crudos ajenos al código en un commit sin pedido explícito.

### 2.5 Invariantes de negocio con nombre

Toda regla crítica (algo que si se rompe cuesta plata, stock o confianza) se identifica como una invariante y se protege con un test — no como documentación suelta. Ejemplos reales de este proyecto:

- **"El stock disponible nunca es negativo"** — protegido en `InventarioService.recalcularStock()`, verificado con tests de reserva FEFO (qué pasa si dos pedidos compiten por el mismo lote, qué pasa si el stock no alcanza).
- **"Un pedido pagado no puede volver a pagarse ni rechazarse dos veces"** — guardas de estado agregadas en `OrdersService.validarPagoManual`/`rechazarPedido` (auditoría 2026-08-12), verificadas con tests que confirman que un pedido ya `PAGADO` o `CANCELADO_DEVUELTO` rechaza la operación con un mensaje claro.
- **"Un cliente moroso no puede comprar al crédito"** — `ClientesService.reservarCredito()`, verificado con tests que confirman que el estado `MOROSO` bloquea la compra sin importar si tiene cupo disponible.
- **"El monto de un cobro nunca deja saldo negativo"** — `ClientesService.registrarCobro()`, verificado con un test de pago parcial y uno de pago que excede la deuda.

### 2.6 Qué falta para acercarse a E-SDD completo (honesto, no aspiracional)

- Ningún `SPEC-XXX.md` real todavía en `docs/specs/` — la carpeta existe como convención, la especificación real pasa en la conversación con el usuario, no en un archivo formal.
- Sin ADRs (`ADR-XXX`) registrados para decisiones de arquitectura ya tomadas (ej. "por qué 2 EC2 y no Kubernetes" vive en una nota dentro de `docs/DESPLIEGUE_AWS.md`, no en un ADR formal).
- Sin ambientes de QA separados con gate de Product Owner formal — la aprobación es la confirmación del usuario en el chat.

Esto no es urgente per se para un equipo de una persona, pero es el gap real si el proyecto crece o se replica para otro cliente con equipo más grande.

---

## 3. DevSecOps

### 3.1 Pipeline de CI/CD real (`.github/workflows/ci-cd.yml`)

Dispara en `push` y `pull_request` a `main`. Jobs, en el orden en que corren:

| Job | Herramienta | Qué bloquea |
|---|---|---|
| `lint-and-test` (matrix backend/frontend) | ESLint, `tsc` (via `next build`/`nest build`), Jest | Error de tipo, de estilo, o test que falla |
| `sast` | CodeQL (GitHub nativo) | Vulnerabilidad de código (inyección, XSS, etc.) |
| `sca-dependencias` (matrix backend/frontend) | `npm audit --omit=dev --audit-level=high` + Trivy filesystem scan | Dependencia con CVE alto/crítico |
| `secret-scan` | Gitleaks | Credencial o llave detectada en el diff |
| `build-and-scan-imagen` (matrix backend/frontend, depende de los 4 anteriores) | Docker Buildx + Trivy image scan | CVE crítico/alto en la imagen final |
| `push-y-deploy-qa` / `deploy-produccion` | — | **Deshabilitados a propósito** (`if: false`) — ver §3.5 |

**Estado real (verificado 2026-08-15, corrida `31853647011`):** los 5 jobs activos pasan en verde. No siempre fue así — la causa raíz de 5 corridas fallidas seguidas (incluida una que solo tocaba `.gitignore`, sin código) fue que `jwt.strategy.spec.ts` exige `JWT_SECRET` por diseño (fail-closed) y el workflow nunca le pasaba esa variable al paso `npm test`. Se corrigió agregando `JWT_SECRET`/`TOTP_ENCRYPTION_KEY` como valores fijos de solo-CI, verificado reproduciendo exactamente ese escenario en local antes de subir el fix (commit `1a5d964`).

### 3.2 Seguridad aplicada en runtime (más allá del pipeline)

- **Secretos fail-closed, nunca con valor por defecto.** `jwtSecret()` y la clave de cifrado de TOTP (`TOTP_ENCRYPTION_KEY`) tiran una excepción explícita si la variable de entorno falta — la app no arranca firmando tokens con un secreto público conocido. Antes de esta auditoría (2026-08-10), sí había un default hardcodeado (`'cambia-esto-en-local'`) duplicado en dos archivos.
- **2FA obligatorio (TOTP) para roles administrativos** (`ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`, `FINANZAS`), con plazo de gracia de 7 días para cuentas nuevas y reset solo por otro administrador. El secreto TOTP se guarda cifrado con AES-256-GCM (`totp-crypto.ts`) — no hasheado, porque a diferencia de una contraseña, sí hace falta poder leerlo de vuelta para verificar el código.
- **Rate limiting por IP** (`@nestjs/throttler`, límite global + límite más estricto en `/auth/login`) **y bloqueo de cuenta por intentos fallidos** (independiente del límite por IP — cubre el caso de intentos distribuidos entre varias IPs contra el mismo email).
- **Revocación de sesión sin estado.** El JWT es autosuficiente (no hay tabla de sesiones activas) — revocar una sesión compara el `iat` del token contra `sesionesInvalidadasDesde` en el usuario: cualquier token emitido antes de esa fecha deja de servir, sin esperar a que expire.
- **Cifrado híbrido RSA/AES para el payload de Culqi** (AES-256-GCM + RSA-OAEP-SHA256, según la documentación oficial de Culqi), implementado y verificado con un round-trip criptográfico real, pero **desactivado por defecto** hasta confirmar en el panel de Culqi qué endpoints protege la llave RSA — activarlo a ciegas podría rechazar cobros reales.
- **Todo dato sensible sale de `SecretsService`**, que en producción lee de AWS Secrets Manager y en desarrollo cae a variables de entorno de `.env` — nunca un valor hardcodeado en el código.

### 3.3 Seguridad en la imagen Docker

Ambos Dockerfiles (`backend/Dockerfile`, `frontend/Dockerfile`) son multi-stage: un stage `builder` con todas las dependencias, y un stage `runtime` mínimo. El escaneo de imagen (Trivy) encontró que el runtime heredaba automáticamente el npm global embebido en `node:20-alpine`, cuyas dependencias internas (`tar`, `glob`, `minimatch`...) traían CVEs HIGH/CRITICAL — sin que el código de la app usara nunca esas dependencias directamente.

La corrección de raíz (no un parche cosmético):
1. **Se elimina npm/npx/corepack del stage final** — actualizar la versión no alcanzaba, porque npm libera parches de sus propias dependencias con retraso frente a los CVEs publicados, así que el hallazgo iba a reaparecer con cada CVE nuevo.
2. El despliegue dejó de depender de `npx prisma migrate deploy` (que necesitaba npm) — ahora usa `node node_modules/prisma/build/index.js migrate deploy`, invocando el paquete `prisma` (movido de `devDependencies` a `dependencies`) directo con el runtime de Node.
3. `npm prune --omit=dev` en el stage `builder` antes de copiar `node_modules` al runtime — sin esto, herramientas de desarrollo (`eslint`, `jest`, `ts-node`) viajaban a producción y sus propias dependencias transitivas seguían generando hallazgos.
4. `apk upgrade` para parchear el sistema operativo base (Alpine) en cada build.

Resultado verificado: **0 CVEs CRITICAL/HIGH** en ambas imágenes tras el fix (antes: 21 en backend, 20 en frontend).

### 3.4 Gestión de secretos

- Nunca en el repo (ver §1.5, verificado contra el historial completo).
- Variables de entorno vía `.env` en desarrollo/Testeo/Producción (cada ambiente con su propio archivo, nunca compartido).
- `SecretsService` centraliza el acceso — en producción real puede leer de AWS Secrets Manager (`USE_AWS_SECRETS_MANAGER=true`), hoy los 2 ambientes EC2 usan `.env` directo.
- Regla de aislamiento por ambiente: **Producción es el único ambiente que puede apuntar al Odoo real** (`Haskell_Distribuidor`). Desarrollo y Testeo apuntan a una base de Odoo duplicada — regla que existía desde el 2026-08-01 pero recién se aplicó de verdad el 2026-08-14, cuando se encontró que el entorno local llevaba dos semanas apuntando por error al Odoo real.

### 3.5 Despliegue real — por qué no es el pipeline de GitHub Actions

El plan original (documentado en `docs/DESPLIEGUE_AWS.md`) era Kubernetes/EKS con el pipeline completando el ciclo: build → push a ECR → `kubectl apply` a QA → aprobación manual → `kubectl apply` a producción. Se descartó por escala (equipo de una persona, no se justifica un cluster) a favor de 2 EC2 simples con Docker Compose, desplegadas a mano vía SSM. Los jobs `push-y-deploy-qa` y `deploy-produccion` quedan en el archivo del workflow (documentados, no borrados) con `if: false` — por si el proyecto escala a e-commerce público y conviene retomar Kubernetes, sin tener que reconstruir el pipeline desde cero.

El despliegue real, ejecutado a mano después de que el pipeline confirma que el código está sano:
```
git pull (como usuario ubuntu — la llave de despliegue no está en root)
docker compose build backend frontend
docker compose up -d backend frontend
docker compose exec backend node node_modules/prisma/build/index.js migrate deploy
docker compose restart nginx (cachea DNS interno de Docker, necesita reiniciar tras rebuild)
curl de verificación
```
Primero a Testeo, verificado con una llamada real, recién después a Producción.

### 3.6 Testing como parte de DevSecOps

El proyecto arrancó con cero tests (`jest` configurado, ningún archivo `*.spec.ts`, según el diagnóstico del 2026-07-31). La política que se siguió no fue "parar todo y cubrir el sistema completo" — fue:

- **Todo fix de una regla crítica trae sus propios tests en el mismo cambio**, no como tarea aparte.
- **Los tests verifican comportamiento real, no que "se llamó a una función".** Ejemplo: los tests de 2FA usan la librería TOTP real — generan un secreto de verdad, calculan un código válido para ese secreto exacto, y confirman que el sistema lo acepta y que un código cualquiera no. Los tests de reserva de stock (FEFO) arman lotes con fechas de vencimiento reales y verifican que el reparto entre lotes respeta el orden de vencimiento, no un mock que simplemente devuelve "true".
- **Estado real (2026-08-15):** 8 suites, 77 tests, cubriendo lo más crítico: máquina de estados de pedidos, cálculo de precios/comisiones, reserva FEFO de inventario, aprobación de línea de crédito, 2FA, revocación de sesión JWT, cifrado del payload de Culqi. No es cobertura total del sistema — es cobertura dirigida por riesgo real (dinero, stock, seguridad), que es la misma lógica de priorización que rige el resto del proyecto (ver `docs/POLITICAS_DESARROLLO.md` §4.2).

---

*Documento vivo — actualizar cuando la práctica real diverja de lo escrito acá, igual que `CONSTITUTION.md` y `docs/POLITICAS_DESARROLLO.md`.*
