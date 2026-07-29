import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CatalogosDigitalesService } from './catalogos-digitales.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { multerZipConfig } from '../../common/upload/multer-zip.config';

const ROLES_GESTION = ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO'];

@Controller('catalogos-digitales')
@UseGuards(RolesGuard)
export class CatalogosDigitalesController {
  constructor(private readonly service: CatalogosDigitalesService) {}

  @Get()
  @Roles(...ROLES_GESTION)
  listar() {
    return this.service.listar();
  }

  @Post()
  @Roles(...ROLES_GESTION)
  @UseInterceptors(FileInterceptor('archivo', multerZipConfig))
  subir(@Body('nombre') nombre: string, @UploadedFile() archivo: Express.Multer.File, @Req() req: any) {
    return this.service.subir(nombre, archivo, req.user.id);
  }

  @Patch(':id/activo')
  @Roles(...ROLES_GESTION)
  cambiarActivo(@Param('id') id: string, @Body('activo') activo: boolean) {
    return this.service.cambiarActivo(id, activo);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR')
  eliminar(@Param('id') id: string) {
    return this.service.eliminar(id);
  }
}
