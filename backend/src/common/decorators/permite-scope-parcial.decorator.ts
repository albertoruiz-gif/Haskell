import { SetMetadata } from '@nestjs/common';

export const SCOPE_PARCIAL_KEY = 'scopeParcialPermitido';

// EP-18: durante el login en dos pasos de 2FA, el token temporal que se
// entrega ANTES de confirmar el segundo factor lleva un "scope" restringido
// (ver jwt.strategy.ts / auth.service.ts) — con ese token no se puede tocar
// nada del resto de la API salvo los 2-3 endpoints puntuales de 2FA que
// marquen explícitamente qué scope(s) parcial(es) aceptan.
export const PermiteScopeParcial = (...scopes: ('pendiente_2fa' | 'setup_2fa')[]) => SetMetadata(SCOPE_PARCIAL_KEY, scopes);
