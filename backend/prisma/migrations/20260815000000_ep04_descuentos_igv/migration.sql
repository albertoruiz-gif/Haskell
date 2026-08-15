-- CreateEnum
CREATE TYPE "EstadoSolicitudDescuento" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateTable
CREATE TABLE "solicitudes_descuento" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoSolicitudDescuento" NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPorId" TEXT,
    "motivoRechazo" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_descuento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "solicitudes_descuento_clienteId_idx" ON "solicitudes_descuento"("clienteId");

-- CreateIndex
CREATE INDEX "solicitudes_descuento_estado_idx" ON "solicitudes_descuento"("estado");

-- AddForeignKey
ALTER TABLE "solicitudes_descuento" ADD CONSTRAINT "solicitudes_descuento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: agrega las columnas nuevas de Order SIN "NOT NULL" todavia en
-- igv/valorVenta -- la tabla ya tiene pedidos reales en Testeo/Produccion, y
-- Postgres no permite agregar una columna NOT NULL sin default en una tabla
-- con filas existentes. Se rellenan (backfill) mas abajo antes de exigirlo.
ALTER TABLE "orders" ADD COLUMN     "descuentoMonto" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "igv" DECIMAL(10,2),
ADD COLUMN     "solicitudDescuentoId" TEXT,
ADD COLUMN     "valorVenta" DECIMAL(10,2);

-- Backfill: pedidos ya existentes no tenian descuento (descuentoPct/Monto ya
-- quedaron en 0 arriba) -- se calcula el desglose de IGV hacia atras desde
-- el totalCulqi real de cada uno, mismo criterio que PricingService.calcularIGV
-- (valorVenta redondeado primero, igv por diferencia, para que sumen exacto).
UPDATE "orders"
SET "valorVenta" = ROUND("totalCulqi" / 1.18, 2),
    "igv" = "totalCulqi" - ROUND("totalCulqi" / 1.18, 2)
WHERE "valorVenta" IS NULL;

-- Ahora si, exigir NOT NULL una vez que ningun pedido quedo sin valor.
ALTER TABLE "orders" ALTER COLUMN "igv" SET NOT NULL,
ALTER COLUMN "valorVenta" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_solicitudDescuentoId_key" ON "orders"("solicitudDescuentoId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_solicitudDescuentoId_fkey" FOREIGN KEY ("solicitudDescuentoId") REFERENCES "solicitudes_descuento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
