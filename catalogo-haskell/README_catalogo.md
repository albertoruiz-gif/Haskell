# Catalogo de productos Haskell — estructura de datos + catalogo ampliado

Entregable generado a partir de `Especificacion_Solicitud_Scraping_Haskell.md`. Cubre el diseno de la estructura de base de datos en Postgres y un catalogo real (no simulado) de productos individuales del sitio, traducido al espanol latinoamericano neutro.

## Contenido de esta carpeta

| Archivo | Que es |
|---|---|
| `esquema_postgres.sql` | DDL completo de Postgres para el catalogo maestro: `categoria`, `producto`, `producto_categoria`, `producto_variante`, `producto_imagen`, `producto_atributo`, `producto_historial_precio`, `scraping_run`, `scraping_error`. |
| `productos_haskell.xlsx` | Excel con 3 hojas: `Productos` (143 productos reales en 29 lineas), `Categorias_Lineas` (resumen por linea), `Notas_Metodologicas` (alcance, fuente, metodologia, supuestos). |
| `build_excel.py` | Script original que genero la primera muestra (20 productos, 6 lineas). |
| `build_excel_full.py` | Script que genera la version ampliada (143 productos, 29 lineas) — combina `build_excel.py` con `generar_productos_nuevos.py`. |
| `generar_productos_nuevos.py` | Datos y plantillas de los 123 productos agregados en la ampliacion. |
| `agregar_precios_pen.py` | Script que agrega la conversion a soles peruanos (PEN) y el PVP Peru al archivo Excel. |
| `emparejar_imagenes.py` | Script que empareja los archivos .webp de `Co Work/Haskell/imagenes_principales` con cada fila del catalogo (por linea, tipo de producto y tamano). |

## Alcance actual

**143 productos reales**, en **29 lineas** — todas las lineas de tratamiento capilar publicadas en `haskellcosmeticos.com.br` al momento de la extraccion (24/07/2026). Se navego cada pagina de linea de forma directa y se tomaron los datos factuales publicados: nombre, tamano, precio regular y precio de oferta en BRL, y activos principales.

**Que queda fuera intencionalmente:**

- **Kits/combos.** El sitio vende decenas de kits (2 a 7 productos combinados con descuento) ademas de los productos individuales. No se cargaron como filas propias para no duplicar los productos que ya los componen.
- **Coloracion, ingredientes INCI e imagenes.** No estan incluidos en esta pasada; se completan corriendo el exportador Playwright completo (`npm run scrape`, mencionado en la especificacion original) que si visita cada ficha de producto individual.
- **2 lineas con datos parciales** (Mandioca, Queratina & Provit B5): la pagina solo mostraba precio individual confirmado para 1 producto de cada una — el resto de los items mencionados en el texto de la linea solo aparecian dentro de kits, sin precio individual visible, asi que no se inventaron precios para completarlos.

**Sobre la redaccion de las descripciones:** los primeros 20 productos (lineas Cavalo Forte, Bendito Loiro, Matcha, Murumuru, Frizz Cancelado, Cachos Sim!) tienen descripcion, beneficios y modo de uso redactados ficha por ficha. Los 123 productos agregados despues usan una redaccion propia generada por plantilla segun el tipo de producto (champu, mascarilla, leave-in, tonico, etc.) combinada con el proposito de cada linea — mas eficiente para cubrir el catalogo completo, pero menos especifica que una redaccion individual. En ningun caso se copiaron o tradujeron literalmente los textos de marketing del sitio; toda la redaccion en espanol es propia, basada solo en los datos factuales (nombre, activos, tipo de producto).

Ningun precio fue inventado: donde el sitio no mostraba precio de oferta, la celda queda vacia.

## Para obtener el catalogo 100% completo (kits, INCI, imagenes, coloracion)

1. Ejecutar `npm run scrape` del exportador Node.js + Playwright ya incluido en el proyecto principal, que visita cada ficha de producto individual.
2. Cargar el resultado (JSON/CSV) contra `esquema_postgres.sql`.
3. Vincular `producto_variante.sku_variante` con `CatalogLine.sku` del backend de la plataforma comercial cuando se arme un catalogo de campana.

## Precios en soles peruanos (PEN) y PVP Peru

El Excel incluye una hoja nueva, **Parametros_PEN**, con dos valores editables:

- Tipo de cambio: **0.67 soles (PEN) por 1 real brasileno (BRL)**.
- Margen sobre el precio convertido: **25%**.

En la hoja **Productos** se agregaron 4 columnas con formulas (no valores fijos) que apuntan a esos dos parametros:

- `precio_regular_pen` = precio_regular_brl x tipo de cambio.
- `pvp_peru_regular_pen` = precio_regular_pen x (1 + margen) — este es el **precio de venta al publico (PVP) en Peru**.
- `precio_oferta_pen` y `pvp_peru_oferta_pen` — el mismo calculo aplicado al precio de oferta en BRL, cuando existe.

Si se cambia el tipo de cambio o el margen en `Parametros_PEN!B2` o `Parametros_PEN!B3`, las 143 filas del catalogo recalculan solas (no hay que tocar cada fila).

## Imagenes de producto

Las columnas `imagen_principal_local` e `imagenes_adicionales` de la hoja Productos se completaron a partir de los archivos .webp que vos guardaste en `Co Work/Haskell/imagenes_principales` (nombrados por producto, sin codigo). El emparejamiento se hizo por 3 criterios combinados (linea, tipo de producto y tamano) para evitar errores como confundir un shampoo con un acondicionador de la misma linea:

- **143 de 143 productos** quedaron con imagen asignada.
- El script no copia el contenido de las imagenes: solo guarda el **nombre del archivo** en la celda, asumiendo que la carpeta `imagenes_principales` queda junto al proyecto para que el backend la lea de ahi (o se suba tal cual a donde corresponda: S3, `/public` del frontend, etc.).

## Traduccion

Todo el contenido en espanol esta en **espanol latinoamericano neutro** (sin voseo argentino tipo "tenes/podes/vos"), a pedido explicito. Se conservaron sin traducir los nombres de marca y de linea (Cavalo Forte, Se Curve, Jaborandi, etc.).

## Como se relaciona con el proyecto principal

Este esquema es **independiente** del backend NestJS/Prisma de la plataforma comercial (`Co Work/Haskell/plataforma-comercial-multicanal/backend/prisma/schema.prisma`): es el catalogo "maestro traducido" scrapeado de Haskell Brasil, no el catalogo de campana por canal. Se conectan por SKU: `producto_variante.sku_variante` (aca) ↔ `CatalogLine.sku` (alla).
