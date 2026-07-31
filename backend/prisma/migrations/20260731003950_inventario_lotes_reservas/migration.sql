-- AlterEnum
ALTER TYPE "EstadoPedido" ADD VALUE 'ANULADO_POR_VENCIMIENTO';

-- CreateEnum
CREATE TYPE "EstadoLote" AS ENUM ('NACIONALIZADO', 'EN_TRASLADO_ALMACEN', 'RECEPCION_PENDIENTE', 'CONTROL_CALIDAD', 'DISPONIBLE', 'BLOQUEADO', 'DANADO', 'PROXIMO_VENCER', 'VENCIDO', 'EN_BAJA', 'DADO_DE_BAJA');

-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('RESERVADO_TEMPORAL', 'COMPROMETIDO', 'CONSUMIDO', 'LIBERADO');

-- AlterTable
ALTER TABLE "catalog_lines" ALTER COLUMN "stockDisponible" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "lotes_inventario" (
    "id" TEXT NOT NULL,
    "catalogLineId" TEXT NOT NULL,
    "numeroLote" TEXT NOT NULL,
    "proveedor" TEXT,
    "paisOrigen" TEXT,
    "ordenCompra" TEXT,
    "documentoImportacion" TEXT,
    "fechaFabricacion" TIMESTAMP(3),
    "fechaVencimiento" TIMESTAMP(3),
    "cantidadImportada" INTEGER,
    "cantidadRecibida" INTEGER NOT NULL DEFAULT 0,
    "cantidadDanada" INTEGER NOT NULL DEFAULT 0,
    "costoFob" DECIMAL(10,2),
    "costoFleteSeguro" DECIMAL(10,2),
    "gastosAduaneros" DECIMAL(10,2),
    "costoTotalNacionalizado" DECIMAL(10,2),
    "costoUnitarioReal" DECIMAL(10,2),
    "ubicacionAlmacen" TEXT,
    "estado" "EstadoLote" NOT NULL DEFAULT 'NACIONALIZADO',
    "responsableRecepcionId" TEXT,
    "fechaLiberacion" TIMESTAMP(3),
    "motivoBloqueo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservas_stock" (
    "id" TEXT NOT NULL,
    "loteId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'RESERVADO_TEMPORAL',
    "expiraEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservas_stock_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "lotes_inventario" ADD CONSTRAINT "lotes_inventario_catalogLineId_fkey" FOREIGN KEY ("catalogLineId") REFERENCES "catalog_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lotes_inventario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas_stock" ADD CONSTRAINT "reservas_stock_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
