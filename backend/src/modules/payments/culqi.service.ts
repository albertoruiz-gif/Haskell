import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../config/prisma.service';
import { SecretsService } from '../../config/secrets.service';
import { OrdersService } from '../orders/orders.service';
import { cifrarPayloadCulqi } from './culqi-crypto';

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
    const payload = { amount: montoCentimos, currency_code: 'PEN', email: order.asesor.user.email, source_id: culqiToken };

    // Cifrado RSA/AES de "Llaves RSA" (docs.culqi.com/es/documentacion/pagos-online/llaves_rsa) —
    // implementado en culqi-crypto.ts (AES-256-GCM + RSA-OAEP-SHA256, verificado
    // con round-trip en culqi-crypto.spec.ts), pero DESACTIVADO por defecto
    // (CULQI_CIFRADO_ACTIVO=true para prenderlo): la doc de Culqi dice que el
    // cifrado solo aplica a los endpoints que se eligieron al crear la llave
    // RSA en el dashboard, y no hay forma de confirmar desde acá si /v2/charges
    // con un source_id ya tokenizado quedó incluido — activarlo a ciegas podría
    // rechazar cobros reales si Culqi no espera un payload cifrado en este
    // endpoint. Antes de activarlo: confirmar en el dashboard de Culqi
    // (Desarrollo → RSA Keys) qué endpoints protege esta llave.
    const cifradoActivo = process.env.CULQI_CIFRADO_ACTIVO === 'true';
    const headers: Record<string, string> = { Authorization: `Bearer ${privateKey}` };
    let body: unknown = payload;
    if (cifradoActivo) {
      const { rsaId, rsaPublicKey } = this.secrets.culqi();
      body = cifrarPayloadCulqi(payload, rsaPublicKey);
      headers['x-culqi-rsa-id'] = rsaId;
    }

    // Culqi devuelve 4xx (no 200) cuando el cargo es rechazado por el banco/
    // Yape — se captura para guardar un Payment "rechazado" con el motivo
    // real en vez de un 500 crudo (el frontend necesita merchant_message).
    let data: any;
    try {
      const res = await axios.post('https://api.culqi.com/v2/charges', body, { headers });
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
