-- CreateTable
CREATE TABLE "gastos_marketing" (
    "id" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "canal" "Canal",
    "monto" DECIMAL(12,2) NOT NULL,
    "periodoDesde" TIMESTAMP(3) NOT NULL,
    "periodoHasta" TIMESTAMP(3) NOT NULL,
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gastos_marketing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_marketing_periodoDesde_periodoHasta_idx" ON "gastos_marketing"("periodoDesde", "periodoHasta");
