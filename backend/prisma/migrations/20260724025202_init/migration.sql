-- CreateEnum
CREATE TYPE "Canal" AS ENUM ('SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA');

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO', 'LIDER_MINORISTA', 'VENDEDOR', 'ASESOR', 'ALMACEN', 'TRANSPORTISTA', 'FINANZAS');

-- CreateEnum
CREATE TYPE "EstadoCatalogo" AS ENUM ('BORRADOR', 'EN_VALIDACION', 'OBSERVADO', 'APROBADO', 'PROGRAMADO', 'PUBLICADO', 'SUSPENDIDO', 'VENCIDO');

-- CreateEnum
CREATE TYPE "TipoPromocion" AS ENUM ('DESCUENTO_PVP', 'COMBO', 'REGALO', 'OFERTA_TEMPORAL');

-- CreateEnum
CREATE TYPE "AlcanceOferta" AS ENUM ('DIA', 'SEMANA', 'MES');

-- CreateEnum
CREATE TYPE "AlcancePorcentaje" AS ENUM ('GLOBAL', 'CAMPANA', 'CANAL');

-- CreateEnum
CREATE TYPE "EstadoEntrega" AS ENUM ('ASIGNADO', 'ACEPTADO', 'EN_RUTA', 'ENTREGADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "EstadoPedido" AS ENUM ('BORRADOR', 'PENDIENTE_PAGO', 'PAGADO', 'STOCK_RESERVADO', 'PICKING', 'PACKING', 'ENTREGADO_TRANSPORTISTA', 'EN_RUTA', 'ENTREGADO', 'ENTREGA_FALLIDA', 'CANCELADO_DEVUELTO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asesores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "fechaNacimiento" TIMESTAMP(3) NOT NULL,
    "telefonoPrincipal" TEXT NOT NULL,
    "telefonoSecundario" TEXT,
    "numeroYape" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "liderId" TEXT,
    "odooPartnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asesores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direcciones" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "provincia" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,
    "direccion" TEXT NOT NULL,
    "referencia" TEXT,
    "predeterminada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "direcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tarifas" (
    "id" TEXT NOT NULL,
    "distrito" TEXT NOT NULL,
    "zona" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "slaHoras" INTEGER NOT NULL DEFAULT 48,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),

    CONSTRAINT "tarifas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "canalesObjetivo" "Canal"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalogs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "estado" "EstadoCatalogo" NOT NULL DEFAULT 'BORRADOR',
    "vigenciaDesde" TIMESTAMP(3),
    "vigenciaHasta" TIMESTAMP(3),
    "responsableCargaId" TEXT,
    "responsableAprobacionId" TEXT,
    "motivoObservacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "catalog_lines" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "categoria" TEXT,
    "pvpCampania" DECIMAL(10,2) NOT NULL,
    "ordenVisualizacion" INTEGER NOT NULL DEFAULT 0,
    "destacado" BOOLEAN NOT NULL DEFAULT false,
    "cantidadMaximaPorAsesor" INTEGER,

    CONSTRAINT "catalog_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "catalogLineId" TEXT,
    "tipo" "TipoPromocion" NOT NULL DEFAULT 'OFERTA_TEMPORAL',
    "alcance" "AlcanceOferta" NOT NULL,
    "descuentoPct" DECIMAL(5,2),
    "precioFijo" DECIMAL(10,2),
    "inicio" TIMESTAMP(3) NOT NULL,
    "fin" TIMESTAMP(3) NOT NULL,
    "creadoPorId" TEXT NOT NULL,
    "aprobadoPorId" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_configs" (
    "id" TEXT NOT NULL,
    "alcance" "AlcancePorcentaje" NOT NULL DEFAULT 'GLOBAL',
    "campaignId" TEXT,
    "catalogId" TEXT,
    "canal" "Canal",
    "porcentajeAsesor" DECIMAL(5,2) NOT NULL DEFAULT 80.00,
    "actualizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "direccionId" TEXT,
    "vigenciaHasta" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "catalogLineId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "campaignId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "catalogVersion" INTEGER NOT NULL,
    "direccionSnapshot" JSONB NOT NULL,
    "tarifaSnapshot" DECIMAL(10,2) NOT NULL,
    "subtotalAsesor" DECIMAL(10,2) NOT NULL,
    "totalCulqi" DECIMAL(10,2) NOT NULL,
    "estado" "EstadoPedido" NOT NULL DEFAULT 'BORRADOR',
    "referenciaWeb" TEXT NOT NULL,
    "odooSaleOrderId" INTEGER,
    "odooSaleOrderName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entregas" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "transportistaId" TEXT NOT NULL,
    "estado" "EstadoEntrega" NOT NULL DEFAULT 'ASIGNADO',
    "bultos" INTEGER NOT NULL DEFAULT 1,
    "aceptadoEn" TIMESTAMP(3),
    "receptor" TEXT,
    "documentoReceptor" TEXT,
    "evidenciaUrl" TEXT,
    "motivoFallo" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entregas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "pvpUnitario" DECIMAL(10,2) NOT NULL,
    "porcentajeAsesorAplicado" DECIMAL(5,2) NOT NULL,
    "precioAsesorUnitario" DECIMAL(10,2) NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "promocionAplicada" JSONB,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "culqiToken" TEXT,
    "culqiChargeId" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'INICIADO',
    "montoCentimos" INTEGER NOT NULL,
    "respuestaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT NOT NULL,
    "valoresAntes" JSONB,
    "valoresDespues" JSONB,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "asesores_userId_key" ON "asesores"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "asesores_codigo_key" ON "asesores"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "asesores_numeroDocumento_key" ON "asesores"("numeroDocumento");

-- CreateIndex
CREATE UNIQUE INDEX "tarifas_distrito_key" ON "tarifas"("distrito");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_codigo_key" ON "campaigns"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "catalogs_campaignId_canal_version_key" ON "catalogs"("campaignId", "canal", "version");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_lines_catalogId_sku_key" ON "catalog_lines"("catalogId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "orders_referenciaWeb_key" ON "orders"("referenciaWeb");

-- CreateIndex
CREATE UNIQUE INDEX "entregas_orderId_key" ON "entregas"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_culqiChargeId_key" ON "payments"("culqiChargeId");

-- AddForeignKey
ALTER TABLE "asesores" ADD CONSTRAINT "asesores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direcciones" ADD CONSTRAINT "direcciones_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "asesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalogs" ADD CONSTRAINT "catalogs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "catalog_lines" ADD CONSTRAINT "catalog_lines_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_catalogLineId_fkey" FOREIGN KEY ("catalogLineId") REFERENCES "catalog_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_configs" ADD CONSTRAINT "pricing_configs_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "asesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_catalogLineId_fkey" FOREIGN KEY ("catalogLineId") REFERENCES "catalog_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "asesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
