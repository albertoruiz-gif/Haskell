import { PricingService } from './pricing.service';

describe('PricingService', () => {
  function crearService() {
    const prisma: any = {
      pricingConfig: { findFirst: jest.fn(), create: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return { service: new PricingService(prisma), prisma };
  }

  describe('calcularPrecioAsesor (algoritmo real, sin mocks — RN-008)', () => {
    it('aplica el porcentaje sobre el PVP', () => {
      const { service } = crearService();
      expect(service.calcularPrecioAsesor(100, 80)).toBe(80);
      expect(service.calcularPrecioAsesor(50, 50)).toBe(25);
    });

    it('redondea a 2 decimales en vez de arrastrar error de punto flotante', () => {
      const { service } = crearService();
      // 33.33 * 0.8 = 26.664 -> debe quedar en 26.66, no 26.664 ni 26.66399999...
      expect(service.calcularPrecioAsesor(33.33, 80)).toBe(26.66);
    });

    it('porcentaje 100 devuelve el mismo PVP', () => {
      const { service } = crearService();
      expect(service.calcularPrecioAsesor(45.5, 100)).toBe(45.5);
    });
  });

  describe('calcularTotalCulqi (RN-010 — Σ(PVP × %asesor × cantidad) + envío, envío sin descuento RN-009)', () => {
    it('suma varias líneas más el envío', () => {
      const { service } = crearService();
      const total = service.calcularTotalCulqi(
        [
          { pvpUnitario: 100, porcentaje: 80, cantidad: 2 }, // 80 * 2 = 160
          { pvpUnitario: 50, porcentaje: 80, cantidad: 1 }, // 40
        ],
        15, // envío
      );
      expect(total).toBe(160 + 40 + 15);
    });

    it('con carrito vacío, el total es exactamente el costo de envío', () => {
      const { service } = crearService();
      expect(service.calcularTotalCulqi([], 12.5)).toBe(12.5);
    });

    it('cada línea puede tener su propio porcentaje vigente (no asume uno global)', () => {
      const { service } = crearService();
      const total = service.calcularTotalCulqi(
        [
          { pvpUnitario: 100, porcentaje: 80, cantidad: 1 }, // 80
          { pvpUnitario: 100, porcentaje: 50, cantidad: 1 }, // 50 (oferta con % distinto)
        ],
        0,
      );
      expect(total).toBe(130);
    });
  });

  describe('resolverPorcentajeAsesor — jerarquía de alcance CANAL > CAMPAÑA > GLOBAL', () => {
    it('usa 80% por defecto si no hay ninguna PricingConfig', async () => {
      const { service, prisma } = crearService();
      prisma.pricingConfig.findFirst.mockResolvedValue(null);
      const pct = await service.resolverPorcentajeAsesor({ campaignId: 'c1', catalogId: 'cat1', canal: 'RETAIL' });
      expect(pct).toBe(80);
    });

    it('usa el porcentaje configurado cuando existe', async () => {
      const { service, prisma } = crearService();
      prisma.pricingConfig.findFirst.mockResolvedValue({ porcentajeAsesor: 75 });
      const pct = await service.resolverPorcentajeAsesor({ campaignId: 'c1', catalogId: 'cat1', canal: 'RETAIL' });
      expect(pct).toBe(75);
    });

    it('la consulta prioriza CANAL, luego CAMPAÑA, luego GLOBAL en ese orden dentro del OR', async () => {
      const { service, prisma } = crearService();
      prisma.pricingConfig.findFirst.mockResolvedValue(null);
      await service.resolverPorcentajeAsesor({ campaignId: 'c1', catalogId: 'cat1', canal: 'SALONES_BELLEZA' });

      const llamada = prisma.pricingConfig.findFirst.mock.calls[0][0];
      expect(llamada.where.OR[0]).toEqual(expect.objectContaining({ alcance: 'CANAL', catalogId: 'cat1', canal: 'SALONES_BELLEZA' }));
      expect(llamada.where.OR[1]).toEqual(expect.objectContaining({ alcance: 'CAMPANA', campaignId: 'c1' }));
      expect(llamada.where.OR[2]).toEqual(expect.objectContaining({ alcance: 'GLOBAL' }));
    });
  });

  describe('actualizarPorcentaje', () => {
    it('rechaza un porcentaje fuera de rango (0-100)', async () => {
      const { service } = crearService();
      await expect(service.actualizarPorcentaje({ alcance: 'GLOBAL' as any, porcentaje: 0, actorId: 'a1' })).rejects.toThrow();
      await expect(service.actualizarPorcentaje({ alcance: 'GLOBAL' as any, porcentaje: 101, actorId: 'a1' })).rejects.toThrow();
    });

    it('deja rastro en AuditLog con el porcentaje y alcance nuevos', async () => {
      const { service, prisma } = crearService();
      prisma.pricingConfig.create.mockResolvedValue({ id: 'pc1' });

      await service.actualizarPorcentaje({ alcance: 'GLOBAL' as any, porcentaje: 85, actorId: 'actor-1' });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorId: 'actor-1',
            accion: 'ACTUALIZAR_PORCENTAJE_ASESOR',
            valoresDespues: { porcentaje: 85, alcance: 'GLOBAL' },
          }),
        }),
      );
    });
  });
});
