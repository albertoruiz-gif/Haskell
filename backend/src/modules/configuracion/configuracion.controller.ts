import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { ActualizarConfiguracionDto } from './dto/actualizar-configuracion.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('configuracion')
@UseGuards(RolesGuard)
export class ConfiguracionController {
  constructor(private readonly configuracion: ConfiguracionService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  obtener() {
    return this.configuracion.obtener();
  }

  @Patch()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  actualizar(@Body() dto: ActualizarConfiguracionDto, @Req() req: any) {
    return this.configuracion.actualizar(dto, req.user.id);
  }
}
