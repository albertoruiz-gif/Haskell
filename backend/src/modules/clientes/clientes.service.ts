import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Canal, EstadoCliente, EstadoCobro, EstadoSolicitudCredito, EstadoSolicitudDescuento } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';

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
  private readonly logger = new Logger(ClientesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClient,
  ) {}

  private readonly CANALES_CON_CREDITO: Canal[] = ['SALONES_BELLEZA', 'RETAIL'];

  private validarCanalConCredito(canal: Canal) {
    if (!this.CANALES_CON_CREDITO.includes(canal)) {
      throw new BadRequestException(
        `El canal ${canal} no opera con clientes/crédito (EP-21) — solo Salones de Belleza y Retail.`,
      );
    }
  }

  /**
   * Sincroniza el Cliente a res.partner en Odoo — a propósito NUNCA revierte
   * ni bloquea la operación local si Odoo falla (mismo criterio que
   * OrdersService.confirmarPagoYEnviarAOdoo, EP-14): el negocio no puede
   * depender de que Odoo esté arriba para dar de alta un cliente o aprobar
   * un crédito. Se registra el error y se reintenta en la próxima
   * sincronización (ej. la siguiente vez que se actualice este cliente).
   */
  private async sincronizarConOdoo(cliente: {
    id: string;
    odooPartnerId: number | null;
    razonSocialONombre: string;
    numeroDocumento: string;
    telefono: string;
    email: string | null;
    direccion: string | null;
    lineaCreditoAprobada: unknown;
  }) {
    try {
      const odooPartnerId = await this.odoo.upsertClienteComoPartner({
        odooPartnerId: cliente.odooPartnerId,
        razonSocialONombre: cliente.razonSocialONombre,
        numeroDocumento: cliente.numeroDocumento,
        telefono: cliente.telefono,
        email: cliente.email,
        direccion: cliente.direccion,
        lineaCreditoAprobada: cliente.lineaCreditoAprobada != null ? Number(cliente.lineaCreditoAprobada) : null,
      });
      if (!cliente.odooPartnerId) {
        await this.prisma.cliente.update({ where: { id: cliente.id }, data: { odooPartnerId } });
      }
    } catch (e) {
      this.logger.error(`No se pudo sincronizar a Odoo el cliente ${cliente.id}: ${(e as Error).message}`);
    }
  }

  async crear(asesorId: string, data: { razonSocialONombre: string; tipoDocumento: string; numeroDocumento: string; telefono: string; email?: string; direccion?: string }) {
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    this.validarCanalConCredito(asesor.canal);

    const cliente = await this.prisma.cliente.create({
      data: { asesorId, canal: asesor.canal, ...data },
    });
    await this.sincronizarConOdoo(cliente);
    return cliente;
  }

  async listar(filtro: { asesorId?: string }) {
    return this.prisma.cliente.findMany({
      where: filtro.asesorId ? { asesorId: filtro.asesorId } : undefined,
      // Solo lo que el frontend necesita para decidir qué mostrar/habilitar
      // sin pedir el historial completo: la solicitud de crédito PENDIENTE
      // (si hay), y las de descuento PENDIENTE o APROBADA-sin-usar (EP-04
      // — "sin usar" = todavía no está ligada a ningún Order, ver el
      // "pedido: null" del filtro).
      include: {
        solicitudesCredito: { where: { estado: 'PENDIENTE' } },
        solicitudesDescuento: {
          where: { OR: [{ estado: 'PENDIENTE' }, { estado: 'APROBADA', pedido: null }] },
          orderBy: { createdAt: 'desc' },
        },
        // EP-21 — para que el Asesor vea "cobro enviado, esperando validación"
        // sin tener que abrir el detalle del cliente.
        cobros: { where: { estado: 'PENDIENTE' }, orderBy: { createdAt: 'desc' } },
      },
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
    await this.sincronizarConOdoo(cliente);
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

  // --- Descuentos por volumen (EP-04, decisión de negocio 2026-08-15) ---
  // Aprobación por pedido puntual (nunca queda vigente para compras
  // futuras — a diferencia de la línea de crédito, acá NO se guarda nada
  // en el Cliente). Umbral de quién puede aprobar: hasta 5% GERENTE_COMERCIAL,
  // más de 5% GERENTE_GENERAL — depende del VALOR pedido, no solo del rol,
  // así que el controller no alcanza con @Roles, se valida acá.
  private readonly UMBRAL_APROBACION_GERENTE_COMERCIAL = 5;

  async solicitarDescuento(clienteId: string, solicitadoPorId: string, data: { porcentaje: number; motivo?: string }) {
    if (data.porcentaje <= 0 || data.porcentaje > 100) {
      throw new BadRequestException('El porcentaje de descuento debe estar entre 0 y 100.');
    }
    return this.prisma.solicitudDescuento.create({
      data: { clienteId, solicitadoPorId, porcentaje: data.porcentaje, motivo: data.motivo },
    });
  }

  async listarSolicitudesDescuento(filtro: { estado?: EstadoSolicitudDescuento }) {
    return this.prisma.solicitudDescuento.findMany({
      where: filtro.estado ? { estado: filtro.estado } : undefined,
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async aprobarSolicitudDescuento(id: string, revisadoPorId: string, rolActor: string) {
    const solicitud = await this.prisma.solicitudDescuento.findUniqueOrThrow({ where: { id } });
    if (solicitud.estado !== EstadoSolicitudDescuento.PENDIENTE) {
      throw new BadRequestException(`La solicitud ya fue resuelta (${solicitud.estado}).`);
    }
    const porcentaje = Number(solicitud.porcentaje);
    // ADMINISTRADOR y GERENTE_GENERAL pueden aprobar cualquier %; GERENTE_COMERCIAL
    // solo hasta el umbral — por encima de eso, esta misma llamada rechaza y
    // el pedido tiene que volver a mandarse a Gerencia General.
    if (porcentaje > this.UMBRAL_APROBACION_GERENTE_COMERCIAL && rolActor === 'GERENTE_COMERCIAL') {
      throw new ForbiddenException(
        `Este descuento (${porcentaje}%) supera el ${this.UMBRAL_APROBACION_GERENTE_COMERCIAL}% — requiere aprobación de Gerente General.`,
      );
    }
    return this.prisma.solicitudDescuento.update({
      where: { id },
      data: { estado: EstadoSolicitudDescuento.APROBADA, revisadoPorId, resueltoEn: new Date() },
    });
  }

  async rechazarSolicitudDescuento(id: string, revisadoPorId: string, motivoRechazo?: string) {
    const solicitud = await this.prisma.solicitudDescuento.findUniqueOrThrow({ where: { id } });
    if (solicitud.estado !== EstadoSolicitudDescuento.PENDIENTE) {
      throw new BadRequestException(`La solicitud ya fue resuelta (${solicitud.estado}).`);
    }
    return this.prisma.solicitudDescuento.update({
      where: { id },
      data: { estado: EstadoSolicitudDescuento.RECHAZADA, revisadoPorId, motivoRechazo, resueltoEn: new Date() },
    });
  }

  // --- Cobranza ligera (EP-21, con validación desde 2026-08-17) ---
  // Registrar un cobro ya NO lo aplica al saldo — nace PENDIENTE con el
  // comprobante adjunto (si lo hay) y recién descuenta de
  // Cliente.saldoUtilizado cuando alguien de Gerencia Comercial/
  // Administración/Finanzas lo valida (validarCobro). Quien lo registra
  // nunca lo autoaprueba, mismo criterio que SolicitudCredito/SolicitudDescuento.

  async registrarCobro(
    clienteId: string,
    registradoPorId: string,
    data: { monto: number; metodo: string; numeroOperacion?: string; banco?: string; observaciones?: string; comprobanteUrl?: string },
  ) {
    await this.prisma.cliente.findUniqueOrThrow({ where: { id: clienteId } });
    return this.prisma.registroCobro.create({ data: { clienteId, registradoPorId, ...data } });
  }

  async listarCobros(filtro: { estado?: EstadoCobro; clienteId?: string }) {
    return this.prisma.registroCobro.findMany({
      where: { estado: filtro.estado, clienteId: filtro.clienteId },
      include: { cliente: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validarCobro(id: string, revisadoPorId: string) {
    const cobro = await this.prisma.registroCobro.findUniqueOrThrow({ where: { id } });
    if (cobro.estado !== EstadoCobro.PENDIENTE) {
      throw new BadRequestException(`Este cobro ya fue resuelto (${cobro.estado}).`);
    }
    const cliente = await this.prisma.cliente.findUniqueOrThrow({ where: { id: cobro.clienteId } });
    // No se permite que un cobro mal ingresado deje saldoUtilizado negativo
    // (ej. registrar 500 cuando solo debía 300) — se recorta a 0, no revienta.
    const nuevoSaldo = Math.max(0, Number(cliente.saldoUtilizado) - Number(cobro.monto));

    const [cobroValidado] = await this.prisma.$transaction([
      this.prisma.registroCobro.update({
        where: { id },
        data: { estado: EstadoCobro.VALIDADO, revisadoPorId, resueltoEn: new Date() },
      }),
      this.prisma.cliente.update({
        where: { id: cobro.clienteId },
        data: {
          saldoUtilizado: nuevoSaldo,
          // Si estaba MOROSO y ya cubrió toda la deuda, vuelve a ACTIVO solo.
          // BLOQUEADO no se levanta automático — ese es un paso manual aparte.
          estado: nuevoSaldo === 0 && cliente.estado === EstadoCliente.MOROSO ? EstadoCliente.ACTIVO : cliente.estado,
        },
      }),
    ]);
    return cobroValidado;
  }

  async rechazarCobro(id: string, revisadoPorId: string, motivoRechazo?: string) {
    const cobro = await this.prisma.registroCobro.findUniqueOrThrow({ where: { id } });
    if (cobro.estado !== EstadoCobro.PENDIENTE) {
      throw new BadRequestException(`Este cobro ya fue resuelto (${cobro.estado}).`);
    }
    // Nunca tocó el saldo (solo se aplica al validar) — rechazar es puramente
    // dejar constancia, no hay nada que revertir.
    return this.prisma.registroCobro.update({
      where: { id },
      data: { estado: EstadoCobro.RECHAZADO, revisadoPorId, motivoRechazo, resueltoEn: new Date() },
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
