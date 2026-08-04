import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { AlcanceOferta, Canal, EstadoCatalogo, TipoPromocion } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly odoo: OdooClient,
  ) {}

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

    const oferta = await this.prisma.offer.create({
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

    if (data.catalogLineId) {
      await this.sincronizarOfertaAOdoo(oferta.id, data.catalogLineId, data.precioFijo, data.descuentoPct, data.inicio, data.fin);
    }

    return oferta;
  }

  /**
   * Refleja la oferta recién creada en Odoo como product.pricelist.item de
   * la lista "Ofertas vigentes" (ver catalogo-haskell/PROMPT_trasladar_ofertas_a_odoo.md).
   * Sincronización en vivo (por evento), best-effort: si Odoo falla, la
   * oferta igual queda creada en la plataforma — no bloquea el flujo
   * comercial por una falla externa; solo se registra en el log y
   * odooPricelistItemId queda null (se puede reintentar a mano).
   */
  private async sincronizarOfertaAOdoo(
    offerId: string,
    catalogLineId: string,
    precioFijo: number | undefined,
    descuentoPct: number | undefined,
    inicio: Date,
    fin: Date,
  ) {
    try {
      const linea = await this.prisma.catalogLine.findUniqueOrThrow({ where: { id: catalogLineId } });
      // Mismo calculo que catalog.controller.mapearLinea: el precio fijo
      // manda si esta seteado; si no, el descuento se aplica sobre pvpCampania.
      const precioEfectivo = precioFijo
        ? Number(precioFijo)
        : descuentoPct
          ? Number(linea.pvpCampania) * (1 - Number(descuentoPct) / 100)
          : Number(linea.pvpCampania);

      const odooPricelistItemId = await this.odoo.crearItemPricelistOferta({ sku: linea.sku, precioEfectivo, inicio, fin });
      await this.prisma.offer.update({ where: { id: offerId }, data: { odooPricelistItemId } });
    } catch (e) {
      this.logger.warn(`No se pudo reflejar en Odoo la oferta ${offerId}: ${e instanceof Error ? e.message : e}`);
    }
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

  /**
   * Listado para el panel de administrador (pestaña Ofertas) — ahora es
   * solo lectura: crear/desactivar una oferta vive en la ficha de cada
   * producto ("Ver ficha completa" en Catálogo/Precios), así que acá alcanza
   * con traer también el producto (sku/nombre) para poder mostrarlo.
   */
  async listarOfertas(catalogId?: string) {
    return this.prisma.offer.findMany({
      where: catalogId ? { catalogId } : undefined,
      include: { catalogLine: { select: { sku: true, nombre: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async desactivarOferta(id: string) {
    const oferta = await this.prisma.offer.update({ where: { id }, data: { activa: false } });
    if (oferta.odooPricelistItemId) {
      try {
        await this.odoo.eliminarItemPricelist(oferta.odooPricelistItemId);
      } catch (e) {
        this.logger.warn(`No se pudo retirar de Odoo el pricelist.item de la oferta ${id}: ${e instanceof Error ? e.message : e}`);
      }
    }
    return oferta;
  }
}
