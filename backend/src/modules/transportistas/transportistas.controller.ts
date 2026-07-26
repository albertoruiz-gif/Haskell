import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TransportistasService } from './transportistas.service';
import { CrearTransportistaDto } from './dto/crear-transportista.dto';
import { ActualizarTarifaTransportistaDto } from './dto/actualizar-tarifa-transportista.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('transportistas')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR', 'ALMACEN')
export class TransportistasController {
  constructor(private readonly transportistas: TransportistasService) {}

  @Get()
  listar() {
    return this.transportistas.listar();
  }

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearTransportistaDto) {
    return this.transportistas.crear(dto);
  }

  @Patch(':id/tarifa')
  @Roles('ADMINISTRADOR')
  actualizarTarifa(@Param('id') id: string, @Body() dto: ActualizarTarifaTransportistaDto) {
    return this.transportistas.actualizarTarifa(id, dto.tarifaPorEntrega);
  }
}
