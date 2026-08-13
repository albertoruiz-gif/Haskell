import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtSecret } from './jwt-secret';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret(),
    });
  }

  // Lo que retorna acá queda disponible como req.user (usado por RolesGuard y CatalogController).
  //
  // EP-01 (auditoría 2026-08-12): antes esto confiaba ciegamente en lo que
  // decía el token, sin volver a mirar la base — un usuario DESACTIVADO
  // seguía pudiendo usar el sistema con su token viejo hasta que expirara
  // solo (hasta 8h), y no existía forma de forzar un logout. Un solo
  // SELECT por id (indexado, barato) alcanza para cerrar ambos huecos: se
  // rechaza si el usuario ya no está activo, o si el token es de ANTES de
  // la última vez que se invalidaron sus sesiones (cambio de clave,
  // desactivación, o un cierre de sesión forzado desde Gestión).
  async validate(payload: {
    sub: string;
    email: string;
    rol: string;
    canal: string | null;
    asesorId: string | null;
    transportistaId?: string | null;
    liderId?: string | null;
    gerenteComercialId?: string | null;
    // EP-18: presente solo en el token temporal de un login con 2FA
    // pendiente — ver ScopeGuard, que es quien realmente lo hace valer.
    scope?: 'pendiente_2fa' | 'setup_2fa';
    iat?: number;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { activo: true, sesionesInvalidadasDesde: true },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('La cuenta ya no está activa.');
    }
    if (user.sesionesInvalidadasDesde && payload.iat && payload.iat * 1000 < user.sesionesInvalidadasDesde.getTime()) {
      throw new UnauthorizedException('La sesión fue cerrada — iniciá sesión de nuevo.');
    }

    return {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      canal: payload.canal,
      asesorId: payload.asesorId,
      transportistaId: payload.transportistaId ?? null,
      liderId: payload.liderId ?? null,
      gerenteComercialId: payload.gerenteComercialId ?? null,
      scope: payload.scope,
    };
  }
}
