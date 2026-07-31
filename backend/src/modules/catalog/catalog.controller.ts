import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../config/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CrearLineaDto } from './dto/crear-linea.dto';
import { ActualizarPrecioDto } from './dto/actualizar-precio.dto';
import { ActualizarLineaDto } from './dto/actualizar-linea.dto';
import { DefinirPackDto } from './dto/definir-pack.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { multerCatalogConfig } from '../../common/upload/multer-catalog.config';

/**
 * RF-011/RF-012/RF-013 y RF-048: el catalogo visible se filtra en el
 * servidor por el canal del usuario autenticado — nunca por parametro de
 * la URL, para que alterar la interfaz no permita ver otro canal (RN-031).
 */
@Controller('catalogo')
@UseGuards(RolesGuard)
export class CatalogController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  // Roles que administran el catalogo pero no son asesores (sin canal
  // propio) — pueden previsualizar el catalogo publicado completo, de
  // todos los canales, para verificar lo que dan de alta en Gestion.
  private readonly ROLES_PREVIEW_CATALOGO = ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'];

  // Ofertas vigentes del catálogo, indexadas por catalogLineId — se piden
  // una sola vez por catálogo (no una por línea) y se usan para que el
  // precio que ve el asesor en el catálogo sea el mismo que se cobra al
  // pagar (antes el catálogo ignoraba las ofertas activas por completo).
  private async ofertasVigentesPorLinea(catalogId: string): Promise<Map<string, any>> {
    const ahora = new Date();
    const ofertas = await this.prisma.offer.findMany({
      where: { catalogId, activa: true, inicio: { lte: ahora }, fin: { gte: ahora }, catalogLineId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    const mapa = new Map<string, any>();
    for (const oferta of ofertas) {
      if (!mapa.has(oferta.catalogLineId as string)) mapa.set(oferta.catalogLineId as string, oferta);
    }
    return mapa;
  }

  private async mapearLinea(linea: any, catalogo: any, ofertasPorLinea: Map<string, any>) {
    const porcentaje = await this.pricing.resolverPorcentajeAsesor({
      campaignId: catalogo.campaignId,
      catalogId: catalogo.id,
      canal: catalogo.canal,
    });
    // Pack: si tiene componentes, se resuelven a sku/nombre/foto para
    // mostrar "este pack incluye..." en la ficha — el pack en sí se vende
    // como un producto normal (su pvpCampania ya viene calculado sumando
    // los componentes con su descuento propio, ver definirPack()).
    const componentes = (linea.packComponentes ?? []).map((pc: any) => ({
      id: pc.componente.id,
      sku: pc.componente.sku,
      nombre: pc.componente.nombre,
      imagenUrl: pc.componente.imagenUrl,
      descuentoPct: Number(pc.descuentoPct),
    }));

    const oferta = ofertasPorLinea.get(linea.id);
    // Mismo cálculo que orders.service.crearPedidoDesdeItems: la oferta
    // reduce el PVP antes de aplicar el % del asesor, para que el precio
    // mostrado acá sea el que realmente se cobra al confirmar el pedido.
    const pvpEfectivo = oferta?.precioFijo
      ? Number(oferta.precioFijo)
      : oferta?.descuentoPct
        ? Number(linea.pvpCampania) * (1 - Number(oferta.descuentoPct) / 100)
        : Number(linea.pvpCampania);

    return {
      id: linea.id,
      sku: linea.sku,
      nombre: linea.nombre,
      categoria: linea.categoria,
      linea: linea.linea,
      subcategoria: linea.subcategoria,
      tipo: linea.tipo,
      descripcion: linea.descripcion,
      beneficios: linea.beneficios,
      propiedades: linea.propiedades,
      modoUso: linea.modoUso,
      activos: linea.activos,
      pvp: Number(linea.pvpCampania),
      precioAsesor: this.pricing.calcularPrecioAsesor(pvpEfectivo, porcentaje),
      oferta: oferta
        ? {
            descuentoPct: oferta.descuentoPct ? Number(oferta.descuentoPct) : null,
            precioFijo: oferta.precioFijo ? Number(oferta.precioFijo) : null,
            alcance: oferta.alcance,
            fin: oferta.fin,
          }
        : null,
      stockDisponible: linea.stockDisponible,
      destacado: linea.destacado,
      imagenUrl: linea.imagenUrl,
      imagenesAdicionales: linea.imagenesAdicionales,
      componentes,
      esPack: componentes.length > 0,
      canal: catalogo.canal,
    };
  }

  @Get()
  async catalogoVigente(@Req() req: any, @Query('busqueda') busqueda?: string) {
    const canalDelUsuario = req.user.canal; // proviene del JWT, no del querystring

    const filtroBusqueda = busqueda
      ? {
          OR: [
            { sku: { contains: busqueda, mode: 'insensitive' as const } },
            { nombre: { contains: busqueda, mode: 'insensitive' as const } },
            { categoria: { contains: busqueda, mode: 'insensitive' as const } },
            { linea: { contains: busqueda, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    // Roles sin Asesor asociado (administrador, gestor de catalogo, etc.):
    // no tienen canal propio, asi que en vez de un catalogo vacio les
    // mostramos la union de todo lo publicado (util para verificar lo que
    // se aprueba/publica en Gestion).
    if (!canalDelUsuario) {
      if (!this.ROLES_PREVIEW_CATALOGO.includes(req.user.rol)) {
        return { canal: null, campania: null, productos: [] };
      }

      const catalogosPublicados = await this.prisma.catalog.findMany({
        where: {
          estado: 'PUBLICADO',
          vigenciaDesde: { lte: new Date() },
          vigenciaHasta: { gte: new Date() },
        },
        include: { lineas: { where: filtroBusqueda, include: { packComponentes: { include: { componente: true } } } } },
        orderBy: { version: 'desc' },
      });

      const productos = (
        await Promise.all(
          catalogosPublicados.map(async (cat) => {
            const ofertas = await this.ofertasVigentesPorLinea(cat.id);
            return Promise.all(cat.lineas.map((linea) => this.mapearLinea(linea, cat, ofertas)));
          }),
        )
      ).flat();

      return { canal: null, campania: null, productos };
    }

    const catalogo = await this.prisma.catalog.findFirst({
      where: {
        canal: canalDelUsuario,
        estado: 'PUBLICADO',
        vigenciaDesde: { lte: new Date() },
        vigenciaHasta: { gte: new Date() },
      },
      include: { lineas: { where: filtroBusqueda, include: { packComponentes: { include: { componente: true } } } } },
      orderBy: { version: 'desc' },
    });

    if (!catalogo) return { canal: canalDelUsuario, campania: null, productos: [] };

    const ofertas = await this.ofertasVigentesPorLinea(catalogo.id);
    const productos = await Promise.all(catalogo.lineas.map((linea) => this.mapearLinea(linea, catalogo, ofertas)));

    return { canal: canalDelUsuario, catalogoId: catalogo.id, version: catalogo.version, productos };
  }

  // --- Administración de catálogo (precio/foto) ---
  // GET /catalogo no sirve para admins: filtra por el canal del JWT, y un
  // ADMINISTRADOR/GERENTE_COMERCIAL no tiene canal (no es asesor).

  // Incluye ALMACEN — necesita poder buscar el producto para el que va a
  // dar de alta un lote en Inventario.
  @Get('admin/lineas')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO', 'ALMACEN')
  listarLineas(@Query('catalogId') catalogId?: string) {
    return this.prisma.catalogLine.findMany({
      where: catalogId ? { catalogId } : undefined,
      include: { packComponentes: { include: { componente: { select: { id: true, sku: true, nombre: true, pvpCampania: true } } } } },
      orderBy: { ordenVisualizacion: 'asc' },
    });
  }

  @Post('admin/lineas')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  crearLinea(@Body() dto: CrearLineaDto) {
    return this.prisma.catalogLine.create({ data: dto });
  }

  @Patch('admin/lineas/:id/precio')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  async actualizarPrecio(@Param('id') id: string, @Body() dto: ActualizarPrecioDto) {
    const linea = await this.prisma.catalogLine.update({ where: { id }, data: { pvpCampania: dto.pvpCampania } });
    // Este producto puede ser componente de uno o más packs — su precio
    // acaba de cambiar, así que los packs que lo incluyen quedarían con un
    // total desactualizado si no se recalculan acá.
    await this.recalcularPacksQueUsanComponente(id);
    return linea;
  }

  // RN pack: el precio del pack se calcula sumando cada componente ya con
  // el % de descuento propio de ESE pack (no la oferta normal del
  // componente) — se recalcula cada vez que se guarda la composición del
  // pack o cambia el precio base de alguno de sus componentes.
  @Patch('admin/lineas/:id/pack')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  async definirPack(@Param('id') packId: string, @Body() dto: DefinirPackDto) {
    if (dto.componentes.some((c) => c.catalogLineId === packId)) {
      throw new BadRequestException('Un pack no puede incluirse a sí mismo como componente.');
    }
    await this.prisma.$transaction([
      this.prisma.packComponente.deleteMany({ where: { packId } }),
      ...(dto.componentes.length > 0
        ? [
            this.prisma.packComponente.createMany({
              data: dto.componentes.map((c) => ({ packId, componenteId: c.catalogLineId, descuentoPct: c.descuentoPct })),
            }),
          ]
        : []),
    ]);
    return this.recalcularPrecioPack(packId);
  }

  private async recalcularPrecioPack(packId: string) {
    const componentes = await this.prisma.packComponente.findMany({
      where: { packId },
      include: { componente: { select: { pvpCampania: true } } },
    });
    if (componentes.length === 0) {
      return this.prisma.catalogLine.findUniqueOrThrow({ where: { id: packId } });
    }
    const total = componentes.reduce(
      (acc, c) => acc + Number(c.componente.pvpCampania) * (1 - Number(c.descuentoPct) / 100),
      0,
    );
    return this.prisma.catalogLine.update({ where: { id: packId }, data: { pvpCampania: Math.round(total * 100) / 100 } });
  }

  private async recalcularPacksQueUsanComponente(componenteId: string) {
    const afectados = await this.prisma.packComponente.findMany({ where: { componenteId }, select: { packId: true } });
    for (const { packId } of afectados) {
      await this.recalcularPrecioPack(packId);
    }
  }

  @Patch('admin/lineas/:id')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  actualizarLinea(@Param('id') id: string, @Body() dto: ActualizarLineaDto) {
    return this.prisma.catalogLine.update({ where: { id }, data: dto });
  }

  @Post('admin/lineas/:id/foto')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  @UseInterceptors(FileInterceptor('foto', multerCatalogConfig))
  subirFoto(@Param('id') id: string, @UploadedFile() foto: Express.Multer.File) {
    return this.prisma.catalogLine.update({
      where: { id },
      data: { imagenUrl: `/uploads/catalogo/${foto.filename}` },
    });
  }

  @Delete('admin/lineas/:id')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  async eliminarLinea(@Param('id') id: string) {
    await this.prisma.offer.deleteMany({ where: { catalogLineId: id } });
    // Si este producto es componente de algún pack, hay que sacarlo de ahí
    // y recalcular el precio de esos packs — si no, quedarían con un total
    // que ya no corresponde a lo que realmente incluyen.
    const packsAfectados = await this.prisma.packComponente.findMany({ where: { componenteId: id }, select: { packId: true } });
    await this.prisma.packComponente.deleteMany({ where: { OR: [{ packId: id }, { componenteId: id }] } });
    for (const { packId } of packsAfectados) {
      await this.recalcularPrecioPack(packId);
    }
    try {
      await this.prisma.catalogLine.delete({ where: { id } });
    } catch {
      throw new BadRequestException('No se puede eliminar: el producto ya está referenciado en un carrito o pedido.');
    }
    return { eliminado: true };
  }

  @Post('admin/lineas/:id/fotos-adicionales')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  @UseInterceptors(FilesInterceptor('fotos', 6, multerCatalogConfig))
  async subirFotosAdicionales(@Param('id') id: string, @UploadedFiles() fotos: Express.Multer.File[]) {
    const linea = await this.prisma.catalogLine.findUniqueOrThrow({ where: { id } });
    const nuevas = fotos.map((f) => `/uploads/catalogo/${f.filename}`);
    return this.prisma.catalogLine.update({
      where: { id },
      data: { imagenesAdicionales: [...linea.imagenesAdicionales, ...nuevas] },
    });
  }
}
