-- CreateTable
CREATE TABLE "datos_financieros_mensuales" (
    "id" TEXT NOT NULL,
    "periodo" TIMESTAMP(3) NOT NULL,
    "costoVentas" DECIMAL(12,2) NOT NULL,
    "cobros" DECIMAL(12,2) NOT NULL,
    "pagosProveedores" DECIMAL(12,2) NOT NULL,
    "gastosOperativos" DECIMAL(12,2) NOT NULL,
    "sueldos" DECIMAL(12,2) NOT NULL,
    "impuestos" DECIMAL(12,2) NOT NULL,
    "inventarioPromedio" DECIMAL(12,2) NOT NULL,
    "cuentasPorCobrarPromedio" DECIMAL(12,2) NOT NULL,
    "cuentasPorPagarPromedio" DECIMAL(12,2) NOT NULL,
    "compras" DECIMAL(12,2) NOT NULL,
    "cuentasPorCobrarVencidas" DECIMAL(12,2) NOT NULL,
    "costoImportadoUnitario" DECIMAL(12,2),
    "registradoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "datos_financieros_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "datos_financieros_mensuales_periodo_key" ON "datos_financieros_mensuales"("periodo");
