import { EstadoPedido } from '@prisma/client';

/**
 * Etiqueta en español de cada EstadoPedido — fuente única usada tanto por el
 * bot de WhatsApp (consulta de estado) como por el espejo de estado hacia
 * Odoo (para que Hasky/Live Chat pueda responder sin salir de Odoo, ver
 * catalogo-haskell/PROMPT_investigar_estados_pago.md).
 */
export const ESTADO_PEDIDO_LABEL: Record<EstadoPedido, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  PAGADO: 'Pago confirmado',
  PICKING: 'En preparación (picking)',
  PACKING: 'En empaque',
  ENTREGADO_TRANSPORTISTA: 'Entregado al transportista',
  EN_RUTA: 'En camino a tu dirección',
  ENTREGADO: 'Entregado',
  ENTREGA_FALLIDA: 'Intento de entrega fallido',
  CANCELADO_DEVUELTO: 'Cancelado / devuelto',
  ANULADO_POR_VENCIMIENTO: 'Anulado — venció el plazo de pago',
};
