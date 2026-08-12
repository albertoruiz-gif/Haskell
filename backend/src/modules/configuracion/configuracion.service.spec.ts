import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  function crearService(filaExistente: { minutosReservaStock: number } | null) {
    const prisma = {
      configuracionSistema: {
        upsert: jest.fn().mockResolvedValue(filaExistente ?? { id: 'global', minutosReservaStock: 30, updatedAt: new Date() }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'global', minutosReservaStock: 30, ...data, updatedAt: new Date() })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return { service: new ConfiguracionService(prisma as any), prisma };
  }

  it('obtener() crea la fila singleton con el default si todavía no existe (upsert)', async () => {
    const { service, prisma } = crearService(null);
    const config = await service.obtener();
    expect(prisma.configuracionSistema.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'global' }, create: { id: 'global' }, update: {} }),
    );
    expect(config.minutosReservaStock).toBe(30);
  });

  it('minutosReservaStock() devuelve el valor guardado, no siempre 30', async () => {
    const { service } = crearService({ minutosReservaStock: 45 });
    expect(await service.minutosReservaStock()).toBe(45);
  });

  it('actualizar() guarda el nuevo valor y deja rastro en AuditLog con el valor anterior', async () => {
    const { service, prisma } = crearService({ minutosReservaStock: 30 });
    await service.actualizar({ minutosReservaStock: 15 }, 'actor-1');
    expect(prisma.configuracionSistema.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ minutosReservaStock: 15, actualizadoPorId: 'actor-1' }) }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'ACTUALIZAR_CONFIGURACION',
          valoresAntes: { minutosReservaStock: 30 },
          valoresDespues: { minutosReservaStock: 15 },
        }),
      }),
    );
  });
});
