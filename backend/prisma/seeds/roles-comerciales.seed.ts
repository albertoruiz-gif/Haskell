import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

/**
 * Cuentas de prueba para los roles comerciales agregados 2026-07-30:
 * Almacén, Líder de Equipo (LIDER_MINORISTA) y Gerente Comercial. Crea
 * además una asesora de Comercio Minorista afiliada por el líder, para
 * demostrar el gate de canal (RN líder/comisiones).
 *
 * No corre como parte del bootstrap normal — se invoca a mano con
 * `npm run seed:roles`, solo en ambientes de desarrollo/demo.
 */

async function crearUsuarioSimple(prisma: PrismaClient, email: string, nombre: string, rol: 'ALMACEN', password: string) {
  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) return existente;
  return prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12), nombre, rol } });
}

export async function seedRolesComerciales(prisma: PrismaClient) {
  await crearUsuarioSimple(prisma, 'almacen.demo@haskell.local', 'Almacén Demo', 'ALMACEN', 'Almacen123!');
  console.log('Usuario Almacén: almacen.demo@haskell.local / Almacen123!');

  let userLider = await prisma.user.findUnique({ where: { email: 'lider.demo@haskell.local' } });
  if (!userLider) {
    userLider = await prisma.user.create({
      data: { email: 'lider.demo@haskell.local', passwordHash: await bcrypt.hash('Lider123!', 12), nombre: 'Rosa Mendoza', rol: 'LIDER_MINORISTA' },
    });
  }
  let lider = await prisma.lider.findUnique({ where: { userId: userLider.id } });
  if (!lider) {
    lider = await prisma.lider.create({ data: { userId: userLider.id, telefono: '988111222', comisionPct: 5 } });
  }
  console.log('Líder de Equipo: lider.demo@haskell.local / Lider123! (comisión 5%)');

  let userGerente = await prisma.user.findUnique({ where: { email: 'gerente.demo@haskell.local' } });
  if (!userGerente) {
    userGerente = await prisma.user.create({
      data: { email: 'gerente.demo@haskell.local', passwordHash: await bcrypt.hash('Gerente123!', 12), nombre: 'Fernando Castro', rol: 'GERENTE_COMERCIAL' },
    });
  }
  const gerenteExistente = await prisma.gerenteComercial.findUnique({ where: { userId: userGerente.id } });
  if (!gerenteExistente) {
    await prisma.gerenteComercial.create({ data: { userId: userGerente.id, telefono: '988333444', comisionPct: 4 } });
  }
  console.log('Gerente Comercial: gerente.demo@haskell.local / Gerente123! (comisión 4% sobre los 3 canales)');

  // Asesora de Comercio Minorista afiliada por el líder — demuestra el
  // gate de canal (el líder solo puede afiliar minorista, auto-vinculado).
  const tarifa = await prisma.tarifa.findUnique({ where: { distrito: 'Miraflores' } });
  if (tarifa) {
    let userAsesora = await prisma.user.findUnique({ where: { email: 'asesora.minorista@haskell.local' } });
    if (!userAsesora) {
      userAsesora = await prisma.user.create({
        data: { email: 'asesora.minorista@haskell.local', passwordHash: await bcrypt.hash('Asesor123!', 12), nombre: 'Carmen Flores Diaz', rol: 'ASESOR' },
      });
    }
    const asesoraExistente = await prisma.asesor.findUnique({ where: { userId: userAsesora.id } });
    if (!asesoraExistente) {
      await prisma.asesor.create({
        data: {
          userId: userAsesora.id,
          codigo: 'AS-MINORISTA-001',
          apellidos: 'Flores Diaz',
          tipoDocumento: 'DNI',
          numeroDocumento: '70199999',
          fechaNacimiento: new Date('1990-05-10'),
          telefonoPrincipal: '987222333',
          numeroYape: '987222333',
          canal: 'COMERCIO_MINORISTA',
          liderId: lider.id,
          direcciones: { create: { departamento: 'Lima', provincia: 'Lima', distrito: 'Miraflores', direccion: 'Calle Prueba 1', predeterminada: true } },
        },
      });
      console.log('Asesora de Comercio Minorista afiliada al líder: asesora.minorista@haskell.local / Asesor123!');
    }
  } else {
    console.log('Asesora minorista omitida: no hay tarifa activa para Miraflores (correr primero seedDemoData de catalogo.seed).');
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedRolesComerciales(prisma)
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
