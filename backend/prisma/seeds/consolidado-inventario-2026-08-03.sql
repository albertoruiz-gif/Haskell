-- Consolidado de Inventario 03-08-2026 — fuente: catalogo-haskell/Base_Datos_Haskell_FGS_1.xlsx
-- (hoja "Base Haskell", FGS Importadora Distribuidora y Servicios E.I.R.L.)
-- + confirmación del usuario sobre Champu Jaborandi Anticaida 300 ml (2026-08-12).
--
-- Qué hace: para los 36 productos de esa lista, fija el precio real (Precio
-- Público del Excel) y el stock real (un lote de inventario DISPONIBLE con
-- la cantidad contada), y marca stockConfirmado=true. El resto del catálogo
-- (128 líneas en el momento en que se escribió esto) queda sin tocar —
-- stockConfirmado=false, visible solo por búsqueda exacta de nombre/SKU y
-- sin precio (ver catalog.controller.ts, filtroBusqueda / mapearLinea).
--
-- Ya se aplicó a mano vía SSM en Testeo y Producción el 2026-08-11/12 — este
-- archivo es el registro para que no se pierda y para poder re-aplicarlo si
-- algún día se recrea el volumen de Postgres (ej. entorno local nuevo).
-- Es IDEMPOTENTE: correrlo dos veces no duplica lotes ni pisa nada raro.
--
-- Uso: psql -U <user> -d <db> -f consolidado-inventario-2026-08-03.sql
-- (o vía el mismo patrón de SSM que el resto de las migraciones de datos,
-- ver reference_ssm_deploy_gotchas en memoria del asistente).

BEGIN;

CREATE TEMP TABLE tmp_stock_36 (sku text, precio numeric, stock int);
INSERT INTO tmp_stock_36 (sku, precio, stock) VALUES
  ('HSK-0039', 59, 430),
  ('HSK-0144', 125, 15),
  ('HSK-0041', 59, 481),
  ('HSK-0145', 125, 6),
  ('HSK-0146', 125, 13),
  ('HSK-0043', 55, 461),
  ('HSK-0147', 69, 64),
  ('HSK-0148', 61, 198),
  ('HSK-0149', 45, 186),
  ('HSK-0001', 52, 219),
  ('HSK-0062', 59, 56),
  ('HSK-0060', 59, 59),
  ('HSK-0064', 55, 18),
  ('HSK-0113', 55, 46),
  ('HSK-0115', 55, 45),
  ('HSK-0110', 55, 29),
  ('HSK-0074', 55, 0), -- Champu Jaborandi Anticaida 300 ml: stock real 0, confirmado por el usuario (no "s/d")
  ('HSK-0077', 55, 35),
  ('HSK-0079', 55, 64),
  ('HSK-0088', 55, 211),
  ('HSK-0150', 120, 27),
  ('HSK-0151', 55, 222),
  ('HSK-0152', 120, 33),
  ('HSK-0153', 125, 49),
  ('HSK-0154', 55, 260),
  ('HSK-0155', 64, 77),
  ('HSK-0156', 68, 169),
  ('HSK-0157', 52, 112),
  ('HSK-0158', 120, 27),
  ('HSK-0012', 55, 233),
  ('HSK-0159', 55, 248),
  ('HSK-0160', 120, 34),
  ('HSK-0161', 125, 38),
  ('HSK-0162', 55, 262),
  ('HSK-0163', 64, 24),
  ('HSK-0164', 43, 288);

UPDATE catalog_lines cl
SET "pvpCampania" = t.precio,
    "stockConfirmado" = true
FROM tmp_stock_36 t
WHERE cl.sku = t.sku;

-- Solo crea el lote si no existe ya uno con este numeroLote para esa línea
-- (evita duplicar stock si el script se corre más de una vez). Los stock=0
-- (Jaborandi 300ml) no generan lote — no hay nada que recibir.
INSERT INTO lotes_inventario (id, "catalogLineId", "numeroLote", "cantidadRecibida", "cantidadDanada", estado, "ubicacionAlmacen", "fechaLiberacion", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, cl.id, 'INV-2026-08-03', t.stock, 0, 'DISPONIBLE', 'Almacen principal', now(), now(), now()
FROM tmp_stock_36 t
JOIN catalog_lines cl ON cl.sku = t.sku
WHERE t.stock > 0
  AND NOT EXISTS (
    SELECT 1 FROM lotes_inventario li WHERE li."catalogLineId" = cl.id AND li."numeroLote" = 'INV-2026-08-03'
  );

-- stockDisponible = la cantidad del lote (no hay reservas activas sobre
-- estos SKUs recién confirmados, así que la suma es directa).
UPDATE catalog_lines cl
SET "stockDisponible" = t.stock
FROM tmp_stock_36 t
WHERE cl.sku = t.sku;

-- Fotos reales exactas — ya estaban subidas en /uploads/catalogo de la carga
-- original de 143 productos, solo no estaban enlazadas a estos 21 SKUs
-- nuevos (HSK-0144 a HSK-0164).
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/manteiga-nutritiva-murumuru-900g.webp' WHERE sku = 'HSK-0161' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/manteiga-nutritiva-murumuru-300g.webp' WHERE sku = 'HSK-0162' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/polpa-em-creme-murumuru-haskell-150g.webp' WHERE sku = 'HSK-0163' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/seiva-nutritiva-murumuru-35ml.webp' WHERE sku = 'HSK-0164' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/shampoo-cavalo-forte-1l.webp' WHERE sku = 'HSK-0144' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/condicionador-cavalo-forte-1l.webp' WHERE sku = 'HSK-0145' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/mascara-de-tratamento-cavalo-forte-900g.webp' WHERE sku = 'HSK-0146' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/leave-in-cavalo-forte-150g.webp' WHERE sku = 'HSK-0147' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/selante-de-pontas-cavalo-forte-35ml.webp' WHERE sku = 'HSK-0148' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/complexo-fortalecedor-cavalo-forte-35ml.webp' WHERE sku = 'HSK-0149' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/shampoo-mandioca-haskell-1l.webp' WHERE sku = 'HSK-0150' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/condicionador-mandioca-haskell-300ml.webp' WHERE sku = 'HSK-0151' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/condicionador-mandioca-haskell-1l.webp' WHERE sku = 'HSK-0152' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/mascara-de-tratamento-mandioca-900g.webp' WHERE sku = 'HSK-0153' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/mascara-de-tratamento-mandioca-300g.webp' WHERE sku = 'HSK-0154' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/leave-in-mandioca-haskell-150gr.webp' WHERE sku = 'HSK-0155' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/ativador-de-cachos-mandioca-240g.webp' WHERE sku = 'HSK-0156' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/reparador-de-pontas-mandioca-35ml.webp' WHERE sku = 'HSK-0157' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/shampoo-murumuru-haskell-1l.webp' WHERE sku = 'HSK-0158' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/condicionador-murumuru-haskell-300ml.webp' WHERE sku = 'HSK-0159' AND "imagenUrl" IS NULL;
UPDATE catalog_lines SET "imagenUrl" = '/uploads/catalogo/condicionador-murumuru-haskell-1l.webp' WHERE sku = 'HSK-0160' AND "imagenUrl" IS NULL;

COMMIT;

-- Verificación
SELECT sku, nombre, "pvpCampania", "stockConfirmado", "stockDisponible", ("imagenUrl" IS NOT NULL) AS tiene_imagen
FROM catalog_lines
WHERE sku IN (SELECT sku FROM tmp_stock_36)
ORDER BY sku;
