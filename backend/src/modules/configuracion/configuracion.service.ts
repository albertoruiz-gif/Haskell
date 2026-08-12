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

  async actualizar(data: { minutosReservaStock?: number }, actorId: string) {
    const anterior = await this.obtener();
    const actualizada = await this.prisma.configuracionSistema.update({
      where: { id: ID_SINGLETON },
      data: { ...data, actualizadoPorId: actorId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'ACTUALIZAR_CONFIGURACION',
        entidad: 'ConfiguracionSistema',
        entidadId: ID_SINGLETON,
        valoresAntes: { minutosReservaStock: anterior.minutosReservaStock },
        valoresDespues: { minutosReservaStock: actualizada.minutosReservaStock },
      },
    });
    return actualizada;
  }

  /** Atajo para InventarioService — evita que tenga que saber del upsert/singleton. */
  async minutosReservaStock(): Promise<number> {
    const config = await this.obtener();
    return config.minutosReservaStock;
  }
}
