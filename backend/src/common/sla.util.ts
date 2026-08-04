const CORTE_HORA_ENTREGA = 15;

/**
 * RF-030/DP-001/DP-002: fecha de entrega prometida. Corte a las 15:00 sobre
 * la hora de `pagadoEn` — antes del corte se promete el día calendario
 * siguiente; después, un día más. Es una promesa por día, no una cuenta de
 * horas: `Tarifa.slaHoras` (36h por defecto) es solo la referencia comercial
 * que se le muestra al cliente, no la fórmula real de la fecha.
 *
 * Ej.: paga lunes 14:00 -> promesa martes. Paga lunes 16:00 -> promesa miércoles.
 */
export function calcularFechaEntregaPrometida(pagadoEn: Date): Date {
  const diasASumar = pagadoEn.getHours() < CORTE_HORA_ENTREGA ? 1 : 2;
  const prometida = new Date(pagadoEn);
  prometida.setDate(prometida.getDate() + diasASumar);
  prometida.setHours(23, 59, 59, 999);
  return prometida;
}

export type EstadoSaludEntrega = 'A_TIEMPO' | 'ATRASADO' | 'POSTERGADO';

/**
 * Misma clasificación que Almacén → Transporte (ver
 * frontend/src/components/admin/transporte/DespachoSection.tsx
 * calcularEstadoSalud) — replicada acá para reflejarla en Odoo
 * (stock.picking.x_estado_delivery). Null si el pedido todavía no se pagó
 * (no arrancó el SLA).
 */
export function calcularEstadoSaludEntrega(params: {
  pagadoEn: Date | null;
  entregaEstado: 'ASIGNADO' | 'ACEPTADO' | 'EN_RUTA' | 'ENTREGADO' | 'FALLIDO' | null;
  entregaUpdatedAt: Date | null;
}): EstadoSaludEntrega | null {
  if (params.entregaEstado === 'FALLIDO') return 'POSTERGADO';
  if (!params.pagadoEn) return null;
  const limite = calcularFechaEntregaPrometida(params.pagadoEn);
  if (params.entregaEstado === 'ENTREGADO' && params.entregaUpdatedAt) {
    return params.entregaUpdatedAt.getTime() <= limite.getTime() ? 'A_TIEMPO' : 'ATRASADO';
  }
  return Date.now() <= limite.getTime() ? 'A_TIEMPO' : 'ATRASADO';
}
