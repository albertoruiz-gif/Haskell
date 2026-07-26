import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'cambia-esto-en-local',
    });
  }

  // Lo que retorna acá queda disponible como req.user (usado por RolesGuard y CatalogController)
  async validate(payload: {
    sub: string;
    email: string;
    rol: string;
    canal: string | null;
    asesorId: string | null;
    transportistaId?: string | null;
  }) {
    return {
      id: payload.sub,
      email: payload.email,
      rol: payload.rol,
      canal: payload.canal,
      asesorId: payload.asesorId,
      transportistaId: payload.transportistaId ?? null,
    };
  }
}
