-- CreateTable
CREATE TABLE "premios_niveles" (
    "id" TEXT NOT NULL,
    "canal" "Canal" NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoMinimo" DECIMAL(12,2) NOT NULL,
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "actualizadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "premios_niveles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "premios_niveles_canal_vigenciaDesde_idx" ON "premios_niveles"("canal", "vigenciaDesde");
