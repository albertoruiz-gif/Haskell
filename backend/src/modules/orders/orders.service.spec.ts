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
