# Prompt para Claude Code (VS Code) — Investigar los estados reales de pago de un pedido

Copia y pega esto en Claude Code, dentro del repo `plataforma-comercial-multicanal`. Es una tarea de investigación, no de código — no cambies nada todavía.

---

## Contexto

En el módulo Gestión → Pagos de esta plataforma se ven pedidos con estados "Pendiente de validar", "Validado" y "Rechazado" (el asesor paga por Yape y un administrador confirma manualmente que el pago llegó). Pero sospecho que puede existir además un estado distinto para cuando el pago en sí sale "no aprobado" (por ejemplo, si viniera de una pasarela o de una validación automática de Yape, no de la revisión manual del administrador) — no lo he confirmado y no quiero asumirlo.

## Qué necesito

Busca en el código dónde se define el enum/tipo de estado de pago de un pedido (probablemente en el schema de Prisma y/o en el backend, cerca de donde se usan "Pendiente de validar", "Validado", "Rechazado"). Repórtame:

1. La lista completa y exacta de los estados posibles de pago que existen en el código hoy — todos, no solo los que se ven en la UI de Gestión → Pagos.
2. El archivo y las líneas donde está definido cada uno.
3. Si existe un estado separado para "pago rechazado por la pasarela/Yape" vs. "rechazado manualmente por un administrador" — o si ambos casos caen en el mismo estado "Rechazado".
4. Cualquier otro estado de pedido relacionado con el pago que no se muestre en la UI pero exista en el modelo de datos.

No propongas cambios de código ni asumas nada que no hayas verificado leyendo el código — si algo no está claro, dilo así en vez de adivinar.

## Por qué importa

Esta información alimenta dos cosas que ya están en marcha: la automatización de facturación (`PROMPT_facturacion_automatica_odoo.md`, que depende de saber exactamente qué cuenta como "pago confirmado") y el prompt de Hasky en Odoo (que eventualmente debe poder decirle a un asesor si su pago fue validado, rechazado, o está pendiente, sin inventar estados que no existen).
