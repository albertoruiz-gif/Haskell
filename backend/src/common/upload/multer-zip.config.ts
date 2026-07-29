import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// El catálogo digital (flipbook tipo Yanbal) se arma por fuera de la
// plataforma y se sube completo como .zip (index.html + imágenes + JS/CSS
// propios) — se guarda en memoria para extraerlo con unzipper, no en disco
// (evita un archivo .zip suelto que después haya que limpiar).
const EXTENSION_VALIDA = /\.zip$/i;

export const multerZipConfig = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!EXTENSION_VALIDA.test(file.originalname)) {
      return cb(new BadRequestException('El archivo debe ser un .zip (la carpeta exportada completa, comprimida).'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 300 * 1024 * 1024 },
};
