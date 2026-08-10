import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LibroReclamacionesService } from './libro-reclamaciones.service';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';
import { ResponderReclamoDto } from './dto/responder-reclamo.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('libro-reclamaciones')
@UseGuards(RolesGuard)
export class LibroReclamacionesController {
  constructor(private readonly reclamaciones: LibroReclamacionesService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  crear(@Body() dto: CrearReclamoDto) {
    return this.reclamaciones.crear(dto);
  }

  // Consulta pública por código — el consumidor no tiene cuenta en la plataforma.
  @Public()
  @Get(':codigo')
  buscarPorCodigo(@Param('codigo') codigo: string) {
    return this.reclamaciones.buscarPorCodigo(codigo);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  listar() {
    return this.reclamaciones.listar();
  }

  @Patch(':id/responder')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  responder(@Param('id') id: string, @Body() dto: ResponderReclamoDto, @Req() req: any) {
    return this.reclamaciones.responder(id, dto.respuesta, req.user.id);
  }
}
