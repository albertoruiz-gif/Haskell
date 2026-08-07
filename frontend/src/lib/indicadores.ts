// Metadata de presentación de los 17 indicadores canónicos — las claves
// deben coincidir EXACTO con backend/src/modules/indicadores/indicadores.constants.ts
// (no inventar otras). El backend solo devuelve la clave + valor/meta, la
// etiqueta en español, la unidad y si "menor es mejor" viven acá porque son
// puramente de presentación.

export type Unidad = 'moneda' | 'porcentaje' | 'dias' | 'cantidad';

export type IndicadorMeta = {
  label: string;
  unidad: Unidad;
  // true = un valor MÁS BAJO que la meta es el resultado deseado (ej. dias
  // de inventario, quiebres de stock). false = más alto es mejor (default).
  menorEsMejor: boolean;
};

export const INDICADORES_INFO: Record<string, IndicadorMeta> = {
  // Comerciales
  ventas_netas: { label: 'Ventas netas', unidad: 'moneda', menorEsMejor: false },
  cumplimiento_meta: { label: 'Cumplimiento de meta', unidad: 'porcentaje', menorEsMejor: false },
  margen_bruto_canal: { label: 'Margen bruto por canal', unidad: 'porcentaje', menorEsMejor: false },
  venta_promedio_asesor_activo: { label: 'Venta promedio por asesor activo', unidad: 'moneda', menorEsMejor: false },
  ticket_promedio: { label: 'Ticket promedio', unidad: 'moneda', menorEsMejor: false },
  // Operativos
  pedidos_completos_a_tiempo: { label: 'Pedidos completos a tiempo', unidad: 'porcentaje', menorEsMejor: false },
  exactitud_inventario: { label: 'Exactitud de inventario', unidad: 'porcentaje', menorEsMejor: false },
  quiebres_stock: { label: 'Quiebres de stock', unidad: 'cantidad', menorEsMejor: true },
  dias_inventario: { label: 'Días de inventario', unidad: 'dias', menorEsMejor: true },
  tiempo_ciclo_pedido: { label: 'Tiempo de ciclo del pedido', unidad: 'dias', menorEsMejor: true },
  // Financieros
  margen_bruto_pct: { label: 'Margen bruto', unidad: 'porcentaje', menorEsMejor: false },
  flujo_caja_operativo: { label: 'Flujo de caja operativo', unidad: 'moneda', menorEsMejor: false },
  costo_importado_producto: { label: 'Costo importado del producto', unidad: 'moneda', menorEsMejor: true },
  ciclo_conversion_efectivo: { label: 'Ciclo de conversión de efectivo', unidad: 'dias', menorEsMejor: true },
  cuentas_por_cobrar_vencidas: { label: 'Cuentas por cobrar vencidas', unidad: 'moneda', menorEsMejor: true },
  // Marketing digital
  ltv_cliente: { label: 'LTV del cliente', unidad: 'moneda', menorEsMejor: false },
  cac: { label: 'Costo de adquisición de cliente (CAC)', unidad: 'moneda', menorEsMejor: true },
};

export function infoIndicador(indicador: string): IndicadorMeta {
  return INDICADORES_INFO[indicador] ?? { label: indicador, unidad: 'cantidad', menorEsMejor: false };
}

// Etiqueta corta de unidad — para que quien carga una meta en la pestaña
// Metas sepa en qué escala escribir el número (ej. "80" vs "80.00" no es
// lo mismo si es % o soles). Usado como sufijo del label y del input.
export const UNIDAD_CORTA: Record<Unidad, string> = {
  moneda: 'S/',
  porcentaje: '%',
  dias: 'días',
  cantidad: 'unds',
};

export function formatearValor(valor: number | null, unidad: Unidad): string {
  if (valor === null) return 'Pendiente de cálculo';
  switch (unidad) {
    case 'moneda':
      return `S/ ${valor.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case 'porcentaje':
      return `${valor.toLocaleString('es-PE', { maximumFractionDigits: 1 })}%`;
    case 'dias':
      return `${valor.toLocaleString('es-PE', { maximumFractionDigits: 1 })} días`;
    default:
      return valor.toLocaleString('es-PE');
  }
}

export type EstadoIndicador = 'exito' | 'alerta' | 'riesgo' | 'sin_meta' | 'pendiente';

// Umbral: dentro del 10% de la meta cuenta como "alerta" (cerca pero no
// llega), por debajo de eso es "riesgo". Simétrico para menor-es-mejor.
export function calcularEstado(valorActual: number | null, meta: number | null, menorEsMejor: boolean): EstadoIndicador {
  if (valorActual === null) return 'pendiente';
  if (meta === null || meta === 0) return 'sin_meta';
  const cumplimiento = menorEsMejor ? meta / valorActual : valorActual / meta;
  if (cumplimiento >= 1) return 'exito';
  if (cumplimiento >= 0.9) return 'alerta';
  return 'riesgo';
}

export const ESTADO_COLOR: Record<EstadoIndicador, string> = {
  exito: 'bg-exito',
  alerta: 'bg-alerta',
  riesgo: 'bg-riesgo',
  sin_meta: 'bg-bosque/20',
  pendiente: 'bg-bosque/10',
};

export const ESTADO_TEXTO: Record<EstadoIndicador, string> = {
  exito: 'text-exito',
  alerta: 'text-alerta',
  riesgo: 'text-riesgo',
  sin_meta: 'text-bosque/50',
  pendiente: 'text-bosque/40',
};

export const ESTADO_LABEL: Record<EstadoIndicador, string> = {
  exito: 'A favor',
  alerta: 'En alerta',
  riesgo: 'En riesgo',
  sin_meta: 'Sin meta definida',
  pendiente: 'Pendiente de cálculo',
};

export const CANAL_LABEL: Record<string, string> = {
  SALONES_BELLEZA: 'Salones de Belleza',
  RETAIL: 'Retail',
  COMERCIO_MINORISTA: 'Minorista',
};

// Opciones del combo de período — compartidas entre el drill-down y la
// gráfica "Ventas netas vs meta" de Gerencial.
export const PERIODOS = ['Día', 'Semana', 'Mes', 'Bimestre', 'Trimestre', 'Semestre', 'Año'] as const;
export type Periodo = (typeof PERIODOS)[number];

export type ValorIndicador = {
  indicador: string;
  valorActual: number | null;
  meta: number | null;
  canal: string | null;
};

// Espejo EXACTO de backend/src/modules/indicadores/indicadores.constants.ts
// — usado por la pestaña Metas para agrupar por categoría. Si se agrega un
// indicador nuevo hay que sumarlo acá también (no hay endpoint que exponga
// esta agrupación todavía).
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

export const INDICADORES_MARKETING_DIGITAL = ['ltv_cliente', 'cac'] as const;

export const CATEGORIAS_INDICADORES = [
  { label: 'Comercial', indicadores: INDICADORES_COMERCIALES as readonly string[] },
  { label: 'Financiero', indicadores: INDICADORES_FINANCIEROS as readonly string[] },
  { label: 'Operativo', indicadores: INDICADORES_OPERATIVOS as readonly string[] },
  { label: 'Marketing digital', indicadores: INDICADORES_MARKETING_DIGITAL as readonly string[] },
];

// Indicadores de alcance por canal — hoy solo margen_bruto_canal, mecanismo
// genérico por si se suman otros (ver prompt sección 3).
export const INDICADORES_POR_CANAL: readonly string[] = ['margen_bruto_canal'];

export const CANALES: readonly string[] = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];

export type MetaIndicador = {
  id: string;
  indicador: string;
  canal: string | null;
  valorObjetivo: string; // Decimal de Prisma serializa como string
  vigenciaDesde: string;
  vigenciaHasta: string | null;
  actualizadoPorId: string;
};
