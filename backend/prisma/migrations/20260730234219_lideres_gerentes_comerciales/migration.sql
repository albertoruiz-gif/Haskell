-- CreateTable
CREATE TABLE "lideres" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "comisionPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lideres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gerentes_comerciales" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "comisionPct" DECIMAL(5,2) NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gerentes_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lideres_userId_key" ON "lideres"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "gerentes_comerciales_userId_key" ON "gerentes_comerciales"("userId");

-- AddForeignKey
ALTER TABLE "lideres" ADD CONSTRAINT "lideres_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gerentes_comerciales" ADD CONSTRAINT "gerentes_comerciales_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asesores" ADD CONSTRAINT "asesores_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "lideres"("id") ON DELETE SET NULL ON UPDATE CASCADE;
