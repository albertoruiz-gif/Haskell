import * as path from 'path';
import * as fs from 'fs';
import * as ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

/**
 * Carga el catálogo real de Haskell (143 productos, ver
 * catalogo-haskell/README_catalogo.md) a un Catalog PUBLICADO de canal
 * RETAIL, más una tarifa de envío de prueba. Es el conector entre el
 * "catálogo maestro traducido" (independiente, scrapeado) y el CatalogLine
 * de la plataforma comercial, que el README de esa carpeta dejaba pendiente.
 *
 * No corre como parte del bootstrap normal (prisma db seed) — es un seed
 * de datos de demo/desarrollo, se invoca a mano con `npm run seed:catalogo`.
 */

const TIPO_CAMBIO = Number(process.env.CATALOGO_TIPO_CAMBIO ?? 0.67);
const MARGEN = Number(process.env.CATALOGO_MARGEN ?? 0.25);

const XLSX_PATH = process.env.CATALOGO_XLSX_PATH ?? path.join(__dirname, '../../../catalogo-haskell/productos_haskell.xlsx');
const IMAGENES_DIR = process.env.CATALOGO_IMAGENES_DIR ?? path.join(__dirname, '../../../catalogo-haskell/imagenes_principales');
const UPLOADS_DIR = path.join(__dirname, '../../uploads/catalogo');

function val(cell: any): any {
  if (cell === null || cell === undefined) return null;
  if (typeof cell === 'object' && 'result' in cell) return cell.result;
  if (typeof cell === 'object' && 'formula' in cell) return null;
  return cell;
}

export async function seedCatalogo(prisma: PrismaClient) {
  if (!fs.existsSync(XLSX_PATH)) {
    console.log(`Catálogo omitido: no se encontró ${XLSX_PATH} (ver CATALOGO_XLSX_PATH).`);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const hoja = wb.getWorksheet('Productos');
  if (!hoja) throw new Error('El Excel no tiene una hoja "Productos".');

  // Copia las fotos a uploads/catalogo si existen localmente — en Docker
  // esto requiere que catalogo-haskell/imagenes_principales esté montado o
  // copiado a mano (ver catalogo-haskell/README_catalogo.md); si no está,
  // los productos quedan sin imagenUrl en vez de fallar.
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  let imagenesDisponibles = new Set<string>();
  if (fs.existsSync(IMAGENES_DIR)) {
    for (const archivo of fs.readdirSync(IMAGENES_DIR)) {
      fs.copyFileSync(path.join(IMAGENES_DIR, archivo), path.join(UPLOADS_DIR, archivo));
    }
    imagenesDisponibles = new Set(fs.readdirSync(UPLOADS_DIR));
    console.log(`Imágenes copiadas: ${imagenesDisponibles.size}`);
  } else {
    imagenesDisponibles = new Set(fs.readdirSync(UPLOADS_DIR));
    console.log(`Carpeta de imágenes no encontrada (${IMAGENES_DIR}) — se usan las que ya estén en uploads/catalogo, si hay.`);
  }

  await prisma.tarifa.upsert({
    where: { distrito: 'Miraflores' },
    create: { distrito: 'Miraflores', zona: 'Lima', precio: 15.0, slaHoras: 36, activa: true },
    update: { activa: true },
  });

  const campaign = await prisma.campaign.upsert({
    where: { codigo: 'CAMP-2026-BASE' },
    create: {
      codigo: 'CAMP-2026-BASE',
      nombre: 'Catálogo base 2026',
      fechaInicio: new Date('2026-01-01'),
      fechaFin: new Date('2026-12-31'),
      estado: 'ACTIVA',
      canalesObjetivo: ['RETAIL'],
    },
    update: {},
  });

  let catalog = await prisma.catalog.findFirst({ where: { campaignId: campaign.id, canal: 'RETAIL' } });
  if (!catalog) {
    catalog = await prisma.catalog.create({
      data: {
        campaignId: campaign.id,
        canal: 'RETAIL',
        version: 1,
        estado: 'PUBLICADO',
        vigenciaDesde: new Date('2026-01-01'),
        vigenciaHasta: new Date('2027-12-31'),
      },
    });
  } else {
    await prisma.catalog.update({
      where: { id: catalog.id },
      data: { estado: 'PUBLICADO', vigenciaDesde: new Date('2026-01-01'), vigenciaHasta: new Date('2027-12-31') },
    });
  }

  let creadas = 0;
  for (let i = 2; i <= hoja.rowCount; i++) {
    const row = hoja.getRow(i).values as any[];
    const sku = val(row[1]); // columna "id" (HSK-0001) — la columna "sku" viene vacía en el Excel
    if (!sku) continue;

    const nombre = val(row[6]);
    const linea = val(row[7]);
    const categoria = val(row[9]);
    const subcategoria = val(row[11]);
    const tipo = val(row[13]);
    const precioRegularBrl = Number(val(row[17])) || 0;
    const precioOfertaBrl = Number(val(row[18])) || 0;
    const descripcion = val(row[23]);
    const beneficios = val(row[25]);
    const propiedades = val(row[27]);
    const modoUso = val(row[29]);
    const activos = val(row[31]);
    const imagenLocal = val(row[34]);

    const precioBaseBrl = precioOfertaBrl > 0 ? precioOfertaBrl : precioRegularBrl;
    const pvpPen = Math.round(precioBaseBrl * TIPO_CAMBIO * (1 + MARGEN) * 100) / 100;
    if (!pvpPen || pvpPen <= 0) continue;

    const imagenUrl = imagenLocal && imagenesDisponibles.has(imagenLocal) ? `/uploads/catalogo/${imagenLocal}` : null;

    const existente = await prisma.catalogLine.findFirst({ where: { catalogId: catalog.id, sku } });
    const data = { nombre, categoria, linea, subcategoria, tipo, descripcion, beneficios, propiedades, modoUso, activos, pvpCampania: pvpPen, imagenUrl };
    if (existente) {
      await prisma.catalogLine.update({ where: { id: existente.id }, data });
    } else {
      await prisma.catalogLine.create({ data: { ...data, catalogId: catalog.id, sku } });
    }
    creadas++;
  }

  console.log(`Catálogo cargado: ${creadas} líneas en catálogo ${catalog.id} (canal RETAIL, ${campaign.codigo}).`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCatalogo(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
