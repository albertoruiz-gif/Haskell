import { CatalogController } from './catalog.controller';

describe('CatalogController.compararStockOdoo (EP-14)', () => {
  function crearController() {
    const prisma: any = { catalogLine: { findMany: jest.fn() } };
    const odoo: any = { obtenerProductos: jest.fn(), obtenerStock: jest.fn() };
    // Los otros 3 no los toca compararStockOdoo — mocks vacíos alcanzan.
    const pricing: any = {};
    const buscador: any = {};
    const inventario: any = {};
    const controller = new CatalogController(prisma, pricing, odoo, buscador, inventario);
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
