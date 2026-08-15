import { BadRequestException } from '@nestjs/common';
import { ClientesService } from './clientes.service';

describe('ClientesService', () => {
  function crearService(overrides: Partial<Record<string, any>> = {}) {
    const prisma: any = {
      asesor: { findUniqueOrThrow: jest.fn() },
      cliente: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      solicitudCredito: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      registroCobro: { create: jest.fn() },
      $transaction: jest.fn(),
      ...overrides,
    };
    const odoo: any = { upsertClienteComoPartner: jest.fn().mockResolvedValue(555) };
    return { service: new ClientesService(prisma, odoo), prisma, odoo };
  }

  describe('crear', () => {
    it('rechaza crear un Cliente para un Asesor de COMERCIO_MINORISTA (EP-21: solo Salón/Retail)', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUniqueOrThrow.mockResolvedValue({ id: 'a1', canal: 'COMERCIO_MINORISTA' });

      await expect(
        service.crear('a1', { razonSocialONombre: 'Tienda X', tipoDocumento: 'RUC', numeroDocumento: '123', telefono: '999' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.cliente.create).not.toHaveBeenCalled();
    });

    it('permite crear un Cliente para un Asesor de SALONES_BELLEZA', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUniqueOrThrow.mockResolvedValue({ id: 'a1', canal: 'SALONES_BELLEZA' });
      prisma.cliente.create.mockResolvedValue({ id: 'c1', odooPartnerId: null, razonSocialONombre: 'Salón Y', numeroDocumento: '456', telefono: '999', email: null, direccion: null, lineaCreditoAprobada: null });

      await service.crear('a1', { razonSocialONombre: 'Salón Y', tipoDocumento: 'DNI', numeroDocumento: '456', telefono: '999' });
      expect(prisma.cliente.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ asesorId: 'a1', canal: 'SALONES_BELLEZA' }) }),
      );
    });

    it('sincroniza el cliente nuevo a Odoo (res.partner) y guarda el odooPartnerId devuelto', async () => {
      const { service, prisma, odoo } = crearService();
      prisma.asesor.findUniqueOrThrow.mockResolvedValue({ id: 'a1', canal: 'RETAIL' });
      prisma.cliente.create.mockResolvedValue({
        id: 'c1', odooPartnerId: null, razonSocialONombre: 'Salón Y', numeroDocumento: '456', telefono: '999', email: null, direccion: null, lineaCreditoAprobada: null,
      });

      await service.crear('a1', { razonSocialONombre: 'Salón Y', tipoDocumento: 'DNI', numeroDocumento: '456', telefono: '999' });

      expect(odoo.upsertClienteComoPartner).toHaveBeenCalledWith(
        expect.objectContaining({ odooPartnerId: null, razonSocialONombre: 'Salón Y', numeroDocumento: '456', lineaCreditoAprobada: null }),
      );
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { odooPartnerId: 555 } });
    });

    it('si Odoo falla al sincronizar, igual devuelve el Cliente creado (no revierte ni tira error)', async () => {
      const { service, prisma, odoo } = crearService();
      prisma.asesor.findUniqueOrThrow.mockResolvedValue({ id: 'a1', canal: 'RETAIL' });
      prisma.cliente.create.mockResolvedValue({
        id: 'c1', odooPartnerId: null, razonSocialONombre: 'Salón Y', numeroDocumento: '456', telefono: '999', email: null, direccion: null, lineaCreditoAprobada: null,
      });
      odoo.upsertClienteComoPartner.mockRejectedValue(new Error('Odoo caído'));

      const cliente = await service.crear('a1', { razonSocialONombre: 'Salón Y', tipoDocumento: 'DNI', numeroDocumento: '456', telefono: '999' });
      expect(cliente.id).toBe('c1');
    });
  });

  describe('solicitarCredito', () => {
    it('rechaza una nueva solicitud si ya hay una PENDIENTE para el mismo cliente', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudCredito.findFirst.mockResolvedValue({ id: 's-existente', estado: 'PENDIENTE' });

      await expect(service.solicitarCredito('c1', 'user-asesor', { lineaSolicitada: 1000 })).rejects.toThrow(BadRequestException);
      expect(prisma.solicitudCredito.create).not.toHaveBeenCalled();
    });
  });

  describe('aprobarSolicitud', () => {
    it('rechaza aprobar una solicitud que ya fue resuelta', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudCredito.findUniqueOrThrow.mockResolvedValue({ id: 's1', estado: 'RECHAZADA', clienteId: 'c1' });

      await expect(service.aprobarSolicitud('s1', 'gerente-1', 1000)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('al aprobar, fija lineaCreditoAprobada y deja al cliente ACTIVO', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudCredito.findUniqueOrThrow.mockResolvedValue({ id: 's1', estado: 'PENDIENTE', clienteId: 'c1' });
      const clienteActualizado = { id: 'c1', lineaCreditoAprobada: 1500, estado: 'ACTIVO' };
      prisma.$transaction.mockResolvedValue([{ id: 's1', estado: 'APROBADA' }, clienteActualizado]);

      const resultado = await service.aprobarSolicitud('s1', 'gerente-1', 1500);
      expect(resultado).toEqual(clienteActualizado);
      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({}),
        expect.objectContaining({}),
      ]);
    });
  });

  describe('reservarCredito (usado por OrdersService al crear un pedido AL_CREDITO)', () => {
    it('rechaza si el cliente no está ACTIVO (ej. MOROSO) — regla dura "solo contado"', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', estado: 'MOROSO', lineaCreditoAprobada: 1000, saldoUtilizado: 0 });

      await expect(service.reservarCredito('c1', 100)).rejects.toThrow(BadRequestException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('rechaza si el cliente todavía no tiene línea de crédito aprobada', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', lineaCreditoAprobada: null, saldoUtilizado: 0 });

      await expect(service.reservarCredito('c1', 100)).rejects.toThrow(BadRequestException);
    });

    it('rechaza si el pedido excede el cupo disponible (línea - saldo ya usado)', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', lineaCreditoAprobada: 1000, saldoUtilizado: 800 });

      // cupo disponible = 1000 - 800 = 200, el pedido pide 300 -> debe rechazar
      await expect(service.reservarCredito('c1', 300)).rejects.toThrow(BadRequestException);
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });

    it('reserva (incrementa saldoUtilizado) cuando el pedido entra en el cupo disponible', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', estado: 'ACTIVO', lineaCreditoAprobada: 1000, saldoUtilizado: 800 });

      await service.reservarCredito('c1', 200);
      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { saldoUtilizado: { increment: 200 } },
      });
    });
  });

  describe('liberarCredito', () => {
    it('nunca deja saldoUtilizado negativo (se recorta a 0)', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 50 });

      await service.liberarCredito('c1', 200);
      expect(prisma.cliente.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { saldoUtilizado: 0 } });
    });
  });

  describe('registrarCobro', () => {
    it('reduce saldoUtilizado y reactiva a un cliente MOROSO cuando la deuda queda en 0', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'MOROSO' });
      let dataGuardada: any;
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          registroCobro: { create: jest.fn().mockResolvedValue({ id: 'cobro-1' }) },
          cliente: {
            update: jest.fn().mockImplementation(({ data }: any) => {
              dataGuardada = data;
              return Promise.resolve({ id: 'c1', ...data });
            }),
          },
        };
        return cb(tx);
      });

      await service.registrarCobro('c1', 'user-1', { monto: 300, metodo: 'deposito' });
      expect(dataGuardada).toEqual({ saldoUtilizado: 0, estado: 'ACTIVO' });
    });

    it('con un pago parcial, mantiene el estado del cliente tal cual está', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'MOROSO' });
      let dataGuardada: any;
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          registroCobro: { create: jest.fn().mockResolvedValue({ id: 'cobro-1' }) },
          cliente: {
            update: jest.fn().mockImplementation(({ data }: any) => {
              dataGuardada = data;
              return Promise.resolve({ id: 'c1', ...data });
            }),
          },
        };
        return cb(tx);
      });

      await service.registrarCobro('c1', 'user-1', { monto: 100, metodo: 'deposito' });
      expect(dataGuardada).toEqual({ saldoUtilizado: 200, estado: 'MOROSO' });
    });
  });
});
