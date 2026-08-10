import Link from 'next/link';

// Borrador base — ver docs/PROMPT_culqi_requisitos_web.md. Plazos y
// exclusiones marcados como pendientes de definir con el negocio + revisión
// legal — el plazo de desistimiento (7 días) sí está confirmado por ley
// (Art. 45, Código de Protección y Defensa del Consumidor).
export default function PoliticaCambiosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 rounded-card bg-white p-5 text-sm leading-relaxed text-bosque/80 shadow-sm">
      <div className="rounded-card bg-crema p-3 text-xs text-bosque/60">
        Versión borrador, pendiente de revisión legal final.
      </div>

      <h1 className="text-lg font-medium text-bosque">Política de Cambios y Devoluciones</h1>

      <h2 className="text-base font-medium text-bosque">Desistimiento (ventas a distancia)</h2>
      <p>
        Conforme al Art. 45 del Código de Protección y Defensa del Consumidor, el consumidor tiene derecho a
        desistirse de la compra dentro de los <strong>7 días calendario</strong> siguientes a la recepción del
        producto, sin necesidad de expresar causa, siempre que el producto no haya sido usado y conserve su empaque
        original.
      </p>

      <h2 className="text-base font-medium text-bosque">Cómo solicitar un cambio o devolución</h2>
      <ol className="list-decimal space-y-1 pl-5">
        <li>
          Escribir a <strong>alberto.ruiz@efficaxba.com</strong> o al <strong>+51 999 420 044</strong> indicando el
          número de pedido.
        </li>
        <li>La Empresa confirma la procedencia del cambio/devolución en un plazo de 2 días hábiles.</li>
        <li>El costo de envío de la devolución lo asume la Empresa.</li>
      </ol>
      <p className="rounded-card bg-red-50 p-2 text-xs text-red-700">
        Pendiente: confirmar el plazo real de confirmación (2 días hábiles es un valor sugerido, no definitivo).
      </p>

      <h2 className="text-base font-medium text-bosque">Productos no sujetos a devolución</h2>
      <p className="rounded-card bg-red-50 p-2 text-xs text-red-700">
        Pendiente de definir con el negocio — por ejemplo, productos de higiene personal abiertos o usados, por
        razones sanitarias.
      </p>

      <h2 className="text-base font-medium text-bosque">Reembolsos</h2>
      <p>Los reembolsos se realizan por el mismo medio de pago utilizado, en un plazo sugerido de 7 días hábiles desde la confirmación de la devolución.</p>
      <p className="rounded-card bg-red-50 p-2 text-xs text-red-700">Pendiente: confirmar el plazo real de reembolso.</p>

      <h2 className="text-base font-medium text-bosque">Reclamos</h2>
      <p>
        Si no está conforme con la resolución, puede presentar un reclamo en nuestro{' '}
        <Link href="/legal/libro-de-reclamaciones" className="font-medium text-acento">
          Libro de Reclamaciones
        </Link>
        .
      </p>
    </article>
  );
}
