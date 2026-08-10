-- CreateEnum
CREATE TYPE "TipoReclamo" AS ENUM ('RECLAMO', 'QUEJA');

-- CreateEnum
CREATE TYPE "EstadoReclamo" AS ENUM ('RECIBIDO', 'EN_PROCESO', 'RESPONDIDO');

-- CreateTable
CREATE TABLE "reclamos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoReclamo" NOT NULL,
    "consumidorNombre" TEXT NOT NULL,
    "consumidorTipoDocumento" TEXT NOT NULL,
    "consumidorNumeroDocumento" TEXT NOT NULL,
    "consumidorDomicilio" TEXT NOT NULL,
    "consumidorTelefono" TEXT NOT NULL,
    "consumidorEmail" TEXT NOT NULL,
    "bienOServicioReclamado" TEXT NOT NULL,
    "montoReclamado" DECIMAL(10,2),
    "detalle" TEXT NOT NULL,
    "pedidoConsumidor" TEXT NOT NULL,
    "estado" "EstadoReclamo" NOT NULL DEFAULT 'RECIBIDO',
    "respuesta" TEXT,
    "respondidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondidoEn" TIMESTAMP(3),

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reclamos_codigo_key" ON "reclamos"("codigo");
