'use client';

// EP-18: banner persistente mientras el usuario está en su plazo de gracia
// para configurar 2FA — se fija en el login (ver setAviso2FA) y desaparece
// solo al activarlo (Mi cuenta lo limpia) o al vencer el plazo (ese día,
// el próximo login ya no entra directo, entra al flujo de configuración
// forzada — ver AuthService.login).

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAviso2FA } from '../../lib/auth';

export function Aviso2FA() {
  const [graciaHasta, setGraciaHasta] = useState<string | null>(null);

  useEffect(() => {
    setGraciaHasta(getAviso2FA());
  }, []);

  if (!graciaHasta) return null;
  const dias = Math.max(0, Math.ceil((new Date(graciaHasta).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <div className="mb-3 flex items-center justify-between rounded-card bg-promo/10 px-3 py-2 text-xs text-bosque">
      <span>
        Tu cuenta requiere verificación en dos pasos — te quedan <strong>{dias} día{dias === 1 ? '' : 's'}</strong> para
        configurarla.
      </span>
      <Link href="/mi-cuenta" className="ml-3 shrink-0 font-medium text-acento">
        Configurar
      </Link>
    </div>
  );
}
