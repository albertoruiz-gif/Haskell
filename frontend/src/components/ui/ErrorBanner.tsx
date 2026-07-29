// Antes cada pantalla mostraba el error como texto rojo suelto, con el
// mensaje crudo que devolviera el backend — un solo lugar para el estilo
// (y, con el tiempo, para revisar que la redacción de cada mensaje piense
// en quien lo lee, no en qué tiró el servidor).
export function ErrorBanner({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return <p className="rounded-card bg-red-50 px-3 py-2 text-xs text-red-700">{mensaje}</p>;
}
