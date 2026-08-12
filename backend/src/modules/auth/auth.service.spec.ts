import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

// EP-01 (auditoría 2026-08-12): estos tres caminos son los que ahora deben
// invalidar sesiones vigentes (además de que exista un cierre explícito) —
// ver jwt.strategy.spec.ts para cómo se usa sesionesInvalidadasDesde.
describe('AuthService — invalidación de sesiones (EP-01)', () => {
  function crearService() {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'user-1', ...data })),
      },
      tokenAcceso: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new AuthService(prisma as any, {} as any, {} as any);
    return { service, prisma };
  }

  it('desactivarUsuario() desactiva Y cierra la sesión vigente', async () => {
    const { service, prisma } = crearService();
    await service.desactivarUsuario('user-1', 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ activo: false, sesionesInvalidadasDesde: expect.any(Date) }) }),
    );
  });

  it('cerrarSesiones() cierra la sesión sin tocar "activo"', async () => {
    const { service, prisma } = crearService();
    await service.cerrarSesiones('user-1', 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { sesionesInvalidadasDesde: expect.any(Date) } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: 'CERRAR_SESIONES' }) }),
    );
  });

  it('cambiarPasswordPropia() con clave correcta actualiza la clave Y cierra la sesión actual', async () => {
    const { service, prisma } = crearService();
    const passwordHash = await bcrypt.hash('vieja123', 12);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash });

    await service.cambiarPasswordPropia('user-1', 'vieja123', 'nuevaclave123');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sesionesInvalidadasDesde: expect.any(Date) }) }),
    );
  });

  it('cambiarPasswordPropia() con clave actual incorrecta NO toca nada', async () => {
    const { service, prisma } = crearService();
    const passwordHash = await bcrypt.hash('vieja123', 12);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash });

    await expect(service.cambiarPasswordPropia('user-1', 'clave-mala', 'nuevaclave123')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('establecerPassword() (link de activación/recuperación) también cierra sesiones vigentes', async () => {
    const { service, prisma } = crearService();
    prisma.tokenAcceso.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tipo: 'RECUPERACION',
      usadoEn: null,
      expiraEn: new Date(Date.now() + 60_000),
    });

    await service.establecerPassword('token-crudo-cualquiera', 'nuevaclave123');
    const llamadaUpdateUser = prisma.user.update.mock.calls.find((c: any) => c[0].where.id === 'user-1');
    expect(llamadaUpdateUser[0].data).toEqual(expect.objectContaining({ sesionesInvalidadasDesde: expect.any(Date) }));
  });
});
