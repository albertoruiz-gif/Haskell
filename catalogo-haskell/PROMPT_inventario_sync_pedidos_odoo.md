# Prompt para Claude Code (VS Code) — Inventario de lo ya construido (sync pedidos → Odoo) antes de seguir

Copia y pega esto en la sesión de Claude Code que tiene contexto de Odoo (la misma que construyó la AI Tool "Consultar estado de pedido", si es identificable, o una que tenga acceso tanto al repo `plataforma-comercial-multicanal` como a la API de Odoo).

---

## Contexto

Encontré que ya existe una AI Tool llamada "Consultar estado de pedido" conectada al agente Hasky en Odoo, que busca por `res.partner.phone`, sincronizado solo cuando `Order.estado` llega a `PAGADO`. No tengo claridad de todo lo que se construyó alrededor de esto — necesito un inventario completo antes de seguir agregando cosas, para no duplicar trabajo ni construir sobre supuestos equivocados (ya nos pasó antes con el precio de oferta).

## Qué necesito que reportes (solo investigación, no cambies nada todavía)

1. **La AI Tool "Consultar estado de pedido"**: ¿qué Acción de Servidor la implementa (nombre/ID)? ¿Qué modelo de Odoo consulta exactamente — solo `res.partner`, o también `sale.order`/`stock.picking`? ¿Qué campos devuelve hoy?

2. **El disparador de sincronización**: ¿qué código dispara la creación/actualización del contacto en Odoo cuando `Order.estado` pasa a `PAGADO`? Archivo y líneas. ¿Se sincroniza algo más aparte del teléfono (nombre, dirección, pedidos, líneas de producto)?

3. **Cobertura de estados**: de los 12 valores de `EstadoPedido` (`BORRADOR`, `PENDIENTE_PAGO`, `PAGADO`, `STOCK_RESERVADO`, `PICKING`, `PACKING`, `ENTREGADO_TRANSPORTISTA`, `EN_RUTA`, `ENTREGADO`, `ENTREGA_FALLIDA`, `CANCELADO_DEVUELTO`, `ANULADO_POR_VENCIMIENTO`), ¿cuáles disparan alguna sincronización a Odoo hoy, y cuáles no sincronizan nada (como confirmaste que pasa con `CANCELADO_DEVUELTO`)?

4. **Los textos "A tiempo / Atrasado / Postergado / Cerrado / Cerrado"** que se ven en la pestaña Delivery de Gestión: ¿de dónde salen exactamente? ¿Es un campo calculado (comparando fecha prometida vs. real), un campo separado en otra tabla, o algo más? Necesito la fuente real antes de diseñarles una sincronización a Odoo.

## Qué NO hacer todavía

No modifiques código ni crees nada nuevo en Odoo en esta tarea — es un inventario de lo que ya existe, para poder diseñar el siguiente paso (ampliar la sincronización para que cubra todo el ciclo del pedido, no solo `PAGADO`) sobre datos reales.

## Al terminar, reporta

Todo lo anterior, con archivo y líneas de cada cosa que confirmes — igual que en el reporte anterior sobre estados de pago, que estuvo muy bien así.
