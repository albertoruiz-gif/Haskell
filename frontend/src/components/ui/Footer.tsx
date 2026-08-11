import Link from 'next/link';

// Requisito de Culqi (docs/PROMPT_culqi_requisitos_web.md): datos de
// contacto + enlaces legales visibles en toda la web, con el Libro de
// Reclamaciones a máximo 2 clics desde cualquier página pública — al
// vivir en el footer global, está a 1 clic desde cualquier lado.
//
// Redes sociales confirmadas por el usuario (2026-08-11):
// Instagram @Haskell_Distribuidor — https://www.instagram.com/haskell_distribuidor/
// Facebook @HaskellDistribuidor — https://www.facebook.com/HaskellDistribuidor
export function Footer() {
  return (
    <footer className="mt-8 space-y-3 rounded-card bg-white p-4 text-xs text-bosque/70 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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
        <div className="ml-auto flex items-center gap-3">
          <a
            href="https://www.instagram.com/haskell_distribuidor/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Haskell en Instagram"
            className="inline-flex items-center gap-1 font-medium text-acento"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <path d="M16 11.37a4 4 0 1 1-7.914 1.174A4 4 0 0 1 16 11.37z" />
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
            </svg>
            Instagram
          </a>
          <a
            href="https://www.facebook.com/HaskellDistribuidor"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Haskell en Facebook"
            className="inline-flex items-center gap-1 font-medium text-acento"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
            </svg>
            Facebook
          </a>
        </div>
      </div>
      <p>
        Juan Alberto Ruiz Díaz — RUC 10095397757 · Haskell / Haskell Cosméticos · Av. Géminis H-16, San Borja, Lima,
        Perú · +51 999 420 044 · alberto.ruiz@efficaxba.com
      </p>
    </footer>
  );
}
