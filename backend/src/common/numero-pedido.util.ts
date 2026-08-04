import { Canal } from '@prisma/client';

/** Siglas de canal para el numero de pedido — cortas y sin ambiguedad entre si. */
const SIGLAS_CANAL: Record<Canal, string> = {
  COMERCIO_MINORISTA: 'MIN',
  RETAIL: 'RET',
  SALONES_BELLEZA: 'SAL',
};

/**
 * Numero de pedido legible para la asesora (confirmacion web/email) y para
 * matchear el pedido en Odoo (stock.picking.x_pedido_externo_id) — ver
 * Order.numero en schema.prisma. Formato: HSK_<CANAL>_<numero global con
 * ceros a la izquierda> — el numero es correlativo across todos los canales,
 * no se reinicia por canal.
 */
export function formatearNumeroPedido(canal: Canal, numero: number): string {
  return `HSK_${SIGLAS_CANAL[canal]}_${String(numero).padStart(6, '0')}`;
}
