import { BadRequestException } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { ESTADO_PEDIDO_LABEL } from './estados-pedido.util';

/**
 * EP-07 — mapa único de transiciones válidas de Order.estado.
 *
 * Antes de esto, cada método de OrdersService/OperacionesService validaba
 * (o no validaba) a mano el estado de origen antes de escribir uno nuevo, sin
 * ningún lugar central que dijera "de X se puede pasar a Y". Con el tiempo
 * eso dejó huecos reales: confirmarPicking/aceptarBultos/confirmarEntrega/
 * registrarEntregaFallida podían dispararse sobre un pedido en cualquier
 * estado (auditoría 2026-08-18), y confirmarPagoYEnviarAOdoo podía
 * "resucitar" a PAGADO un pedido ya cancelado o vencido si la confirmación
 * de Culqi llegaba tarde.
 *
 * CONFIRMADO (ver EP-07 en el tablero vivo) es una decisión de negocio
 * pendiente de Alberto, todavía no existe como estado real — este mapa
 * no lo incluye a propósito.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoPedido, EstadoPedido[]> = {
  PENDIENTE_PAGO: [EstadoPedido.PAGADO, EstadoPedido.CANCELADO_DEVUELTO, EstadoPedido.ANULADO_POR_VENCIMIENTO],
  PAGADO: [EstadoPedido.PICKING, EstadoPedido.CANCELADO_DEVUELTO],
  PICKING: [EstadoPedido.PACKING],
  PACKING: [EstadoPedido.ENTREGADO_TRANSPORTISTA],
  ENTREGADO_TRANSPORTISTA: [EstadoPedido.EN_RUTA],
  EN_RUTA: [EstadoPedido.ENTREGADO, EstadoPedido.ENTREGA_FALLIDA],
  // EP-12: reprogramar una entrega fallida vuelve el pedido a PACKING (mismo
  // transportista, sin pasar por asignarTransportista de nuevo).
  ENTREGA_FALLIDA: [EstadoPedido.PACKING],
  ENTREGADO: [],
  CANCELADO_DEVUELTO: [],
  ANULADO_POR_VENCIMIENTO: [],
};

/**
 * Tira BadRequestException con mensaje en español si la transición no es
 * válida. Usar SIEMPRE antes de escribir un Order.estado nuevo — es la
 * única fuente de verdad de qué transiciones existen en el sistema.
 */
export function asegurarTransicionValida(estadoActual: EstadoPedido, estadoDestino: EstadoPedido): void {
  const permitidos = TRANSICIONES_VALIDAS[estadoActual] ?? [];
  if (!permitidos.includes(estadoDestino)) {
    throw new BadRequestException(
      `No se puede pasar el pedido de "${ESTADO_PEDIDO_LABEL[estadoActual]}" a "${ESTADO_PEDIDO_LABEL[estadoDestino]}".`,
    );
  }
}
