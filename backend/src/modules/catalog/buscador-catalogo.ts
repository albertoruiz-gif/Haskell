import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';

/**
 * Único lugar donde vive la lógica de "encontrar productos por texto" del
 * catálogo — antes esto estaba duplicado (con criterios distintos, y
 * distinto nivel de corrección) en catalog.controller.ts y en
 * frontend/src/lib/useFiltrosCatalogo.ts, y encima el buscador de
 * NuevaOfertaModal.tsx no tenía NINGÚN manejo de tildes/sinónimos. La
 * versión del frontend sigue existiendo aparte porque corre en el
 * navegador (filtra una lista ya cargada, sin ir a la base) — pero todo lo
 * que sí pasa por el backend (Carrito, Catálogo, Gestión, Ofertas) usa esta
 * clase, así que un fix acá no puede volver a quedar aplicado "a medias".
 *
 * Estrategia (2026-08-10, reemplaza el hack anterior de listar
 * manualmente 'champu'/'champú'/'shampoo'): las tildes se resuelven de
 * forma genérica con la extensión `unaccent` de Postgres — ya no hace
 * falta acordarse de agregar cada palabra acentuada a mano, funciona para
 * cualquier producto. Lo único que SÍ sigue necesitando una lista a mano
 * son los sinónimos que son palabras distintas de verdad (no un tema de
 * tilde), como "champú"/"shampoo".
 */
@Injectable()
export class BuscadorCatalogo {
  constructor(private readonly prisma: PrismaService) {}

  // Sinónimos comerciales reales del rubro — palabras distintas para lo
  // mismo, no resolubles quitando tildes. Agregar acá cualquier otro caso
  // real que aparezca (ej. "conditioner"/"acondicionador").
  private readonly GRUPOS_SINONIMOS: string[][] = [['champu', 'shampoo']];

  private variantes(termino: string): string[] {
    const lower = termino.toLowerCase().trim();
    if (lower.length < 4) return [termino];
    const grupo = this.GRUPOS_SINONIMOS.find((g) => g.some((p) => p.startsWith(lower) || lower.startsWith(p)));
    return grupo ? [termino, ...grupo] : [termino];
  }

  /** IDs de CatalogLine cuyo sku/nombre/categoria/linea coincide con el término, sin importar tildes. */
  async idsQueCoinciden(termino: string): Promise<string[]> {
    const variantes = this.variantes(termino);
    const condiciones = variantes.map((v) => {
      const comodin = `%${v}%`;
      return Prisma.sql`(
        unaccent(sku) ILIKE unaccent(${comodin})
        OR unaccent(nombre) ILIKE unaccent(${comodin})
        OR unaccent(categoria) ILIKE unaccent(${comodin})
        OR unaccent(linea) ILIKE unaccent(${comodin})
      )`;
    });
    const filas = await this.prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM catalog_lines WHERE ${Prisma.join(condiciones, ' OR ')}`,
    );
    return filas.map((f) => f.id);
  }
}
