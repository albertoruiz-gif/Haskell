// Estado vacío reutilizable para gráficas sin datos todavía — el backend
// devuelve valorActual=null a propósito mientras no se valide el cálculo
// real contra Odoo (ver indicadores.service.ts). Mostrar esto en vez de un
// gráfico vacío pelado o, peor, números inventados.
export function PendienteCalculo({ mensaje = 'Pendiente de cálculo' }: { mensaje?: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-card bg-crema text-center">
      <span className="text-sm font-medium text-bosque/40">{mensaje}</span>
      <span className="max-w-xs text-xs text-bosque/30">
        Todavía no hay datos reales conectados para esto — se va a completar a medida que se valide contra Odoo.
      </span>
    </div>
  );
}
