import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// EP-18: importar tarifario de envío (RF-016) — acepta Excel .xlsx o CSV,
// mismo criterio que ya usa TarifasController.importar() para elegir el
// parser (extensión .csv, o mimetype text/csv como respaldo — el mimetype
// de CSV es poco confiable entre navegadores/SO). Antes este endpoint no
// tenía fileFilter ni límite de tamaño: cualquier archivo, de cualquier
// tamaño, pasaba directo al parser.
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXTENSION_XLSX = /\.xlsx$/i;
const EXTENSION_CSV = /\.csv$/i;

export const multerTarifasConfig = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    const esXlsx = file.mimetype === MIME_XLSX || EXTENSION_XLSX.test(file.originalname);
    const esCsv = file.mimetype === 'text/csv' || EXTENSION_CSV.test(file.originalname);
    if (!esXlsx && !esCsv) {
      return cb(new BadRequestException('El archivo debe ser un Excel (.xlsx) o CSV.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
};
