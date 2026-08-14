import { BadRequestException } from '@nestjs/common';
import { InventarioService } from './inventario.service';

/**
 * FEFO (First-Expired-First-Out) es la garantía central de que no se vende
 * stock que no existe físicamente ni se despacha primero lo que vence más
 * tarde — si esto falla en producción, se traduce en pedidos pagados sin
 * producto real para entregar. Se prueba con el algoritmo real (sin mocks
 * de la lógica de reparto entre lotes), solo Prisma queda mockeado.
 */
describe('InventarioService — reservarParaOrder (FEFO)', () => {
  function crearService(opts: { lotes: any[]; itemCantidad: number; reservasVencidas?: any[] }) {
    const order = {
      id: 'order-1',
      catalogId: 'cat-1',
      items: [{ id: 'item-1', sku: 'HSK-01', cantidad: opts.itemCantidad }],
    };
    const catalogLine = { id: 'cl-1', nombre: 'Shampoo X' };

    const reservasCreadas: any[] = [];
    const prisma: any = {
      order: { findUniqueOrThrow: jest.fn().mockResolvedValue(order) },
      catalogLine: {
        findFirst: jest.fn().mockResolvedValue(catalogLine),
        update: jest.fn().mockResolvedValue({}),
      },
      loteInventario: { findMany: jest.fn().mockResolvedValue(opts.lotes) },
      reservaStock: {
        create: jest.fn().mockImplementation(({ data }: any) => {
          reservasCreadas.push(data);
          return Promise.resolve({ id: `reserva-${reservasCreadas.length}`, ...data });
        }),
        findMany: jest.fn().mockResolvedValue(opts.reservasVencidas ?? []),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderItem: { findMany: jest.fn().mockResolvedValue(order.items) },
    };
    const configuracion = { minutosReservaStock: jest.fn().mockResolvedValue(30) };
    return { service: new InventarioService(prisma, configuracion as any), prisma, reservasCreadas };
  }

  function lote(id: string, fechaVencimiento: string, cantidadRecibida: number, reservas: { cantidad: number }[] = []) {
    return {
      id,
      cantidadRecibida,
      cantidadDanada: 0,
      fechaVencimiento: new Date(fechaVencimiento),
      reservas: reservas.map((r, i) => ({ id: `r-${id}-${i}`, ...r })),
    };
  }

  it('reserva del lote que vence antes cuando alcanza con uno solo', async () => {
    const lotes = [lote('lote-viejo', '2026-09-01', 20), lote('lote-nuevo', '2027-01-01', 20)];
    const { service, reservasCreadas } = crearService({ lotes, itemCantidad: 10 });

    await service.reservarParaOrder('order-1');

    expect(reservasCreadas).toHaveLength(1);
    expect(reservasCreadas[0]).toEqual(expect.objectContaining({ loteId: 'lote-viejo', cantidad: 10 }));
  });

  it('si el lote que vence antes no alcanza, completa con el siguiente (reparto FEFO entre lotes)', async () => {
    const lotes = [lote('lote-viejo', '2026-09-01', 6), lote('lote-nuevo', '2027-01-01', 20)];
    const { service, reservasCreadas } = crearService({ lotes, itemCantidad: 10 });

    await service.reservarParaOrder('order-1');

    expect(reservasCreadas).toHaveLength(2);
    expect(reservasCreadas[0]).toEqual(expect.objectContaining({ loteId: 'lote-viejo', cantidad: 6 }));
    expect(reservasCreadas[1]).toEqual(expect.objectContaining({ loteId: 'lote-nuevo', cantidad: 4 }));
  });

  it('descuenta las reservas activas ya existentes de un lote antes de repartir', async () => {
    // El lote tiene 10 recibidas pero ya 7 reservadas por otro pedido -> solo 3 disponibles ahí.
    const lotes = [lote('lote-viejo', '2026-09-01', 10, [{ cantidad: 7 }]), lote('lote-nuevo', '2027-01-01', 20)];
    const { service, reservasCreadas } = crearService({ lotes, itemCantidad: 10 });

    await service.reservarParaOrder('order-1');

    expect(reservasCreadas[0]).toEqual(expect.objectContaining({ loteId: 'lote-viejo', cantidad: 3 }));
    expect(reservasCreadas[1]).toEqual(expect.objectContaining({ loteId: 'lote-nuevo', cantidad: 7 }));
  });

  it('salta un lote sin stock disponible (todo ya reservado) y sigue con el próximo', async () => {
    const lotes = [lote('lote-agotado', '2026-09-01', 5, [{ cantidad: 5 }]), lote('lote-nuevo', '2027-01-01', 20)];
    const { service, reservasCreadas } = crearService({ lotes, itemCantidad: 8 });

    await service.reservarParaOrder('order-1');

    expect(reservasCreadas).toHaveLength(1);
    expect(reservasCreadas[0]).toEqual(expect.objectContaining({ loteId: 'lote-nuevo', cantidad: 8 }));
  });

  it('rechaza y libera lo ya reservado en este pedido si el stock total no alcanza', async () => {
    const lotes = [lote('lote-unico', '2026-09-01', 5)];
    const { service, prisma } = crearService({ lotes, itemCantidad: 10 });

    await expect(service.reservarParaOrder('order-1')).rejects.toThrow(BadRequestException);
    // liberarParaOrder debe correr como parte del catch — libera cualquier
    // reserva parcial que haya alcanzado a crearse para este pedido.
    expect(prisma.reservaStock.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: 'LIBERADO' } }),
    );
  });
});
