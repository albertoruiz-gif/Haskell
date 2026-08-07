# Resultado — Inventario de sync pedidos → Odoo (antes de seguir)

Respuesta a `PROMPT_inventario_sync_pedidos_odoo.md`. Solo investigación, sin cambios de código. Verificado contra el código y contra Odoo directamente el 2026-08-07.

## 1. La AI Tool "Consultar estado de pedido"

- **Server Action**: `ir.actions.server` id **1444**, nombre "Hasky: Consultar estado de pedido", `model_id` = `stock.picking` (aparece como "Transfer", el nombre técnico de ese modelo).
- **Modelo que consulta**: solo `stock.picking`. No toca `sale.order` en ningún momento, y solo llega a `res.partner` de forma indirecta, a través del path relacional `partner_id.phone` cuando busca por teléfono (no es una consulta separada a `res.partner`).
- **Búsqueda**: por `x_pedido_externo_id` (número de pedido exacto) si se da `numero_pedido`, o por `partner_id.phone` (últimos 9 dígitos, `like`) si se da `telefono_asesor`.
- **Campos que devuelve**: `numero_pedido` (`x_pedido_externo_id`), `estado` (`x_estado_pedido`), `transportista` (`x_transportista_id.name`), `en_transito` (`x_en_transito`), `fecha_programada_entrega` (`scheduled_date`), `fecha_entregado` (`date_done`), `recibido_por` (`x_recibido_nombre`), `motivo_devolucion_o_fallo` (`x_devuelto_causa`).
- Está en el Topic "Consulta de estado de pedido" (id 6), adjunto al agente **Hasky** (id 7).

## 2. El disparador de sincronización — ya cambió respecto al supuesto del prompt

El supuesto original ("sincronizado solo cuando `Order.estado` llega a `PAGADO`") ya no es así — se amplió en una sesión anterior. Hoy `OperacionesService.sincronizarEstadoPedidoAOdoo()` (`backend/src/modules/operaciones/operaciones.service.ts:35-75`) se dispara desde:

| Transición de `Order.estado` | Dónde se llama |
|---|---|
| `PAGADO` | `orders.service.ts:236` (`validarPagoManual`) |
| `CANCELADO_DEVUELTO` (por rechazo) | `orders.service.ts:246` (`rechazarPedido`) |
| `PICKING` | `operaciones.service.ts:117` |
| `PACKING` | `operaciones.service.ts:130` |
| (asignación de transportista, `Entrega` creada) | `operaciones.service.ts:141` |
| `ENTREGADO_TRANSPORTISTA` | `operaciones.service.ts:160` |
| `EN_RUTA` | `operaciones.service.ts:172` |
| `ENTREGADO` | `operaciones.service.ts:191` |
| `ENTREGA_FALLIDA` | `operaciones.service.ts:223` |

**Hallazgo clave**: este método (línea 57) usa `clientePartnerId: order.asesor.odooPartnerId` tal cual está guardado — no lo crea ni actualiza. El único lugar que realmente crea/actualiza el contacto del asesor en Odoo (`upsertAsesorComoPartner`, con nombre/teléfono/DNI) es `OrdersService.confirmarPagoYEnviarAOdoo()` (`orders.service.ts:251-278`), que **no se llama desde el flujo manual de Yape** (`validarPagoManual`) — se llama únicamente desde `CulqiService.ejecutarCargo()` (`backend/src/modules/payments/culqi.service.ts:54`), solo si el pago fue por tarjeta vía Culqi y salió aprobado.

Esto probablemente explica por qué una búsqueda por teléfono en Hasky no encuentra nada: si el pedido se validó por el camino manual de Yape (el que se usa hoy en la práctica), el asesor nunca llega a tener `odooPartnerId`, así que el `stock.picking` sincronizado queda sin `partner_id` — no hay teléfono contra el cual buscar en Odoo, aunque el pedido sí exista y sí se haya sincronizado.

**Dato adicional relevante**: sí existe un `Payment.estado` (`schema.prisma:583-596`, campo `String`, valores previstos `iniciado|pendiente|aprobado|rechazado|anulado|reembolsado`) — un estado de pago genuinamente separado de `Order.estado`, pero específico del camino Culqi (tarjeta), no del Yape manual. No es lo que alimenta "Pendiente de validar/Validado/Rechazado" en Gestión → Pagos (eso sigue siendo puramente `Order.estado`).

## 3. Cobertura de los 12 estados de `EstadoPedido`

| Estado | ¿Sincroniza a Odoo? |
|---|---|
| `PAGADO`, `PICKING`, `PACKING`, `ENTREGADO_TRANSPORTISTA`, `EN_RUTA`, `ENTREGADO`, `ENTREGA_FALLIDA` | Sí (ver tabla del punto 2) |
| `CANCELADO_DEVUELTO` | Sí, solo si pasa por `rechazarPedido` (`orders.service.ts:246`). Si se genera por falla de stock al crear el pedido (`orders.service.ts:27`, `reservarOCancelar`), no sincroniza — pero no importa, el pedido nunca llegó a `PAGADO` ni a Odoo. |
| `BORRADOR` | No (el pedido nace directo en `PENDIENTE_PAGO`) |
| `PENDIENTE_PAGO` | No — el pedido no existe en Odoo hasta `PAGADO` |
| `STOCK_RESERVADO` | No sincroniza — y de hecho **nunca se asigna en ningún lado del código actual** (solo se verifica como precondición válida en `pickingList`, `operaciones.service.ts:83`, pero ningún `.update()` lo escribe). Valor del enum sin usar hoy. |
| `ANULADO_POR_VENCIMIENTO` | No sincroniza (`inventario.service.ts:205`, cron de reservas vencidas) — consistente, el pedido nunca pasó por `PAGADO`. |

## 4. Los textos "A tiempo / Atrasado / Postergado / Cerrado"

Son dos cosas distintas en dos columnas distintas de la tabla de Despacho, no una sola lista:

- **"A tiempo" / "Atrasado" / "Postergado"** (columna "Estado"): type `EstadoSalud` en `frontend/src/components/admin/transporte/DespachoSection.tsx:58`, calculado en el cliente por `calcularEstadoSalud()` (líneas 60-67) comparando `Entrega.updatedAt` vs. fecha prometida. Ya tiene su réplica en el backend (`backend/src/common/sla.util.ts`, `calcularEstadoSaludEntrega`) y **ya se sincroniza a Odoo** como `x_estado_delivery` en cada llamada a `sincronizarEstadoPedidoAOdoo` — esto no está pendiente de diseñar, ya existe.
- **"Cerrado"** (línea 334, columna "Acciones", no "Estado"): no es parte de `EstadoSalud`, es un texto estático que reemplaza los botones de acción cuando `Entrega.estado` es `ENTREGADO` o `FALLIDO`. No es un dato que haga falta sincronizar — es una etiqueta de UI, no una clasificación.

## 5. Nota adicional — código/número de pedido de los datos de prueba

Se preguntó por qué nunca se vio el "código del pedido" en pantalla para los pedidos de prueba usados al validar el tablero de indicadores. Motivo: esos 6 pedidos se crearon directo en la base de datos por script (para poblar `ventas_netas`, `tiempo_ciclo_pedido`, etc.), sin pasar por el checkout real de la web — nunca hubo una pantalla de confirmación donde verlos.

El código es el número de pedido legible (formato `HSK_<CANAL>_<número>`, ver `backend/src/common/numero-pedido.util.ts`). Los de esos 6 pedidos de prueba en Testeo:

```
HSK_MIN_000011  (ENTREGADO, pagado 07 ago)
HSK_MIN_000012  (ENTREGADO, pagado 07 ago)
HSK_MIN_000013  (ENTREGADO, pagado 07 ago)
HSK_MIN_000014  (ENTREGADO, pagado 01 ago)
HSK_MIN_000015  (ENTREGADO, pagado 01 ago)
HSK_MIN_000016  (ENTREGADO, pagado 01 ago)
```

En un pedido real (hecho por un asesor desde la web), este código sí se muestra — en la pantalla de confirmación del carrito (`frontend/src/app/carrito/page.tsx`), después de procesado el pago.
