import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';
import { AuthService } from '../auth/auth.service';

/**
 * Gerente Comercial (rol GERENTE_COMERCIAL) — ya tenía permisos amplios
 * sobre todo el catálogo/asesores/precios; esto agrega su comisión propia
 * (4% por defecto, editable) sobre el valor de venta (PVP publicado) de
 * TODOS los pedidos pagados, de los 3 canales — a diferencia del Líder,
 * no depende de una lista de asesores a cargo, es sobre el total de la
 * operación comercial.
 */
@Injectable()
export class GerentesComercialesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async crear(data: { email: string; nombre: string; telefono: string; comisionPct?: number }) {
    const claveTemporal = Math.random().toString(36).slice(-10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(claveTemporal, 12),
        nombre: data.nombre,
        rol: 'GERENTE_COMERCIAL',
      },
    });
    await this.authService.iniciarActivacion(user.id, user.email, user.nombre);

    return this.prisma.gerenteComercial.create({
      data: { userId: user.id, telefono: data.telefono, comisionPct: data.comisionPct ?? 4 },
      include: { user: { select: { id: true, email: true, nombre: true, activo: true } } },
    });
  }

  async listar() {
    return this.prisma.gerenteComercial.findMany({
      include: { user: { select: { id: true, email: true, nombre: true, activo: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async actualizarComision(id: string, comisionPct: number) {
    return this.prisma.gerenteComercial.update({ where: { id }, data: { comisionPct } });
  }

  async comisionGanada(id: string) {
    const gerente = await this.prisma.gerenteComercial.findUniqueOrThrow({ where: { id } });

    const pedidos = await this.prisma.order.findMany({
      where: { pagadoEn: { not: null }, estado: { not: 'CANCELADO_DEVUELTO' } },
      include: { items: true },
    });

    const totalVentaPvp = pedidos.reduce(
      (acc, p) => acc + p.items.reduce((a, i) => a + Number(i.pvpUnitario) * i.cantidad, 0),
      0,
    );
    const comisionPct = Number(gerente.comisionPct);

    return {
      comisionPct,
      totalVentaPvp: Math.round(totalVentaPvp * 100) / 100,
      comisionGanada: Math.round(totalVentaPvp * (comisionPct / 100) * 100) / 100,
      cantidadPedidos: pedidos.length,
    };
  }
}
