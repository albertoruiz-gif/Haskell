# Mejoras futuras al pipeline de CI/CD

Propuestas de endurecimiento para `.github/workflows/ci-cd.yml`, no implementadas todavía. Rescatadas de una investigación previa que quedó pegada dentro de `CONSTITUTION.md`; se separan acá porque son una extensión concreta del pipeline, no una regla del agente.

## 0. Gap conocido y aceptado — `sca-dependencias (frontend)` en rojo

Desde el run del 2026-07-31, el job `sca-dependencias` falla para `frontend` en `npm audit --audit-level=high`: 16 vulnerabilidades altas en Next.js (SSRF, cache confusion, exposición de endpoints internos del Server Action) y en PostCSS (XSS, path traversal vía sourcemap). El fix automático (`npm audit fix --force`) sube Next 14.2.5 → 16.2.12, un cambio mayor con riesgo real de breaking changes (App Router, config, React 18→19). Decisión explícita: no se actualiza todavía; queda como tarea aparte, dedicada, con verificación manual del frontend antes de mergear. Mientras tanto el pipeline se sostiene con este job en rojo — no ocultar ni bajar el `--audit-level` como atajo.

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
