import { ConfiguracionService } from './configuracion.service';

describe('ConfiguracionService', () => {
  function crearService(
    filaExistente: { minutosReservaStock: number; toleranciaConciliacionSoles?: number; featureFlags?: Record<string, boolean> } | null,
  ) {
    const base = {
      id: 'global',
      minutosReservaStock: 30,
      toleranciaConciliacionSoles: 5,
      featureFlags: {},
    };
    const prisma = {
      configuracionSistema: {
        upsert: jest.fn().mockResolvedValue({ ...base, ...filaExistente, updatedAt: new Date() }),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...base, ...data, updatedAt: new Date() })),
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
          valoresAntes: expect.objectContaining({ minutosReservaStock: 30 }),
          valoresDespues: expect.objectContaining({ minutosReservaStock: 15 }),
        }),
      }),
    );
  });

  // EP-16 — tolerancia de conciliación y feature flags genéricos.
  describe('toleranciaConciliacionSoles', () => {
    it('devuelve el valor guardado como número (Prisma Decimal -> Number)', async () => {
      const { service } = crearService({ minutosReservaStock: 30, toleranciaConciliacionSoles: 12.5 });
      expect(await service.toleranciaConciliacionSoles()).toBe(12.5);
    });
  });

  describe('featureFlagActivo', () => {
    it('devuelve true si la clave existe y está en true', async () => {
      const { service } = crearService({ minutosReservaStock: 30, featureFlags: { nueva_funcion: true } });
      expect(await service.featureFlagActivo('nueva_funcion')).toBe(true);
    });

    it('devuelve false si la clave existe y está en false', async () => {
      const { service } = crearService({ minutosReservaStock: 30, featureFlags: { nueva_funcion: false } });
      expect(await service.featureFlagActivo('nueva_funcion')).toBe(false);
    });

    it('devuelve false (nunca revienta) si la clave todavía no existe', async () => {
      const { service } = crearService({ minutosReservaStock: 30, featureFlags: {} });
      expect(await service.featureFlagActivo('clave_inexistente')).toBe(false);
    });
  });

  it('actualizar() también persiste tolerancia y feature flags, y los deja en el AuditLog', async () => {
    const { service, prisma } = crearService({ minutosReservaStock: 30, toleranciaConciliacionSoles: 5, featureFlags: {} });
    await service.actualizar({ toleranciaConciliacionSoles: 20, featureFlags: { nueva_funcion: true } }, 'actor-1');
    expect(prisma.configuracionSistema.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toleranciaConciliacionSoles: 20, featureFlags: { nueva_funcion: true } }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          valoresAntes: expect.objectContaining({ toleranciaConciliacionSoles: 5, featureFlags: {} }),
          valoresDespues: expect.objectContaining({ toleranciaConciliacionSoles: 20, featureFlags: { nueva_funcion: true } }),
        }),
      }),
    );
  });
});
