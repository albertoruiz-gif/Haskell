import { BadRequestException, Injectable } from '@nestjs/common';
import { createWriteStream, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import * as unzipper from 'unzipper';
import { PrismaService } from '../../config/prisma.service';

const RAIZ_UPLOADS = join(process.cwd(), 'uploads', 'catalogos-digitales');

/**
 * Catálogo digital editorial (flipbook tipo Yanbal) — se arma por fuera de
 * la plataforma con otra herramienta y se sube como .zip (index.html +
 * imágenes + JS/CSS propios). Esta pantalla solo aloja y publica ese sitio
 * estático; no tiene relación con el catálogo operativo (Catalog/CatalogLine)
 * que usan los asesores para vender con precios por canal.
 */
@Injectable()
export class CatalogosDigitalesService {
  constructor(private readonly prisma: PrismaService) {}

  private conUrl(registro: { id: string; raiz: string; [k: string]: any }) {
    const url = `/uploads/catalogos-digitales/${registro.id}${registro.raiz ? `/${registro.raiz}` : ''}/index.html`;
    return { ...registro, url };
  }

  async listar() {
    const registros = await this.prisma.catalogoDigital.findMany({ orderBy: { createdAt: 'desc' } });
    return registros.map((r) => this.conUrl(r));
  }

  // Busca index.html dentro del árbol extraído: puede estar en la raíz del
  // zip o dentro de una subcarpeta (típico cuando se comprime una carpeta
  // en vez de su contenido). Devuelve la subcarpeta relativa, o null si no
  // aparece en ningún lado dentro de una profundidad razonable.
  private buscarRaizIndexHtml(base: string, actual = '', profundidad = 0): string | null {
    if (profundidad > 6) return null;
    const dirAbs = join(base, actual);
    let entradas: import('fs').Dirent[];
    try {
      entradas = readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return null;
    }
    if (entradas.some((e) => e.isFile() && e.name.toLowerCase() === 'index.html')) {
      return actual;
    }
    for (const e of entradas) {
      if (e.isDirectory()) {
        const encontrado = this.buscarRaizIndexHtml(base, actual ? `${actual}/${e.name}` : e.name, profundidad + 1);
        if (encontrado !== null) return encontrado;
      }
    }
    return null;
  }

  async subir(nombre: string, archivo: Express.Multer.File, subidoPorId: string) {
    if (!archivo) throw new BadRequestException('Subí un archivo .zip con el catálogo digital.');
    if (!nombre?.trim()) throw new BadRequestException('El catálogo necesita un nombre para identificarlo.');

    const registro = await this.prisma.catalogoDigital.create({
      data: { nombre: nombre.trim(), subidoPorId },
    });

    const destino = join(RAIZ_UPLOADS, registro.id);
    const destinoAbs = resolve(destino);
    mkdirSync(destino, { recursive: true });

    try {
      const zip = await unzipper.Open.buffer(archivo.buffer);

      for (const entrada of zip.files) {
        // Algunos zips armados en Windows (ej. Compress-Archive de
        // PowerShell) guardan las rutas internas con backslash en vez del
        // '/' estándar del formato zip — Linux no lo trata como separador,
        // así que se normaliza antes de resolver la ruta de destino.
        const rutaEntrada = entrada.path.replace(/\\/g, '/');
        const destinoEntrada = resolve(join(destino, rutaEntrada));
        // Protección contra zip-slip: descarta cualquier entrada que
        // intente escribir fuera de la carpeta del catálogo.
        if (destinoEntrada !== destinoAbs && !destinoEntrada.startsWith(destinoAbs + sep)) continue;

        if (entrada.type === 'Directory') {
          mkdirSync(destinoEntrada, { recursive: true });
          continue;
        }

        mkdirSync(dirname(destinoEntrada), { recursive: true });
        await new Promise<void>((resolveEscritura, rejectEscritura) => {
          entrada
            .stream()
            .pipe(createWriteStream(destinoEntrada))
            .on('finish', () => resolveEscritura())
            .on('error', rejectEscritura);
        });
      }

      const raiz = this.buscarRaizIndexHtml(destino);
      if (raiz === null) {
        throw new BadRequestException('El .zip no contiene un index.html — subí la carpeta exportada completa del catálogo.');
      }

      const actualizado = await this.prisma.catalogoDigital.update({ where: { id: registro.id }, data: { raiz } });
      return this.conUrl(actualizado);
    } catch (err) {
      rmSync(destino, { recursive: true, force: true });
      await this.prisma.catalogoDigital.delete({ where: { id: registro.id } }).catch(() => {});
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('No se pudo procesar el .zip — verificá que no esté dañado o corrupto.');
    }
  }

  async cambiarActivo(id: string, activo: boolean) {
    const actualizado = await this.prisma.catalogoDigital.update({ where: { id }, data: { activo } });
    return this.conUrl(actualizado);
  }

  async eliminar(id: string) {
    rmSync(join(RAIZ_UPLOADS, id), { recursive: true, force: true });
    await this.prisma.catalogoDigital.delete({ where: { id } });
    return { eliminado: true };
  }
}
