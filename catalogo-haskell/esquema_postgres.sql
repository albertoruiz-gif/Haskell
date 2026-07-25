-- =====================================================================
-- Esquema PostgreSQL — Catálogo de productos Haskell (bilingüe pt-BR/es)
-- Basado en: Especificacion_Solicitud_Scraping_Haskell.md, sección 12
-- (entidades recomendadas: Product, Category, ProductCategory,
-- ProductVariant, ProductImage, ProductAttribute, ProductPriceHistory,
-- ScrapingRun, ScrapingError) + estructura del JSON de la sección 7.
--
-- Este esquema es INDEPENDIENTE del backend NestJS/Prisma de la
-- plataforma comercial (backend/prisma/schema.prisma) porque cumple un
-- rol distinto: es el catálogo "maestro traducido" que se scrapea de
-- Haskell Brasil. Los SKU de acá se referencian desde CatalogLine.sku
-- en el otro esquema al momento de armar un catálogo de campaña.
-- =====================================================================

CREATE TABLE IF NOT EXISTS categoria (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_original_pt  TEXT NOT NULL,
    nombre_es           TEXT NOT NULL,
    slug                TEXT UNIQUE NOT NULL,
    categoria_padre_id  UUID REFERENCES categoria(id), -- permite categoria > subcategoria > linea como jerarquia
    nivel               TEXT NOT NULL CHECK (nivel IN ('categoria', 'subcategoria', 'linea')),
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS producto (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                    TEXT UNIQUE NOT NULL,
    sku                     TEXT UNIQUE,                 -- puede ser NULL: el sitio publico no siempre lo muestra
    marca                   TEXT NOT NULL DEFAULT 'Haskell',
    linea                   TEXT NOT NULL,                -- ej. "Cavalo Forte", "Bendito Loiro"
    tipo_original_pt        TEXT NOT NULL,                -- ej. "Shampoo"
    tipo_es                 TEXT NOT NULL,                -- ej. "Champú"
    nombre_original_pt      TEXT NOT NULL,
    nombre_es               TEXT NOT NULL,
    descripcion_original_pt TEXT,
    descripcion_es          TEXT,
    beneficios_original_pt  TEXT[],
    beneficios_es           TEXT[],
    propiedades_original_pt TEXT[],
    propiedades_es          TEXT[],
    modo_uso_original_pt    TEXT,
    modo_uso_es             TEXT,
    activos_original_pt     TEXT[],
    activos_es               TEXT[],
    ingredientes_originales  TEXT,                        -- INCI, se conserva sin traducir (spec 4.2)
    recomendado_para_es      TEXT[],                       -- tipo de cabello recomendado
    url_origen               TEXT NOT NULL,
    activo                    BOOLEAN NOT NULL DEFAULT true, -- false = desaparecio de la fuente, no se borra (spec 12)
    primera_deteccion         TIMESTAMPTZ NOT NULL DEFAULT now(),
    ultima_actualizacion       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS producto_categoria (
    producto_id   UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    categoria_id  UUID NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
    PRIMARY KEY (producto_id, categoria_id)
);

-- Cada presentacion/tamaño (300ml, 500ml, etc.) es una variante vendible del producto base
CREATE TABLE IF NOT EXISTS producto_variante (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id           UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    sku_variante          TEXT UNIQUE,
    presentacion_es       TEXT NOT NULL,       -- ej. "300 ml"
    cantidad              NUMERIC(10,2) NOT NULL,
    unidad                TEXT NOT NULL CHECK (unidad IN ('ml','l','g','kg','unidad')),
    moneda                TEXT NOT NULL DEFAULT 'BRL',
    precio_regular        NUMERIC(10,2) NOT NULL,
    precio_oferta         NUMERIC(10,2),
    en_oferta             BOOLEAN NOT NULL DEFAULT false,
    texto_promocion       TEXT,
    disponible            BOOLEAN NOT NULL DEFAULT true,
    estado_stock          TEXT DEFAULT 'disponible',
    creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS producto_imagen (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id    UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    url_original   TEXT NOT NULL,
    ruta_local     TEXT,               -- ej. /images/shampoo-bendito-loiro-300ml/01.webp
    es_principal   BOOLEAN NOT NULL DEFAULT false,
    posicion       INTEGER NOT NULL DEFAULT 1,
    texto_alt_es   TEXT
);

-- Atributo libre clave/valor para lo que no encaja en columnas fijas (sellos, direccion olfativa, etc.)
CREATE TABLE IF NOT EXISTS producto_atributo (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    producto_id     UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    clave           TEXT NOT NULL,
    valor_original_pt TEXT,
    valor_es        TEXT
);

CREATE TABLE IF NOT EXISTS producto_historial_precio (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variante_id      UUID NOT NULL REFERENCES producto_variante(id) ON DELETE CASCADE,
    precio_regular   NUMERIC(10,2) NOT NULL,
    precio_oferta    NUMERIC(10,2),
    registrado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Una fila por cada corrida del exportador (spec seccion 16: resumen de detectados/procesados/errores)
CREATE TABLE IF NOT EXISTS scraping_run (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    iniciado_en            TIMESTAMPTZ NOT NULL DEFAULT now(),
    finalizado_en          TIMESTAMPTZ,
    modo_traduccion        TEXT NOT NULL DEFAULT 'basic', -- 'basic' | 'openai', ver spec seccion 4.4
    productos_detectados   INTEGER DEFAULT 0,
    productos_procesados   INTEGER DEFAULT 0,
    productos_nuevos       INTEGER DEFAULT 0,
    productos_actualizados INTEGER DEFAULT 0,
    productos_omitidos     INTEGER DEFAULT 0,
    productos_con_error    INTEGER DEFAULT 0,
    imagenes_descargadas   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scraping_error (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID NOT NULL REFERENCES scraping_run(id) ON DELETE CASCADE,
    url            TEXT NOT NULL,
    tipo_error     TEXT NOT NULL,
    mensaje        TEXT,
    numero_intento INTEGER NOT NULL DEFAULT 1,
    ocurrido_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_producto_linea ON producto(linea);
CREATE INDEX IF NOT EXISTS idx_producto_tipo ON producto(tipo_es);
CREATE INDEX IF NOT EXISTS idx_variante_producto ON producto_variante(producto_id);
CREATE INDEX IF NOT EXISTS idx_imagen_producto ON producto_imagen(producto_id);

-- Clave de deduplicacion recomendada (spec seccion 15): en ausencia de SKU
-- publicado, usar (slug) o (nombre_es + linea + presentacion) como clave estable.
-- No se crea un UNIQUE compuesto rigido aca porque la fuente no siempre
-- publica SKU — se resuelve a nivel aplicacion antes del INSERT/UPDATE.
