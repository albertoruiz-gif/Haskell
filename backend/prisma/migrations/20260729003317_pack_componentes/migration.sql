-- AlterTable
ALTER TABLE "catalog_lines" ADD COLUMN     "componentesIds" TEXT[] DEFAULT ARRAY[]::TEXT[];