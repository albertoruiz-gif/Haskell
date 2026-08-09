import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
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

  // asesorId opcional: cuando lo llama el propio asesor via PaymentsController,
  // se valida que el pedido sea suyo (mismo criterio que crearPedidoDesdeItems).
  async ejecutarCargo(orderId: string, culqiToken: string, asesorId?: string) {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { asesor: { include: { user: true } } },
    });
    if (asesorId && order.asesorId !== asesorId) {
      throw new ForbiddenException('Este pedido no te pertenece.');
    }
    const montoCentimos = Math.round(Number(order.totalCulqi) * 100);

    if (montoCentimos > this.LIMITE_YAPE_CENTIMOS) {
      throw new BadRequestException('El pedido excede el límite Yape vigente (RN-015).');
    }

    // Idempotencia (RF-020): si ya existe un pago aprobado para este pedido, no se cobra de nuevo.
    const pagoPrevio = await this.prisma.payment.findFirst({ where: { orderId, estado: 'aprobado' } });
    if (pagoPrevio) return pagoPrevio;

    const { privateKey } = this.secrets.culqi();
    // NOTA: no se implementó el cifrado RSA/AES de "Llaves RSA" — no se pudo
    // confirmar contra la doc de Culqi que /v2/charges con un source_id ya
    // tokenizado lo exija (aplicaría según Culqi solo a "ciertos endpoints").
    // Si Culqi rechaza el cargo con un error de cifrado/firma, hay que
    // retomar esto siguiendo su ejemplo AES-256-GCM + RSA-OAEP-SHA256 +
    // header x-culqi-rsa-id (CULQI_RSA_ID/CULQI_RSA_PUBLIC_KEY ya están en
    // secrets.service.ts, sin usar todavía).
    // Culqi devuelve 4xx (no 200) cuando el cargo es rechazado por el banco/
    // Yape — se captura para guardar un Payment "rechazado" con el motivo
    // real en vez de un 500 crudo (el frontend necesita merchant_message).
    let data: any;
    try {
      const res = await axios.post(
        'https://api.culqi.com/v2/charges',
        { amount: montoCentimos, currency_code: 'PEN', email: order.asesor.user.email, source_id: culqiToken },
        { headers: { Authorization: `Bearer ${privateKey}` } },
      );
      data = res.data;
    } catch (err: any) {
      if (!err.response) throw err; // error de red real, no un rechazo de Culqi
      data = err.response.data;
    }

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
      await this.ordersService.confirmarPagoYEnviarAOdoo(orderId);
    }

    return payment;
  }
}
