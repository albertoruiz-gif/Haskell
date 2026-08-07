import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

const MESES_ABREV = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export type NivelPublico = { id: string; nombre: string; descripcion: string | null; montoMinimo: number };
export type ProgresoPremio = {
  ventaSemana: number;
  ventaDelMes: number;
  nivelActual: NivelPublico | null;
  nivelSiguiente: NivelPublico | null;
  faltante: number | null;
};
export type LogroPremio = { mes: string; nivel: string };
export type HistorialPremios = { totalPremiosGanados: number; logros: LogroPremio[] };

/**
 * Escala de premios por venta mensual, por canal (RF pedido por Alberto
 * 2026-08-07). El Gerente Comercial/Administrador define los niveles desde
 * Gestión → Premios; el asesor ve su progreso en el Carrito, y el Líder ve
 * el de todo su equipo en Mi equipo. Solo informativo — no hay paso de
 * "entregado" (decisión explícita del usuario).
 *
 * Cada nivel se versiona igual que MetaIndicador (vigenciaDesde/Hasta):
 * editar no sobrescribe, cierra el vigente y crea uno nuevo, así los meses
 * pasados siguen mostrando la escala que realmente estaba activa entonces.
 */
@Injectable()
export class PremiosService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Administración de la escala (Gestión → Premios) ---

  async nivelesVigentes(canal: string): Promise<NivelPublico[]> {
    return this.nivelesVigentesEn(canal, new Date());
  }

  async crearNivel(actualizadoPorId: string, data: { canal: string; nombre: string; descripcion?: string; montoMinimo: number }) {
    return this.prisma.premioNivel.create({
      data: {
        canal: data.canal as never,
        nombre: data.nombre,
        descripcion: data.descripcion,
        montoMinimo: data.montoMinimo,
        actualizadoPorId,
      },
    });
  }

  async actualizarNivel(id: string, actualizadoPorId: string, data: { nombre: string; descripcion?: string; montoMinimo: number }) {
    const actual = await this.prisma.premioNivel.findUniqueOrThrow({ where: { id } });
    if (actual.vigenciaHasta) throw new NotFoundException('Este nivel ya no está vigente — no se puede editar, solo crear uno nuevo.');
    const ahora = new Date();
    await this.prisma.premioNivel.update({ where: { id }, data: { vigenciaHasta: ahora } });
    return this.prisma.premioNivel.create({
      data: {
        canal: actual.canal,
        nombre: data.nombre,
        descripcion: data.descripcion,
        montoMinimo: data.montoMinimo,
        actualizadoPorId,
        vigenciaDesde: ahora,
      },
    });
  }

  async retirarNivel(id: string) {
    return this.prisma.premioNivel.update({ where: { id }, data: { vigenciaHasta: new Date() } });
  }

  // --- Progreso del asesor ---

  async resumenAsesor(asesorId: string): Promise<ProgresoPremio> {
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    const { desde: desdeMes, hasta } = this.rangoMesActual();
    const { desde: desdeSemana } = this.rangoSemanaActual();
    const [ventaDelMes, ventaSemana] = await Promise.all([
      this.ventaAsesorEnRango(asesorId, desdeMes, hasta),
      this.ventaAsesorEnRango(asesorId, desdeSemana, hasta),
    ]);
    const niveles = await this.nivelesVigentesEn(asesor.canal, hasta);
    return { ventaSemana, ...this.armarProgreso(ventaDelMes, niveles) };
  }

  /**
   * "Cuántos premios ganó" — cuenta, mes a mes desde que el asesor existe,
   * en cuántos llegó a algún nivel (con la escala que estaba vigente EN ESE
   * mes, mismo criterio que la serie). No hay tope de tiempo artificial más
   * allá de la fecha de alta del asesor.
   */
  async historialPremios(asesorId: string): Promise<HistorialPremios> {
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    const mesesDesdeAlta = this.mesesEntre(asesor.createdAt, new Date()) + 1;
    const buckets = this.generarBucketsMensuales(Math.min(Math.max(mesesDesdeAlta, 1), 36));
    const logros: LogroPremio[] = [];
    for (const b of buckets) {
      const venta = await this.ventaAsesorEnRango(asesorId, b.desde, b.hasta);
      const niveles = await this.nivelesVigentesEn(asesor.canal, b.hasta);
      const { nivelActual } = this.armarProgreso(venta, niveles);
      if (nivelActual) logros.push({ mes: b.etiqueta, nivel: nivelActual.nombre });
    }
    return { totalPremiosGanados: logros.length, logros: logros.reverse() };
  }

  /** Serie mensual histórica — para el asesor y para su Líder (RF 2026-08-07). */
  async serieMensualAsesor(asesorId: string, meses: number) {
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    const buckets = this.generarBucketsMensuales(Math.min(Math.max(Math.trunc(meses) || 6, 1), 24));
    const puntos = [];
    for (const b of buckets) {
      const venta = await this.ventaAsesorEnRango(asesorId, b.desde, b.hasta);
      const niveles = await this.nivelesVigentesEn(asesor.canal, b.hasta);
      const progreso = this.armarProgreso(venta, niveles);
      puntos.push({
        etiqueta: b.etiqueta,
        venta: progreso.ventaDelMes,
        nivelActual: progreso.nivelActual?.nombre ?? null,
      });
    }
    return { canal: asesor.canal, puntos };
  }

  // --- helpers privados ---

  private rangoMesActual(): { desde: Date; hasta: Date } {
    const ahora = new Date();
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
    return { desde, hasta: ahora };
  }

  // Semana calendario lunes-domingo (convención de negocio en Perú), no
  // "últimos 7 días" — así "cómo voy en la semana" arranca en cero cada
  // lunes, igual que el mes arranca en cero cada 1°.
  private rangoSemanaActual(): { desde: Date; hasta: Date } {
    const ahora = new Date();
    const diaSemana = ahora.getDay(); // 0=domingo .. 6=sábado
    const offsetHastaLunes = diaSemana === 0 ? 6 : diaSemana - 1;
    const desde = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - offsetHastaLunes, 0, 0, 0, 0);
    return { desde, hasta: ahora };
  }

  private mesesEntre(desde: Date, hasta: Date): number {
    return (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());
  }

  private generarBucketsMensuales(cantidad: number): { desde: Date; hasta: Date; etiqueta: string }[] {
    const ahora = new Date();
    const buckets = [];
    for (let i = cantidad - 1; i >= 0; i--) {
      const mes = ahora.getMonth() - i;
      const desde = new Date(ahora.getFullYear(), mes, 1, 0, 0, 0, 0);
      const hasta = new Date(ahora.getFullYear(), mes + 1, 0, 23, 59, 59, 999);
      buckets.push({ desde, hasta, etiqueta: `${MESES_ABREV[hasta.getMonth()]} ${hasta.getFullYear()}` });
    }
    return buckets;
  }

  private async ventaAsesorEnRango(asesorId: string, desde: Date, hasta: Date): Promise<number> {
    const pedidos = await this.prisma.order.findMany({
      where: { asesorId, pagadoEn: { gte: desde, lte: hasta }, estado: { not: 'CANCELADO_DEVUELTO' } },
      include: { items: true },
    });
    const total = pedidos.reduce((acc, p) => acc + p.items.reduce((s, i) => s + Number(i.pvpUnitario) * i.cantidad, 0), 0);
    return Math.round(total * 100) / 100;
  }

  private async nivelesVigentesEn(canal: string, fecha: Date): Promise<NivelPublico[]> {
    const niveles = await this.prisma.premioNivel.findMany({
      where: {
        canal: canal as never,
        vigenciaDesde: { lte: fecha },
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gte: fecha } }],
      },
      orderBy: { montoMinimo: 'asc' },
    });
    return niveles.map((n) => ({ id: n.id, nombre: n.nombre, descripcion: n.descripcion, montoMinimo: Number(n.montoMinimo) }));
  }

  private armarProgreso(ventaDelMes: number, niveles: NivelPublico[]): Omit<ProgresoPremio, 'ventaSemana'> {
    let nivelActual: NivelPublico | null = null;
    let nivelSiguiente: NivelPublico | null = null;
    for (const nivel of niveles) {
      if (ventaDelMes >= nivel.montoMinimo) {
        nivelActual = nivel;
      } else {
        nivelSiguiente = nivel;
        break;
      }
    }
    const faltante = nivelSiguiente ? Math.round((nivelSiguiente.montoMinimo - ventaDelMes) * 100) / 100 : null;
    return { ventaDelMes, nivelActual, nivelSiguiente, faltante };
  }
}
