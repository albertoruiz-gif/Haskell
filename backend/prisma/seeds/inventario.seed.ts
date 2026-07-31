import { PrismaClient } from '@prisma/client';

/**
 * Lotes de inventario de prueba — uno por cada situación que puede pasar
 * un lote (disponible/próximo a vencer, vencido, bloqueado, dañado, aún
 * en recepción), sobre los primeros 5 productos del catálogo RETAIL
 * (HSK-0001 a HSK-0005). Requiere haber corrido antes seedCatalogo().
 *
 * No corre como parte del bootstrap normal — se invoca a mano con
 * `npm run seed:inventario`, solo en ambientes de desarrollo/demo.
 */

async function catalogLineDe(prisma: PrismaClient, sku: string) {
  const linea = await prisma.catalogLine.findFirst({ where: { sku } });
  if (!linea) throw new Error(`No se encontró ${sku} — correr primero seedCatalogo().`);
  return linea;
}

async function crearLoteYAvanzar(
  prisma: PrismaClient,
  params: { catalogLineId: string; numeroLote: string; cantidadRecibida: number; cantidadDanada?: number; fechaVencimiento?: Date; ubicacionAlmacen?: string },
  estadoFinal: string,
  motivoBloqueo?: string,
) {
  const existente = await prisma.loteInventario.findFirst({ where: { catalogLineId: params.catalogLineId, numeroLote: params.numeroLote } });
  if (existente) return existente;

  const lote = await prisma.loteInventario.create({
    data: {
      catalogLineId: params.catalogLineId,
      numeroLote: params.numeroLote,
      proveedor: 'Haskell Brasil',
      paisOrigen: 'Brasil',
      cantidadRecibida: params.cantidadRecibida,
      cantidadDanada: params.cantidadDanada ?? 0,
      fechaVencimiento: params.fechaVencimiento,
      ubicacionAlmacen: params.ubicacionAlmacen,
      estado: 'NACIONALIZADO',
    },
  });

  // Pasa por los estados intermedios reales hasta llegar al final pedido —
  // igual que lo haría un operador de Almacén desde la UI. DISPONIBLE,
  // BLOQUEADO y DANADO son ramas que salen de CONTROL_CALIDAD; los demás
  // son pasos previos del mismo pipeline lineal.
  const PIPELINE_BASE = ['EN_TRASLADO_ALMACEN', 'RECEPCION_PENDIENTE', 'CONTROL_CALIDAD'];
  const idxEnBase = PIPELINE_BASE.indexOf(estadoFinal);
  const secuencia = idxEnBase >= 0 ? PIPELINE_BASE.slice(0, idxEnBase + 1) : [...PIPELINE_BASE, estadoFinal];
  let loteActual = lote;
  for (const estado of secuencia) {
    if (loteActual.estado === estado) continue;
    loteActual = await prisma.loteInventario.update({
      where: { id: lote.id },
      data: { estado: estado as any, motivoBloqueo: estado === 'BLOQUEADO' ? motivoBloqueo : undefined },
    });
  }
  return loteActual;
}

export async function seedInventario(prisma: PrismaClient) {
  const dias = (n: number) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

  const hsk1 = await catalogLineDe(prisma, 'HSK-0001');
  await crearLoteYAvanzar(prisma, { catalogLineId: hsk1.id, numeroLote: 'LT-2026-001', cantidadRecibida: 50, fechaVencimiento: dias(15), ubicacionAlmacen: 'A-01' }, 'DISPONIBLE');

  const hsk2 = await catalogLineDe(prisma, 'HSK-0002');
  await crearLoteYAvanzar(prisma, { catalogLineId: hsk2.id, numeroLote: 'LT-2026-002', cantidadRecibida: 20, fechaVencimiento: dias(-5), ubicacionAlmacen: 'A-02' }, 'DISPONIBLE');

  const hsk3 = await catalogLineDe(prisma, 'HSK-0003');
  await crearLoteYAvanzar(prisma, { catalogLineId: hsk3.id, numeroLote: 'LT-2026-003', cantidadRecibida: 30, ubicacionAlmacen: 'B-01' }, 'BLOQUEADO', 'Pendiente validación sanitaria');

  const hsk4 = await catalogLineDe(prisma, 'HSK-0004');
  await crearLoteYAvanzar(prisma, { catalogLineId: hsk4.id, numeroLote: 'LT-2026-004', cantidadRecibida: 40 }, 'RECEPCION_PENDIENTE');

  const hsk5 = await catalogLineDe(prisma, 'HSK-0005');
  await crearLoteYAvanzar(prisma, { catalogLineId: hsk5.id, numeroLote: 'LT-2026-005', cantidadRecibida: 25, cantidadDanada: 5 }, 'DANADO');

  console.log('Lotes de prueba: HSK-0001 disponible (próx. a vencer), HSK-0002 vencido, HSK-0003 bloqueado, HSK-0004 recepción pendiente, HSK-0005 dañado.');
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedInventario(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
