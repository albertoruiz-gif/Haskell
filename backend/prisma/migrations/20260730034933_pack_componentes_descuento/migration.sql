-- AlterTable
ALTER TABLE "catalog_lines" DROP COLUMN "componentesIds";

-- CreateTable
CREATE TABLE "pack_componentes" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "componenteId" TEXT NOT NULL,
    "descuentoPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_componentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pack_componentes_packId_componenteId_key" ON "pack_componentes"("packId", "componenteId");

-- AddForeignKey
ALTER TABLE "pack_componentes" ADD CONSTRAINT "pack_componentes_packId_fkey" FOREIGN KEY ("packId") REFERENCES "catalog_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_componentes" ADD CONSTRAINT "pack_componentes_componenteId_fkey" FOREIGN KEY ("componenteId") REFERENCES "catalog_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
