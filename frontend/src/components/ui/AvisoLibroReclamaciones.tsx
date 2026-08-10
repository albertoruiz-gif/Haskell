import Link from 'next/link';

// Aviso "Anexo III" — texto comúnmente citado para el Libro de
// Reclamaciones, NO fue verificado letra por letra contra el DS
// 011-2011-PCM (ver docs/PROMPT_culqi_requisitos_web.md, sección
// dedicada). Confirmar el texto exacto antes de considerarlo definitivo.
export function AvisoLibroReclamaciones() {
  return (
    <p className="rounded-card bg-crema px-3 py-2 text-xs text-bosque/70">
      Este establecimiento cuenta con un Libro de Reclamaciones a disposición del consumidor, conforme a lo
      establecido en el Código de Protección y Defensa del Consumidor. Puede acceder a él en:{' '}
      <Link href="/legal/libro-de-reclamaciones" className="font-medium text-acento">
        Libro de Reclamaciones
      </Link>
      .
    </p>
  );
}
