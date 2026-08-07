-- CreateTable
CREATE TABLE "metas_indicadores" (
    "id" TEXT NOT NULL,
    "indicador" TEXT NOT NULL,
    "canal" "Canal",
    "valorObjetivo" DECIMAL(12,2) NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "actualizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metas_indicadores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "metas_indicadores_indicador_canal_idx" ON "metas_indicadores"("indicador", "canal");
