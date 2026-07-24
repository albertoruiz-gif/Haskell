import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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
  @Roles('ALMACEN')
  confirmarPicking(@Param('id') id: string, @Body('incidencia') incidencia: string, @Req() req: any) {
    return this.operacionesService.confirmarPicking(id, req.user.id, incidencia);
  }

  @Post('pedidos/:id/packing/confirmar')
  @Roles('ALMACEN')
  confirmarPacking(@Param('id') id: string, @Body('bultos') bultos: number) {
    return this.operacionesService.confirmarPacking(id, bultos);
  }

  @Post('pedidos/:id/transportista/asignar')
  @Roles('ALMACEN', 'ADMINISTRADOR')
  asignarTransportista(@Param('id') id: string, @Body() dto: { transportistaId: string; bultos: number }) {
    return this.operacionesService.asignarTransportista(id, dto.transportistaId, dto.bultos);
  }

  @Post('pedidos/:id/transportista/aceptar')
  @Roles('TRANSPORTISTA')
  aceptarBultos(@Param('id') id: string, @Req() req: any) {
    return this.operacionesService.aceptarBultos(id, req.user.id);
  }

  @Post('pedidos/:id/entrega/confirmar')
  @Roles('TRANSPORTISTA')
  confirmarEntrega(@Param('id') id: string, @Body() dto: { receptor: string; documentoReceptor?: string; evidenciaUrl?: string }) {
    return this.operacionesService.confirmarEntrega(id, dto);
  }

  @Post('pedidos/:id/entrega/fallida')
  @Roles('TRANSPORTISTA')
  entregaFallida(@Param('id') id: string, @Body() dto: { motivo: string; observaciones?: string }) {
    return this.operacionesService.registrarEntregaFallida(id, dto.motivo, dto.observaciones);
  }
}
