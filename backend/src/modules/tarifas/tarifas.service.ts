import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../config/prisma.service';

type FilaTarifa = { distrito: string; zona?: string; precio: number; slaHoras: number };

@Injectable()
export class TarifasService {
  constructor(private readonly prisma: PrismaService) {}

  /** Carga masiva del tarifario desde Excel (.xlsx) o CSV — upsert por distrito. */
  async importar(buffer: Buffer, esCSV: boolean) {
    const filas = esCSV ? this.parsearCSV(buffer) : await this.parsearExcel(buffer);

    let creadas = 0;
    let actualizadas = 0;
    const errores: { fila: number; motivo: string }[] = [];

    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      if (!fila.distrito) {
        errores.push({ fila: i + 2, motivo: 'Distrito vacío.' });
        continue;
      }
      if (!fila.precio || Number.isNaN(fila.precio)) {
        errores.push({ fila: i + 2, motivo: `Precio inválido para "${fila.distrito}".` });
        continue;
      }
      const existente = await this.prisma.tarifa.findUnique({ where: { distrito: fila.distrito } });
      await this.prisma.tarifa.upsert({
        where: { distrito: fila.distrito },
        create: { distrito: fila.distrito, zona: fila.zona, precio: fila.precio, slaHoras: fila.slaHoras || 36 },
        update: { zona: fila.zona, precio: fila.precio, slaHoras: fila.slaHoras || undefined },
      });
      existente ? actualizadas++ : creadas++;
    }

    return { total: filas.length, creadas, actualizadas, errores };
  }

  private async parsearExcel(buffer: Buffer): Promise<FilaTarifa[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const hoja = workbook.worksheets[0];
    if (!hoja) throw new BadRequestException('El archivo no tiene hojas.');

    const encabezados = (hoja.getRow(1).values as any[]).map((v) => String(v ?? '').trim().toLowerCase());
    const idx = (nombre: string) => encabezados.indexOf(nombre);

    const filas: FilaTarifa[] = [];
    for (let i = 2; i <= hoja.rowCount; i++) {
      const row = hoja.getRow(i);
      if (row.values.length === 0) continue;
      const obtener = (nombre: string) => {
        const col = idx(nombre);
        return col >= 0 ? row.getCell(col).value : undefined;
      };
      filas.push({
        distrito: String(obtener('distrito') ?? '').trim(),
        zona: obtener('zona') ? String(obtener('zona')).trim() : undefined,
        precio: Number(obtener('precio')),
        slaHoras: Number(obtener('slahoras') ?? obtener('sla_horas') ?? obtener('plazo') ?? 36),
      });
    }
    return filas;
  }

  private parsearCSV(buffer: Buffer): FilaTarifa[] {
    const texto = buffer.toString('utf-8').trim();
    const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lineas.length === 0) throw new BadRequestException('El archivo está vacío.');

    const encabezados = lineas[0].split(',').map((h) => h.trim().toLowerCase());
    const idx = (nombre: string) => encabezados.indexOf(nombre);

    return lineas.slice(1).map((linea) => {
      const celdas = linea.split(',').map((c) => c.trim());
      const distritoIdx = idx('distrito');
      const zonaIdx = idx('zona');
      const precioIdx = idx('precio');
      const slaIdx = idx('slahoras') >= 0 ? idx('slahoras') : idx('sla_horas') >= 0 ? idx('sla_horas') : idx('plazo');
      return {
        distrito: distritoIdx >= 0 ? celdas[distritoIdx] : '',
        zona: zonaIdx >= 0 && celdas[zonaIdx] ? celdas[zonaIdx] : undefined,
        precio: Number(precioIdx >= 0 ? celdas[precioIdx] : NaN),
        slaHoras: Number(slaIdx >= 0 ? celdas[slaIdx] : 36) || 36,
      };
    });
  }
}
