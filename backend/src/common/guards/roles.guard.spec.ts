import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { PermisosService } from '../../modules/permisos/permisos.service';

describe('RolesGuard', () => {
  function crearContexto(rolesMetadata: string[] | undefined, user: any) {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(rolesMetadata) } as unknown as Reflector;
    class ClienteControllerFalso {}
    const context = {
      getHandler: () => ({ name: 'crear' }),
      getClass: () => ClienteControllerFalso,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
    return { reflector, context };
  }

  it('deja pasar cuando el endpoint no tiene @Roles() (sin metadata)', () => {
    const { reflector, context } = crearContexto(undefined, { rol: 'ASESOR' });
    const permisos = { rolesEfectivos: jest.fn() } as unknown as PermisosService;
    const guard = new RolesGuard(reflector, permisos);
    expect(guard.canActivate(context)).toBe(true);
    expect(permisos.rolesEfectivos).not.toHaveBeenCalled();
  });

  it('sin override guardado, usa los roles compilados en @Roles() tal cual', () => {
    const { reflector, context } = crearContexto(['ADMINISTRADOR'], { rol: 'ADMINISTRADOR' });
    const permisos = { rolesEfectivos: jest.fn().mockReturnValue(['ADMINISTRADOR']) } as unknown as PermisosService;
    const guard = new RolesGuard(reflector, permisos);
    expect(guard.canActivate(context)).toBe(true);
    expect(permisos.rolesEfectivos).toHaveBeenCalledWith('ClienteControllerFalso.crear', ['ADMINISTRADOR']);
  });

  it('EP-01: con un override que amplía el acceso, deja pasar un rol que el @Roles() compilado no incluía', () => {
    const { reflector, context } = crearContexto(['ADMINISTRADOR'], { rol: 'ASESOR' });
    const permisos = { rolesEfectivos: jest.fn().mockReturnValue(['ADMINISTRADOR', 'ASESOR']) } as unknown as PermisosService;
    const guard = new RolesGuard(reflector, permisos);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('EP-01: con un override que restringe el acceso, bloquea un rol que el @Roles() compilado sí permitía', () => {
    const { reflector, context } = crearContexto(['ADMINISTRADOR', 'GERENTE_COMERCIAL'], { rol: 'GERENTE_COMERCIAL' });
    const permisos = { rolesEfectivos: jest.fn().mockReturnValue(['ADMINISTRADOR']) } as unknown as PermisosService;
    const guard = new RolesGuard(reflector, permisos);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('sin usuario en el request, siempre bloquea aunque el rol requerido esté vacío de casualidad', () => {
    const { reflector, context } = crearContexto(['ADMINISTRADOR'], undefined);
    const permisos = { rolesEfectivos: jest.fn().mockReturnValue(['ADMINISTRADOR']) } as unknown as PermisosService;
    const guard = new RolesGuard(reflector, permisos);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
