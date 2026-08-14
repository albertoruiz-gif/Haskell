-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('ACTIVO', 'MOROSO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstadoSolicitudCredito" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('CONTADO_CULQI', 'CONTADO_DEPOSITO', 'AL_CREDITO');

-- CreateEnum
CREATE TYPE "EstadoDeposito" AS ENUM ('PENDIENTE_VALIDACION', 'VALIDADO', 'RECHAZADO');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "clienteId" TEXT,
ADD COLUMN     "depositoBanco" TEXT,
ADD COLUMN     "depositoComprobanteUrl" TEXT,
ADD COLUMN     "depositoEstado" "EstadoDeposito",
ADD COLUMN     "depositoNumeroOperacion" TEXT,
ADD COLUMN     "depositoValidadoEn" TIMESTAMP(3),
ADD COLUMN     "depositoValidadoPorId" TEXT,
ADD COLUMN     "formaPago" "FormaPago" NOT NULL DEFAULT 'CONTADO_CULQI';

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "asesorId" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "razonSocialONombre" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL,
    "numeroDocumento" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "email" TEXT,
    "direccion" TEXT,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'ACTIVO',
    "lineaCreditoAprobada" DECIMAL(10,2),
    "saldoUtilizado" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "odooPartnerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solicitudes_credito" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "solicitadoPorId" TEXT NOT NULL,
    "lineaSolicitada" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT,
    "estado" "EstadoSolicitudCredito" NOT NULL DEFAULT 'PENDIENTE',
    "revisadoPorId" TEXT,
    "lineaAprobada" DECIMAL(10,2),
    "motivoRechazo" TEXT,
    "resueltoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solicitudes_credito_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_cobro" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "metodo" TEXT NOT NULL,
    "numeroOperacion" TEXT,
    "banco" TEXT,
    "registradoPorId" TEXT NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registros_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_asesorId_idx" ON "clientes"("asesorId");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_canal_numeroDocumento_key" ON "clientes"("canal", "numeroDocumento");

-- CreateIndex
CREATE INDEX "solicitudes_credito_clienteId_idx" ON "solicitudes_credito"("clienteId");

-- CreateIndex
CREATE INDEX "solicitudes_credito_estado_idx" ON "solicitudes_credito"("estado");

-- CreateIndex
CREATE INDEX "registros_cobro_clienteId_idx" ON "registros_cobro"("clienteId");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_asesorId_fkey" FOREIGN KEY ("asesorId") REFERENCES "asesores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solicitudes_credito" ADD CONSTRAINT "solicitudes_credito_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_cobro" ADD CONSTRAINT "registros_cobro_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
