-- EP-07: máquina de estados de pedidos centralizada (ver
-- backend/src/common/maquina-estados-pedido.ts). Esta migración limpia dos
-- estados muertos del enum EstadoPedido que nunca se llegaron a usar en
-- código real (BORRADOR, STOCK_RESERVADO) y quita el default tácito de
-- Order.estado (@default(BORRADOR) — un default hacia un estado que ya
-- estamos borrando no tenía sentido; todo create() ya declara su estado
-- explícitamente).
--
-- Postgres no permite DROP VALUE en un enum existente, así que hay que
-- recrear el tipo. Guard de seguridad antes de tocar nada: si por algún
-- motivo hubiera filas reales usando los valores que se eliminan, la
-- migración entera aborta con una excepción en vez de silenciarlo.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "orders" WHERE "estado"::text IN ('BORRADOR', 'STOCK_RESERVADO')) THEN
    RAISE EXCEPTION 'EP-07: hay pedidos reales en BORRADOR/STOCK_RESERVADO — no se puede recrear el enum sin antes migrar esas filas a mano.';
  END IF;
END $$;

ALTER TABLE "orders" ALTER COLUMN "estado" DROP DEFAULT;

ALTER TYPE "EstadoPedido" RENAME TO "EstadoPedido_old";

CREATE TYPE "EstadoPedido" AS ENUM (
  'PENDIENTE_PAGO',
  'PAGADO',
  'PICKING',
  'PACKING',
  'ENTREGADO_TRANSPORTISTA',
  'EN_RUTA',
  'ENTREGADO',
  'ENTREGA_FALLIDA',
  'CANCELADO_DEVUELTO',
  'ANULADO_POR_VENCIMIENTO'
);

ALTER TABLE "orders"
  ALTER COLUMN "estado" TYPE "EstadoPedido" USING ("estado"::text::"EstadoPedido");

DROP TYPE "EstadoPedido_old";
