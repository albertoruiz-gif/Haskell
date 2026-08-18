import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { CatalogController } from './catalog.controller';

describe('CatalogController.compararStockOdoo (EP-14)', () => {
  function crearController() {
    const prisma: any = { catalogLine: { findMany: jest.fn() } };
    const odoo: any = { obtenerProductos: jest.fn(), obtenerStock: jest.fn() };
    // Los otros 3 no los toca compararStockOdoo — mocks vacíos alcanzan.
    const pricing: any = {};
    const buscador: any = {};
    const inventario: any = {};
    const campaigns: any = {};
    const controller = new CatalogController(prisma, pricing, odoo, buscador, inventario, campaigns);
    return { controller, prisma, odoo };
  }

  it('reporta sin coincidencia los SKU que no existen en Odoo (sin default_code que matchee)', async () => {
    const { controller, prisma, odoo } = crearController();
    odoo.obtenerProductos.mockResolvedValue([{ id: 1, default_code: 'HSK-0001', name: 'A', list_price: 10 }]);
    odoo.obtenerStock.mockResolvedValue([]);
    prisma.catalogLine.findMany.mockResolvedValue([{ sku: 'HSK-9999', nombre: 'No está en Odoo', stockDisponible: 5 }]);

    const resultado = await controller.compararStockOdoo();

    expect(resultado.sinCoincidencia).toBe(1);
    expect(resultado.comparados).toBe(0);
    expect(resultado.detalle).toEqual([]);
  });

  it('no reporta nada en "detalle" cuando el stock interno y el de Odoo coinciden', async () => {
    const { controller, prisma, odoo } = crearController();
    odoo.obtenerProductos.mockResolvedValue([{ id: 1, default_code: 'HSK-0001', name: 'A', list_price: 10 }]);
    odoo.obtenerStock.mockResolvedValue([{ product_id: [1, 'A'], quantity: 10, reserved_quantity: 2 }]);
    prisma.catalogLine.findMany.mockResolvedValue([{ sku: 'HSK-0001', nombre: 'A', stockDisponible: 8 }]);

    const resultado = await controller.compararStockOdoo();

    expect(resultado.comparados).toBe(1);
    expect(resultado.conDiferencia).toBe(0);
    expect(resultado.detalle).toEqual([]);
  });

  it('reporta la diferencia (interno - disponible en Odoo, disponible = quantity - reserved_quantity)', async () => {
    const { controller, prisma, odoo } = crearController();
    odoo.obtenerProductos.mockResolvedValue([{ id: 1, default_code: 'HSK-0001', name: 'A', list_price: 10 }]);
    odoo.obtenerStock.mockResolvedValue([{ product_id: [1, 'A'], quantity: 10, reserved_quantity: 2 }]); // disponible = 8
    prisma.catalogLine.findMany.mockResolvedValue([{ sku: 'HSK-0001', nombre: 'A', stockDisponible: 5 }]);

    const resultado = await controller.compararStockOdoo();

    expect(resultado.conDiferencia).toBe(1);
    expect(resultado.detalle).toEqual([
      { sku: 'HSK-0001', nombre: 'A', stockInterno: 5, stockOdoo: 8, diferencia: -3 },
    ]);
  });

  it('nunca modifica CatalogLine.stockDisponible — es un reporte, no un sync', async () => {
    const { controller, prisma, odoo } = crearController();
    odoo.obtenerProductos.mockResolvedValue([{ id: 1, default_code: 'HSK-0001', name: 'A', list_price: 10 }]);
    odoo.obtenerStock.mockResolvedValue([{ product_id: [1, 'A'], quantity: 0, reserved_quantity: 0 }]);
    prisma.catalogLine.findMany.mockResolvedValue([{ sku: 'HSK-0001', nombre: 'A', stockDisponible: 20 }]);

    await controller.compararStockOdoo();

    expect(prisma.catalogLine.findMany).toHaveBeenCalledTimes(1);
  });
});

describe('CatalogController — EP-03 (duplicados + carga masiva)', () => {
  function crearController() {
    const prisma: any = {
      catalogLine: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
    };
    const pricing: any = {};
    const odoo: any = {};
    const buscador: any = {};
    const inventario: any = {};
    const campaigns: any = {};
    const controller = new CatalogController(prisma, pricing, odoo, buscador, inventario, campaigns);
    return { controller, prisma };
  }

  async function archivoDeEjemplo(filas: (string | number)[][]) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Productos');
    ws.addRow(['sku', 'nombre', 'categoria', 'linea', 'subcategoria', 'tipo', 'descripcion', 'beneficios', 'propiedades', 'modo_uso', 'activos', 'pvp']);
    for (const fila of filas) ws.addRow(fila);
    const buffer = await wb.xlsx.writeBuffer();
    return { buffer: Buffer.from(buffer) } as Express.Multer.File;
  }

  describe('crearLinea — SKU duplicado', () => {
    it('da un mensaje claro en vez del error crudo de Postgres (P2002)', async () => {
      const { controller, prisma } = crearController();
      const errorP2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: '5.19.0' });
      prisma.catalogLine.create.mockRejectedValue(errorP2002);

      await expect(controller.crearLinea({ catalogId: 'cat1', sku: 'HSK-0001', pvpCampania: 10 } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('otros errores de Prisma no se disfrazan de duplicado — se re-lanzan tal cual', async () => {
      const { controller, prisma } = crearController();
      prisma.catalogLine.create.mockRejectedValue(new Error('otra falla'));

      await expect(controller.crearLinea({ catalogId: 'cat1', sku: 'HSK-0001', pvpCampania: 10 } as any)).rejects.toThrow(
        'otra falla',
      );
    });
  });

  describe('carga masiva — previsualizar', () => {
    it('marca error si el SKU ya existe en el catálogo', async () => {
      const { controller, prisma } = crearController();
      prisma.catalogLine.findUnique.mockResolvedValue({ id: 'existente' });
      const archivo = await archivoDeEjemplo([['HSK-0001', 'Shampoo', '', '', '', '', '', '', '', '', '', '25.90']]);

      const resultado = await controller.previsualizarCargaMasivaLineas('cat1', archivo);

      expect(resultado.validos).toEqual([]);
      expect(resultado.errores).toEqual(
        expect.arrayContaining([expect.objectContaining({ campo: 'sku', motivo: expect.stringContaining('Ya existe') })]),
      );
    });

    it('marca error si el SKU está duplicado dentro del mismo archivo', async () => {
      const { controller } = crearController();
      const archivo = await archivoDeEjemplo([
        ['HSK-0001', 'Shampoo', '', '', '', '', '', '', '', '', '', '25.90'],
        ['HSK-0001', 'Shampoo otra vez', '', '', '', '', '', '', '', '', '', '30'],
      ]);

      const resultado = await controller.previsualizarCargaMasivaLineas('cat1', archivo);

      expect(resultado.errores).toEqual(
        expect.arrayContaining([expect.objectContaining({ fila: 3, motivo: expect.stringContaining('duplicado dentro del archivo') })]),
      );
    });

    it('marca error si el pvp no es un número positivo', async () => {
      const { controller } = crearController();
      const archivo = await archivoDeEjemplo([['HSK-0002', 'Acondicionador', '', '', '', '', '', '', '', '', '', '0']]);

      const resultado = await controller.previsualizarCargaMasivaLineas('cat1', archivo);

      expect(resultado.errores).toEqual(expect.arrayContaining([expect.objectContaining({ campo: 'pvp' })]));
    });

    it('una fila válida pasa a "validos" con sus datos', async () => {
      const { controller } = crearController();
      const archivo = await archivoDeEjemplo([['HSK-0003', 'Mascarilla', 'Cuidado', '', '', '', '', '', '', '', '', '45.5']]);

      const resultado = await controller.previsualizarCargaMasivaLineas('cat1', archivo);

      expect(resultado.errores).toEqual([]);
      expect(resultado.validos).toEqual([
        expect.objectContaining({ sku: 'HSK-0003', nombre: 'Mascarilla', categoria: 'Cuidado', pvpCampania: '45.5' }),
      ]);
    });

    it('exige el archivo y el catalogId', async () => {
      const { controller } = crearController();
      await expect(controller.previsualizarCargaMasivaLineas('cat1', undefined)).rejects.toThrow(BadRequestException);
      const archivo = await archivoDeEjemplo([]);
      await expect(controller.previsualizarCargaMasivaLineas('', archivo)).rejects.toThrow(BadRequestException);
    });
  });

  describe('carga masiva — confirmar', () => {
    it('crea una CatalogLine por cada fila y deja rastro en AuditLog', async () => {
      const { controller, prisma } = crearController();
      prisma.catalogLine.create.mockResolvedValue({ id: 'nueva' });

      const resultado = await controller.confirmarCargaMasivaLineas(
        { catalogId: 'cat1', filas: [{ sku: 'HSK-0001', nombre: 'Shampoo', pvpCampania: '25.9' }] },
        { user: { id: 'actor-1' } },
      );

      expect(resultado).toEqual({ creadas: 1 });
      expect(prisma.catalogLine.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ catalogId: 'cat1', sku: 'HSK-0001', pvpCampania: 25.9 }) }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ actorId: 'actor-1', accion: 'CARGA_MASIVA_CATALOGO' }) }),
      );
    });
  });
});
