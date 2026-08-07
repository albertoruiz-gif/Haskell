// Claves canónicas de indicador — deben coincidir con las 15 del "Tablero
// inicial recomendado" (ver Indicadores_comerciales_operativos_financieros_Haskell.md,
// sección 4). Se usan tanto para validar MetaIndicador.indicador como para
// armar la respuesta agregada de cada pestaña del tablero.
export const INDICADORES_COMERCIALES = [
  'ventas_netas',
  'cumplimiento_meta',
  'margen_bruto_canal',
  'venta_promedio_asesor_activo',
  'ticket_promedio',
] as const;

export const INDICADORES_OPERATIVOS = [
  'pedidos_completos_a_tiempo',
  'exactitud_inventario',
  'quiebres_stock',
  'dias_inventario',
  'tiempo_ciclo_pedido',
] as const;

export const INDICADORES_FINANCIEROS = [
  'margen_bruto_pct',
  'flujo_caja_operativo',
  'costo_importado_producto',
  'ciclo_conversion_efectivo',
  'cuentas_por_cobrar_vencidas',
] as const;

// Sumados 2026-08-06 a pedido de Alberto. No están en el documento original
// de indicadores (ese cubre comercial/operativo/financiero) — se agregan
// porque el canal web/digital lo justifica, pero ambos dependen de fuentes
// de datos que hoy no existen del todo:
// - cac necesita el gasto de marketing como numerador → ver modelo
//   GastoMarketing (gasto-marketing.controller.ts) y "clientes nuevos" del
//   período como denominador (fuente todavía por definir).
// - ltv_cliente solo tiene sentido para Salones/Retail (en Minorista la
//   cartera es de la asesora, no se registra clienta final por regla de
//   negocio — ver HASKY_agente_livechat_diseno.md) y depende de la Fase 3
//   de Hasky (asistente de cartera), todavía no implementada.
// Por eso valorActual va a devolver null para estos dos hasta que esas
// piezas existan — no inventar el cálculo mientras tanto.
export const INDICADORES_MARKETING_DIGITAL = ['ltv_cliente', 'cac'] as const;

export const INDICADORES_VALIDOS = [
  ...INDICADORES_COMERCIALES,
  ...INDICADORES_OPERATIVOS,
  ...INDICADORES_FINANCIEROS,
  ...INDICADORES_MARKETING_DIGITAL,
] as const;

export type IndicadorKey = (typeof INDICADORES_VALIDOS)[number];
