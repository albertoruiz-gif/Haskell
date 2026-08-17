import { BadRequestException } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';

describe('OperacionesService — reprogramarEntrega (EP-12)', () => {
  function crearService() {
    const prisma: any = {
      entrega: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      order: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ asesor: {}, entrega: null }) },
      transportista: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const odoo: any = { upsertTransportistaComoPartner: jest.fn(), sincronizarDeliveryAOdoo: jest.fn() };
    const inventario: any = { reservarParaOrder: jest.fn(), comprometerParaOrder: jest.fn() };
    const service = new OperacionesService(prisma, odoo, inventario);
    return { service, prisma, inventario };
  }

  it('rechaza reprogramar una entrega que no está FALLIDO', async () => {
    const { service, prisma } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'EN_RUTA' });

    await expect(service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: new Date() })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.entrega.update).not.toHaveBeenCalled();
  });

  it('re-reserva y compromete el stock antes de tocar nada más', async () => {
    const { service, prisma, inventario } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'FALLIDO' });
    prisma.entrega.update.mockResolvedValue({ id: 'e1', estado: 'ASIGNADO' });

    await service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: new Date('2026-09-01') });

    expect(inventario.reservarParaOrder).toHaveBeenCalledWith('o1');
    expect(inventario.comprometerParaOrder).toHaveBeenCalledWith('o1');
  });

  it('si ya no hay stock disponible, no reprograma nada (reservarParaOrder revienta)', async () => {
    const { service, prisma, inventario } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'FALLIDO' });
    inventario.reservarParaOrder.mockRejectedValue(new BadRequestException('Stock insuficiente'));

    await expect(service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: new Date() })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.entrega.update).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('vuelve el pedido a PACKING y la entrega a ASIGNADO, incrementando vecesReprogramada', async () => {
    const { service, prisma } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'FALLIDO' });
    prisma.entrega.update.mockResolvedValue({ id: 'e1', estado: 'ASIGNADO' });
    const fecha = new Date('2026-09-01T15:00:00Z');

    await service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: fecha, motivo: 'cliente pidió el viernes' });

    expect(prisma.order.update).toHaveBeenCalledWith({ where: { id: 'o1' }, data: { estado: 'PACKING' } });
    expect(prisma.entrega.update).toHaveBeenCalledWith({
      where: { orderId: 'o1' },
      data: {
        estado: 'ASIGNADO',
        aceptadoEn: null,
        fechaReprogramada: fecha,
        motivoReprogramacion: 'cliente pidió el viernes',
        vecesReprogramada: { increment: 1 },
      },
    });
  });

  it('deja rastro en AuditLog', async () => {
    const { service, prisma } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'FALLIDO' });
    prisma.entrega.update.mockResolvedValue({ id: 'e1', estado: 'ASIGNADO' });

    await service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: new Date('2026-09-01'), motivo: 'x' });

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: 'actor-1', accion: 'REPROGRAMAR_ENTREGA', entidadId: 'e1' }),
      }),
    );
  });
});
