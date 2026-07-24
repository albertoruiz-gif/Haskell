import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Aplica la matriz de permisos de RFD 3.2/3.3: cada rol solo accede a lo
 * que le corresponde. El JWT (poblado en el modulo de auth, pendiente de
 * scaffolding detallado) trae el rol y el canal/alcance del usuario.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException('No tenés permiso para esta acción.');
    }
    return true;
  }
}
