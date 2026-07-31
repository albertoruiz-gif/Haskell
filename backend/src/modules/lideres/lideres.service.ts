import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';

/**
 * Líder/Supervisor de equipo (rol LIDER_MINORISTA) — afilia y tiene a
 * cargo asesores de canal COMERCIO_MINORISTA, y gana una comisión propia
 * (comisionPct, 5% por defecto, editable por líder) sobre el valor de
 * venta (PVP publicado, no el precio con descuento del asesor) de los
 * pedidos de sus asesores a cargo.
 */
@Injectable()
export class LideresService {
  constructor(private readonly prisma: PrismaService) {}

  async crear(data: { email: string; nombre: string; telefono: string; comisionPct?: number }) {
    const claveTemporal = Math.random().toString(36).slice(-10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(claveTemporal, 12),
        nombre: data.nombre,
        rol: 'LIDER_MINORISTA',
      },
    });

    return this.prisma.lider.create({
      data: { userId: user.id, telefono: data.telefono, comisionPct: data.comisionPct ?? 5 },
      include: { user: { select: { id: true, email: true, nombre: true, activo: true } } },
    });
  }

  async listar() {
    const lideres = await this.prisma.lider.findMany({
      include: {
        user: { select: { id: true, email: true, nombre: true, activo: true } },
        asesores: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return lideres.map((l) => ({ ...l, cantidadAsesores: l.asesores.length }));
  }

  async actualizarComision(id: string, comisionPct: number) {
    return this.prisma.lider.update({ where: { id }, data: { comisionPct } });
  }

  /**
   * Suma el PVP publicado (no el precio con descuento del asesor) de los
   * ítems de cada pedido de los asesores a cargo, desde que se pagan — si
   * un pedido después se cancela/devuelve, deja de contar (recalculado en
   * vivo cada vez, no es un saldo acumulado).
   */
  async comisionGanada(id: string) {
    const lider = await this.prisma.lider.findUniqueOrThrow({ where: { id } });
    const asesores = await this.prisma.asesor.findMany({ where: { liderId: id }, select: { id: true } });
    const asesorIds = asesores.map((a) => a.id);

    if (asesorIds.length === 0) {
      return { comisionPct: Number(lider.comisionPct), totalVentaPvp: 0, comisionGanada: 0, cantidadPedidos: 0, cantidadAsesores: 0 };
    }

    const pedidos = await this.prisma.order.findMany({
      where: { asesorId: { in: asesorIds }, pagadoEn: { not: null }, estado: { not: 'CANCELADO_DEVUELTO' } },
      include: { items: true },
    });

    const totalVentaPvp = pedidos.reduce(
      (acc, p) => acc + p.items.reduce((a, i) => a + Number(i.pvpUnitario) * i.cantidad, 0),
      0,
    );
    const comisionPct = Number(lider.comisionPct);

    return {
      comisionPct,
      totalVentaPvp: Math.round(totalVentaPvp * 100) / 100,
      comisionGanada: Math.round(totalVentaPvp * (comisionPct / 100) * 100) / 100,
      cantidadPedidos: pedidos.length,
      cantidadAsesores: asesorIds.length,
    };
  }
}
