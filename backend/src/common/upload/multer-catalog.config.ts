import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const destino = join(process.cwd(), 'uploads', 'catalogo');
if (!existsSync(destino)) mkdirSync(destino, { recursive: true });

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

// Extensión permitida, tomada de una lista fija — no de extname(originalname)
// tal cual, para no arrastrar lo que el cliente mande en el nombre del archivo.
const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const multerCatalogConfig = {
  storage: diskStorage({
    destination: destino,
    // Auditoria de seguridad 2026-08-10: antes el nombre incluía
    // `req.params.id` sin validar, ANTES de que el controller llegue a
    // confirmar que ese id exista — un id con "../" habría podido escribir
    // el archivo fuera de esta carpeta. El nombre ya no depende de nada
    // que venga del cliente (ni el id de la URL, ni el nombre original del
    // archivo) — solo un token aleatorio, tal como ya lo usa el resto del
    // sistema (ver quien arma la URL: catalog.controller.ts).
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = EXTENSION_POR_MIME[file.mimetype] ?? extname(file.originalname).slice(0, 5);
      cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new BadRequestException('Formato de imagen no soportado (usar JPG, PNG o WEBP).'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};
