import * as bcrypt from 'bcrypt';
import { PrismaClient, EstadoPedido } from '@prisma/client';

/**
 * Asesores, transportistas y pedidos inventados para tener algo que
 * mostrar/probar en cada pantalla (Pagos, Almacén, Delivery) sin depender
 * de datos reales. Requiere haber corrido antes seedCatalogo() (necesita
 * un Catalog PUBLICADO de canal RETAIL con líneas cargadas).
 *
 * No corre como parte del bootstrap normal — se invoca a mano con
 * `npm run seed:demo`, solo en ambientes de desarrollo/demo.
 */

type AsesorInfo = { asesor: any; email: string };

async function crearAsesor(
  prisma: PrismaClient,
  datos: {
    email: string;
    nombres: string;
    apellidos: string;
    dni: string;
    telefono: string;
    yape: string;
    fechaNacimiento: string;
    canal: 'RETAIL' | 'SALONES_BELLEZA' | 'COMERCIO_MINORISTA';
    distrito: string;
    direccion: string;
  },
): Promise<AsesorInfo> {
  let user = await prisma.user.findUnique({ where: { email: datos.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: datos.email, passwordHash: await bcrypt.hash('Asesor123!', 12), nombre: `${datos.nombres} ${datos.apellidos}`, rol: 'ASESOR' },
    });
  }
  let asesor = await prisma.asesor.findUnique({ where: { userId: user.id }, include: { direcciones: true } });
  if (!asesor) {
    asesor = await prisma.asesor.create({
      data: {
        userId: user.id,
        codigo: `AS-${datos.dni}`,
        apellidos: datos.apellidos,
        tipoDocumento: 'DNI',
        numeroDocumento: datos.dni,
        fechaNacimiento: new Date(datos.fechaNacimiento),
        telefonoPrincipal: datos.telefono,
        numeroYape: datos.yape,
        canal: datos.canal,
        direcciones: { create: { departamento: 'Lima', provincia: 'Lima', distrito: datos.distrito, direccion: datos.direccion, predeterminada: true } },
      },
      include: { direcciones: true },
    });
  }
  return { asesor, email: datos.email };
}

async function crearTransportista(prisma: PrismaClient, datos: { email: string; nombre: string; telefono: string; placa: string; tarifaPorEntrega: number }) {
  let user = await prisma.user.findUnique({ where: { email: datos.email } });
  if (!user) {
    user = await prisma.user.create({ data: { email: datos.email, passwordHash: await bcrypt.hash('Transp123!', 12), nombre: datos.nombre, rol: 'TRANSPORTISTA' } });
  }
  let transportista = await prisma.transportista.findUnique({ where: { userId: user.id } });
  if (!transportista) {
    transportista = await prisma.transportista.create({ data: { userId: user.id, telefono: datos.telefono, placa: datos.placa, tarifaPorEntrega: datos.tarifaPorEntrega } });
  }
  return transportista;
}

async function crearPedido(
  prisma: PrismaClient,
  params: { asesorInfo: AsesorInfo; catalog: any; itemsSku: string[]; estado: EstadoPedido; pagadoEn?: Date },
) {
  const { asesor } = params.asesorInfo;
  const direccion = asesor.direcciones[0];
  const tarifa = await prisma.tarifa.findUniqueOrThrow({ where: { distrito: direccion.distrito } });
  const lineas = await prisma.catalogLine.findMany({ where: { catalogId: params.catalog.id, sku: { in: params.itemsSku } } });

  const porcentaje = 80;
  const items = lineas.map((l) => {
    const cantidad = 1 + Math.floor(Math.random() * 2);
    const precioAsesorUnitario = Math.round(Number(l.pvpCampania) * (porcentaje / 100) * 100) / 100;
    return { sku: l.sku, nombre: l.nombre ?? l.sku, pvpUnitario: Number(l.pvpCampania), porcentajeAsesorAplicado: porcentaje, precioAsesorUnitario, cantidad };
  });
  const subtotalAsesor = items.reduce((acc, i) => acc + i.precioAsesorUnitario * i.cantidad, 0);
  const totalCulqi = Math.round((subtotalAsesor + Number(tarifa.precio)) * 100) / 100;

  return prisma.order.create({
    data: {
      asesorId: asesor.id,
      canal: asesor.canal,
      campaignId: params.catalog.campaignId,
      catalogId: params.catalog.id,
      catalogVersion: params.catalog.version,
      direccionSnapshot: { departamento: direccion.departamento, provincia: direccion.provincia, distrito: direccion.distrito, direccion: direccion.direccion },
      tarifaSnapshot: tarifa.precio,
      slaHorasSnapshot: tarifa.slaHoras,
      subtotalAsesor: Math.round(subtotalAsesor * 100) / 100,
      totalCulqi,
      estado: params.estado,
      pagadoEn: params.pagadoEn ?? null,
      items: { create: items },
    },
  });
}

export async function seedDemoData(prisma: PrismaClient) {
  const catalog = await prisma.catalog.findFirst({ where: { canal: 'RETAIL', estado: 'PUBLICADO' } });
  if (!catalog) {
    console.log('Demo omitida: no hay ningún Catalog PUBLICADO de canal RETAIL — correr primero seedCatalogo().');
    return;
  }

  const datosAsesores = [
    { email: 'maria.quispe@haskell.local', nombres: 'María Fernanda', apellidos: 'Quispe Rojas', dni: '70111222', telefono: '987111222', yape: '987111222', fechaNacimiento: '1992-03-14', canal: 'RETAIL' as const, distrito: 'San Isidro', direccion: 'Av. Los Álamos 245' },
    { email: 'carlos.mendoza@haskell.local', nombres: 'Carlos Alberto', apellidos: 'Mendoza Ríos', dni: '70111333', telefono: '987111333', yape: '987111333', fechaNacimiento: '1988-07-22', canal: 'RETAIL' as const, distrito: 'Surco', direccion: 'Calle Las Begonias 118' },
    { email: 'lucia.torres@haskell.local', nombres: 'Lucía Alejandra', apellidos: 'Torres Vega', dni: '70111444', telefono: '987111444', yape: '987111444', fechaNacimiento: '1995-11-05', canal: 'RETAIL' as const, distrito: 'La Molina', direccion: 'Jr. Las Camelias 302' },
    { email: 'jorge.huaman@haskell.local', nombres: 'Jorge Luis', apellidos: 'Huamán Castro', dni: '70111555', telefono: '987111555', yape: '987111555', fechaNacimiento: '1985-01-30', canal: 'RETAIL' as const, distrito: 'Miraflores', direccion: 'Av. Pardo 456' },
    { email: 'andrea.salazar@haskell.local', nombres: 'Andrea Gabriela', apellidos: 'Salazar Peña', dni: '70111666', telefono: '987111666', yape: '987111666', fechaNacimiento: '1998-09-18', canal: 'RETAIL' as const, distrito: 'San Isidro', direccion: 'Av. Camino Real 789' },
  ];
  for (const t of [
    { distrito: 'San Isidro', zona: 'Lima', precio: 18, slaHoras: 24 },
    { distrito: 'Surco', zona: 'Lima', precio: 12, slaHoras: 48 },
    { distrito: 'La Molina', zona: 'Lima', precio: 20, slaHoras: 48 },
  ]) {
    await prisma.tarifa.upsert({ where: { distrito: t.distrito }, create: { ...t, activa: true }, update: { activa: true } });
  }

  const asesores: AsesorInfo[] = [];
  for (const d of datosAsesores) asesores.push(await crearAsesor(prisma, d));
  console.log('Asesores:', asesores.map((a) => a.email).join(', '));

  const transportista1 = await crearTransportista(prisma, { email: 'miguel.torres@haskell.local', nombre: 'Miguel Torres', telefono: '976222111', placa: 'ABC-123', tarifaPorEntrega: 15 });
  const transportista2 = await crearTransportista(prisma, { email: 'rosa.vidal@haskell.local', nombre: 'Rosa Vidal', telefono: '976222222', placa: 'XYZ-789', tarifaPorEntrega: 12 });
  console.log('Transportistas: Miguel Torres, Rosa Vidal');

  const ahora = new Date();
  const haceHoras = (h: number) => new Date(ahora.getTime() - h * 60 * 60 * 1000);

  const p1 = await crearPedido(prisma, { asesorInfo: asesores[0], catalog, itemsSku: ['HSK-0001', 'HSK-0002'], estado: 'PENDIENTE_PAGO' });
  const p2 = await crearPedido(prisma, { asesorInfo: asesores[1], catalog, itemsSku: ['HSK-0003'], estado: 'PENDIENTE_PAGO' });
  const p3 = await crearPedido(prisma, { asesorInfo: asesores[2], catalog, itemsSku: ['HSK-0004', 'HSK-0005'], estado: 'PAGADO', pagadoEn: haceHoras(1) });
  const p4 = await crearPedido(prisma, { asesorInfo: asesores[0], catalog, itemsSku: ['HSK-0006'], estado: 'PICKING', pagadoEn: haceHoras(3) });
  const p5 = await crearPedido(prisma, { asesorInfo: asesores[3], catalog, itemsSku: ['HSK-0007', 'HSK-0008'], estado: 'PACKING', pagadoEn: haceHoras(5) });
  const p6 = await crearPedido(prisma, { asesorInfo: asesores[1], catalog, itemsSku: ['HSK-0009'], estado: 'ENTREGADO_TRANSPORTISTA', pagadoEn: haceHoras(10) });
  const p7 = await crearPedido(prisma, { asesorInfo: asesores[4], catalog, itemsSku: ['HSK-0010', 'HSK-0011'], estado: 'EN_RUTA', pagadoEn: haceHoras(20) });
  const p8 = await crearPedido(prisma, { asesorInfo: asesores[2], catalog, itemsSku: ['HSK-0012'], estado: 'ENTREGADO', pagadoEn: haceHoras(40) });
  const p9 = await crearPedido(prisma, { asesorInfo: asesores[3], catalog, itemsSku: ['HSK-0013'], estado: 'ENTREGA_FALLIDA', pagadoEn: haceHoras(30) });
  const p10 = await crearPedido(prisma, { asesorInfo: asesores[4], catalog, itemsSku: ['HSK-0014'], estado: 'CANCELADO_DEVUELTO' });
  console.log('Pedidos creados:', [p1, p2, p3, p4, p5, p6, p7, p8, p9, p10].map((p) => p.referenciaWeb).join(', '));

  await prisma.entrega.upsert({ where: { orderId: p6.id }, create: { orderId: p6.id, transportistaId: transportista1.id, estado: 'ASIGNADO', bultos: 1 }, update: {} });
  await prisma.entrega.upsert({ where: { orderId: p7.id }, create: { orderId: p7.id, transportistaId: transportista2.id, estado: 'EN_RUTA', bultos: 2, aceptadoEn: haceHoras(19) }, update: {} });
  await prisma.entrega.upsert({
    where: { orderId: p8.id },
    create: {
      orderId: p8.id,
      transportistaId: transportista1.id,
      estado: 'ENTREGADO',
      bultos: 1,
      aceptadoEn: haceHoras(39),
      receptor: 'Rosa Elena Gómez',
      documentoReceptor: '45678912',
      montoPago: transportista1.tarifaPorEntrega,
      pagado: false,
    },
    update: {},
  });
  await prisma.entrega.upsert({
    where: { orderId: p9.id },
    create: {
      orderId: p9.id,
      transportistaId: transportista2.id,
      estado: 'FALLIDO',
      bultos: 1,
      aceptadoEn: haceHoras(29),
      motivoFallo: 'Cliente ausente en la dirección registrada',
      observaciones: 'Se reprogramará para el día siguiente',
    },
    update: {},
  });
  console.log('Entregas de demo creadas.');
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedDemoData(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
