ALTER TABLE "users" ADD COLUMN "totpSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "totpActivadoEn" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "totpGraciaHasta" TIMESTAMP(3);

-- Backfill: a las cuentas YA EXISTENTES con un rol que ahora requiere 2FA
-- se les da 7 días de gracia desde HOY (el día del despliegue), no desde su
-- fecha de alta original — si no, cuentas viejas quedarían exigidas de
-- inmediato sin ningún plazo real.
UPDATE "users"
SET "totpGraciaHasta" = NOW() + INTERVAL '7 days'
WHERE "rol" IN ('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS');
