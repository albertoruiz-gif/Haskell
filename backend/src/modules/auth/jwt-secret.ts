/**
 * Auditoria de seguridad 2026-08-10: antes había `?? 'cambia-esto-en-local'`
 * duplicado en jwt.strategy.ts Y auth.module.ts — un secreto hardcodeado y
 * visible en el código fuente. Hoy Testeo/Producción tienen un JWT_SECRET
 * real configurado (verificado, 64 caracteres), así que esto nunca se
 * llegó a explotar — pero si esa variable de entorno alguna vez faltara,
 * la app arrancaba igual y firmaba tokens con un secreto público conocido,
 * en vez de fallar. Esto fuerza que falte-arranque en vez de fallar-abierto.
 */
export function jwtSecret(): string {
  const valor = process.env.JWT_SECRET;
  if (!valor) {
    throw new Error(
      'Falta JWT_SECRET en las variables de entorno — ver backend/.env.example. ' +
        'No se arranca con un secreto por defecto: firmar tokens con un valor conocido de antemano ' +
        'permitiría falsificar sesiones de cualquier rol, incluido Administrador.',
    );
  }
  return valor;
}
