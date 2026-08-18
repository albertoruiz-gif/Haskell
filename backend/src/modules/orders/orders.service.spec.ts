import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EstadoPedido, FormaPago } from '@prisma/client';
import { OrdersService } from './orders.service';
import { PricingService } from '../pricing/pricing.service';

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

    const clientes = { liberarCredito: jest.fn().mockResolvedValue(undefined), reservarCredito: jest.fn().mockResolvedValue(undefined) };
    const configuracion = { toleranciaConciliacionSoles: jest.fn().mockResolvedValue(5) };
    const service = new OrdersService(
      prisma as any,
      {} as any, // pricing — no lo usan estos dos métodos
      {} as any, // campaigns
      {} as any, // odoo
      inventario as any,
      operaciones as any,
      clientes as any,
      configuracion as any,
    );
    return { service, prisma, inventario, operaciones, clientes, configuracion };
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
    const clientes = { liberarCredito: jest.fn().mockResolvedValue(undefined), reservarCredito: jest.fn().mockResolvedValue(undefined) };
    const service = new OrdersService(prisma as any, {} as any, {} as any, odoo as any, inventario as any, {} as any, clientes as any, {} as any);
    return { service, prisma, inventario, odoo, clientes };
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

  // EP-07 (auditoría 2026-08-18): el chequeo anterior era "si NO está
  // PAGADO, marcarlo PAGADO" — una confirmación de Culqi que llegara tarde
  // sobre un pedido ya cancelado/vencido/entregado lo "resucitaba" a PAGADO
  // igual. Ahora exige que la transición sea válida (solo PENDIENTE_PAGO).
  it.each([EstadoPedido.CANCELADO_DEVUELTO, EstadoPedido.ANULADO_POR_VENCIMIENTO, EstadoPedido.ENTREGADO])(
    'NO resucita a PAGADO un pedido en %s aunque Culqi confirme tarde',
    async (estado) => {
      const { service, prisma, inventario } = crearService(crearOrder({ estado, odooSaleOrderId: null }));
      await expect(service.confirmarPagoYEnviarAOdoo('order-1')).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(inventario.comprometerParaOrder).not.toHaveBeenCalled();
    },
  );
});

// EP-04 (decisión de negocio 2026-08-15): descuento por volumen aprobado
// por pedido puntual, uso único, y el desglose de IGV que se le calcula
// hacia atrás a TODO pedido (con o sin descuento). Usa el PricingService
// REAL (no mockeado) para que el cálculo de plata sea el algoritmo de
// verdad, no una función que "se llamó con estos argumentos".
describe('OrdersService — crearPedidoDesdeItems (EP-04 descuento + IGV)', () => {
  function crearService() {
    const catalog = { id: 'cat1', campaignId: 'camp1', canal: 'RETAIL', estado: 'PUBLICADO' };
    const asesor = {
      id: 'a1',
      canal: 'RETAIL',
      direcciones: [{ id: 'd1', distrito: 'Lima', predeterminada: true }],
    };
    const catalogLine = { id: 'cl1', sku: 'HSK-01', nombre: 'Producto X', pvpCampania: 100, catalogId: 'cat1', catalog };

    const prisma: any = {
      asesor: { findUniqueOrThrow: jest.fn().mockResolvedValue(asesor) },
      cliente: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'c1', asesorId: 'a1' }) },
      tarifa: { findUnique: jest.fn().mockResolvedValue({ precio: 10, activa: true }) },
      catalogLine: { findMany: jest.fn().mockResolvedValue([catalogLine]) },
      solicitudDescuento: { findUniqueOrThrow: jest.fn() },
      order: {
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'order-nuevo', ...data, items: [] })),
      },
    };
    const pricingPrisma: any = { pricingConfig: { findFirst: jest.fn().mockResolvedValue(null) } }; // usa 80% default
    const pricing = new PricingService(pricingPrisma);
    const campaigns = { ofertaVigentePara: jest.fn().mockResolvedValue(null) };
    const inventario = { reservarParaOrder: jest.fn().mockResolvedValue(undefined) };
    const operaciones = { sincronizarEstadoPedidoAOdoo: jest.fn().mockResolvedValue(undefined) };
    const clientes = { reservarCredito: jest.fn().mockResolvedValue(undefined), liberarCredito: jest.fn().mockResolvedValue(undefined) };

    const service = new OrdersService(prisma, pricing, campaigns as any, {} as any, inventario as any, operaciones as any, clientes as any, {} as any);
    return { service, prisma, clientes };
  }

  // 1 unidad, PVP 100, %asesor 80 (default) -> precioAsesorUnitario 80, + envío 10 = totalCulqi 90 sin descuento.

  it('sin solicitudDescuentoId, no aplica descuento y calcula el IGV sobre el total completo', async () => {
    const { service } = crearService();
    const order = await service.crearPedidoDesdeItems('a1', [{ catalogLineId: 'cl1', cantidad: 1 }], { clienteId: 'c1' });
    expect(order.descuentoPct).toBe(0);
    expect(order.descuentoMonto).toBe(0);
    expect(order.totalCulqi).toBe(90); // 80 + 10 envío
    // igv = 90 - round(90/1.18,2) = 90 - 76.27 = 13.73
    expect(order.valorVenta).toBe(76.27);
    expect(order.igv).toBe(13.73);
  });

  it('con un descuento aprobado, lo aplica sobre el subtotal de productos (nunca sobre el envío) y recalcula el IGV sobre el total ya descontado', async () => {
    const { service, prisma } = crearService();
    prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({
      id: 'sd1', clienteId: 'c1', estado: 'APROBADA', porcentaje: 5, pedido: null,
    });

    const order = await service.crearPedidoDesdeItems('a1', [{ catalogLineId: 'cl1', cantidad: 1 }], {
      clienteId: 'c1',
      solicitudDescuentoId: 'sd1',
    });
    // subtotal productos = 80, descuento 5% = 4 -> totalCulqi = 80 - 4 + 10 envío = 86
    expect(order.descuentoPct).toBe(5);
    expect(order.descuentoMonto).toBe(4);
    expect(order.totalCulqi).toBe(86);
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ solicitudDescuentoId: 'sd1' }) }),
    );
  });

  it('rechaza un descuento que pertenece a otro cliente', async () => {
    const { service, prisma } = crearService();
    prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({
      id: 'sd1', clienteId: 'otro-cliente', estado: 'APROBADA', porcentaje: 5, pedido: null,
    });

    await expect(
      service.crearPedidoDesdeItems('a1', [{ catalogLineId: 'cl1', cantidad: 1 }], { clienteId: 'c1', solicitudDescuentoId: 'sd1' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('rechaza un descuento que todavía no fue aprobado', async () => {
    const { service, prisma } = crearService();
    prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({
      id: 'sd1', clienteId: 'c1', estado: 'PENDIENTE', porcentaje: 5, pedido: null,
    });

    await expect(
      service.crearPedidoDesdeItems('a1', [{ catalogLineId: 'cl1', cantidad: 1 }], { clienteId: 'c1', solicitudDescuentoId: 'sd1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza un descuento ya usado en otro pedido (uso único)', async () => {
    const { service, prisma } = crearService();
    prisma.solicitudDescuento.findUniqueOrThrow.mockResolvedValue({
      id: 'sd1', clienteId: 'c1', estado: 'APROBADA', porcentaje: 5, pedido: { id: 'otro-pedido' },
    });

    await expect(
      service.crearPedidoDesdeItems('a1', [{ catalogLineId: 'cl1', cantidad: 1 }], { clienteId: 'c1', solicitudDescuentoId: 'sd1' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('OrdersService — obtenerSeguimiento (EP-12)', () => {
  function crearService(order: any) {
    const prisma = { order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) } };
    const service = new OrdersService(prisma as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { service, prisma };
  }

  const ORDER_BASE = {
    id: 'o1',
    asesorId: 'a1',
    canal: 'RETAIL',
    numero: 42,
    referenciaWeb: 'ref-abc',
    estado: 'EN_RUTA',
    pagadoEn: new Date('2026-08-01T10:00:00Z'),
    entrega: null,
  };

  it('rechaza a un Asesor que pide el seguimiento de un pedido que no es suyo', async () => {
    const { service } = crearService({ ...ORDER_BASE, asesorId: 'otro-asesor' });
    await expect(service.obtenerSeguimiento('o1', 'a1', 'ASESOR')).rejects.toThrow(ForbiddenException);
  });

  it('deja pasar al dueño del pedido', async () => {
    const { service } = crearService(ORDER_BASE);
    const resultado = await service.obtenerSeguimiento('o1', 'a1', 'ASESOR');
    expect(resultado.referenciaWeb).toBe('ref-abc');
    expect(resultado.estado).toBe('EN_RUTA');
  });

  it('deja pasar a un rol administrativo aunque el pedido sea de otro asesor', async () => {
    const { service } = crearService({ ...ORDER_BASE, asesorId: 'otro-asesor' });
    await expect(service.obtenerSeguimiento('o1', 'admin-1', 'ADMINISTRADOR')).resolves.toBeDefined();
  });

  it('devuelve entrega: null cuando todavía no hay transportista asignado', async () => {
    const { service } = crearService(ORDER_BASE);
    const resultado = await service.obtenerSeguimiento('o1', 'a1', 'ASESOR');
    expect(resultado.entrega).toBeNull();
  });

  it('incluye el detalle de la entrega (con etiqueta en español) cuando ya hay transportista', async () => {
    const { service } = crearService({
      ...ORDER_BASE,
      entrega: {
        estado: 'EN_RUTA',
        transportista: { user: { nombre: 'Juan Pérez' } },
        fechaReprogramada: null,
        motivoFallo: null,
        receptor: null,
      },
    });
    const resultado = await service.obtenerSeguimiento('o1', 'a1', 'ASESOR');
    expect(resultado.entrega).toEqual(
      expect.objectContaining({ estado: 'EN_RUTA', estadoLabel: 'En camino', transportistaNombre: 'Juan Pérez' }),
    );
  });
});

// EP-16: registrarDeposito ahora acepta el monto que el Asesor declara, y
// validarDeposito lo concilia contra el total real con una tolerancia
// configurable — depósitos sin monto (registrados antes de este cambio) se
// saltan el chequeo, por compatibilidad hacia atrás.
describe('OrdersService — registrarDeposito / validarDeposito (EP-16)', () => {
  function crearService(ordenEnBD: Record<string, any>, tolerancia = 5) {
    const prisma = {
      order: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(ordenEnBD),
        update: jest.fn().mockResolvedValue({ ...ordenEnBD }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const inventario = { comprometerParaOrder: jest.fn().mockResolvedValue(undefined) };
    const operaciones = { sincronizarEstadoPedidoAOdoo: jest.fn().mockResolvedValue(undefined) };
    const configuracion = { toleranciaConciliacionSoles: jest.fn().mockResolvedValue(tolerancia) };
    const service = new OrdersService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
      inventario as any,
      operaciones as any,
      {} as any,
      configuracion as any,
    );
    return { service, prisma, inventario, operaciones, configuracion };
  }

  const ORDER_BASE = {
    id: 'order-1',
    formaPago: FormaPago.CONTADO_DEPOSITO,
    estado: EstadoPedido.PENDIENTE_PAGO,
    totalCulqi: 90,
    depositoNumeroOperacion: 'op-123',
    depositoMonto: null as number | null,
  };

  describe('registrarDeposito', () => {
    it('guarda el monto declarado junto con el resto de datos del depósito', async () => {
      const { service, prisma } = crearService({ ...ORDER_BASE, depositoNumeroOperacion: null });
      await service.registrarDeposito('order-1', { numeroOperacion: 'op-123', banco: 'BCP', monto: 90 });
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ depositoMonto: 90 }) }),
      );
    });
  });

  describe('validarDeposito', () => {
    it('valida sin problema cuando el monto declarado coincide con el total', async () => {
      const { service, prisma } = crearService({ ...ORDER_BASE, depositoMonto: 90 });
      await service.validarDeposito('order-1', 'actor-1');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: EstadoPedido.PAGADO }) }),
      );
    });

    it('valida sin problema cuando la diferencia está dentro de la tolerancia configurada', async () => {
      const { service, prisma } = crearService({ ...ORDER_BASE, depositoMonto: 93 }, 5);
      await service.validarDeposito('order-1', 'actor-1');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: EstadoPedido.PAGADO }) }),
      );
    });

    it('rechaza cuando la diferencia supera la tolerancia configurada', async () => {
      const { service, prisma, configuracion } = crearService({ ...ORDER_BASE, depositoMonto: 100 }, 5);
      await expect(service.validarDeposito('order-1', 'actor-1')).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
      expect(configuracion.toleranciaConciliacionSoles).toHaveBeenCalled();
    });

    it('no chequea conciliación si el depósito no tiene monto declarado (compatibilidad con depósitos previos)', async () => {
      const { service, prisma, configuracion } = crearService({ ...ORDER_BASE, depositoMonto: null });
      await service.validarDeposito('order-1', 'actor-1');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ estado: EstadoPedido.PAGADO }) }),
      );
      expect(configuracion.toleranciaConciliacionSoles).not.toHaveBeenCalled();
    });
  });
});
