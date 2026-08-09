import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';
import { PremiosService } from '../premios/premios.service';
import { AuthService } from '../auth/auth.service';

/**
 * Líder/Supervisor de equipo (rol LIDER_MINORISTA) — afilia y tiene a
 * cargo asesores de canal COMERCIO_MINORISTA, y gana una comisión propia
 * (comisionPct, 5% por defecto, editable por líder) sobre el valor de
 * venta (PVP publicado, no el precio con descuento del asesor) de los
 * pedidos de sus asesores a cargo.
 */
@Injectable()
export class LideresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly premios: PremiosService,
    private readonly authService: AuthService,
  ) {}

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
    await this.authService.iniciarActivacion(user.id, user.email, user.nombre);

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

  /**
   * Vista "Mi equipo" del Líder (RF pedido por Alberto 2026-08-06): ranking
   * de sus asesores por venta, la comisión que cada uno se queda (PVP -
   * precio con descuento del asesor, el margen que ya existe en cada
   * OrderItem — no es un campo nuevo) y el total/comisión del equipo
   * completo (mismo cálculo que comisionGanada, reusado acá para no
   * duplicar la regla de negocio en dos lugares).
   */
  async resumenEquipo(id: string) {
    const [resumenLider, asesores] = await Promise.all([
      this.comisionGanada(id),
      this.prisma.asesor.findMany({
        where: { liderId: id },
        select: {
          id: true,
          codigo: true,
          user: { select: { nombre: true } },
          direcciones: { select: { distrito: true, predeterminada: true } },
        },
      }),
    ]);

    if (asesores.length === 0) {
      return { ...resumenLider, asesores: [] };
    }

    const pedidosPorAsesor = await this.prisma.order.findMany({
      where: { asesorId: { in: asesores.map((a) => a.id) }, pagadoEn: { not: null }, estado: { not: 'CANCELADO_DEVUELTO' } },
      include: { items: true },
    });

    // Progreso de premio del mes (RF 2026-08-07) — se calcula aparte porque
    // es async (consulta niveles vigentes por canal), a diferencia del resto
    // del ranking que ya viene resuelto en memoria desde pedidosPorAsesor.
    const premiosPorAsesor = new Map(
      await Promise.all(asesores.map(async (a) => [a.id, await this.premios.resumenAsesor(a.id)] as const)),
    );

    const ranking = asesores
      .map((a) => {
        const pedidos = pedidosPorAsesor.filter((p) => p.asesorId === a.id);
        const totalVentaPvp = pedidos.reduce(
          (acc, p) => acc + p.items.reduce((s, i) => s + Number(i.pvpUnitario) * i.cantidad, 0),
          0,
        );
        // La comisión del asesor es su propio margen (PVP - precio con
        // descuento que ya paga a la empresa), no un % nuevo — ver
        // OrderItem.pvpUnitario/precioAsesorUnitario.
        const comisionAsesor = pedidos.reduce(
          (acc, p) =>
            acc + p.items.reduce((s, i) => s + (Number(i.pvpUnitario) - Number(i.precioAsesorUnitario)) * i.cantidad, 0),
          0,
        );
        // Mismo criterio de fallback que orders.service.ts al armar la
        // orden de despacho: la dirección marcada predeterminada, o la
        // primera si por algún motivo ninguna lo está.
        const direccion = a.direcciones.find((d) => d.predeterminada) ?? a.direcciones[0];
        const premio = premiosPorAsesor.get(a.id);
        return {
          asesorId: a.id,
          codigo: a.codigo,
          nombre: a.user.nombre,
          distrito: direccion?.distrito ?? null,
          totalVentaPvp: Math.round(totalVentaPvp * 100) / 100,
          comisionAsesor: Math.round(comisionAsesor * 100) / 100,
          cantidadPedidos: pedidos.length,
          premioActual: premio?.nivelActual?.nombre ?? null,
          premioSiguiente: premio?.nivelSiguiente?.nombre ?? null,
          faltantePremio: premio?.faltante ?? null,
        };
      })
      .sort((a, b) => b.totalVentaPvp - a.totalVentaPvp);

    return { ...resumenLider, asesores: ranking };
  }
}
