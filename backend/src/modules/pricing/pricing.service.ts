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

  /** Σ(PVP × %asesor vigente × cantidad), sin envío — separado de calcularTotalCulqi para poder aplicarle el descuento de EP-04 antes de sumar el envío (RN-009: el envío nunca lleva descuento). */
  calcularSubtotalProductos(items: { pvpUnitario: number; porcentaje: number; cantidad: number }[]): number {
    const subtotal = items.reduce(
      (acc, item) => acc + this.calcularPrecioAsesor(item.pvpUnitario, item.porcentaje) * item.cantidad,
      0,
    );
    return Math.round(subtotal * 100) / 100;
  }

  /** RN-010 (adenda): Total Culqi = Σ(PVP × %asesor vigente × cantidad) + envío. El envío no lleva descuento (RN-009). */
  calcularTotalCulqi(items: { pvpUnitario: number; porcentaje: number; cantidad: number }[], envio: number): number {
    return Math.round((this.calcularSubtotalProductos(items) + envio) * 100) / 100;
  }

  private readonly IGV_TASA = 1.18; // 18%, Perú

  /**
   * EP-04 — descuento por volumen (decisión de negocio 2026-08-15): se
   * aplica sobre el subtotal de PRODUCTOS únicamente, nunca sobre el envío
   * (RN-009, mismo criterio que las ofertas). Redondeado a 2 decimales.
   */
  calcularDescuento(subtotalProductos: number, porcentaje: number): number {
    return Math.round(subtotalProductos * (porcentaje / 100) * 100) / 100;
  }

  /**
   * EP-04 (decisión de negocio 2026-08-15, verificada con el ejemplo real
   * del usuario: S/80 final → S/12.20 de IGV, S/67.80 de valor de venta):
   * "Haskell tiene en sus precios el IGV incluido" — totalConDescuento ya
   * ES el precio final que se cobra (Culqi/depósito/crédito), y el IGV se
   * calcula HACIA ATRÁS desde ahí, nunca sumado por encima.
   *
   * valorVenta se calcula primero y se redondea; igv se obtiene por
   * diferencia (no redondeando ambos por separado) para garantizar que
   * valorVenta + igv sea EXACTAMENTE igual a totalConDescuento — un pedido
   * cuya boleta no cuadra centavo a centavo es peor que uno con un redondeo
   * de un centavo hacia un lado u otro.
   */
  calcularIGV(totalConDescuento: number): { igv: number; valorVenta: number } {
    const valorVenta = Math.round((totalConDescuento / this.IGV_TASA) * 100) / 100;
    const igv = Math.round((totalConDescuento - valorVenta) * 100) / 100;
    return { igv, valorVenta };
  }
}
