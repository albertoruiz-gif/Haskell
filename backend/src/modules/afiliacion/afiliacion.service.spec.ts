import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AfiliacionService } from './afiliacion.service';

describe('AfiliacionService — EP-02 reasignación de líder', () => {
  function crearService() {
    const prisma = {
      asesor: { findUnique: jest.fn(), update: jest.fn() },
      lider: { findUnique: jest.fn(), findMany: jest.fn() },
      user: { findMany: jest.fn() },
      historialAsignacionAsesor: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const authService = { iniciarActivacion: jest.fn() };
    return { service: new AfiliacionService(prisma as any, authService as any), prisma };
  }

  describe('reasignarLider', () => {
    it('rechaza un asesor inexistente', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue(null);
      await expect(service.reasignarLider('asesor-x', 'lider-1', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza asesores que no son de Comercio Minorista (no tienen líder)', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue({ id: 'asesor-1', canal: 'RETAIL', liderId: null });
      await expect(service.reasignarLider('asesor-1', 'lider-1', 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza un líder inexistente', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue({ id: 'asesor-1', canal: 'COMERCIO_MINORISTA', liderId: null });
      prisma.lider.findUnique.mockResolvedValue(null);
      await expect(service.reasignarLider('asesor-1', 'lider-x', 'actor-1')).rejects.toThrow(NotFoundException);
    });

    it('rechaza reasignar a un líder inactivo', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue({ id: 'asesor-1', canal: 'COMERCIO_MINORISTA', liderId: null });
      prisma.lider.findUnique.mockResolvedValue({ id: 'lider-1', user: { activo: false } });
      await expect(service.reasignarLider('asesor-1', 'lider-1', 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('rechaza reasignar al mismo líder que ya tiene', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue({ id: 'asesor-1', canal: 'COMERCIO_MINORISTA', liderId: 'lider-1' });
      prisma.lider.findUnique.mockResolvedValue({ id: 'lider-1', user: { activo: true } });
      await expect(service.reasignarLider('asesor-1', 'lider-1', 'actor-1')).rejects.toThrow(BadRequestException);
    });

    it('en el caso feliz, actualiza Asesor.liderId Y crea el registro de historial en la misma transacción', async () => {
      const { service, prisma } = crearService();
      prisma.asesor.findUnique.mockResolvedValue({ id: 'asesor-1', canal: 'COMERCIO_MINORISTA', liderId: 'lider-viejo' });
      prisma.lider.findUnique.mockResolvedValue({ id: 'lider-nuevo', user: { activo: true } });
      prisma.$transaction.mockResolvedValue([{ id: 'asesor-1', liderId: 'lider-nuevo' }, {}]);

      const resultado = await service.reasignarLider('asesor-1', 'lider-nuevo', 'actor-1', 'reorganización de zona');

      expect(resultado).toEqual({ id: 'asesor-1', liderId: 'lider-nuevo' });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.asesor.update).toHaveBeenCalledWith({ where: { id: 'asesor-1' }, data: { liderId: 'lider-nuevo' } });
      expect(prisma.historialAsignacionAsesor.create).toHaveBeenCalledWith({
        data: {
          asesorId: 'asesor-1',
          liderAnteriorId: 'lider-viejo',
          liderNuevoId: 'lider-nuevo',
          actorId: 'actor-1',
          motivo: 'reorganización de zona',
        },
      });
    });
  });

  describe('historialAsignaciones', () => {
    it('devuelve vacío sin pegarle a lider/user cuando el asesor no tiene historial', async () => {
      const { service, prisma } = crearService();
      prisma.historialAsignacionAsesor.findMany.mockResolvedValue([]);
      const resultado = await service.historialAsignaciones('asesor-1');
      expect(resultado).toEqual([]);
      expect(prisma.lider.findMany).not.toHaveBeenCalled();
    });

    it('resuelve nombres de líder anterior/nuevo y del actor', async () => {
      const { service, prisma } = crearService();
      prisma.historialAsignacionAsesor.findMany.mockResolvedValue([
        {
          id: 'h1',
          liderAnteriorId: 'lider-viejo',
          liderNuevoId: 'lider-nuevo',
          actorId: 'actor-1',
          motivo: 'reorganización',
          createdAt: new Date('2026-08-16'),
        },
      ]);
      prisma.lider.findMany.mockResolvedValue([
        { id: 'lider-viejo', user: { nombre: 'Ana Viejo' } },
        { id: 'lider-nuevo', user: { nombre: 'Beto Nuevo' } },
      ]);
      prisma.user.findMany.mockResolvedValue([{ id: 'actor-1', nombre: 'Carla Admin' }]);

      const resultado = await service.historialAsignaciones('asesor-1');

      expect(resultado).toEqual([
        {
          id: 'h1',
          liderAnterior: 'Ana Viejo',
          liderNuevo: 'Beto Nuevo',
          actor: 'Carla Admin',
          motivo: 'reorganización',
          createdAt: new Date('2026-08-16'),
        },
      ]);
    });

    it('muestra "Líder eliminado" si el líder referenciado ya no existe', async () => {
      const { service, prisma } = crearService();
      prisma.historialAsignacionAsesor.findMany.mockResolvedValue([
        { id: 'h1', liderAnteriorId: null, liderNuevoId: 'lider-borrado', actorId: 'actor-1', motivo: null, createdAt: new Date() },
      ]);
      prisma.lider.findMany.mockResolvedValue([]); // ya no existe
      prisma.user.findMany.mockResolvedValue([{ id: 'actor-1', nombre: 'Carla Admin' }]);

      const [resultado] = await service.historialAsignaciones('asesor-1');
      expect(resultado.liderAnterior).toBeNull();
      expect(resultado.liderNuevo).toBe('Líder eliminado');
    });
  });
});
