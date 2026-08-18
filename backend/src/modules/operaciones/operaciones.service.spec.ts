import { BadRequestException } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';

describe('OperacionesService — reprogramarEntrega (EP-12)', () => {
  const ORDER_CON_ASESOR = {
    canal: 'RETAIL',
    numero: 42,
    estado: 'ENTREGA_FALLIDA',
    asesor: { user: { nombre: 'Ana Asesora', email: 'ana@test.com' } },
    entrega: null,
  };

  function crearService() {
    const prisma: any = {
      entrega: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      order: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue(ORDER_CON_ASESOR) },
      transportista: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const odoo: any = { upsertTransportistaComoPartner: jest.fn(), sincronizarDeliveryAOdoo: jest.fn(), enviarCorreo: jest.fn() };
    const inventario: any = { reservarParaOrder: jest.fn(), comprometerParaOrder: jest.fn() };
    const service = new OperacionesService(prisma, odoo, inventario);
    return { service, prisma, inventario, odoo };
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

  it('reprogramar avisa por correo al asesor con la nueva fecha', async () => {
    const { service, prisma, odoo } = crearService();
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ id: 'e1', estado: 'FALLIDO' });
    prisma.entrega.update.mockResolvedValue({ id: 'e1', estado: 'ASIGNADO' });

    await service.reprogramarEntrega('o1', 'actor-1', { fechaReprogramada: new Date('2026-09-01'), motivo: 'pidió el viernes' });

    expect(odoo.enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'ana@test.com', asunto: 'Tu pedido tiene una nueva fecha de entrega' }),
    );
  });
});

describe('OperacionesService — notificaciones proactivas por correo (EP-12)', () => {
  const ORDER_CON_ASESOR = {
    canal: 'RETAIL',
    numero: 42,
    asesor: { user: { nombre: 'Ana Asesora', email: 'ana@test.com' } },
    entrega: null,
  };

  // EP-07: cada método exige un Order.estado de origen distinto (el guard
  // corre ANTES de la notificación por correo, que usa el mismo mock) —
  // por defecto se deja el que necesita marcarEnRuta; los tests de
  // confirmarEntrega/registrarEntregaFallida lo pisan con mockResolvedValue.
  function crearService(estadoOrigen: string = 'ENTREGADO_TRANSPORTISTA') {
    const prisma: any = {
      entrega: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
      order: { update: jest.fn(), findUniqueOrThrow: jest.fn().mockResolvedValue({ ...ORDER_CON_ASESOR, estado: estadoOrigen }) },
      transportista: { update: jest.fn() },
      inventario: {},
    };
    const odoo: any = { upsertTransportistaComoPartner: jest.fn(), sincronizarDeliveryAOdoo: jest.fn(), enviarCorreo: jest.fn() };
    const inventario: any = { consumirParaOrder: jest.fn(), liberarParaOrder: jest.fn() };
    const service = new OperacionesService(prisma, odoo, inventario);
    return { service, prisma, odoo };
  }

  it('marcarEnRuta avisa "salió a reparto"', async () => {
    const { service, prisma, odoo } = crearService('ENTREGADO_TRANSPORTISTA');
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ estado: 'ACEPTADO' });
    prisma.entrega.update.mockResolvedValue({ estado: 'EN_RUTA' });

    await service.marcarEnRuta('o1');

    expect(odoo.enviarCorreo).toHaveBeenCalledWith(expect.objectContaining({ para: 'ana@test.com', asunto: 'Tu pedido salió a reparto' }));
  });

  it('confirmarEntrega avisa "fue entregado" con el nombre de quién recibió', async () => {
    const { service, prisma, odoo } = crearService('EN_RUTA');
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ transportista: { tarifaPorEntrega: 10 } });
    prisma.entrega.update.mockResolvedValue({ estado: 'ENTREGADO' });

    await service.confirmarEntrega('o1', { receptor: 'Juan Pérez', documentoReceptor: '12345678', evidenciaUrl: '/uploads/x.jpg' });

    expect(odoo.enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'ana@test.com', asunto: 'Tu pedido fue entregado', htmlCuerpo: expect.stringContaining('Juan Pérez') }),
    );
  });

  it('registrarEntregaFallida avisa el motivo del problema', async () => {
    const { service, prisma, odoo } = crearService('EN_RUTA');
    prisma.entrega.update.mockResolvedValue({ estado: 'FALLIDO' });

    await service.registrarEntregaFallida('o1', 'Cliente ausente');

    expect(odoo.enviarCorreo).toHaveBeenCalledWith(
      expect.objectContaining({ para: 'ana@test.com', htmlCuerpo: expect.stringContaining('Cliente ausente') }),
    );
  });

  it('un fallo al enviar el correo nunca tumba el cambio de estado real (best-effort)', async () => {
    const { service, prisma, odoo } = crearService('ENTREGADO_TRANSPORTISTA');
    prisma.entrega.findUniqueOrThrow.mockResolvedValue({ estado: 'ACEPTADO' });
    prisma.entrega.update.mockResolvedValue({ estado: 'EN_RUTA' });
    odoo.enviarCorreo.mockRejectedValue(new Error('Odoo caído'));

    await expect(service.marcarEnRuta('o1')).resolves.toEqual({ estado: 'EN_RUTA' });
  });
});

// EP-07: confirmarPicking/confirmarPacking/aceptarBultos no validaban en
// absoluto el estado de origen del pedido antes de este cambio — cobertura
// nueva, no existía ningún test para estos tres métodos.
describe('OperacionesService — guardas de transición de estado (EP-07)', () => {
  function crearService(orderOverrides: Record<string, any> = {}) {
    const order = { id: 'o1', estado: 'PAGADO', odooSaleOrderId: null, ...orderOverrides };
    const prisma: any = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...order, ...data })),
      },
      entrega: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ transportistaId: 't1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const odoo: any = { obtenerPicking: jest.fn().mockResolvedValue([]), sincronizarDeliveryAOdoo: jest.fn(), upsertTransportistaComoPartner: jest.fn() };
    const inventario: any = {};
    const service = new OperacionesService(prisma, odoo, inventario);
    return { service, prisma };
  }

  describe('confirmarPicking', () => {
    it('permite confirmar picking sobre un pedido PAGADO', async () => {
      const { service, prisma } = crearService({ estado: 'PAGADO' });
      await service.confirmarPicking('o1', 'actor-1');
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'PICKING' } }));
    });

    it.each(['PENDIENTE_PAGO', 'PICKING', 'ENTREGADO', 'CANCELADO_DEVUELTO'])(
      'rechaza confirmar picking si el pedido está en %s',
      async (estado) => {
        const { service, prisma } = crearService({ estado });
        await expect(service.confirmarPicking('o1', 'actor-1')).rejects.toThrow(BadRequestException);
        expect(prisma.order.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('confirmarPacking', () => {
    it('permite empacar un pedido en PICKING', async () => {
      const { service, prisma } = crearService({ estado: 'PICKING' });
      await service.confirmarPacking('o1');
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'PACKING' } }));
    });

    it('rechaza empacar un pedido que no pasó por picking', async () => {
      const { service, prisma } = crearService({ estado: 'PAGADO' });
      await expect(service.confirmarPacking('o1')).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('aceptarBultos', () => {
    it('permite aceptar bultos de un pedido en PACKING', async () => {
      const { service, prisma } = crearService({ estado: 'PACKING' });
      await service.aceptarBultos('o1', 't1', 'TRANSPORTISTA');
      expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: 'ENTREGADO_TRANSPORTISTA' } }));
    });

    it('rechaza aceptar bultos de un pedido que no pasó por packing', async () => {
      const { service, prisma } = crearService({ estado: 'PAGADO' });
      await expect(service.aceptarBultos('o1', 't1', 'TRANSPORTISTA')).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });
});
