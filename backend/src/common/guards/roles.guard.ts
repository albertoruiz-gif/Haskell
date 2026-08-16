import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PermisosService } from '../../modules/permisos/permisos.service';

/**
 * Aplica la matriz de permisos de RFD 3.2/3.3: cada rol solo accede a lo
 * que le corresponde. El JWT (poblado en el modulo de auth, pendiente de
 * scaffolding detallado) trae el rol y el canal/alcance del usuario.
 *
 * EP-01 (2026-08-16): los roles requeridos ya no son 100% fijos — un
 * ADMINISTRADOR puede haber redefinido, desde Gestión → Permisos, qué
 * roles entran a este endpoint puntual. Si no hay override guardado, se
 * usa el @Roles() compilado tal cual (ver PermisosService.rolesEfectivos,
 * que lee de una caché en memoria — nada de esto pega a la base por request).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permisos: PermisosService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const clave = `${context.getClass().name}.${context.getHandler().name}`;
    const rolesPermitidos = this.permisos.rolesEfectivos(clave, requiredRoles);

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !rolesPermitidos.includes(user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción.');
    }
    return true;
  }
}
