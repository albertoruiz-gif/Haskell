/*
  Warnings:

  - Added the required column `apellidos` to the `asesores` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "asesores" ADD COLUMN     "apellidos" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "catalog_lines" ADD COLUMN     "imagenUrl" TEXT;

-- AlterTable
ALTER TABLE "direcciones" ADD COLUMN     "pais" TEXT NOT NULL DEFAULT 'Perú';
