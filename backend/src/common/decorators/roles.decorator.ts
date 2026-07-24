import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Restringe un endpoint a los roles de RFD seccion 3.2 (Administrador, GerenteComercial, etc). */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
