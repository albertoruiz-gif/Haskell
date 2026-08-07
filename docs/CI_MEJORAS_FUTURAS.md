# Mejoras futuras al pipeline de CI/CD

Propuestas de endurecimiento para `.github/workflows/ci-cd.yml`, no implementadas todavía. Rescatadas de una investigación previa que quedó pegada dentro de `CONSTITUTION.md`; se separan acá porque son una extensión concreta del pipeline, no una regla del agente.

## 0. [RESUELTO 2026-08-07] `next@14.2.5` sin parche — migrado a next@15.5.23

Desde el run del 2026-07-31, el job `sca-dependencias` fallaba para `frontend` en `npm audit --audit-level=high` por vulnerabilidades altas en Next.js (SSRF, cache confusion, exposición de endpoints internos del Server Action) y en PostCSS (XSS, path traversal vía sourcemap). `next@14.2.5` no tenía parche dentro de su propia rama 14.x para esos advisories.

**2026-08-07 (primer parche parcial)**: se resolvió la parte segura sin tocar `next` — `npm audit fix` (brace-expansion, js-yaml) y un `overrides.postcss` (fuerza la copia interna de `next` a 8.5.23+ sin bumpear `next`). Quedó pendiente `next` en sí, y el umbral de ese job se bajó temporalmente a `--audit-level=critical` como riesgo aceptado.

**2026-08-07 (migración completa, mismo día)**: se investigó el impacto real antes de migrar — este frontend no usa Server Actions, `middleware.ts`, `rewrites`, `next/image` con `remotePatterns`, rutas dinámicas (`[param]`) ni `cookies()/headers()` (auth por localStorage, no por cookie), así que el breaking change más grande de Next 15 (APIs de request async: `params`/`searchParams`/`cookies`/`headers`) no tenía ningún punto de impacto real en el código. Se subió `next`/`eslint-config-next` a `15.5.23` (última de la rama 15, patchea todos los CVEs; peer dep de React sigue aceptando `^18.2.0`, sin necesidad de subir a React 19) y se agregó `overrides.sharp` (dependencia opcional de `next` para optimización de imágenes, traía una vulnerabilidad propia vía libvips). Resultado: **`npm audit` en 0 vulnerabilidades**, build/lint limpios sin cambios de código necesarios, verificado funcionalmente en Testeo. El umbral de `sca-dependencias (frontend)` en `ci-cd.yml` volvió a `--audit-level=high`, igual que backend. Tag de rollback en git: `pre-next15-migracion-2026-08-07`.

## 1. Spec-conformance gates

Hacer fallar el build automáticamente cuando el código diverja de las reglas de `CONSTITUTION.md` o de las especificaciones en `docs/specs/`. Disparador por ruta: correr esta validación solo cuando cambien `docs/specs/**` o el código que implementa esa especificación.

## 2. Contract testing (Specmatic u otra herramienta equivalente)

Hoy no hay contratos de API formalizados (OpenAPI/AsyncAPI) ni `npm run test:contract`. Si en algún momento se define un contrato de API explícito, una herramienta de contract testing podría integrarse en el job `lint-and-test` para validar que la implementación no diverge del contrato, con el mismo patrón de "fail the build" que ya usan CodeQL/Trivy/gitleaks en este pipeline.

## 3. Bucle de autocorrección con IA

Cuando un test de contrato o de invariante falla en CI, en lugar de detener el proceso para revisión humana inmediata, el fallo se podría reenviar como contexto a un agente de IA para que ajuste el código y reintente — análogo a cómo ya se usa `tsc --noEmit` hoy para validar seeds antes de ejecutarlos.

## 4. Agente verificador (adversarial / AI-as-a-judge)

Sumar un paso en el pipeline donde un segundo modelo, distinto del que generó el cambio, revise el código contra `CONSTITUTION.md` con el objetivo explícito de encontrar violaciones que el primero pudo pasar por alto. Encaja como un job adicional en `ci-cd.yml`, en paralelo a `sast`/`sca-dependencias`.

## 5. Mock servers para desarrollo en paralelo

Si se adopta contract testing con contratos OpenAPI, generar servidores mock desde esos contratos permitiría que frontend y backend avancen en paralelo sin esperarse mutuamente.
