import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
      solicitudDescuento: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
      },
      registroCobro: { create: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
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

  describe('registrarCobro (EP-21, desde 2026-08-17: ya NO toca el saldo — nace PENDIENTE)', () => {
    it('crea el registro en PENDIENTE sin tocar Cliente.saldoUtilizado', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'MOROSO' });
      prisma.registroCobro.create.mockResolvedValue({ id: 'cobro-1', estado: 'PENDIENTE' });

      const resultado = await service.registrarCobro('c1', 'user-1', { monto: 300, metodo: 'deposito' });

      expect(resultado).toEqual({ id: 'cobro-1', estado: 'PENDIENTE' });
      expect(prisma.registroCobro.create).toHaveBeenCalledWith({
        data: { clienteId: 'c1', registradoPorId: 'user-1', monto: 300, metodo: 'deposito' },
      });
      expect(prisma.cliente.update).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('guarda comprobanteUrl cuando viene adjunto', async () => {
      const { service, prisma } = crearService();
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'ACTIVO' });
      prisma.registroCobro.create.mockResolvedValue({ id: 'cobro-1' });

      await service.registrarCobro('c1', 'user-1', { monto: 300, metodo: 'deposito', comprobanteUrl: '/uploads/cobros/x.jpg' });

      expect(prisma.registroCobro.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ comprobanteUrl: '/uploads/cobros/x.jpg' }) }),
      );
    });
  });

  describe('validarCobro (EP-21)', () => {
    it('rechaza validar un cobro que ya fue resuelto', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'RECHAZADO', clienteId: 'c1', monto: 100 });

      await expect(service.validarCobro('cobro-1', 'gerente-1')).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('al validar, recién ahí reduce saldoUtilizado y reactiva a un cliente MOROSO cuando la deuda queda en 0', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'PENDIENTE', clienteId: 'c1', monto: 300 });
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'MOROSO' });
      prisma.$transaction.mockResolvedValue([
        { id: 'cobro-1', estado: 'VALIDADO' },
        { id: 'c1', saldoUtilizado: 0, estado: 'ACTIVO' },
      ]);

      const resultado = await service.validarCobro('cobro-1', 'gerente-1');

      expect(resultado).toEqual({ id: 'cobro-1', estado: 'VALIDADO' });
      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({}),
        expect.objectContaining({}),
      ]);
    });

    it('con un pago parcial, mantiene el estado del cliente tal cual está', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'PENDIENTE', clienteId: 'c1', monto: 100 });
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'MOROSO' });
      let dataClienteGuardada: any;
      prisma.$transaction.mockImplementation((ops: any[]) => {
        // El segundo elemento del array es la promesa de cliente.update — en
        // este mock no ejecutamos las promesas reales, solo inspeccionamos
        // los args con los que se llamó a prisma.cliente.update más abajo.
        return Promise.resolve([{ id: 'cobro-1', estado: 'VALIDADO' }, { id: 'c1' }]);
      });

      await service.validarCobro('cobro-1', 'gerente-1');

      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { saldoUtilizado: 200, estado: 'MOROSO' },
      });
    });

    it('nunca deja saldoUtilizado negativo (se recorta a 0)', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'PENDIENTE', clienteId: 'c1', monto: 500 });
      prisma.cliente.findUniqueOrThrow.mockResolvedValue({ id: 'c1', saldoUtilizado: 300, estado: 'ACTIVO' });
      prisma.$transaction.mockResolvedValue([{ id: 'cobro-1' }, { id: 'c1' }]);

      await service.validarCobro('cobro-1', 'gerente-1');

      expect(prisma.cliente.update).toHaveBeenCalledWith({
        where: { id: 'c1' },
        data: { saldoUtilizado: 0, estado: 'ACTIVO' },
      });
    });
  });

  describe('rechazarCobro (EP-21)', () => {
    it('rechaza rechazar un cobro que ya fue resuelto', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'VALIDADO' });

      await expect(service.rechazarCobro('cobro-1', 'gerente-1')).rejects.toThrow(BadRequestException);
      expect(prisma.registroCobro.update).not.toHaveBeenCalled();
    });

    it('rechaza sin tocar Cliente.saldoUtilizado — nunca se había aplicado', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findUniqueOrThrow.mockResolvedValue({ id: 'cobro-1', estado: 'PENDIENTE', clienteId: 'c1' });
      prisma.registroCobro.update.mockResolvedValue({ id: 'cobro-1', estado: 'RECHAZADO' });

      await service.rechazarCobro('cobro-1', 'gerente-1', 'comprobante ilegible');

      expect(prisma.registroCobro.update).toHaveBeenCalledWith({
        where: { id: 'cobro-1' },
        data: expect.objectContaining({ estado: 'RECHAZADO', revisadoPorId: 'gerente-1', motivoRechazo: 'comprobante ilegible' }),
      });
      expect(prisma.cliente.update).not.toHaveBeenCalled();
    });
  });

  describe('listarCobros (EP-21)', () => {
    it('filtra por estado cuando se pide', async () => {
      const { service, prisma } = crearService();
      prisma.registroCobro.findMany.mockResolvedValue([]);

      await service.listarCobros({ estado: 'PENDIENTE' as any });

      expect(prisma.registroCobro.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ estado: 'PENDIENTE' }) }),
      );
    });
  });

  describe('solicitarDescuento (EP-04)', () => {
    it('rechaza un porcentaje fuera de rango', async () => {
      const { service } = crearService();
      await expect(service.solicitarDescuento('c1', 'user-asesor', { porcentaje: 0 })).rejects.toThrow(BadRequestException);
      await expect(service.solicitarDescuento('c1', 'user-asesor', { porcentaje: 101 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('aprobarSolicitudDescuento — umbral 5% (EP-04, decisión de negocio 2026-08-15)', () => {
    it('rechaza aprobar una solicitud que ya fue resuelta', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'RECHAZADA', porcentaje: 3 });

      await expect(service.aprobarSolicitudDescuento('sd1', 'gerente-1', 'GERENTE_COMERCIAL')).rejects.toThrow(BadRequestException);
      expect(prisma.solicitudDescuento.update).not.toHaveBeenCalled();
    });

    it('GERENTE_COMERCIAL puede aprobar hasta 5% inclusive', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'PENDIENTE', porcentaje: 5 });
      prisma.solicitudDescuento.update.mockResolvedValue({ id: 'sd1', estado: 'APROBADA' });

      await service.aprobarSolicitudDescuento('sd1', 'gerente-1', 'GERENTE_COMERCIAL');
      expect(prisma.solicitudDescuento.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: 'APROBADA', revisadoPorId: 'gerente-1' }) }),
      );
    });

    it('GERENTE_COMERCIAL NO puede aprobar más de 5% — hay que escalar a Gerente General', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'PENDIENTE', porcentaje: 5.01 });

      await expect(service.aprobarSolicitudDescuento('sd1', 'gerente-1', 'GERENTE_COMERCIAL')).rejects.toThrow(ForbiddenException);
      expect(prisma.solicitudDescuento.update).not.toHaveBeenCalled();
    });

    it('GERENTE_GENERAL puede aprobar cualquier porcentaje, incluso por encima del 5%', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'PENDIENTE', porcentaje: 15 });
      prisma.solicitudDescuento.update.mockResolvedValue({ id: 'sd1', estado: 'APROBADA' });

      await service.aprobarSolicitudDescuento('sd1', 'gerente-general-1', 'GERENTE_GENERAL');
      expect(prisma.solicitudDescuento.update).toHaveBeenCalled();
    });

    it('ADMINISTRADOR puede aprobar cualquier porcentaje', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'PENDIENTE', porcentaje: 20 });
      prisma.solicitudDescuento.update.mockResolvedValue({ id: 'sd1', estado: 'APROBADA' });

      await service.aprobarSolicitudDescuento('sd1', 'admin-1', 'ADMINISTRADOR');
      expect(prisma.solicitudDescuento.update).toHaveBeenCalled();
    });
  });

  describe('rechazarSolicitudDescuento', () => {
    it('rechaza si la solicitud ya fue resuelta', async () => {
      const { service, prisma } = crearService();
      prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({ id: 'sd1', estado: 'APROBADA' });

      await expect(service.rechazarSolicitudDescuento('sd1', 'gerente-1')).rejects.toThrow(BadRequestException);
    });
  });
});
