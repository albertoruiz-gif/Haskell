import { Injectable } from '@nestjs/common';
import { AlcancePorcentaje, Canal } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

interface ContextoPrecio {
  campaignId: string;
  catalogId: string;
  canal: Canal;
}

/**
 * Calcula el precio del asesor y el total Culqi.
 * Adenda v0.3: el 80% de RN-008 pasa a ser un parametro editable
 * (PricingConfig), con prioridad catalogo > campaña > canal > global,
 * y 80% como default si no hay ninguna configuracion explicita.
 */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly PORCENTAJE_DEFAULT = 80;

  /** Resuelve el porcentaje vigente para un contexto, respetando la jerarquia de alcance. */
  async resolverPorcentajeAsesor(ctx: ContextoPrecio): Promise<number> {
    const config = await this.prisma.pricingConfig.findFirst({
      where: {
        OR: [
          { alcance: AlcancePorcentaje.CANAL, catalogId: ctx.catalogId, canal: ctx.canal },
          { alcance: AlcancePorcentaje.CAMPANA, campaignId: ctx.campaignId },
          { alcance: AlcancePorcentaje.GLOBAL },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return config ? Number(config.porcentajeAsesor) : this.PORCENTAJE_DEFAULT;
  }

  /** Actualiza el porcentaje del asesor. Requiere rol ADMINISTRADOR o GERENTE_COMERCIAL (validado en el controller/guard). */
  async actualizarPorcentaje(params: {
    alcance: AlcancePorcentaje;
    porcentaje: number;
    actorId: string;
    campaignId?: string;
    canal?: Canal;
  }) {
    if (params.porcentaje <= 0 || params.porcentaje > 100) {
      throw new Error('El porcentaje del asesor debe estar entre 0 y 100.');
    }

    const nuevo = await this.prisma.pricingConfig.create({
      data: {
        alcance: params.alcance,
        porcentajeAsesor: params.porcentaje,
        campaignId: params.campaignId,
        canal: params.canal,
        actualizadoPorId: params.actorId,
      },
    });

    // Auditoria obligatoria (adenda v0.3 seccion 1 / RN-027, RNF-008)
    await this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        accion: 'ACTUALIZAR_PORCENTAJE_ASESOR',
        entidad: 'PricingConfig',
        entidadId: nuevo.id,
        valoresDespues: { porcentaje: params.porcentaje, alcance: params.alcance },
      },
    });

    return nuevo;
  }

  /** PVP * (porcentaje / 100), redondeado a 2 decimales (pendiente definir regla exacta de redondeo — DP-007). */
  calcularPrecioAsesor(pvpUnitario: number, porcentaje: number): number {
    return Math.round(pvpUnitario * (porcentaje / 100) * 100) / 100;
  }

  /** RN-010 (adenda): Total Culqi = Σ(PVP × %asesor vigente × cantidad) + envío. El envío no lleva descuento (RN-009). */
  calcularTotalCulqi(items: { pvpUnitario: number; porcentaje: number; cantidad: number }[], envio: number): number {
    const subtotal = items.reduce(
      (acc, item) => acc + this.calcularPrecioAsesor(item.pvpUnitario, item.porcentaje) * item.cantidad,
      0,
    );
    return Math.round((subtotal + envio) * 100) / 100;
  }
}
