import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TransportistasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async crear(data: { email: string; nombre: string; telefono: string; placa?: string; tarifaPorEntrega: number }) {
    const claveTemporal = Math.random().toString(36).slice(-10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(claveTemporal, 12),
        nombre: data.nombre,
        rol: 'TRANSPORTISTA',
      },
    });
    await this.authService.iniciarActivacion(user.id, user.email, user.nombre);

    return this.prisma.transportista.create({
      data: {
        userId: user.id,
        telefono: data.telefono,
        placa: data.placa,
        tarifaPorEntrega: data.tarifaPorEntrega,
      },
      include: { user: { select: { id: true, email: true, nombre: true, activo: true } } },
    });
  }

  // Efectividad = entregados / (entregados + devueltos). Mínimo esperado:
  // 90% — se muestra para que el administrador lo tenga en cuenta al pagar,
  // no bloquea el pago automáticamente (es una señal, no una regla dura).
  async listar() {
    const transportistas = await this.prisma.transportista.findMany({
      include: { user: { select: { id: true, email: true, nombre: true, activo: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const conteos = await this.prisma.entrega.groupBy({
      by: ['transportistaId', 'estado'],
      where: { estado: { in: ['ENTREGADO', 'FALLIDO'] } },
      _count: true,
    });

    return transportistas.map((t) => {
      const entregados = conteos.find((c) => c.transportistaId === t.id && c.estado === 'ENTREGADO')?._count ?? 0;
      const fallidos = conteos.find((c) => c.transportistaId === t.id && c.estado === 'FALLIDO')?._count ?? 0;
      const total = entregados + fallidos;
      return { ...t, efectividad: total > 0 ? Math.round((entregados / total) * 1000) / 10 : null, totalEntregas: total };
    });
  }

  async actualizarTarifa(id: string, tarifaPorEntrega: number) {
    return this.prisma.transportista.update({ where: { id }, data: { tarifaPorEntrega } });
  }
}
