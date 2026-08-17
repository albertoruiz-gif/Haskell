import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

// EP-18: carga masiva de asesores (RF-008) — el Excel se lee entero en
// memoria con ExcelJS (workbook.xlsx.load), nunca se guarda en disco. Solo
// acepta .xlsx (formato OOXML real) porque es lo único que ExcelJS.xlsx
// sabe leer — un .xls (binario viejo) pasaría el filtro por mimetype en
// algunos navegadores pero después reventaría al parsear, así que se
// rechaza acá mismo en vez de dejar que el error salga más adelante.
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXTENSION_XLSX = /\.xlsx$/i;

export const multerExcelConfig = {
  storage: memoryStorage(),
  fileFilter: (req: any, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (file.mimetype !== MIME_XLSX && !EXTENSION_XLSX.test(file.originalname)) {
      return cb(new BadRequestException('El archivo debe ser un Excel .xlsx.'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
};
