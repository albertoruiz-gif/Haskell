import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../config/prisma.service';
import { SecretsService } from '../../config/secrets.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Culqi Checkout Custom + Yape (RF-018 a RF-021).
 * El frontend solo usa la llave publica para tokenizar; esta clase corre
 * en el backend con la llave privada y jamas la expone.
 * TODO: implementar cifrado RSA del payload (RSA ID + llave publica RSA, ver RFD 8.1)
 * antes de enviar datos sensibles al Checkout, segun documentacion oficial de Culqi.
 */
@Injectable()
export class CulqiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretsService,
    private readonly ordersService: OrdersService,
  ) {}

  private readonly LIMITE_YAPE_CENTIMOS = 200_000; // S/2,000 — configurable, ver RN-015

  async ejecutarCargo(orderId: string, culqiToken: string) {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const montoCentimos = Math.round(Number(order.totalCulqi) * 100);

    if (montoCentimos > this.LIMITE_YAPE_CENTIMOS) {
      throw new BadRequestException('El pedido excede el límite Yape vigente (RN-015).');
    }

    // Idempotencia (RF-020): si ya existe un pago aprobado para este pedido, no se cobra de nuevo.
    const pagoPrevio = await this.prisma.payment.findFirst({ where: { orderId, estado: 'aprobado' } });
    if (pagoPrevio) return pagoPrevio;

    const { privateKey } = this.secrets.culqi();
    const { data } = await axios.post(
      'https://api.culqi.com/v2/charges',
      { amount: montoCentimos, currency_code: 'PEN', source_id: culqiToken },
      { headers: { Authorization: `Bearer ${privateKey}` } },
    );

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        culqiChargeId: data.id,
        estado: data.outcome?.type === 'venta_exitosa' ? 'aprobado' : 'rechazado',
        montoCentimos,
        respuestaJson: data,
      },
    });

    if (payment.estado === 'aprobado') {
      await this.ordersService.confirmarPagoYEnviarAOdoo(orderId, data.id);
    }

    return payment;
  }
}
