import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsNumber, Max, Min } from 'class-validator';
import { GerentesComercialesService } from './gerentes-comerciales.service';
import { CrearGerenteDto } from './dto/crear-gerente.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class ActualizarComisionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPct!: number;
}

@Controller('gerentes-comerciales')
@UseGuards(RolesGuard)
export class GerentesComercialesController {
  constructor(private readonly gerentes: GerentesComercialesService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearGerenteDto) {
    return this.gerentes.crear(dto);
  }

  @Get()
  @Roles('ADMINISTRADOR')
  listar() {
    return this.gerentes.listar();
  }

  @Patch(':id/comision')
  @Roles('ADMINISTRADOR')
  actualizarComision(@Param('id') id: string, @Body() dto: ActualizarComisionDto) {
    return this.gerentes.actualizarComision(id, dto.comisionPct);
  }

  // Un Gerente Comercial solo puede ver su propia comisión — Administrador puede ver cualquiera.
  @Get(':id/comision')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  comisionGanada(@Param('id') id: string, @Req() req: any) {
    if (req.user.rol === 'GERENTE_COMERCIAL' && req.user.gerenteComercialId !== id) {
      throw new ForbiddenException('Solo podés ver tu propia comisión.');
    }
    return this.gerentes.comisionGanada(id);
  }
}
