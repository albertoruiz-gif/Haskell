import { Body, Controller, Delete, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { ActualizarPermisoDto } from './dto/actualizar-permiso.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

// EP-01: quién puede ver y editar la matriz de permisos es, a propósito, el
// rol más restringido que existe (ADMINISTRADOR) — esta pantalla controla
// la seguridad del resto del sistema, no tiene sentido delegarla más abajo.
@Controller('permisos')
@UseGuards(RolesGuard)
export class PermisosController {
  constructor(private readonly permisos: PermisosService) {}

  @Get()
  @Roles('ADMINISTRADOR')
  listar() {
    return this.permisos.listarCatalogo();
  }

  @Patch(':clave')
  @Roles('ADMINISTRADOR')
  actualizar(@Param('clave') clave: string, @Body() dto: ActualizarPermisoDto, @Req() req: any) {
    return this.permisos.actualizar(clave, dto.roles, req.user.id);
  }

  @Delete(':clave')
  @Roles('ADMINISTRADOR')
  restaurar(@Param('clave') clave: string, @Req() req: any) {
    return this.permisos.restaurar(clave, req.user.id);
  }
}
