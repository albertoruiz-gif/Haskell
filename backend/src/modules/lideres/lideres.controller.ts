import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsNumber, Max, Min } from 'class-validator';
import { LideresService } from './lideres.service';
import { CrearLiderDto } from './dto/crear-lider.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class ActualizarComisionDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  comisionPct!: number;
}

@Controller('lideres')
@UseGuards(RolesGuard)
export class LideresController {
  constructor(private readonly lideres: LideresService) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crear(@Body() dto: CrearLiderDto) {
    return this.lideres.crear(dto);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  listar() {
    return this.lideres.listar();
  }

  @Patch(':id/comision')
  @Roles('ADMINISTRADOR')
  actualizarComision(@Param('id') id: string, @Body() dto: ActualizarComisionDto) {
    return this.lideres.actualizarComision(id, dto.comisionPct);
  }

  // Un Lider solo puede ver su propia comisión — Administrador y Gerente
  // Comercial pueden ver la de cualquiera (supervisión general).
  @Get(':id/comision')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA')
  comisionGanada(@Param('id') id: string, @Req() req: any) {
    if (req.user.rol === 'LIDER_MINORISTA' && req.user.liderId !== id) {
      throw new ForbiddenException('Solo podés ver tu propia comisión.');
    }
    return this.lideres.comisionGanada(id);
  }
}
