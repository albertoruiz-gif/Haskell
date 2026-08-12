CREATE TABLE "configuracion_sistema" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "minutosReservaStock" INTEGER NOT NULL DEFAULT 30,
    "actualizadoPorId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("id")
);
