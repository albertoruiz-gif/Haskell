import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PERMISOS_CATALOGO } from './permisos-catalogo';

describe('PermisosService', () => {
  function crearService(overridesExistentes: { clave: string; roles: string[] }[] = []) {
    const prisma = {
      permisoOverride: {
        findMany: jest.fn().mockResolvedValue(overridesExistentes),
        upsert: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    return { service: new PermisosService(prisma as any), prisma };
  }

  const CLAVE_EJEMPLO = PERMISOS_CATALOGO[0].clave;
  const DEFAULT_EJEMPLO = PERMISOS_CATALOGO[0].rolesPorDefecto;

  it('rolesEfectivos() devuelve el default cuando no hay override cargado', async () => {
    const { service } = crearService([]);
    await service.onModuleInit();
    expect(service.rolesEfectivos(CLAVE_EJEMPLO, DEFAULT_EJEMPLO)).toEqual(DEFAULT_EJEMPLO);
  });

  it('onModuleInit() no revienta si la tabla todavía no existe (migración pendiente en un deploy nuevo) — cae a los defaults', async () => {
    const { service, prisma } = crearService([]);
    prisma.permisoOverride.findMany.mockRejectedValueOnce(new Error('relation "permisos_override" does not exist'));
    await expect(service.onModuleInit()).resolves.not.toThrow();
    expect(service.rolesEfectivos(CLAVE_EJEMPLO, DEFAULT_EJEMPLO)).toEqual(DEFAULT_EJEMPLO);
  });

  it('rolesEfectivos() devuelve el override en vez del default cuando existe uno cargado', async () => {
    const { service } = crearService([{ clave: CLAVE_EJEMPLO, roles: ['ADMINISTRADOR'] }]);
    await service.onModuleInit();
    expect(service.rolesEfectivos(CLAVE_EJEMPLO, DEFAULT_EJEMPLO)).toEqual(['ADMINISTRADOR']);
  });

  it('listarCatalogo() marca personalizado:true solo en lo que tiene override', async () => {
    const { service } = crearService([{ clave: CLAVE_EJEMPLO, roles: ['ADMINISTRADOR'] }]);
    await service.onModuleInit();
    const catalogo = service.listarCatalogo();
    const item = catalogo.find((c) => c.clave === CLAVE_EJEMPLO)!;
    expect(item.personalizado).toBe(true);
    expect(item.rolesEfectivos).toEqual(['ADMINISTRADOR']);
    const otro = catalogo.find((c) => c.clave !== CLAVE_EJEMPLO)!;
    expect(otro.personalizado).toBe(false);
  });

  it('actualizar() rechaza una clave que no existe en el catálogo', async () => {
    const { service } = crearService([]);
    await service.onModuleInit();
    await expect(service.actualizar('NoExiste.metodo', ['ADMINISTRADOR'], 'actor-1')).rejects.toThrow(NotFoundException);
  });

  it('actualizar() rechaza dejar la lista de roles vacía', async () => {
    const { service } = crearService([]);
    await service.onModuleInit();
    await expect(service.actualizar(CLAVE_EJEMPLO, [], 'actor-1')).rejects.toThrow(BadRequestException);
  });

  it('actualizar() hace upsert, escribe AuditLog con antes/después y refresca la caché', async () => {
    const { service, prisma } = crearService([]);
    await service.onModuleInit();
    await service.actualizar(CLAVE_EJEMPLO, ['ADMINISTRADOR'], 'actor-1');

    expect(prisma.permisoOverride.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clave: CLAVE_EJEMPLO },
        create: expect.objectContaining({ clave: CLAVE_EJEMPLO, roles: ['ADMINISTRADOR'], actualizadoPorId: 'actor-1' }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accion: 'ACTUALIZAR_PERMISO',
          entidadId: CLAVE_EJEMPLO,
          valoresAntes: { roles: DEFAULT_EJEMPLO },
          valoresDespues: { roles: ['ADMINISTRADOR'] },
        }),
      }),
    );
    // recargarCache() vuelve a pegarle a la base — 1 al iniciar + 1 al actualizar.
    expect(prisma.permisoOverride.findMany).toHaveBeenCalledTimes(2);
  });

  it('restaurar() borra el override y vuelve al default del catálogo', async () => {
    const { service, prisma } = crearService([{ clave: CLAVE_EJEMPLO, roles: ['ADMINISTRADOR'] }]);
    await service.onModuleInit();
    const resultado = await service.restaurar(CLAVE_EJEMPLO, 'actor-1');

    expect(prisma.permisoOverride.delete).toHaveBeenCalledWith({ where: { clave: CLAVE_EJEMPLO } });
    expect(resultado).toEqual({ clave: CLAVE_EJEMPLO, rolesEfectivos: DEFAULT_EJEMPLO, personalizado: false });
    expect(service.rolesEfectivos(CLAVE_EJEMPLO, DEFAULT_EJEMPLO)).toEqual(DEFAULT_EJEMPLO);
  });

  it('restaurar() no hace nada si no había override (idempotente, sin tocar la base)', async () => {
    const { service, prisma } = crearService([]);
    await service.onModuleInit();
    await service.restaurar(CLAVE_EJEMPLO, 'actor-1');
    expect(prisma.permisoOverride.delete).not.toHaveBeenCalled();
  });
});
