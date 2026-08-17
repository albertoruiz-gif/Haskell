import { EstadoEntrega } from '@prisma/client';

/**
 * Etiqueta en español de cada EstadoEntrega — para el seguimiento que ve
 * el Asesor (EP-12, GET /orders/:id/seguimiento) y cualquier otra pantalla
 * que necesite mostrar el estado de una Entrega en texto llano.
 */
export const ESTADO_ENTREGA_LABEL: Record<EstadoEntrega, string> = {
  ASIGNADO: 'Asignado a transportista',
  ACEPTADO: 'Transportista confirmó recepción',
  EN_RUTA: 'En camino',
  ENTREGADO: 'Entregado',
  FALLIDO: 'Intento de entrega fallido',
};
