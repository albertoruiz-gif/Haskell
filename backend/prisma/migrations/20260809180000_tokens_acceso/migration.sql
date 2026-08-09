-- CreateEnum
CREATE TYPE "TipoTokenAcceso" AS ENUM ('ACTIVACION', 'RECUPERACION');

-- CreateTable
CREATE TABLE "tokens_acceso" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tipo" "TipoTokenAcceso" NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "usadoEn" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tokens_acceso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tokens_acceso_tokenHash_key" ON "tokens_acceso"("tokenHash");

-- CreateIndex
CREATE INDEX "tokens_acceso_userId_idx" ON "tokens_acceso"("userId");

-- AddForeignKey
ALTER TABLE "tokens_acceso" ADD CONSTRAINT "tokens_acceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
