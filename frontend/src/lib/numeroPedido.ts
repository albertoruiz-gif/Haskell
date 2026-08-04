// Espejo de backend/src/common/numero-pedido.util.ts — mismo formato,
// frontend y backend son apps separadas sin código compartido en este repo.
const SIGLAS_CANAL: Record<string, string> = {
  COMERCIO_MINORISTA: 'MIN',
  RETAIL: 'RET',
  SALONES_BELLEZA: 'SAL',
};

export function formatearNumeroPedido(canal: string, numero: number): string {
  const sigla = SIGLAS_CANAL[canal] ?? canal;
  return `HSK_${sigla}_${String(numero).padStart(6, '0')}`;
}
