# Parametrización de Odoo — Haskell_Distribuidor (Compañía 2)

Registro de toda la configuración hecha en Odoo (vía API externa JSON-RPC, sin instalar módulos — plan Online/SaaS) para que sirva de checklist al implementar una empresa nueva en esta misma instancia. No incluye ninguna contraseña ni credencial real — esas siempre se piden a mano por fuera de este documento.

Instancia: la misma cuenta Odoo 19 Online usada por Efficax (Compañía 1) y Haskell_Perú (Compañía 3). Toda llamada a la API ancla explícitamente `company_id`/`allowed_company_ids` — ver `backend/src/modules/odoo/odoo.client.ts`.

---

## 1. Multi-compañía

- Cada compañía es independiente: catálogo, almacenes, plan de cuentas, SUNAT — nada se hereda automáticamente entre compañías, hay que configurar cada una desde cero.
- El cliente JSON-RPC (`OdooClient.execute()`) ancla **toda** llamada (lectura o escritura) al `ODOO_COMPANY_ID` configurado por variable de entorno — nunca se opera "a ciegas" sobre la compañía por defecto del usuario técnico.
- Para replicar: definir el `company_id` de la empresa nueva en Odoo (Ajustes → Usuarios y compañías → Compañías) y usarlo en `ODOO_COMPANY_ID` de esa integración.

## 2. Catálogo de productos

- Import inicial hecho por código propio (no el importador nativo de Odoo), matcheando por `default_code` = código interno (ej. `HSK-xxxx`).
- Campos usados de `product.product`: `default_code`, `name`, `list_price` (Precio de venta), `standard_price` (Costo — **nunca** exponerlo a un asesor ni a un agente de IA).
- Para replicar: definir el prefijo de código interno de la empresa nueva (equivalente a `HSK-`) y cargar productos con `company_id` de esa compañía (o `False` si son compartidos entre compañías).

## 3. Listas de precios — Ofertas de la plataforma web → Odoo

**Objetivo:** que el precio de oferta real (no el de lista) sea visible en Odoo para facturación/Hasky/reportes, sin depender de la plataforma web.

- **Ajustes → Ventas → Precio → "Tarifas"**: debe estar con el check activado (equivale a "Listas de precios múltiples" / *Pricelists*). Ya estaba activado en esta instancia — si en una empresa nueva no lo está, es un toggle de configuración, no requiere instalar nada.
- Se creó una `product.pricelist` dedicada llamada **"Ofertas vigentes"** (moneda PEN, `company_id` de la compañía), separada de la lista "Por defecto".
- Cada oferta activa de la plataforma se refleja como un `product.pricelist.item`:
  - `pricelist_id`: la lista "Ofertas vigentes" de esa compañía.
  - `applied_on`: `'0_product_variant'`.
  - `product_id`: resuelto buscando `product.product` por `default_code = SKU`.
  - `compute_price`: `'fixed'`, `fixed_price`: precio real ya calculado (precio fijo, o PVP × (1 − descuento%)).
  - `date_start` / `date_end`: vigencia exacta de la oferta.
- Al desactivarse/borrarse una oferta, el `pricelist.item` correspondiente se **elimina** (`unlink`) — en esta instancia `product.pricelist.item` no tiene campo `active`, no se puede "desactivar", hay que borrarlo.
- Sincronización **en vivo** (por evento, al crear/desactivar la oferta), best-effort: si Odoo falla, la oferta igual queda creada en la plataforma web (que sigue siendo la fuente de verdad) — solo se registra en el log.
- Código: `backend/src/modules/odoo/odoo.client.ts` (`crearItemPricelistOferta`, `eliminarItemPricelist`) y `backend/src/modules/campaigns/campaigns.service.ts`.
- Para replicar: crear la pricelist "Ofertas vigentes" de la compañía nueva (mismo nombre exacto, el código la busca por nombre) y confirmar que el código interno del producto (`default_code`) siga el mismo patrón de matching.

## 4. Número de pedido legible (plataforma web)

No es una parametrización de Odoo en sí, pero es la clave que conecta la plataforma con Odoo en varias integraciones (ver secciones 5 y 6):

- Formato: `HSK_<CANAL>_<número correlativo con ceros a la izquierda>`, ej. `HSK_RET_000123`.
- Siglas de canal: `COMERCIO_MINORISTA` → `MIN`, `RETAIL` → `RET`, `SALONES_BELLEZA` → `SAL`.
- Para una empresa nueva: cambiar el prefijo (`HSK_`) por las siglas de esa compañía. Código: `backend/src/common/numero-pedido.util.ts` y su espejo `frontend/src/lib/numeroPedido.ts`.

## 5. Almacenes e Inventario

**Hallazgo:** ninguna compañía nueva tiene almacén por defecto — hay que crearlo antes de poder generar cualquier `stock.picking`.

- Se crearon dos `stock.warehouse` para Haskell_Distribuidor:
  - **Almacén Central - Los Olivos** (código `OLIV`)
  - **Almacén Periférico - San Borja** (código `SANB`)
- Crear un `stock.warehouse` genera automáticamente sus tipos de operación (`stock.picking.type`) — entre ellos **"Órdenes de entrega"** (código `outgoing`), que es el que se usa para reflejar despachos.
- ⚠️ Cuidado al buscar el tipo de operación de salida: filtrar solo por `code = 'outgoing'` no alcanza — el módulo de Punto de Venta también registra un tipo de salida con ese mismo código ("Pedidos de TPV"). Hay que filtrar también por `name = 'Órdenes de entrega'` (ver bug corregido en `odoo.client.ts`, método `obtenerTipoOperacionEntrega`).
- Por ahora, todas las entregas de la plataforma se reflejan bajo el **Almacén Central - Los Olivos** — la plataforma todavía no distingue desde qué almacén físico sale cada pedido. El Almacén Periférico - San Borja existe pero no se usa todavía en el código.
- Para replicar: crear los almacenes reales de la empresa nueva (`stock.warehouse`, con `company_id` correcto) antes de tocar cualquier integración de Delivery.

## 6. Delivery de la plataforma → Odoo (`stock.picking`)

**Objetivo:** que el estado de entrega de un pedido (vive en la plataforma, módulo `/delivery`) se refleje en Odoo sin que el pedido tenga que existir como venta (`sale.order`).

Campos personalizados creados en `stock.picking` (vía `ir.model.fields`, `state: 'manual'`):

| Campo | Tipo | Uso |
|---|---|---|
| `x_pedido_externo_id` | char | Número de pedido legible (sección 4) — clave de matching entre plataforma y Odoo |
| `x_transportista_id` | many2one → `res.partner` | Transportista asignado |
| `x_en_transito` | boolean | Pedido en ruta |
| `x_recibido_nombre` | char | Nombre de quien recibió |
| `x_recibido_dni` | char | DNI de quien recibió |
| `x_devuelto_causa` | text | Causa de devolución/entrega fallida |
| `x_estado_delivery` | char | Clasificación de SLA: `A_TIEMPO` / `ATRASADO` / `POSTERGADO` (misma lógica que la pantalla Almacén → Transporte del panel admin) |

- El transportista se refleja en Odoo como **contacto proveedor** (`res.partner`, `supplier_rank: 1`, `company_type: 'person'`) — porque se le factura cuando se le paga. Se guarda el `id` de ese contacto en `Transportista.odooPartnerId` (Prisma) para no duplicarlo en cada sincronización.
- El `stock.picking` se busca por `x_pedido_externo_id`; si no existe se crea (con `picking_type_id`/`location_id`/`location_dest_id` del Almacén Central - Los Olivos), si existe se actualiza (`write`).
- Sincronización **en vivo** (al asignar transportista, aceptar bultos, marcar en ruta, confirmar entrega o registrar entrega fallida), best-effort — igual que en la sección 3.
- Código: `backend/src/modules/odoo/odoo.client.ts` (`upsertTransportistaComoPartner`, `sincronizarDeliveryAOdoo`) y `backend/src/modules/operaciones/operaciones.service.ts`.
- Para replicar: crear los mismos 7 campos custom en `stock.picking` para la compañía nueva (los campos custom son globales al modelo, no por compañía — solo hace falta crearlos una vez en toda la instancia, no por cada empresa).

## 7. Agente de IA "Hasky" — Herramienta de precio y stock

**Objetivo:** que el agente de IA nativo de Odoo (Live Chat) pueda confirmar precio y stock real de un producto, no solo identificarlo por catálogo.

- Mecanismo confirmado en esta versión (Odoo 19): una **Acción de Servidor** (`ir.actions.server`, `state: 'code'`) se vuelve Herramienta de IA marcando el campo booleano **`use_in_ai = true`**, más:
  - `ai_tool_description`: texto que le explica a la IA cuándo usar la herramienta.
  - `ai_tool_schema`: JSON Schema de los parámetros (cada propiedad del schema llega como variable de Python ya inyectada en el código — no hace falta parsear nada a mano).
  - `ai_tool_has_schema: true`, `ai_tool_allow_end_message: false` (esta herramienta no termina la conversación, solo aporta datos).
- Las Herramientas se agrupan en **Temas** (`ai.topic`), y un Tema se cuelga de un Agente (`ai.agent`) vía el campo `topic_ids` (many2many). Se creó el Tema **"Consulta de producto"** con la herramienta adentro, y se agregó a `Hasky.topic_ids`.
- ⚠️ El sandbox de Python de las Acciones de Servidor **prohíbe `import`** (error `forbidden opcode(s): IMPORT_NAME`) — hay que resolver todo con builtins puros (ej. para quitar el tamaño/presentación del nombre de un producto, se usó `.split()` + comparación de tokens en vez de una expresión regular con `import re`).
- La herramienta creada (`Hasky: Consultar precio y stock por producto`) busca el producto por `default_code` o `name`, encuentra las "presentaciones hermanas" (mismo nombre base, distinto tamaño) recortando el último token si es una unidad conocida (`ml`, `g`, `kg`, `l`, `lt`) precedida de un número, y devuelve `codigo`, `nombre`, `precio_venta` (`list_price`) y `stock_disponible` (`qty_available`) — **nunca** `standard_price` (Costo).
- Filtra siempre por la compañía (`company_id in [False, <id>]`), fijando el contexto (`allowed_company_ids`/`company_id`) dentro del propio código Python.
- Probado con HSK-0017 en el botón "Prueba" de Hasky — confirmado funcionando por Alberto.
- Para replicar: el mismo patrón sirve para cualquier compañía — solo cambia el `company_id` fijado dentro del código de la Acción de Servidor y, si aplica, el rango válido de códigos internos (en Haskell es HSK-0001 a HSK-0143, ver reglas del `system_prompt` de Hasky).

## 8. Facturación electrónica SUNAT — Compañía 2 (Haskell_Distribuidor)

**Estado: en progreso, no completado.**

Contexto: Efficax (Compañía 1) ya tiene facturación SUNAT funcionando con su propio RUC. Haskell_Distribuidor es un RUC distinto e independiente — no hereda nada de Efficax.

### 8.1 Datos de la compañía (completado)

Campos en `res.company` (id de la compañía):
- `vat`: RUC (10095397757).
- `l10n_pe_edi_provider`: seleccionado `'sunat'` (envío directo a SUNAT con certificado propio — las otras opciones son `'digiflow'` para un OSE como Estela, o `'iap'` para el servicio propio de Odoo).
- `l10n_pe_edi_provider_username` / `l10n_pe_edi_provider_password`: usuario y Clave SOL de SUNAT para ese RUC (credencial del portal de SUNAT, **distinta** de la contraseña del certificado digital).
- `l10n_pe_edi_certificate_id`: many2one → `certificate.certificate` (ver 8.2).
- `l10n_pe_edi_test_env`: `true` — Odoo sí tiene ambiente de pruebas nativo; se dejó activado para las primeras pruebas, hay que confirmarlo con Alberto antes de pasar a `false` (emisión real).

### 8.2 Certificado digital (completado)

- Modelo genérico `certificate.certificate` (compartido entre países/usos en Odoo 17+, no es exclusivo de Perú).
- Campos usados: `name`, `company_id`, `content` (el archivo `.p12`/`.pfx` en base64), `pkcs12_password`.
- Tras crearlo, Odoo valida automáticamente el certificado (`is_valid`, `date_end`, `subject_common_name`) — quedó validado, vence 2029, titular y RUC coinciden con lo esperado.
- **Nunca** se transfirió la contraseña ni el archivo por texto plano en un comando — el archivo se copió directo al contenedor (`docker compose cp`) y la contraseña se leyó desde un archivo temporal ignorado por git, nunca como argumento de línea de comandos ni impresa en consola. Ambos se borraron del contenedor apenas se confirmó que el certificado cargó bien.

### 8.3 Plan de cuentas / Localización fiscal (pendiente de confirmar)

**Hallazgo clave:** que el país fiscal de una compañía sea "Perú" (`account_fiscal_country_id`) y que los módulos `l10n_pe*` estén instalados a nivel de toda la base de datos **no crea automáticamente** el plan de cuentas de esa compañía. Haskell_Distribuidor tenía **0 cuentas contables, 0 diarios, 0 impuestos** pese a tener el país fiscal ya en "Perú".

Cómo se carga correctamente (encontrado en la práctica, no documentado en el prompt original):
1. Con la compañía correcta activa (selector arriba a la derecha),
2. **Ajustes generales de Odoo** (no dentro de la app Contabilidad) → buscar "Fiscal" o "Localización",
3. Sección **Contabilidad → Localización Fiscal**, campo **"Paquete"** → elegir **"PE Perú"**,
4. Guardar.

Al momento de escribir esto, Alberto acababa de guardar el paquete — quedó pendiente de verificar que se hayan generado cuentas/diarios/impuestos.

### 8.4 Diarios de Boleta y Factura (pendiente, bloqueado por 8.3)

- Referencia: Efficax (Compañía 1) solo tiene diarios de **Factura** (no emite boleta, es una empresa de servicios B2B) — ej. `account.journal` "Facturas Electronicas/Mercaderia y Servicios" (código `INV3`, `l10n_latam_use_documents: true`, con una cuenta de ingresos como `default_account_id`).
- Haskell sí necesita **ambos** (Boleta para canal Minorista, Factura para Retail y Salones de Belleza — ver `catalogo-haskell/PROMPT_facturacion_automatica_odoo.md`).
- No se pudieron crear todavía porque no existe ninguna cuenta de ingresos en la Compañía 2 (depende de 8.3).
- Códigos SUNAT de referencia (catálogo `l10n_latam.document.type`, global a la instancia, no por compañía): Factura = `01` / prefijo `F`, Boleta = `03` / prefijo `B`.
- Alberto indicó: iniciar con la misma estructura que ya usa Efficax como referencia, agregando el diario de Boleta que Efficax no tiene.

### 8.5 Pendiente aparte, no bloqueante para lo anterior

- `backend/src/modules/orders/orders.service.ts:261` — el pedido que se envía a Odoo hoy manda `odooProductId: 0` (hardcodeado, un TODO ya existente) en vez del producto/precio real. Hay que resolver esto antes de poder automatizar la emisión de boleta/factura al confirmarse el pago — es una tarea aparte, no mezclarla con la configuración de SUNAT.

---

## Checklist rápido para una empresa nueva

1. Crear la compañía en Odoo (Ajustes → Usuarios y compañías) y definir su `ODOO_COMPANY_ID` en las variables de entorno de la integración que corresponda.
2. Cargar catálogo de productos con su propio prefijo de código interno.
3. Crear su(s) almacén(es) (`stock.warehouse`) — nada de Inventario funciona sin esto.
4. Si va a usar la sincronización de Ofertas: crear su propia `product.pricelist` "Ofertas vigentes".
5. Si va a usar Delivery→Odoo: los campos custom de `stock.picking` (sección 6) son globales, no hay que recrearlos — solo verificar que el código apunte al almacén/tipo de operación correcto de la empresa nueva.
6. Si va a facturar por SUNAT: RUC + certificado + Clave SOL (con el titular correcto) → Ajustes → Localización Fiscal → elegir "PE Perú" y guardar **antes** de crear diarios → crear diarios de Boleta/Factura → probar un comprobante de cada tipo en ambiente de pruebas antes de pasar a producción.
