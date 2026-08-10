import Link from 'next/link';

// Requisito de Culqi (docs/PROMPT_culqi_requisitos_web.md): datos de
// contacto + enlaces legales visibles en toda la web, con el Libro de
// Reclamaciones a máximo 2 clics desde cualquier página pública — al
// vivir en el footer global, está a 1 clic desde cualquier lado.
//
// Nota: no se linkean íconos de redes sociales todavía — @haskell_distribuidor
// fue confirmado como handle, pero no en qué red exacta (Instagram/Facebook/
// TikTok) vive. Culqi solo exige que, SI hay íconos, redirijan a la cuenta
// correcta — omitirlos hasta confirmar no incumple el requisito.
export function Footer() {
  return (
    <footer className="mt-8 space-y-3 rounded-card bg-white p-4 text-xs text-bosque/70 shadow-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/legal/terminos-y-condiciones" className="font-medium text-acento">
          Términos y condiciones
        </Link>
        <Link href="/legal/politica-de-cambios-y-devoluciones" className="font-medium text-acento">
          Política de cambios y devoluciones
        </Link>
        <Link href="/legal/libro-de-reclamaciones" className="font-medium text-acento">
          Libro de Reclamaciones
        </Link>
        <Link href="/contacto" className="font-medium text-acento">
          Contacto
        </Link>
      </div>
      <p>
        Juan Alberto Ruiz Díaz — RUC 10095397757 · Haskell / Haskell Cosméticos · Av. Géminis H-16, San Borja, Lima,
        Perú · +51 999 420 044 · alberto.ruiz@efficaxba.com
      </p>
    </footer>
  );
}
