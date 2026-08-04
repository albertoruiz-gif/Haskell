# Prompt para Claude Code (VS Code) — Reflejar el estado de Delivery de la plataforma en Odoo

Copia y pega todo lo que sigue como prompt inicial en Claude Code, dentro del repo `plataforma-comercial-multicanal`.

---

## Contexto de negocio

Trabajo con Haskell Cosméticos (Perú). El seguimiento de entregas (delivery) vive hoy solo en esta plataforma, en el módulo "Delivery" (`/delivery`), con esta información por pedido: transportista asignado, si está en tránsito, fecha de entrega prometida, fecha/hora de entrega real y quién recibió (nombre + DNI), causa de devolución si aplica, y un estado de SLA (A tiempo / Atrasado / Postergado / Cerrado).

Por separado, estamos migrando la operación a **Odoo Online (plan Enterprise vía SaaS)**, que ya tiene cargado el catálogo de productos. El agente de IA de Odoo (Hasky, Live Chat, atiende a asesoras y asesores) eventualmente necesita poder responder "¿mi pedido fue entregado?" — y para eso el estado de entrega tiene que existir en Odoo, no solo en esta plataforma.

## Objetivo de esta tarea

Que cada vez que cambie el estado de un pedido en el módulo Delivery de esta plataforma, ese cambio se refleje automáticamente en un registro de Odoo — sin que el pedido tenga que existir primero como venta (`sale.order`) en Odoo. Es un espejo de solo lectura para Odoo: la plataforma sigue siendo la fuente de verdad y el lugar donde se opera (asignar transportista, marcar en tránsito, confirmar recepción, entregar, devolver); Odoo solo recibe el resultado.

## Restricción técnica importante — léela antes de proponer una solución

Esta instancia es **Odoo Online (SaaS)**: no se pueden instalar módulos Python personalizados. Todo se construye con piezas de configuración nativas, creadas por la API externa de Odoo (XML-RPC o JSON-RPC): campos personalizados (`ir.model.fields`) sobre modelos existentes, Acciones de Servidor (`ir.actions.server`), Reglas de Automatización (`base.automation`) si hace falta lógica disparada dentro de Odoo. No propongas un módulo instalable.

## Dónde vive esto en Odoo

El modelo correcto es `stock.picking` (la app Inventario, específicamente "Entregas"). No hace falta que el pedido exista como `sale.order` — se puede crear un `stock.picking` directamente vía API, sin venta asociada, usando el tipo de operación de salida (`picking_type_id` de salidas). Si más adelante los pedidos migran a Odoo como `sale.order`, este mismo registro se puede vincular; no es necesario resolver eso ahora.

## Campos a agregar en `stock.picking` (vía API, `ir.model.fields`)

Mapea la tabla de `/delivery` así:

| Columna en la plataforma | Campo en Odoo | Notas |
|---|---|---|
| ID del pedido (ej. `cmsc8t341009kt8d0xe4fvi2j`) | Campo custom, texto, único — ej. `x_pedido_externo_id` | Clave de matching entre sistemas |
| Entrega prometida | `scheduled_date` (nativo) | No crear campo custom, ya existe |
| Entregado (fecha/hora) | `date_done` (nativo) | No crear campo custom, ya existe |
| Transportista | Campo custom — ej. `x_transportista` | Confirma con Alberto si debe ser texto simple o vínculo a un contacto (`res.partner`) |
| En tránsito | Campo custom booleano — ej. `x_en_transito` | |
| Quién recibió (nombre) | Campo custom texto — ej. `x_recibido_nombre` | |
| Quién recibió (DNI) | Campo custom texto — ej. `x_recibido_dni` | |
| Devuelto (causa) | Campo custom texto largo — ej. `x_devuelto_causa` | |
| Estado (A tiempo/Atrasado/Postergado/Cerrado) | Campo custom selección — ej. `x_estado_delivery` | Es un estado de SLA, distinto del `state` nativo de Odoo (Borrador/En espera/Listo/Hecho/Cancelado) — no los mezcles, son dos cosas distintas |

## Qué construir

1. Crea los campos custom de la tabla de arriba en `stock.picking` vía API.
2. En el backend (`plataforma-comercial-multicanal`), agrega la lógica que, cada vez que cambie el estado de un pedido en `/delivery` (asignar transportista, marcar en tránsito, confirmar recepción, entregar, devolver), llame a la API externa de Odoo y cree o actualice (por `x_pedido_externo_id`) el `stock.picking` correspondiente con los valores nuevos.
3. Decide con el usuario (Alberto) si esto se dispara síncronamente en cada acción del módulo Delivery, o con un job periódico que sincronice los pedidos modificados recientemente — cualquiera es válido, pero no lo asumas sin comentarlo.
4. Prueba con 2-3 pedidos reales del módulo Delivery (los que se ven hoy en `/delivery`) y confirma que el `stock.picking` en Odoo queda con los datos correctos.

## Preguntas de negocio abiertas — resuélvelas con Alberto antes de fijar detalles, no las asumas

- ¿"Transportista" debe quedar como texto libre o como contacto vinculado (`res.partner`) en Odoo? Afecta si conviene crear contactos para Miguel Torres, Rosa Vidal, etc.
- ¿La sincronización debe ser inmediata (webhook/evento) o puede ser por lotes cada cierto tiempo?
- ¿Hace falta que Hasky pueda buscar el pedido por algún otro dato además del ID interno de la plataforma (ej. nombre del cliente, o número de pedido más corto/legible para que un asesor lo escriba en el chat)? El ID actual (`cmsc8t341009kt8d0xe4fvi2j`) no es algo que un asesor vaya a teclear de memoria.

## Credenciales

Vas a necesitar URL de la instancia, base de datos, usuario y API key de Odoo. Pídeselos a Alberto directamente y guárdalos en variables de entorno — nunca hardcodeados en el código.

## Al terminar, reporta

- Campos creados en `stock.picking` (nombres exactos).
- Dónde quedó la lógica de sincronización en el backend.
- Resultado de la prueba con los pedidos reales.
- Respuestas de Alberto a las preguntas abiertas, y qué falta ajustar según eso.
