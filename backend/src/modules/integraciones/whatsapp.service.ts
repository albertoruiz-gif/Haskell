import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { ESTADO_PEDIDO_LABEL } from '../../common/estados-pedido.util';

/** Peru: celulares son 9 digitos. Comparamos por los ultimos 9 digitos para
 * tolerar formatos distintos (+51987654321, 987654321, 51 987 654 321, etc.). */
function ultimosNueveDigitos(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  return soloDigitos.slice(-9);
}

@Injectable()
export class WhatsappIntegracionService {
  constructor(private readonly prisma: PrismaService) {}

  async consultarPedido(telefonoCrudo: string, referencia?: string) {
    const ultimos9 = ultimosNueveDigitos(telefonoCrudo);
    if (ultimos9.length < 9) {
      return { encontrado: false, motivo: 'telefono_invalido' as const };
    }

    const asesor = await this.prisma.asesor.findFirst({
      where: {
        OR: [
          { telefonoPrincipal: { contains: ultimos9 } },
          { telefonoSecundario: { contains: ultimos9 } },
        ],
      },
    });

    if (!asesor) {
      return { encontrado: false, motivo: 'asesor_no_encontrado' as const };
    }

    const pedido = referencia
      ? await this.prisma.order.findFirst({
          where: { asesorId: asesor.id, referenciaWeb: { contains: referencia, mode: 'insensitive' } },
          include: { entrega: true },
          orderBy: { createdAt: 'desc' },
        })
      : await this.prisma.order.findFirst({
          where: { asesorId: asesor.id },
          include: { entrega: true },
          orderBy: { createdAt: 'desc' },
        });

    if (!pedido) {
      return { encontrado: false, motivo: 'pedido_no_encontrado' as const };
    }

    return {
      encontrado: true as const,
      referenciaWeb: pedido.referenciaWeb,
      estado: pedido.estado,
      estadoEs: ESTADO_PEDIDO_LABEL[pedido.estado],
      totalCulqi: Number(pedido.totalCulqi),
      creadoEn: pedido.createdAt,
      pagadoEn: pedido.pagadoEn,
      entrega: pedido.entrega
        ? { estado: pedido.entrega.estado, receptor: pedido.entrega.receptor }
        : null,
    };
  }
}
