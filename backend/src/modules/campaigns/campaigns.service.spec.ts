import { CampaignsService } from './campaigns.service';

describe('CampaignsService — EP-03 publicación programada', () => {
  function crearService() {
    const prisma: any = {
      catalog: { update: jest.fn(), updateMany: jest.fn() },
    };
    const odoo: any = {};
    const service = new CampaignsService(prisma, odoo);
    return { service, prisma };
  }

  describe('publicarCatalogo', () => {
    it('con vigenciaDesde futura, deja el catálogo en PROGRAMADO (no PUBLICADO todavía)', async () => {
      const { service, prisma } = crearService();
      prisma.catalog.update.mockResolvedValue({ id: 'c1', estado: 'PROGRAMADO' });
      const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const hasta = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await service.publicarCatalogo('c1', manana, hasta);

      expect(prisma.catalog.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'PROGRAMADO', vigenciaDesde: manana, vigenciaHasta: hasta },
      });
    });

    it('con vigenciaDesde de hoy o pasada, publica de una (PUBLICADO)', async () => {
      const { service, prisma } = crearService();
      prisma.catalog.update.mockResolvedValue({ id: 'c1', estado: 'PUBLICADO' });
      const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hasta = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await service.publicarCatalogo('c1', ayer, hasta);

      expect(prisma.catalog.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { estado: 'PUBLICADO', vigenciaDesde: ayer, vigenciaHasta: hasta },
      });
    });
  });

  describe('verificarTransicionesCatalogo', () => {
    it('pasa a PUBLICADO los catálogos PROGRAMADO cuya vigenciaDesde ya llegó', async () => {
      const { service, prisma } = crearService();
      await service.verificarTransicionesCatalogo();

      expect(prisma.catalog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'PROGRAMADO' }),
          data: { estado: 'PUBLICADO' },
        }),
      );
    });

    it('pasa a VENCIDO los catálogos PUBLICADO cuya vigenciaHasta ya pasó', async () => {
      const { service, prisma } = crearService();
      await service.verificarTransicionesCatalogo();

      expect(prisma.catalog.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: 'PUBLICADO' }),
          data: { estado: 'VENCIDO' },
        }),
      );
    });
  });
});
