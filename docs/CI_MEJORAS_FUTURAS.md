# Mejoras futuras al pipeline de CI/CD

Propuestas de endurecimiento para `.github/workflows/ci-cd.yml`, no implementadas todavía. Rescatadas de una investigación previa que quedó pegada dentro de `CONSTITUTION.md`; se separan acá porque son una extensión concreta del pipeline, no una regla del agente.

## 0. Gap conocido y aceptado — `next@14.2.5` sin parche, umbral bajado en frontend

Desde el run del 2026-07-31, el job `sca-dependencias` fallaba para `frontend` en `npm audit --audit-level=high` por vulnerabilidades altas en Next.js (SSRF, cache confusion, exposición de endpoints internos del Server Action) y en PostCSS (XSS, path traversal vía sourcemap). El fix automático (`npm audit fix --force`) sube Next 14.2.5 → 15.5.16/16.2.x, un cambio mayor con riesgo real de breaking changes (App Router, config, posible React 18→19). Sigue sin actualizarse — queda como tarea aparte, dedicada, con verificación manual completa del frontend (carrito, indicadores, dashboard) antes de mergear.

**Actualización 2026-08-07**: se resolvió la parte segura sin tocar `next` — `npm audit fix` (brace-expansion, js-yaml) y un `overrides.postcss` (fuerza la copia interna de `next` a la versión parchada 8.5.23+ sin bumpear `next`). Solo quedan sin parche `next` (prod, sin fix dentro de la rama 14.x) y `glob` (dev, vía `eslint-config-next`, ya excluido por `--omit=dev`). Decisión explícita del usuario: en vez de dejar `sca-dependencias (frontend)` en rojo permanentemente, se bajó el umbral a `--audit-level=critical` solo para ese job/app en `ci-cd.yml`, aceptando el riesgo de `next` como conocido y documentado — **esto reemplaza la decisión anterior de "no bajar el audit-level como atajo"**. La migración de Next.js a una versión parchada (15.5.16+ o 16.2.5+) sigue pendiente como tarea real, no cosmética.

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
