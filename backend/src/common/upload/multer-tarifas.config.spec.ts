import { BadRequestException } from '@nestjs/common';
import { multerTarifasConfig } from './multer-tarifas.config';

describe('multerTarifasConfig.fileFilter', () => {
  function archivo(originalname: string, mimetype: string): Express.Multer.File {
    return { originalname, mimetype } as Express.Multer.File;
  }

  it('acepta un .xlsx', (done) => {
    multerTarifasConfig.fileFilter({} as any, archivo('tarifas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('acepta un .csv con mimetype text/csv', (done) => {
    multerTarifasConfig.fileFilter({} as any, archivo('tarifas.csv', 'text/csv'), (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('acepta un .csv aunque el mimetype sea inconsistente (cae a la extensión, como ya hacía TarifasController.importar)', (done) => {
    multerTarifasConfig.fileFilter({} as any, archivo('tarifas.csv', 'application/vnd.ms-excel'), (err, accept) => {
      expect(err).toBeNull();
      expect(accept).toBe(true);
      done();
    });
  });

  it('rechaza un archivo que no es ni Excel ni CSV', (done) => {
    multerTarifasConfig.fileFilter({} as any, archivo('tarifas.pdf', 'application/pdf'), (err, accept) => {
      expect(err).toBeInstanceOf(BadRequestException);
      expect(accept).toBe(false);
      done();
    });
  });

  it('tiene un límite de tamaño configurado', () => {
    expect(multerTarifasConfig.limits.fileSize).toBe(10 * 1024 * 1024);
  });
});
