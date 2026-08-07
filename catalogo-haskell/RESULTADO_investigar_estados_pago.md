# Resultado — Investigación de estados reales de pago de un pedido

Respuesta a `PROMPT_investigar_estados_pago.md`. Solo investigación, sin cambios de código. Verificado contra el código el 2026-08-07.

## 1. Lista completa de estados — un solo enum, no hay un enum de "pago" aparte

`EstadoPedido` en `backend/prisma/schema.prisma:74-90`:

```
BORRADOR
PENDIENTE_PAGO
PAGADO
STOCK_RESERVADO
PICKING
PACKING
ENTREGADO_TRANSPORTISTA
EN_RUTA
ENTREGADO
ENTREGA_FALLIDA
CANCELADO_DEVUELTO
ANULADO_POR_VENCIMIENTO
```

Es el mismo campo `Order.estado` que cubre todo el ciclo de vida del pedido (pago, picking, empaque, entrega) — no existe un enum ni un campo separado solo para "estado de pago".

## 2. Cómo se mapean los 3 textos que se ven en Gestión → Pagos

En `frontend/src/components/admin/PagosTab.tsx:27-31`:

| Texto en pantalla | Valor real del enum |
|---|---|
| "Pendiente de validar" | `PENDIENTE_PAGO` |
| "Validado" | `PAGADO` |
| "Rechazado" | `CANCELADO_DEVUELTO` |

Son solo 3 de los 12 valores posibles, renombrados para esa pantalla — el resto (`PICKING`, `EN_RUTA`, `ANULADO_POR_VENCIMIENTO`, etc.) no se muestra ahí pero existe en el modelo.

## 3. ¿"Rechazado" tiene motivo?

Sí, pero no vive en el pedido. En `backend/src/modules/orders/orders.service.ts:240-248`:

```ts
async rechazarPedido(orderId: string, actorId: string, motivo?: string) {
  await this.prisma.auditLog.create({
    data: { actorId, accion: 'RECHAZAR_PEDIDO', entidad: 'Order', entidadId: orderId, motivo },
  });
  // ... estado: CANCELADO_DEVUELTO
}
```

El `motivo` (opcional, texto libre que escribe el administrador al rechazar) se guarda en la tabla `audit_logs` (`schema.prisma:598-611`, campo `motivo String?`), **no como un campo en `Order`**. Para verlo hay que consultar el historial de auditoría de ese pedido, no el pedido en sí.

No existe una distinción entre "rechazado automáticamente por la pasarela" vs "rechazado a mano por un administrador" — no hay webhook de Culqi conectado (confirmado en el propio comentario del código), así que hoy todo rechazo es manual, y `CANCELADO_DEVUELTO` es el mismo estado tanto para eso como para cualquier cancelación/devolución en general.

## 4. Teléfono en el pedido

El modelo `Order` completo (`schema.prisma:507-538`) no tiene ningún campo de teléfono, ni del cliente ni del asesor.

El teléfono vive en `Asesor.telefonoPrincipal` / `Asesor.telefonoSecundario` (ambos `String`, sin `@unique` ni `@@index` — no están indexados a nivel de base de datos, aunque sí son consultables con un query normal).

**Sobre por qué Hasky no lo encontró**: la AI Tool "Consultar estado de pedido" no busca en `Asesor.telefonoPrincipal` de esta plataforma — busca en `res.partner.phone` dentro de Odoo, que solo se sincroniza cuando el pedido de ese asesor ya pasó a `PAGADO` (recién ahí se crea/actualiza su contacto en Odoo). Si se probó con el teléfono de un asesor que todavía no tiene ningún pedido validado, o cuyo contacto en Odoo no tiene el teléfono cargado, no va a encontrar nada — aunque el dato exista en la plataforma. Queda pendiente de decisión si se quiere investigar/ajustar esto más a fondo.
