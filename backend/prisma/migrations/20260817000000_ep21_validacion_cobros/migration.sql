-- EP-21: estado de validación + comprobante adjunto en RegistroCobro.
--
-- IMPORTANTE (a mano, no autogenerada): antes de esta migración,
-- registrarCobro() aplicaba el monto a Cliente.saldoUtilizado de forma
-- inmediata al crear el registro — es decir, todo RegistroCobro que ya
-- existe en la base representa un cobro que YA fue aplicado de verdad.
-- Si a esas filas les pusiéramos el default nuevo (PENDIENTE), quedarían
-- mostrándose como "pendientes de validar" en la bandeja nueva, y un
-- rechazo accidental intentaría revertir un monto que el saldo del
-- cliente ya no tiene reservado. Por eso el backfill explícito de abajo:
-- todo lo que ya existía queda VALIDADO (refleja su estado real), y solo
-- los cobros creados de acá en adelante nacen PENDIENTE.

CREATE TYPE "EstadoCobro" AS ENUM ('PENDIENTE', 'VALIDADO', 'RECHAZADO');

ALTER TABLE "registros_cobro"
  ADD COLUMN "comprobanteUrl" TEXT,
  ADD COLUMN "estado" "EstadoCobro" NOT NULL DEFAULT 'PENDIENTE',
  ADD COLUMN "revisadoPorId" TEXT,
  ADD COLUMN "motivoRechazo" TEXT,
  ADD COLUMN "resueltoEn" TIMESTAMP(3);

-- Backfill: todas las filas que existían ANTES de este ALTER TABLE (nunca
-- pudo haberse insertado una fila nueva entre el ADD COLUMN de arriba y
-- este UPDATE, es la misma migración) ya estaban aplicadas al saldo bajo
-- el comportamiento viejo.
UPDATE "registros_cobro" SET "estado" = 'VALIDADO';

CREATE INDEX "registros_cobro_estado_idx" ON "registros_cobro"("estado");
