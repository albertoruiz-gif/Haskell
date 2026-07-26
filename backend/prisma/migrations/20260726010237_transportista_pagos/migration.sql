-- AlterTable
ALTER TABLE "entregas" ADD COLUMN     "montoPago" DECIMAL(10,2),
ADD COLUMN     "pagado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pagadoEn" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "transportistas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "placa" TEXT,
    "tarifaPorEntrega" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transportistas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transportistas_userId_key" ON "transportistas"("userId");

-- AddForeignKey
ALTER TABLE "transportistas" ADD CONSTRAINT "transportistas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entregas" ADD CONSTRAINT "entregas_transportistaId_fkey" FOREIGN KEY ("transportistaId") REFERENCES "transportistas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
