import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { PERMISOS_CATALOGO } from './permisos-catalogo';

/**
 * EP-01: permisos por módulo configurables desde Gestión → Permisos, sin
 * pasar por un deploy. RolesGuard consulta rolesEfectivos() en CADA
 * request, así que no puede pegarle a Postgres ahí — por eso se mantiene
 * una copia entera en memoria (cache), cargada al arrancar y refrescada
 * solo cuando alguien edita o restaura un permiso (nunca en el camino de
 * lectura). Tabla vacía = comportamiento idéntico al @Roles() compilado en
 * cada controller (ver permisos-catalogo.ts).
 */
@Injectable()
export class PermisosService implements OnModuleInit {
  private cache = new Map<string, string[]>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.recargarCache();
  }

  private async recargarCache() {
    const overrides = await this.prisma.permisoOverride.findMany();
    this.cache = new Map(overrides.map((o) => [o.clave, o.roles as string[]]));
  }

  /** Lectura sincrónica desde la caché — la usa RolesGuard en cada request. */
  rolesEfectivos(clave: string, rolesPorDefecto: string[]): string[] {
    return this.cache.get(clave) ?? rolesPorDefecto;
  }

  listarCatalogo() {
    return PERMISOS_CATALOGO.map((item) => ({
      ...item,
      rolesEfectivos: this.cache.get(item.clave) ?? item.rolesPorDefecto,
      personalizado: this.cache.has(item.clave),
    }));
  }

  async actualizar(clave: string, roles: string[], actorId: string) {
    const item = PERMISOS_CATALOGO.find((p) => p.clave === clave);
    if (!item) throw new NotFoundException(`Permiso no reconocido: ${clave}`);
    if (!roles || roles.length === 0) {
      throw new BadRequestException('Debe quedar al menos un rol con acceso.');
    }
    const antes = this.cache.get(clave) ?? item.rolesPorDefecto;

    await this.prisma.permisoOverride.upsert({
      where: { clave },
      create: { clave, roles: roles as any, actualizadoPorId: actorId },
      update: { roles: roles as any, actualizadoPorId: actorId },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'ACTUALIZAR_PERMISO',
        entidad: 'PermisoOverride',
        entidadId: clave,
        valoresAntes: { roles: antes },
        valoresDespues: { roles },
      },
    });
    await this.recargarCache();
    return { clave, rolesEfectivos: roles, personalizado: true };
  }

  /** Borra el override y vuelve al @Roles() compilado en el código. */
  async restaurar(clave: string, actorId: string) {
    const item = PERMISOS_CATALOGO.find((p) => p.clave === clave);
    if (!item) throw new NotFoundException(`Permiso no reconocido: ${clave}`);
    const antes = this.cache.get(clave);
    if (antes) {
      await this.prisma.permisoOverride.delete({ where: { clave } });
      await this.prisma.auditLog.create({
        data: {
          actorId,
          accion: 'RESTAURAR_PERMISO',
          entidad: 'PermisoOverride',
          entidadId: clave,
          valoresAntes: { roles: antes },
          valoresDespues: { roles: item.rolesPorDefecto },
        },
      });
      await this.recargarCache();
    }
    return { clave, rolesEfectivos: item.rolesPorDefecto, personalizado: false };
  }
}
