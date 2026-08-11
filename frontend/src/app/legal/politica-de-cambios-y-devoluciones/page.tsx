import Link from 'next/link';

// Base redactada según docs/PROMPT_culqi_requisitos_web.md. El plazo de
// desistimiento (7 días) está confirmado por ley (Art. 45, Código de
// Protección y Defensa del Consumidor); el resto de plazos/exclusiones son
// valores razonables sugeridos, sin avisos visibles de "pendiente" en la
// página pública (pedido explícito del usuario 2026-08-10, para no
// arriesgar una nueva observación de Culqi) — la revisión legal fina queda
// como pendiente interno.
export default function PoliticaCambiosPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-4 rounded-card bg-white p-5 text-sm leading-relaxed text-bosque/80 shadow-sm">
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

      <h2 className="text-base font-medium text-bosque">Productos no sujetos a devolución</h2>
      <p>
        Por razones sanitarias, no se aceptan devoluciones de productos de higiene y cuidado personal que hayan sido
        abiertos, usados o que no conserven su empaque original de fábrica.
      </p>

      <h2 className="text-base font-medium text-bosque">Reembolsos</h2>
      <p>
        Los reembolsos se realizan por el mismo medio de pago utilizado, en un plazo de 7 días hábiles desde la
        confirmación de la devolución.
      </p>

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
