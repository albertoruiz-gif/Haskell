import { BadRequestException, Injectable } from '@nestjs/common';
import { Canal, EstadoCliente, EstadoSolicitudCredito } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

/**
 * EP-21 — Clientes y línea de crédito (canales SALONES_BELLEZA/RETAIL).
 *
 * Decisiones de negocio (definidas con Alberto 2026-08-13, basadas en
 * Playbook_Creditos_Cobranzas de Efficax, calibrado hacia abajo para la
 * escala de Haskell):
 * - Solo SALONES_BELLEZA y RETAIL operan a crédito. COMERCIO_MINORISTA
 *   nunca tiene Cliente ni SolicitudCredito — el Asesor compra para sí.
 * - La aprobación de línea de crédito SIEMPRE la resuelve GERENTE_COMERCIAL
 *   (nunca el Asesor, nunca automático), sin excepción por canal o monto.
 * - Cobranza ligera únicamente: RegistroCobro es un registro manual de
 *   pago contra la deuda acumulada, no hay conciliación bancaria automática
 *   ni un módulo de cobranzas completo.
 * - Regla dura: un Cliente MOROSO no puede comprar AL_CREDITO — fuerza
 *   CONTADO (depósito o Culqi) hasta regularizar. Hoy el paso a MOROSO es
 *   manual (marcarEstado) porque el plazo de crédito/vencimiento todavía no
 *   está definido como regla de negocio — cuando se defina, agregar el
 *   cálculo automático acá sin tocar el resto del flujo.
 */
@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly CANALES_CON_CREDITO: Canal[] = ['SALONES_BELLEZA', 'RETAIL'];

  private validarCanalConCredito(canal: Canal) {
    if (!this.CANALES_CON_CREDITO.includes(canal)) {
      throw new BadRequestException(
        `El canal ${canal} no opera con clientes/crédito (EP-21) — solo Salones de Belleza y Retail.`,
      );
    }
  }

  async crear(asesorId: string, data: { razonSocialONombre: string; tipoDocumento: string; numeroDocumento: string; telefono: string; email?: string; direccion?: string }) {
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    this.validarCanalConCredito(asesor.canal);

    return this.prisma.cliente.create({
      data: { asesorId, canal: asesor.canal, ...data },
    });
  }

  async listar(filtro: { asesorId?: string }) {
    return this.prisma.cliente.findMany({
      where: filtro.asesorId ? { asesorId: filtro.asesorId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async obtener(id: string) {
    return this.prisma.cliente.findUniqueOrThrow({
      where: { id },
      include: {
        solicitudesCredito: { orderBy: { createdAt: 'desc' } },
        cobros: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async marcarEstado(id: string, estado: EstadoCliente) {
    return this.prisma.cliente.update({ where: { id }, data: { estado } });
  }

  // --- Solicitudes de crédito ---

  async solicitarCredito(clienteId: string, solicitadoPorId: string, data: { lineaSolicitada: number; motivo?: string }) {
    const pendiente = await this.prisma.solicitudCredito.findFirst({
      where: { clienteId, estado: EstadoSolicitudCredito.PENDIENTE },
    });
    if (pendiente) {
      throw new BadRequestException('Este cliente ya tiene una solicitud de crédito pendiente de revisión.');
    }
    return this.prisma.solicitudCredito.create({
      data: { clienteId, solicitadoPorId, lineaSolicitada: data.lineaSolicitada, motivo: data.motivo },
    });
  }

  async listarSolicitudes(filtro: { estado?: EstadoSolicitudCredito }) {
    return this.prisma.solicitudCredito.findMany({
      where: filtro.estado ? { estado: filtro.estado } : undefined,
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async aprobarSolicitud(id: string, revisadoPorId: string, lineaAprobada: number) {
    const solicitud = await this.prisma.solicitudCredito.findUniqueOrThrow({ where: { id } });
    if (solicitud.estado !== EstadoSolicitudCredito.PENDIENTE) {
      throw new BadRequestException(`La solicitud ya fue resuelta (${solicitud.estado}).`);
    }
    const [, cliente] = await this.prisma.$transaction([
      this.prisma.solicitudCredito.update({
        where: { id },
        data: { estado: EstadoSolicitudCredito.APROBADA, revisadoPorId, lineaAprobada, resueltoEn: new Date() },
      }),
      this.prisma.cliente.update({
        where: { id: solicitud.clienteId },
        data: { lineaCreditoAprobada: lineaAprobada, estado: EstadoCliente.ACTIVO },
      }),
    ]);
    return cliente;
  }

  async rechazarSolicitud(id: string, revisadoPorId: string, motivoRechazo?: string) {
    const solicitud = await this.prisma.solicitudCredito.findUniqueOrThrow({ where: { id } });
    if (solicitud.estado !== EstadoSolicitudCredito.PENDIENTE) {
      throw new BadRequestException(`La solicitud ya fue resuelta (${solicitud.estado}).`);
    }
    return this.prisma.solicitudCredito.update({
      where: { id },
      data: { estado: EstadoSolicitudCredito.RECHAZADA, revisadoPorId, motivoRechazo, resueltoEn: new Date() },
    });
  }

  // --- Cobranza ligera ---

  async registrarCobro(
    clienteId: string,
    registradoPorId: string,
    data: { monto: number; metodo: string; numeroOperacion?: string; banco?: string; observaciones?: string },
  ) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    // No se permite que un cobro mal ingresado deje saldoUtilizado negativo
    // (ej. registrar 500 cuando solo debía 300) — se recorta a 0, no revienta.
    const nuevoSaldo = Math.max(0, Number(cliente.saldoUtilizado) - data.monto);

    return this.prisma.$transaction(async (tx) => {
      const cobro = await tx.registroCobro.create({ data: { clienteId, registradoPorId, ...data } });
      await tx.cliente.update({
        where: { id: clienteId },
        data: {
          saldoUtilizado: nuevoSaldo,
          // Si estaba MOROSO y ya cubrió toda la deuda, vuelve a ACTIVO solo.
          // BLOQUEADO no se levanta automático — ese es un paso manual aparte.
          estado: nuevoSaldo === 0 && cliente.estado === EstadoCliente.MOROSO ? EstadoCliente.ACTIVO : cliente.estado,
        },
      });
      return cobro;
    });
  }

  // --- Usado por OrdersService al crear/rechazar un pedido AL_CREDITO ---

  /** Valida cupo disponible y reserva el monto contra la línea — lanza si no corresponde. */
  async reservarCredito(clienteId: string, montoPedido: number) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    if (cliente.estado !== EstadoCliente.ACTIVO) {
      throw new BadRequestException(
        `El cliente está ${cliente.estado} — no puede comprar al crédito, debe pagar contado (depósito o Culqi).`,
      );
    }
    if (!cliente.lineaCreditoAprobada) {
      throw new BadRequestException('Este cliente todavía no tiene línea de crédito aprobada — debe pagar contado.');
    }
    const saldoDisponible = Number(cliente.lineaCreditoAprobada) - Number(cliente.saldoUtilizado);
    if (montoPedido > saldoDisponible) {
      throw new BadRequestException(
        `El pedido (S/ ${montoPedido.toFixed(2)}) excede el crédito disponible de este cliente (S/ ${saldoDisponible.toFixed(2)}).`,
      );
    }
    await this.prisma.cliente.update({ where: { id: clienteId }, data: { saldoUtilizado: { increment: montoPedido } } });
  }

  /** Reversa la reserva de crédito de un pedido AL_CREDITO rechazado/anulado. */
  async liberarCredito(clienteId: string, montoPedido: number) {
    const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    const nuevoSaldo = Math.max(0, Number(cliente.saldoUtilizado) - montoPedido);
    await this.prisma.cliente.update({ where: { id: clienteId }, data: { saldoUtilizado: nuevoSaldo } });
  }
}
