import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('operaciones')
@UseGuards(RolesGuard)
export class OperacionesController {
  constructor(private readonly operacionesService: OperacionesService) {}

  @Get('pedidos/:id/picking')
  @Roles('ALMACEN', 'ADMINISTRADOR')
  pickingList(@Param('id') id: string) {
    return this.operacionesService.pickingList(id);
  }

  @Post('pedidos/:id/picking/confirmar')
  @Roles('ALMACEN', 'ADMINISTRADOR')
  confirmarPicking(@Param('id') id: string, @Body('incidencia') incidencia: string, @Req() req: any) {
    return this.operacionesService.confirmarPicking(id, req.user.id, incidencia);
  }

  @Post('pedidos/:id/packing/confirmar')
  @Roles('ALMACEN', 'ADMINISTRADOR')
  confirmarPacking(@Param('id') id: string, @Body('bultos') bultos: number) {
    return this.operacionesService.confirmarPacking(id, bultos);
  }

  @Post('pedidos/:id/transportista/asignar')
  @Roles('ALMACEN', 'ADMINISTRADOR')
  asignarTransportista(@Param('id') id: string, @Body() dto: { transportistaId: string; bultos: number }) {
    return this.operacionesService.asignarTransportista(id, dto.transportistaId, dto.bultos);
  }

  @Post('pedidos/:id/transportista/aceptar')
  @Roles('TRANSPORTISTA', 'ADMINISTRADOR')
  aceptarBultos(@Param('id') id: string, @Req() req: any) {
    return this.operacionesService.aceptarBultos(id, req.user.transportistaId, req.user.rol);
  }

  @Post('pedidos/:id/transportista/en-ruta')
  @Roles('TRANSPORTISTA', 'ADMINISTRADOR')
  marcarEnRuta(@Param('id') id: string) {
    return this.operacionesService.marcarEnRuta(id);
  }

  @Post('pedidos/:id/entrega/confirmar')
  @Roles('TRANSPORTISTA', 'ADMINISTRADOR')
  confirmarEntrega(@Param('id') id: string, @Body() dto: { receptor: string; documentoReceptor?: string; evidenciaUrl?: string }) {
    return this.operacionesService.confirmarEntrega(id, dto);
  }

  @Post('pedidos/:id/entrega/fallida')
  @Roles('TRANSPORTISTA', 'ADMINISTRADOR')
  entregaFallida(@Param('id') id: string, @Body() dto: { motivo: string; observaciones?: string }) {
    return this.operacionesService.registrarEntregaFallida(id, dto.motivo, dto.observaciones);
  }

  // --- Módulo Transporte: pagos a transportistas (tarifa fija por entrega) ---

  @Get('pagos-transportista')
  @Roles('ADMINISTRADOR', 'ALMACEN')
  listarPagos(@Query('transportistaId') transportistaId?: string, @Query('pagado') pagado?: string) {
    return this.operacionesService.listarPagosTransportista(transportistaId, pagado === undefined ? undefined : pagado === 'true');
  }

  @Patch('entregas/:entregaId/marcar-pagado')
  @Roles('ADMINISTRADOR')
  marcarPagado(@Param('entregaId') entregaId: string) {
    return this.operacionesService.marcarPagado(entregaId);
  }
}
