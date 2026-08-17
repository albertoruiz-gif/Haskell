import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

// EP-21 — comprobante de un RegistroCobro (voucher de depósito bancario,
// típicamente). A diferencia de la evidencia de entrega, acá también se
// acepta PDF: muchos comprobantes de banca por internet se descargan así,
// no como foto.
const destino = join(process.cwd(), 'uploads', 'cobros');
if (!existsSync(destino)) mkdirSync(destino, { recursive: true });

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const EXTENSION_POR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export const multerCobroConfig = {
  storage: diskStorage({
    destination: destino,
    // Mismo criterio que multer-catalog.config.ts (auditoría 2026-08-10):
    // el nombre del archivo no depende de nada que venga del cliente.
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = EXTENSION_POR_MIME[file.mimetype] ?? extname(file.originalname).slice(0, 5);
      cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new BadRequestException('El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
};
