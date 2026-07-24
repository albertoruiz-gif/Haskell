import { Injectable, BadRequestException } from '@nestjs/common';
import { AlcanceOferta, Canal, EstadoCatalogo, TipoPromocion } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  // RF-040: crear campaña con al menos un canal objetivo
  async crearCampania(data: {
    codigo: string;
    nombre: string;
    descripcion?: string;
    fechaInicio: Date;
    fechaFin: Date;
    canalesObjetivo: Canal[];
  }) {
    if (!data.canalesObjetivo?.length) {
      throw new BadRequestException('La campaña requiere al menos un canal objetivo.');
    }
    return this.prisma.campaign.create({ data });
  }

  // RF-041: un catalogo independiente por canal dentro de la campaña
  async crearCatalogoPorCanal(campaignId: string, canal: Canal, responsableCargaId: string) {
    const ultimaVersion = await this.prisma.catalog.findFirst({
      where: { campaignId, canal },
      orderBy: { version: 'desc' },
    });
    return this.prisma.catalog.create({
      data: {
        campaignId,
        canal,
        version: (ultimaVersion?.version ?? 0) + 1,
        estado: EstadoCatalogo.BORRADOR,
        responsableCargaId,
      },
    });
  }

  // RF-046: aprobar/observar — separado de quien cargó (RN-035)
  async aprobarCatalogo(catalogId: string, aprobadorId: string) {
    const catalogo = await this.prisma.catalog.findUniqueOrThrow({ where: { id: catalogId } });
    if (catalogo.responsableCargaId === aprobadorId) {
      throw new BadRequestException('Quien carga el catálogo no puede aprobarlo (RN-035).');
    }
    return this.prisma.catalog.update({
      where: { id: catalogId },
      data: { estado: EstadoCatalogo.APROBADO, responsableAprobacionId: aprobadorId },
    });
  }

  async observarCatalogo(catalogId: string, aprobadorId: string, motivo: string) {
    return this.prisma.catalog.update({
      where: { id: catalogId },
      data: { estado: EstadoCatalogo.OBSERVADO, responsableAprobacionId: aprobadorId, motivoObservacion: motivo },
    });
  }

  // RF-047: publicar segun vigencia — el vencimiento lo procesa un job programado (pendiente de implementar cron)
  async publicarCatalogo(catalogId: string, vigenciaDesde: Date, vigenciaHasta: Date) {
    return this.prisma.catalog.update({
      where: { id: catalogId },
      data: { estado: EstadoCatalogo.PUBLICADO, vigenciaDesde, vigenciaHasta },
    });
  }

  async suspenderCatalogo(catalogId: string, actorId: string, motivo: string) {
    if (!motivo) throw new BadRequestException('La suspensión requiere motivo (RN-040).');
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'SUSPENDER_CATALOGO', entidad: 'Catalog', entidadId: catalogId, motivo },
    });
    return this.prisma.catalog.update({ where: { id: catalogId }, data: { estado: EstadoCatalogo.SUSPENDIDO } });
  }

  /**
   * Ofertas temporales (dia/semana/mes) — adenda v0.3, extiende RF-043/RF-044.
   * No requieren nueva version completa de catalogo; se aplican sobre un
   * catalogo ya publicado. Por defecto no se acumulan con la promocion base
   * (ver DP-024 pendiente de decision formal).
   */
  async crearOfertaTemporal(data: {
    catalogId: string;
    catalogLineId?: string;
    alcance: AlcanceOferta;
    descuentoPct?: number;
    precioFijo?: number;
    inicio: Date;
    fin: Date;
    creadoPorId: string;
  }) {
    const catalogo = await this.prisma.catalog.findUniqueOrThrow({ where: { id: data.catalogId } });
    if (catalogo.estado !== EstadoCatalogo.PUBLICADO) {
      throw new BadRequestException('Solo se pueden crear ofertas sobre un catálogo publicado.');
    }
    if (!data.descuentoPct && !data.precioFijo) {
      throw new BadRequestException('La oferta necesita descuentoPct o precioFijo.');
    }

    return this.prisma.offer.create({
      data: {
        catalogId: data.catalogId,
        catalogLineId: data.catalogLineId,
        tipo: TipoPromocion.OFERTA_TEMPORAL,
        alcance: data.alcance,
        descuentoPct: data.descuentoPct,
        precioFijo: data.precioFijo,
        inicio: data.inicio,
        fin: data.fin,
        creadoPorId: data.creadoPorId,
      },
    });
  }

  /** Devuelve la oferta vigente (si existe) para una linea de catalogo en el momento actual. */
  async ofertaVigentePara(catalogLineId: string, ahora = new Date()) {
    return this.prisma.offer.findFirst({
      where: {
        catalogLineId,
        activa: true,
        inicio: { lte: ahora },
        fin: { gte: ahora },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Listado para el panel de administrador (pestaña Ofertas). */
  async listarOfertas(catalogId?: string) {
    return this.prisma.offer.findMany({
      where: catalogId ? { catalogId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }
}
