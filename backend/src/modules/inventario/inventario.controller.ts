import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { CambiarEstadoLoteDto } from './dto/cambiar-estado-lote.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('inventario')
@UseGuards(RolesGuard)
export class InventarioController {
  constructor(private readonly inventario: InventarioService) {}

  @Post('lotes')
  @Roles('ADMINISTRADOR', 'ALMACEN')
  crearLote(@Body() dto: CrearLoteDto, @Req() req: any) {
    return this.inventario.crearLote(dto, req.user.id);
  }

  @Get('lotes')
  @Roles('ADMINISTRADOR', 'ALMACEN', 'GERENTE_COMERCIAL')
  listarLotes(@Query('catalogLineId') catalogLineId?: string) {
    return this.inventario.listarLotes(catalogLineId);
  }

  @Patch('lotes/:id/estado')
  @Roles('ADMINISTRADOR', 'ALMACEN')
  cambiarEstadoLote(@Param('id') id: string, @Body() dto: CambiarEstadoLoteDto, @Req() req: any) {
    return this.inventario.cambiarEstadoLote(id, dto.estado, dto.motivo, req.user.id);
  }

  @Get('stock/:catalogLineId')
  @Roles('ADMINISTRADOR', 'ALMACEN', 'GERENTE_COMERCIAL')
  stockBreakdown(@Param('catalogLineId') catalogLineId: string) {
    return this.inventario.stockBreakdown(catalogLineId);
  }
}
