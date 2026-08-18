import { BadRequestException } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { TRANSICIONES_VALIDAS, asegurarTransicionValida } from './maquina-estados-pedido';

describe('maquina-estados-pedido (EP-07)', () => {
  it('el mapa cubre TODOS los valores del enum EstadoPedido, sin faltar ninguno', () => {
    const valores = Object.values(EstadoPedido);
    for (const estado of valores) {
      expect(TRANSICIONES_VALIDAS).toHaveProperty(estado);
    }
    expect(Object.keys(TRANSICIONES_VALIDAS).sort()).toEqual([...valores].sort());
  });

  it('los estados terminales (ENTREGADO, CANCELADO_DEVUELTO, ANULADO_POR_VENCIMIENTO) no tienen ninguna transición de salida', () => {
    expect(TRANSICIONES_VALIDAS[EstadoPedido.ENTREGADO]).toEqual([]);
    expect(TRANSICIONES_VALIDAS[EstadoPedido.CANCELADO_DEVUELTO]).toEqual([]);
    expect(TRANSICIONES_VALIDAS[EstadoPedido.ANULADO_POR_VENCIMIENTO]).toEqual([]);
  });

  it('asegurarTransicionValida no tira nada si la transición está permitida', () => {
    expect(() => asegurarTransicionValida(EstadoPedido.PENDIENTE_PAGO, EstadoPedido.PAGADO)).not.toThrow();
    expect(() => asegurarTransicionValida(EstadoPedido.EN_RUTA, EstadoPedido.ENTREGADO)).not.toThrow();
  });

  it('asegurarTransicionValida tira BadRequestException con los nombres en español si la transición no existe', () => {
    expect(() => asegurarTransicionValida(EstadoPedido.ENTREGADO, EstadoPedido.PENDIENTE_PAGO)).toThrow(BadRequestException);
    expect(() => asegurarTransicionValida(EstadoPedido.PENDIENTE_PAGO, EstadoPedido.ENTREGADO)).toThrow(
      /Pendiente de pago.*Entregado/,
    );
  });

  it('no permite saltarse pasos del flujo de despacho (ej. de PAGADO directo a EN_RUTA)', () => {
    expect(() => asegurarTransicionValida(EstadoPedido.PAGADO, EstadoPedido.EN_RUTA)).toThrow(BadRequestException);
  });
});
