import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IndicadoresService } from './indicadores.service';

/**
 * Lectura del tablero gerencial — mismos 4 grupos del diseño acordado
 * (Gerencial, Comercial, Finanzas, Operaciones). Acceso total: Administrador,
 * Gerente General, Gerente Comercial y Finanzas (confirmado con Alberto
 * 2026-08-06). Los Líderes de equipo (LIDER_MINORISTA) NO ven este tablero —
 * tienen su propia vista acotada a su equipo, ver LideresController.
 * La escritura de metas vive aparte en MetasController con permisos más
 * acotados (Administrador, Gerente General y Gerente Comercial).
 */
@Controller('indicadores')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get('gerencial')
  gerencial() {
    return this.indicadores.gerencial();
  }

  @Get('comercial')
  comercial(@Query('canal') canal?: string) {
    const CANALES_VALIDOS = ['SALONES_BELLEZA', 'RETAIL', 'COMERCIO_MINORISTA'];
    return this.indicadores.comercial(canal && CANALES_VALIDOS.includes(canal) ? canal : null);
  }

  // "Ventas por canal" — gráfica de composición de la pestaña Comercial.
  @Get('comercial/ventas-por-canal')
  ventasPorCanal() {
    return this.indicadores.ventasPorCanal();
  }

  @Get('finanzas')
  finanzas() {
    return this.indicadores.finanzas();
  }

  @Get('operaciones')
  operaciones() {
    return this.indicadores.operaciones();
  }

  @Get('marketing')
  marketing() {
    return this.indicadores.marketing();
  }

  // Serie histórica para el panel de detalle (drill-down) del frontend —
  // ver IndicadoresService.serieHistorica.
  @Get('serie')
  serie(@Query('indicador') indicador: string, @Query('periodo') periodo: string, @Query('cantidad') cantidad?: string) {
    return this.indicadores.serieHistorica(indicador, periodo, cantidad ? parseInt(cantidad, 10) : 12);
  }

  // Pie de productos/categorías más vendidos, mes actual — gerencial (todo
  // el negocio o un canal). Click en una porción de "categoria" pide de
  // nuevo con nivel=producto&categoria=X para el drill-down (RF 2026-08-07).
  @Get('productos-top')
  productosTop(@Query('canal') canal?: string, @Query('nivel') nivel?: string, @Query('categoria') categoria?: string) {
    const { desde, hasta } = this.indicadores.rangoMesActualPublico();
    return this.indicadores.productosTop({ desde, hasta, canal: canal || null, nivel: nivel === 'producto' ? 'producto' : 'categoria', categoria: categoria || null });
  }

  // Misma gráfica, para "Mis Ventas" del propio asesor — fuerza su asesorId,
  // ignora canal (usa siempre el suyo vía asesorId).
  @Get('mis-productos-top')
  @Roles('ASESOR')
  misProductosTop(@Req() req: any, @Query('nivel') nivel?: string, @Query('categoria') categoria?: string) {
    const { desde, hasta } = this.indicadores.rangoMesActualPublico();
    return this.indicadores.productosTop({
      desde,
      hasta,
      asesorId: req.user.asesorId,
      nivel: nivel === 'producto' ? 'producto' : 'categoria',
      categoria: categoria || null,
    });
  }
}
