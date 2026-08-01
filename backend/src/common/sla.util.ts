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
