# Prompt para Claude Code (VS Code) — Trasladar las ofertas de la plataforma a Odoo

Copia y pega esto en Claude Code, dentro del repo `plataforma-comercial-multicanal`. Investiga primero, no asumas nada del modelo de datos sin leerlo.

---

## Contexto

Ya confirmamos (investigación previa) que las ofertas reales de productos existen como un modelo separado ("Offer") en esta plataforma, distinto del precio de venta regular y distinto del "precio de asesor". Odoo hoy no tiene visibilidad de esto: el "Precio de venta" cargado en cada producto de Odoo es siempre el precio regular. Esto bloquea dos cosas que ya están en marcha: la automatización de facturación (que necesita facturar el monto real cobrado, no el de lista) y el agente Hasky en Odoo (que hoy responde que no tiene información de ofertas, precisamente porque Odoo no las tiene).

## Objetivo de esta tarea

Que las ofertas activas de un producto se reflejen en Odoo, para que cualquier proceso de Odoo (facturación, Hasky, reportes) pueda leer el precio real vigente sin depender de la plataforma web.

## Restricción técnica — igual que en las tareas anteriores

Odoo Online (SaaS): no se instalan módulos Python. Todo vía API externa (XML-RPC/JSON-RPC) sobre configuración nativa.

## Enfoque recomendado — Listas de precios de Odoo

Odoo tiene un mecanismo nativo que encaja con esto sin necesitar nada custom: **Listas de precios** (`product.pricelist`, con líneas `product.pricelist.item`). Cada línea permite fijar un precio o descuento para un producto específico, con fecha de inicio y fin — exactamente el mismo concepto que un "Offer" con vigencia. Verifica primero si la funcionalidad "Listas de precios múltiples" está habilitada en esta instancia (Ventas → Configuración → Precios); si no lo está, es un toggle de configuración, no requiere instalar nada.

## Qué hacer

1. En el código de esta plataforma, localiza el modelo "Offer": campos exactos (producto, precio o porcentaje de descuento, fecha de inicio, fecha de fin, si está activo). No asumas la estructura, léela.
2. Confirma que "Listas de precios múltiples" esté habilitada en Odoo; si no, actívala vía configuración.
3. Crea (si no existe) una lista de precios en Odoo dedicada a ofertas (ej. "Ofertas vigentes"), vía API.
4. Implementa la sincronización: cuando se crea, activa, modifica o desactiva un "Offer" en la plataforma, crea/actualiza/desactiva el `product.pricelist.item` correspondiente en Odoo — matcheando el producto por el código HSK-xxxx (que ya está cargado como referencia interna en cada `product.template` de Odoo). Usa `date_start`/`date_end` del pricelist item para reflejar la vigencia real de la oferta.
5. Prueba con 2-3 ofertas reales activas hoy en la plataforma: confirma que en Odoo, al consultar el precio de ese producto con esa lista de precios, se refleja el precio de oferta dentro del rango de fechas, y el precio regular fuera de ese rango.
6. Decide con el usuario (Alberto) si la sincronización es en vivo (evento) o por lotes — no lo asumas.

## Fuera de alcance de esta tarea (no lo implementes, solo repórtalo si aplica)

- Actualizar el prompt de Hasky para que use esta lista de precios en vez de decir "no tengo información de ofertas" — eso se hace después, en otra sesión, una vez esto esté funcionando.
- Conectar esto con la automatización de facturación — también es un paso posterior.

## Credenciales

URL de instancia, base de datos, usuario y API key de Odoo: pídeselos a Alberto directamente, en variables de entorno.

## Al terminar, reporta

- Estructura real del modelo "Offer" que encontraste (campos y archivo).
- Si "Listas de precios múltiples" ya estaba habilitada o la activaste.
- Nombre/ID de la lista de precios y cómo matcheas producto (confirma que el código HSK-xxxx sí está en la referencia interna de cada producto en Odoo, no lo asumas).
- Resultado de la prueba con ofertas reales.
- Qué decidió Alberto sobre sincronización en vivo vs. por lotes.
