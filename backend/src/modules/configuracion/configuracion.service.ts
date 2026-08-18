import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

const ID_SINGLETON = 'global';

/**
 * Configuración editable desde Gestión (EP-16), fila única. No hay seed
 * para esta tabla a propósito — obtener() la crea sola con los defaults del
 * schema la primera vez que alguien la pide, igual que el resto del
 * proyecto evita pasos manuales de setup.
 */
@Injectable()
export class ConfiguracionService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener() {
    return this.prisma.configuracionSistema.upsert({
      where: { id: ID_SINGLETON },
      create: { id: ID_SINGLETON },
      update: {},
    });
  }

  async actualizar(
    data: { minutosReservaStock?: number; toleranciaConciliacionSoles?: number; featureFlags?: Record<string, boolean> },
    actorId: string,
  ) {
    const anterior = await this.obtener();
    const actualizada = await this.prisma.configuracionSistema.update({
      where: { id: ID_SINGLETON },
      data: { ...data, featureFlags: data.featureFlags as any, actualizadoPorId: actorId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'ACTUALIZAR_CONFIGURACION',
        entidad: 'ConfiguracionSistema',
        entidadId: ID_SINGLETON,
        valoresAntes: {
          minutosReservaStock: anterior.minutosReservaStock,
          toleranciaConciliacionSoles: Number(anterior.toleranciaConciliacionSoles),
          featureFlags: anterior.featureFlags,
        },
        valoresDespues: {
          minutosReservaStock: actualizada.minutosReservaStock,
          toleranciaConciliacionSoles: Number(actualizada.toleranciaConciliacionSoles),
          featureFlags: actualizada.featureFlags,
        },
      },
    });
    return actualizada;
  }

  /** Atajo para InventarioService — evita que tenga que saber del upsert/singleton. */
  async minutosReservaStock(): Promise<number> {
    const config = await this.obtener();
    return config.minutosReservaStock;
  }

  /** Atajo para OrdersService.validarDeposito (EP-16). */
  async toleranciaConciliacionSoles(): Promise<number> {
    const config = await this.obtener();
    return Number(config.toleranciaConciliacionSoles);
  }

  /**
   * EP-16: feature flags genéricos — clave arbitraria -> boolean. Cualquier
   * módulo puede consultar un flag propio sin que haga falta una migración
   * nueva ni tocar este servicio; si la clave no existe todavía, se
   * considera apagado (false), nunca revienta.
   */
  async featureFlagActivo(clave: string): Promise<boolean> {
    const config = await this.obtener();
    const flags = (config.featureFlags as Record<string, boolean> | null) ?? {};
    return flags[clave] === true;
  }
}
