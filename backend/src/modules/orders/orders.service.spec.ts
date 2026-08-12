import { BadRequestException } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { OrdersService } from './orders.service';

// EP-07 (auditoría 2026-08-12): validarPagoManual() y rechazarPedido() no
// validaban el estado previo del pedido — este es el bug más crítico
// encontrado en el análisis de pendientes: se podía "rechazar" un pedido
// ya EN_RUTA/ENTREGADO, o re-marcar PAGADO uno que no estaba en
// PENDIENTE_PAGO. Estos tests fijan el comportamiento correcto para que no
// se repita sin querer en un cambio futuro.
describe('OrdersService — guardas de estado', () => {
  function crearService(ordenEnBD: { estado: EstadoPedido }) {
    const prisma = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(ordenEnBD),
        update: jest.fn().mockResolvedValue({ ...ordenEnBD }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const inventario = {
      comprometerParaOrder: jest.fn().mockResolvedValue(undefined),
      liberarParaOrder: jest.fn().mockResolvedValue(undefined),
    };
    const operaciones = { sincronizarEstadoPedidoAOdoo: jest.fn().mockResolvedValue(undefined) };

    const service = new OrdersService(
      prisma as any,
      {} as any, // pricing — no lo usan estos dos métodos
      {} as any, // campaigns
      {} as any, // odoo
      inventario as any,
      operaciones as any,
    );
    return { service, prisma, inventario, operaciones };
  }

  describe('validarPagoManual', () => {
    it('marca PAGADO cuando el pedido está PENDIENTE_PAGO', async () => {
      const { service, prisma, inventario } = crearService({ estado: EstadoPedido.PENDIENTE_PAGO });
      await service.validarPagoManual('order-1', 'actor-1');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: EstadoPedido.PAGADO }) }),
      );
      expect(inventario.comprometerParaOrder).toHaveBeenCalledWith('order-1');
    });

    it.each([EstadoPedido.PAGADO, EstadoPedido.CANCELADO_DEVUELTO, EstadoPedido.ENTREGADO, EstadoPedido.ANULADO_POR_VENCIMIENTO])(
      'rechaza si el pedido ya está en %s',
      async (estado) => {
        const { service, prisma } = crearService({ estado });
        await expect(service.validarPagoManual('order-1', 'actor-1')).rejects.toThrow(BadRequestException);
        expect(prisma.order.update).not.toHaveBeenCalled();
      },
    );
  });

  describe('rechazarPedido', () => {
    it.each([EstadoPedido.PENDIENTE_PAGO, EstadoPedido.PAGADO])('permite rechazar desde %s', async (estado) => {
      const { service, prisma, inventario } = crearService({ estado });
      await service.rechazarPedido('order-1', 'actor-1', 'motivo de prueba');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { estado: EstadoPedido.CANCELADO_DEVUELTO } }),
      );
      expect(inventario.liberarParaOrder).toHaveBeenCalledWith('order-1');
    });

    it.each([
      EstadoPedido.PICKING,
      EstadoPedido.PACKING,
      EstadoPedido.ENTREGADO_TRANSPORTISTA,
      EstadoPedido.EN_RUTA,
      EstadoPedido.ENTREGADO,
      EstadoPedido.ENTREGA_FALLIDA,
      EstadoPedido.CANCELADO_DEVUELTO,
    ])('NO permite rechazar un pedido ya despachado o cerrado (%s)', async (estado) => {
      const { service, prisma, inventario } = crearService({ estado });
      await expect(service.rechazarPedido('order-1', 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(inventario.liberarParaOrder).not.toHaveBeenCalled();
    });
  });
});

// EP-14 (auditoría 2026-08-12): confirmarPagoYEnviarAOdoo mandaba
// `odooProductId: 0` fijo — Odoo lo rechaza siempre (ID inexistente), y como
// nada atrapaba ese error, el cliente quedaba cobrado por Culqi pero el
// pedido nunca pasaba de PENDIENTE_PAGO. Estos tests fijan que: 1) el pago
// se confirma SIEMPRE que Culqi lo aprobó, sin importar qué pase con Odoo;
// 2) el SKU se mapea al producto real de Odoo, no a un ID fijo.
describe('OrdersService — confirmarPagoYEnviarAOdoo', () => {
  function crearOrder(overrides: Partial<{ estado: EstadoPedido; odooSaleOrderId: number | null }> = {}) {
    return {
      id: 'order-1',
      referenciaWeb: 'ref-abc',
      estado: EstadoPedido.PENDIENTE_PAGO,
      odooSaleOrderId: null,
      asesor: { odooPartnerId: null, codigo: 'AS-001', telefonoPrincipal: '999999999', numeroDocumento: '12345678' },
      items: [
        { sku: 'HSK-0012', cantidad: 2, precioAsesorUnitario: 40 },
        { sku: 'HSK-0161', cantidad: 1, precioAsesorUnitario: 100 },
      ],
      ...overrides,
    };
  }

  function crearService(order: ReturnType<typeof crearOrder>) {
    const prisma = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        // Simula que cada update devuelve la orden con los campos nuevos ya aplicados.
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...order, ...data })),
      },
    };
    const inventario = { comprometerParaOrder: jest.fn().mockResolvedValue(undefined) };
    const odoo = {
      upsertAsesorComoPartner: jest.fn().mockResolvedValue(555),
      buscarProductoIdPorSku: jest.fn().mockImplementation((sku: string) => Promise.resolve(sku === 'HSK-0012' ? 101 : sku === 'HSK-0161' ? 102 : null)),
      crearPedidoVenta: jest.fn().mockResolvedValue(999),
    };
    const service = new OrdersService(prisma as any, {} as any, {} as any, odoo as any, inventario as any, {} as any);
    return { service, prisma, inventario, odoo };
  }

  it('confirma el pago y compromete stock aunque Odoo no exista todavía como llamada', async () => {
    const { service, prisma, inventario } = crearService(crearOrder());
    await service.confirmarPagoYEnviarAOdoo('order-1');
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: EstadoPedido.PAGADO } }));
    expect(inventario.comprometerParaOrder).toHaveBeenCalledWith('order-1');
  });

  it('manda a Odoo el producto REAL de cada SKU, no un id fijo', async () => {
    const { service, odoo } = crearService(crearOrder());
    await service.confirmarPagoYEnviarAOdoo('order-1');
    expect(odoo.buscarProductoIdPorSku).toHaveBeenCalledWith('HSK-0012');
    expect(odoo.buscarProductoIdPorSku).toHaveBeenCalledWith('HSK-0161');
    expect(odoo.crearPedidoVenta).toHaveBeenCalledWith(
      expect.objectContaining({
        lineas: [
          { odooProductId: 101, cantidad: 2, precioUnitario: 40 },
          { odooProductId: 102, cantidad: 1, precioUnitario: 100 },
        ],
      }),
    );
  });

  it('si Odoo falla (ej. SKU sin mapear), el pago queda confirmado igual y NO tira excepción', async () => {
    const order = crearOrder();
    const { service, prisma, inventario, odoo } = crearService(order);
    odoo.buscarProductoIdPorSku.mockResolvedValue(null); // ningún SKU mapea

    await expect(service.confirmarPagoYEnviarAOdoo('order-1')).resolves.toBeDefined();
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { estado: EstadoPedido.PAGADO } }));
    expect(inventario.comprometerParaOrder).toHaveBeenCalledWith('order-1');
    // No se le pasó odooSaleOrderId a ningún update porque crearPedidoVenta nunca se llamó.
    expect(odoo.crearPedidoVenta).not.toHaveBeenCalled();
    for (const call of prisma.order.update.mock.calls) {
      expect(call[0].data).not.toHaveProperty('odooSaleOrderId');
    }
  });

  it('es idempotente: si ya tiene odooSaleOrderId, no vuelve a tocar nada', async () => {
    const { service, prisma, inventario, odoo } = crearService(crearOrder({ estado: EstadoPedido.PAGADO, odooSaleOrderId: 999 }));
    await service.confirmarPagoYEnviarAOdoo('order-1');
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(inventario.comprometerParaOrder).not.toHaveBeenCalled();
    expect(odoo.crearPedidoVenta).not.toHaveBeenCalled();
  });

  it('es resumible: si ya está PAGADO pero sin sincronizar a Odoo, solo reintenta la parte de Odoo', async () => {
    const { service, prisma, inventario, odoo } = crearService(crearOrder({ estado: EstadoPedido.PAGADO, odooSaleOrderId: null }));
    await service.confirmarPagoYEnviarAOdoo('order-1');
    expect(inventario.comprometerParaOrder).not.toHaveBeenCalled(); // ya se había comprometido antes
    expect(odoo.crearPedidoVenta).toHaveBeenCalled();
    expect(prisma.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { odooSaleOrderId: 999 } }));
  });
});
