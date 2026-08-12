import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

// EP-01 (auditoría 2026-08-12): antes validate() confiaba ciegamente en el
// payload del token, sin volver a mirar la base — un usuario desactivado
// seguía entrando con su token viejo hasta que expirara solo (hasta 8h), y
// no había forma de forzar un logout. Estos tests fijan que ahora sí se
// revisa contra la base en cada request.
describe('JwtStrategy.validate', () => {
  function crearStrategy(usuarioEnBD: { activo: boolean; sesionesInvalidadasDesde: Date | null } | null) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(usuarioEnBD) } };
    return { strategy: new JwtStrategy(prisma as any), prisma };
  }

  const payloadBase = { sub: 'user-1', email: 'a@b.com', rol: 'ADMINISTRADOR', canal: null, asesorId: null };

  it('deja pasar un token de un usuario activo sin sesiones invalidadas', async () => {
    const { strategy } = crearStrategy({ activo: true, sesionesInvalidadasDesde: null });
    const req = await strategy.validate({ ...payloadBase, iat: Math.floor(Date.now() / 1000) });
    expect(req.id).toBe('user-1');
  });

  it('rechaza si el usuario ya no existe', async () => {
    const { strategy } = crearStrategy(null);
    await expect(strategy.validate({ ...payloadBase, iat: 1000 })).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza si el usuario fue desactivado', async () => {
    const { strategy } = crearStrategy({ activo: false, sesionesInvalidadasDesde: null });
    await expect(strategy.validate({ ...payloadBase, iat: 1000 })).rejects.toThrow(UnauthorizedException);
  });

  it('rechaza un token emitido ANTES de que se invalidaran las sesiones (cambio de clave, cierre forzado)', async () => {
    const invalidadasDesde = new Date('2026-08-12T12:00:00Z');
    const { strategy } = crearStrategy({ activo: true, sesionesInvalidadasDesde: invalidadasDesde });
    const iatAntes = Math.floor(new Date('2026-08-12T11:00:00Z').getTime() / 1000); // token de 1h antes
    await expect(strategy.validate({ ...payloadBase, iat: iatAntes })).rejects.toThrow(UnauthorizedException);
  });

  it('deja pasar un token emitido DESPUÉS de la invalidación (ej. volvió a loguearse)', async () => {
    const invalidadasDesde = new Date('2026-08-12T12:00:00Z');
    const { strategy } = crearStrategy({ activo: true, sesionesInvalidadasDesde: invalidadasDesde });
    const iatDespues = Math.floor(new Date('2026-08-12T12:30:00Z').getTime() / 1000);
    const req = await strategy.validate({ ...payloadBase, iat: iatDespues });
    expect(req.id).toBe('user-1');
  });
});
