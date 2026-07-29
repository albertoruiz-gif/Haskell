-- CreateTable
CREATE TABLE "catalogos_digitales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "raiz" TEXT NOT NULL DEFAULT '',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "subidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalogos_digitales_pkey" PRIMARY KEY ("id")
);