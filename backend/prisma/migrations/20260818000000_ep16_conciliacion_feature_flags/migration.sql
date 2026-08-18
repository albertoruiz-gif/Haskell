-- EP-16: tolerancia de conciliacion de depositos + feature flags genericos
-- en ConfiguracionSistema (columnas nuevas con default, no requieren
-- backfill); Order.depositoMonto nuevo, nullable a proposito (depositos ya
-- registrados antes de este cambio no tienen este dato).

ALTER TABLE "configuracion_sistema"
  ADD COLUMN "toleranciaConciliacionSoles" DECIMAL(10,2) NOT NULL DEFAULT 5,
  ADD COLUMN "featureFlags" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "orders"
  ADD COLUMN "depositoMonto" DECIMAL(10,2);
