import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { join } from 'path';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Cabeceras de seguridad (X-Frame-Options, X-Content-Type-Options, etc.)
  // — auditoria 2026-08-10, antes no habia ninguna. CSP desactivada acá a
  // propósito: la API no sirve HTML propio (solo JSON + /uploads), y una
  // CSP mal calibrada rompería la carga de imágenes/scripts del frontend
  // si algún día se sirve desde el mismo dominio.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Auditoria 2026-08-10: sin FRONTEND_ORIGIN configurado, esto caía en
  // origin: '*' (cualquier sitio podía llamar a la API). Ahora, si falta
  // la variable, se restringe a los dominios propios conocidos en vez de
  // abrir a todo Internet — nunca debería depender de que alguien se
  // acuerde de setear la variable en cada server nuevo.
  const origenesPorDefecto = ['https://haskell.com.pe', 'https://testeo.haskell.com.pe', 'http://localhost:3001'];
  const origenesPermitidos = process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',') : origenesPorDefecto;
  if (!process.env.FRONTEND_ORIGIN) {
    Logger.warn('FRONTEND_ORIGIN no está configurado — usando lista por defecto en vez de origin:"*".', 'Bootstrap');
  }
  app.enableCors({ origin: origenesPermitidos });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Fuera del prefijo /api a proposito: son archivos estaticos, no rutas de la API.
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.setGlobalPrefix('api');

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Backend escuchando en :${port}`);
}

bootstrap();
