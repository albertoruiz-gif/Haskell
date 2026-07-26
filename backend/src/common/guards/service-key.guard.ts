import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

/**
 * Autenticacion servicio-a-servicio para integraciones externas (ej. el
 * microservicio whatsapp-bot) que no tienen sesion de usuario ni JWT.
 * Se usa junto con @Public() para saltar el JwtAuthGuard global y en su
 * lugar exigir un header `x-service-key` que coincida con una variable de
 * entorno del backend. No reemplaza a RolesGuard: es un guard aparte para
 * un pequeno numero de endpoints internos, nunca para rutas de usuario.
 */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const headerKey = request.headers['x-service-key'];
    const expected = process.env.WHATSAPP_BOT_SERVICE_KEY;

    if (!expected) {
      throw new UnauthorizedException('WHATSAPP_BOT_SERVICE_KEY no esta configurada en el backend.');
    }
    if (!headerKey || headerKey !== expected) {
      throw new UnauthorizedException('Llave de servicio invalida o ausente.');
    }
    return true;
  }
}
