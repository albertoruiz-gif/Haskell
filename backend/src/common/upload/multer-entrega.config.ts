import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

// Evidencia de entrega (foto tomada por el transportista al momento de
// entregar, RF-028/DP-010) — carpeta separada de las fotos de producto.
const destino = join(process.cwd(), 'uploads', 'entregas');
if (!existsSync(destino)) mkdirSync(destino, { recursive: true });

const TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp'];

export const multerEntregaConfig = {
  storage: diskStorage({
    destination: destino,
    filename: (req: any, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      cb(null, `${req.params.id}-${Date.now()}-${randomBytes(4).toString('hex')}${extname(file.originalname)}`);
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
