-- AlterTable
ALTER TABLE "catalog_lines" ADD COLUMN     "imagenesAdicionales" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "propiedades" TEXT,
ADD COLUMN     "subcategoria" TEXT,
ADD COLUMN     "tipo" TEXT;
