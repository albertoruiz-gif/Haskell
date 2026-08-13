// EP-18: única fuente de verdad de qué roles requieren 2FA y cuántos días
// de gracia tienen — antes vivía duplicado a mano en cada lugar que crea un
// User (AuthService, GerentesComercialesService...), y quedó demostrado que
// eso se olvida: GerentesComercialesService creaba el User directo con
// Prisma, sin pasar por AuthService.crearUsuario(), así que nunca les
// asignaba plazo de gracia — su primer login los mandaba derecho a
// "configurá 2FA ahora" sin ningún aviso previo.
export const ROLES_2FA = ['ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS'] as const;
export const DIAS_GRACIA_2FA = 7;

export function calcularGracia2FA(rol: string): Date | undefined {
  return (ROLES_2FA as readonly string[]).includes(rol) ? new Date(Date.now() + DIAS_GRACIA_2FA * 24 * 60 * 60 * 1000) : undefined;
}
