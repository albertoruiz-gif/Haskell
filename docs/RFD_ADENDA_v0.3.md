# Adenda RFD v0.3 — Plataforma Comercial Multicanal

Complementa el RFD v0.2 (21/07/2026). No reemplaza el documento original; donde hay conflicto, esta adenda prevalece hasta que se incorpore formalmente a una v0.3 revisada y aprobada por los mismos responsables (Gerencia Comercial, Finanzas/Contabilidad, Almacén/Logística, Tecnología).

## 1. Comisión del asesor configurable (modifica RN-008, RN-010, DP-006, 7.3)

**Texto original (RN-008):** "El precio del asesor será el 80% del PVP vigente publicado en el catálogo de su canal."
**Texto original (7.3):** "El porcentaje_asesor será 80% en el MVP y deberá bloquearse o advertirse cualquier valor distinto."

**Nuevo texto:**

- RN-008 (revisada): El precio del asesor será un porcentaje del PVP vigente, definido por `porcentajeAsesor`. El valor por defecto del sistema es 80%, editable únicamente por el rol Administrador (o Gerente comercial con permiso explícito), a nivel global y, opcionalmente, sobrescribible por campaña o por canal dentro de una campaña.
- RN-010 (revisada): Total Culqi = Σ(PVP unitario × porcentaje_asesor vigente para esa línea × cantidad) + tarifa de envío de la dirección seleccionada.
- Todo cambio de `porcentajeAsesor` queda auditado (actor, fecha/hora, valor anterior, valor nuevo, alcance — global/campaña/canal) — reutiliza RN-027/RNF-008, no crea un mecanismo nuevo.
- El pedido sigue congelando el porcentaje aplicado al momento de la compra (RN-007, RN-038 no cambian): cambios posteriores al porcentaje no alteran pedidos ya realizados.
- DP-006 queda resuelta parcialmente: el 80% es el valor por defecto pero **no** es fijo; aplica a todos los productos/canales salvo que el administrador configure una excepción explícita por campaña o canal. Pendiente definir si se permite excepción por producto individual (fuera de este scaffold).

Implementado en `backend/src/modules/pricing/pricing.service.ts` y en el modelo `PricingConfig` de `prisma/schema.prisma`.

## 2. Ofertas por día, semana y mes (extiende RF-043, RF-044, DP-017)

El RFD ya prevé promociones dentro del catálogo de campaña (RN-029 a RN-040, RF-040 a RF-050), pero no modela explícitamente ofertas de vigencia corta e independiente del ciclo completo de aprobación de catálogo. Se añade:

- Nuevo tipo de promoción `OFERTA_TEMPORAL` con alcance `DIA` | `SEMANA` | `MES`, fecha/hora de inicio y fin, editable por el Administrador o Gerente comercial sin requerir una nueva versión completa de catálogo (evita el ciclo de aprobación pesado para ofertas tácticas de corta duración).
- Una oferta temporal se aplica sobre un catálogo ya publicado y vigente; no puede extender la vigencia del catálogo ni saltarse la restricción de canal (RN-031, RN-039 siguen aplicando).
- Queda pendiente definir (agregar a la tabla de decisiones pendientes, sección 3) si las ofertas temporales pueden acumularse con otras promociones del catálogo — por defecto en este scaffold, **no se acumulan**: la oferta temporal reemplaza la promoción base mientras esté vigente.

Implementado en el modelo `Offer` de `prisma/schema.prisma` y `backend/src/modules/campaigns/campaigns.service.ts`.

## 3. Nuevas decisiones pendientes (extiende sección 14.2)

| ID | Decisión | Prioridad |
|---|---|---|
| DP-023 | ¿El porcentaje_asesor configurable puede variar por producto individual, o solo por alcance global/campaña/canal? | Media |
| DP-024 | ¿Las ofertas temporales (día/semana/mes) pueden acumularse con las promociones del catálogo base, o siempre las reemplazan? | Alta |
| DP-025 | ¿Quién aprueba una oferta temporal — requiere el mismo doble control (carga vs. aprobación) que el catálogo completo, o el administrador puede publicarla directamente? | Alta |

## 4. Integración Odoo — decisión tomada (resuelve parcialmente DP-021)

Se define: **la web consulta y escribe en Odoo** vía API externa JSON-RPC/XML-RPC (JSON-2), con usuario técnico y API key generada en Odoo (Ajustes → Cuenta → Seguridad → Nueva clave API). No se usan webhooks salientes de Odoo (no disponibles en el plan Online sin Odoo.sh). Ver detalle en `ARQUITECTURA.md`.

Sigue pendiente (DP-021 no se resuelve del todo): si los precios de campaña actualizan listas de precios de Odoo o se envían solo como precio de línea del pedido. Este scaffold implementa la opción más simple y segura para el MVP — **precio de línea del pedido**, sin tocar listas de precios de Odoo — hasta que Finanzas/Tecnología decidan lo contrario.

## 5. Nota sobre el material DevSecOps solicitado

Se intentó clonar `https://github.com/cursos-tecylab/DVO20JUN26.git` para basar el pipeline en el material del curso; el repositorio devolvió 404 (privado, eliminado, o nombre distinto). El pipeline en `.github/workflows/ci-cd.yml` usa prácticas estándar de la industria (SAST con CodeQL, SCA con `npm audit` + Trivy, secret scanning con Gitleaks, escaneo de imagen con Trivy, aprobación manual antes de producción). Si conseguís acceso al repo correcto, lo reviso y ajusto el pipeline a su contenido específico.
