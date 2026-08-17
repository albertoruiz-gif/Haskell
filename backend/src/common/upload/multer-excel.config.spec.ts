import { BadRequestException } from '@nestjs/common';
import { multerExcelConfig } from './multer-excel.config';

describe('multerExcelConfig.fileFilter', () => {
  function archivo(originalname: string, mimetype: string): Express.Multer.File {
    return { originalname, mimetype } as Express.Multer.File;
  }

  it('acepta un .xlsx con el mimetype correcto', (done) => {
    multerExcelConfig.fileFilter({} as any, archivo('asesores.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('acepta un .xlsx aunque el navegador mande un mimetype genérico (cae a la extensión)', (done) => {
    multerExcelConfig.fileFilter({} as any, archivo('asesores.xlsx', 'application/octet-stream'), (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('rechaza un .xls (binario viejo) — ExcelJS.xlsx no puede leerlo', (done) => {
    multerExcelConfig.fileFilter({} as any, archivo('asesores.xls', 'application/vnd.ms-excel'), (err, accept) => {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(accept).toBe(false);
      done();
    });
  });

  it('rechaza un archivo que no es un Excel en absoluto', (done) => {
    multerExcelConfig.fileFilter({} as any, archivo('virus.exe', 'application/x-msdownload'), (err, accept) => {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(accept).toBe(false);
      done();
    });
  });

  it('tiene un límite de tamaño configurado', () => {
    expect(multerExcelConfig.limits.fileSize).toBe(10 * 1024 * 1024);
  });
});
