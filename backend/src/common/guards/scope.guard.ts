import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPE_PARCIAL_KEY } from '../decorators/permite-scope-parcial.decorator';

/**
 * EP-18: el login en dos pasos de 2FA entrega un token temporal con
 * `scope: 'pendiente_2fa' | 'setup_2fa'` en vez del token normal — este
 * guard es el que hace que ese token NO sirva para nada más que los
 * endpoints de 2FA marcados con @PermiteScopeParcial(). Sin `scope` en el
 * payload (todos los tokens emitidos antes de este cambio, y todo login
 * que no requiere 2FA) se trata como acceso completo, sin restricción —
 * este guard es puramente restrictivo, nunca amplía permisos.
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const scope = request.user?.scope;
    if (!scope || scope === 'full') return true;

    const scopesPermitidos = this.reflector.getAllAndOverride<string[]>(SCOPE_PARCIAL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (scopesPermitidos?.includes(scope)) return true;

    throw new ForbiddenException('Completá la verificación en dos pasos antes de continuar.');
  }
}
