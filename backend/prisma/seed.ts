import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Bootstrap del primer usuario ADMINISTRADOR — sin esto no hay forma de
// entrar al panel de administrador la primera vez (no existe registro
// público, a propósito).
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@haskell.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!';

  const existente = await prisma.user.findUnique({ where: { email } });
  if (existente) {
    console.log(`Ya existe un usuario con email ${email}, no se creó ninguno nuevo.`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      nombre: 'Administrador',
      rol: 'ADMINISTRADOR',
    },
  });

  console.log(`Usuario administrador creado: ${email} / ${password} (cambiar la clave luego del primer login).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
