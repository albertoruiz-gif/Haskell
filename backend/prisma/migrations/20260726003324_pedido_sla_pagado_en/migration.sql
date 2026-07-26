-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "pagadoEn" TIMESTAMP(3),
ADD COLUMN     "slaHorasSnapshot" INTEGER;

-- AlterTable
ALTER TABLE "tarifas" ALTER COLUMN "slaHoras" SET DEFAULT 36;
