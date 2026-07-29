import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../config/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CrearLineaDto } from './dto/crear-linea.dto';
import { ActualizarPrecioDto } from './dto/actualizar-precio.dto';
import { ActualizarLineaDto } from './dto/actualizar-linea.dto';
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

  private async mapearLinea(linea: any, catalogo: any) {
    const porcentaje = await this.pricing.resolverPorcentajeAsesor({
      campaignId: catalogo.campaignId,
      catalogId: catalogo.id,
      canal: catalogo.canal,
    });
    // Pack simple: si tiene componentes, se resuelven a sku/nombre/foto para
    // mostrar "este pack incluye..." en la ficha — el pack en sí se vende
    // como un producto normal, esto es solo informativo.
    const componentes = linea.componentesIds?.length
      ? await this.prisma.catalogLine.findMany({
          where: { id: { in: linea.componentesIds } },
          select: { id: true, sku: true, nombre: true, imagenUrl: true },
        })
      : [];
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
      precioAsesor: this.pricing.calcularPrecioAsesor(Number(linea.pvpCampania), porcentaje),
      destacado: linea.destacado,
      imagenUrl: linea.imagenUrl,
      imagenesAdicionales: linea.imagenesAdicionales,
      componentes,
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
        include: { lineas: { where: filtroBusqueda } },
        orderBy: { version: 'desc' },
      });

      const productos = (
        await Promise.all(catalogosPublicados.map((cat) => Promise.all(cat.lineas.map((linea) => this.mapearLinea(linea, cat)))))
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
      include: { lineas: { where: filtroBusqueda } },
      orderBy: { version: 'desc' },
    });

    if (!catalogo) return { canal: canalDelUsuario, campania: null, productos: [] };

    const productos = await Promise.all(catalogo.lineas.map((linea) => this.mapearLinea(linea, catalogo)));

    return { canal: canalDelUsuario, catalogoId: catalogo.id, version: catalogo.version, productos };
  }

  // --- Administración de catálogo (precio/foto) ---
  // GET /catalogo no sirve para admins: filtra por el canal del JWT, y un
  // ADMINISTRADOR/GERENTE_COMERCIAL no tiene canal (no es asesor).

  @Get('admin/lineas')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  listarLineas(@Query('catalogId') catalogId?: string) {
    return this.prisma.catalogLine.findMany({
      where: catalogId ? { catalogId } : undefined,
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
  actualizarPrecio(@Param('id') id: string, @Body() dto: ActualizarPrecioDto) {
    return this.prisma.catalogLine.update({ where: { id }, data: { pvpCampania: dto.pvpCampania } });
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
