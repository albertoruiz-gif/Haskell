# Prompt para Claude Code (VS Code) — Facturación automática al confirmar pago (Odoo, Haskell Perú)

Copia y pega todo lo que sigue como prompt inicial en Claude Code.

---

## Contexto de negocio

Trabajo con Haskell Cosméticos (Perú), una empresa de productos de tratamiento capilar. Estamos migrando su operación a **Odoo Online (plan Enterprise vía SaaS)**. Odoo va a operar como espejo/maestro durante la transición: registra ventas, pagos, cobros, y debe emitir boletas y facturas electrónicas (SUNAT).

La empresa vende por 3 canales, cada uno con una lógica de cobro distinta:

- **Minorista**: el asesor de ventas cobra el anticipo directamente al cliente final (100% por adelantado, no hay cuenta por cobrar de cliente), y luego remite el 80% de lo cobrado a la empresa, quedándose con el 20% de comisión.
- **Retail**: venta a crédito o consignación, discrecional según la línea de crédito negociada con cada cliente (no hay plazo/monto fijo — es caso por caso).
- **Salón de Belleza**: igual que Retail — crédito o consignación, discrecional por cliente.

En Perú, el documento tributario a emitir depende del tipo de cliente/canal:
- **Boleta de venta** → canal Minorista (venta a consumidor final).
- **Factura** → canales Retail y Salón de Belleza (venta a negocios, con RUC).

## Objetivo de esta tarea

Automatizar en Odoo: cuando se confirme el pago de una venta, disparar automáticamente la emisión del documento correcto (boleta si es Minorista, factura si es Retail o Salón de Belleza), sin intervención manual.

## Restricción técnica importante — léela antes de proponer una solución

Esta instancia es **Odoo Online (SaaS)**, lo cual significa que **no se pueden instalar módulos Python personalizados** (a diferencia de Odoo Community autoalojado). Todo lo que construyas tiene que hacerse con las piezas de configuración nativas de Odoo, creadas por su API externa (XML-RPC o JSON-RPC), sin tocar código fuente del servidor:

- **Campos personalizados** (`ir.model.fields`) en los modelos que ya existen (`sale.order`, `account.move`, etc.).
- **Acciones de Servidor** (`ir.actions.server`), tipo "Execute Code" — son snippets de Python que corren dentro del sandbox de Odoo, se crean como registros normales vía API, no requieren instalar nada.
- **Reglas de Automatización** (`base.automation`) — disparan una Acción de Servidor cuando un modelo cumple una condición (ej. cambio de estado de un campo).

No propongas un módulo Odoo instalable ni archivos `.py` de un módulo — no funcionará en este plan. Todo se crea como *datos de configuración* usando la API externa de Odoo.

## Prerrequisito a verificar primero (no asumir que ya funciona)

Antes de automatizar nada, verifica que la instancia de Odoo pueda emitir boletas y facturas electrónicas válidas ante SUNAT hoy — probando manualmente al menos un caso de cada tipo. Esto depende del módulo de localización peruana (`l10n_pe_edi`, nativo de Odoo, o el de terceros `l10n_pe_edi_odoofact` si el nativo no está disponible en este plan). Si la emisión electrónica no está funcionando todavía, ese es un bloqueante previo a esta automatización — repórtalo en vez de construir la automatización sobre algo que no funciona.

## Prerrequisito adicional — de dónde sale el precio real de cada línea (ofertas)

Ya confirmamos por separado que Odoo no tiene visibilidad de las ofertas: el "Precio de venta" cargado en cada producto de Odoo es siempre el precio regular, no refleja si hubo una oferta real activa en la plataforma web al momento de la venta. Esto es crítico para esta tarea, porque la boleta/factura tiene que reflejar el precio que realmente se le cobró al cliente, no el precio de lista de Odoo.

Antes de construir el disparador de facturación, confirma con Alberto: ¿el pedido — con sus líneas de producto, cantidades y el precio unitario realmente cobrado (regular u oferta) — ya se sincroniza, o está planeado que se sincronice, desde la plataforma hacia un `sale.order` (o directamente hacia las líneas de `account.move`) en Odoo? Esa sincronización es un paso previo y distinto de esta tarea (parecido en espíritu al de Delivery que se hizo aparte, pero para pedidos/ventas).

Si esa sincronización de pedidos con precio real todavía no existe: repórtalo como bloqueante, no lo construyas como parte de esta tarea sin confirmarlo primero, y no asumas que puedes recalcular el monto a facturar desde el "Precio de venta" nativo de Odoo — estaría mal cada vez que se aplicó una oferta real. Decide con Alberto si primero hay que resolver ese paso de sincronización antes de automatizar la emisión de boleta/factura.

## Qué construir

1. **Campo "Canal de venta"**: confirma si ya existe un campo que distinga Minorista / Retail / Salón de Belleza en `sale.order` y/o `account.move`. Si no existe, créalo (selection field) vía API.
2. **Mapeo canal → tipo de documento SUNAT**: Minorista → Boleta de venta (`l10n_latam.document.type` código 03); Retail y Salón de Belleza → Factura (código 01).
3. **Acción de Servidor** que, dado un registro de pago/factura, lea el canal y genere/valide el documento del tipo correcto.
4. **Regla de Automatización** que dispare esa Acción de Servidor cuando el estado de pago cambie a confirmado/pagado.
5. Prueba con un caso de cada canal (Minorista, Retail, Salón de Belleza) y reporta el resultado.

## Pregunta de negocio abierta — resuélvela con Alberto antes de fijar el disparador exacto

No asumas esto sin confirmar: en el canal **Minorista**, el cliente le paga al asesor directamente, y el asesor remite después el 80% a la empresa. ¿El disparador de "pago confirmado" debe ser cuando el asesor registra/remite ese 80% a la empresa, o en otro momento del flujo? Pregúntaselo a Alberto directamente antes de implementar esta parte — es una decisión de negocio, no técnica.

Para **Retail y Salón de Belleza**, la asunción razonable es que el disparador es cuando un pago queda conciliado contra la factura (`payment_state == 'paid'` en `account.move`) — confírmalo también, no lo des por sentado sin preguntar.

## Credenciales

Vas a necesitar URL de la instancia, base de datos, usuario y API key de Odoo. Pídeselos a Alberto directamente (no los asumas ni los inventes) y guárdalos en variables de entorno — nunca hardcodeados en el código.

## Al terminar, reporta

- Qué campos, Acciones de Servidor y Reglas de Automatización creaste (con sus nombres/IDs en Odoo).
- Cómo probarlo manualmente.
- Qué quedó pendiente de confirmar con Alberto (incluida la pregunta del disparador de Minorista, y si existe o falta el paso de sincronización de pedidos con precio real desde la plataforma, si no te las respondió antes de implementar).
