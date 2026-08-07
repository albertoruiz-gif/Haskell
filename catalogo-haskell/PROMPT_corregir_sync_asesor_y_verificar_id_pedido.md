# Prompt para Claude Code (VS Code) — Corregir sync de contacto en flujo Yape + verificar formato del ID de pedido

Copia y pega esto en la misma sesión que tiene contexto de `plataforma-comercial-multicanal` y Odoo.

---

## Contexto

Ya confirmaste (`RESULTADO_inventario_sync_pedidos_odoo.md`) que `upsertAsesorComoPartner` (crea/actualiza el contacto del asesor en Odoo, con teléfono) solo se llama desde `CulqiService.ejecutarCargo()` — nunca desde `OrdersService.validarPagoManual()`, que es el camino real usado hoy (Yape + validación manual). Por eso una búsqueda por teléfono en la AI Tool "Consultar estado de pedido" no encuentra nada para pedidos validados por Yape.

## Qué corregir

1. Haz que `validarPagoManual()` (`orders.service.ts`, cerca de la línea 236) también llame a `upsertAsesorComoPartner` (la misma lógica que usa `confirmarPagoYEnviarAOdoo()` en el camino Culqi) antes o junto con `sincronizarEstadoPedidoAOdoo()`, para que el `partner_id` quede seteado también en el flujo manual de Yape. No dupliques la lógica — reutiliza el mismo método si es posible, o extrae un helper común si `confirmarPagoYEnviarAOdoo` mezcla cosas específicas de Culqi que no aplican aquí.
2. Prueba con un pedido nuevo pagado por Yape: valida el pago manualmente, y confirma en Odoo que el `stock.picking` sincronizado sí tiene `partner_id` con el teléfono del asesor cargado.

## Qué verificar (no asumir)

3. ¿Qué valor real se guarda en `x_pedido_externo_id` cuando se sincroniza un pedido — el ID interno (`cmsc8t...`, el `cuid` de Prisma) o el código legible (`HSK_MIN_000011`)? Confírmalo leyendo el código de `sincronizarEstadoPedidoAOdoo()`.
4. Con eso confirmado, busca en Odoo el pedido rechazado de prueba (`cmsc8t34z00abt8d0b917sr1t`, Andrea Gabriela Salazar Peña, S/98.28) usando el valor correcto de `x_pedido_externo_id` para ese pedido — ¿existe el `stock.picking`? Si no existe, dime por qué (por ejemplo, si ese rechazo en particular no pasó por `rechazarPedido`, o es de antes de que existiera esa sincronización).

## Al terminar, reporta

- El fix aplicado y el resultado de la prueba con Yape.
- Qué formato tiene realmente `x_pedido_externo_id`.
- Si encontraste o no el pedido de prueba rechazado en Odoo, y por qué.
