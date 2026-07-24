import { Body, Controller, Get, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Canal } from '@prisma/client';
import { AfiliacionService } from './afiliacion.service';
import { CrearAsesorDto } from './dto/crear-asesor.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('afiliacion')
@UseGuards(RolesGuard)
export class AfiliacionController {
  constructor(private readonly afiliacionService: AfiliacionService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  listar(@Query('canal') canal?: Canal, @Query('activo') activo?: string) {
    return this.afiliacionService.listarAsesores({
      canal,
      activo: activo === undefined ? undefined : activo === 'true',
    });
  }

  @Post('individual')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  crearIndividual(@Body() dto: CrearAsesorDto) {
    return this.afiliacionService.crearAsesorIndividual({ ...dto, fechaNacimiento: new Date(dto.fechaNacimiento) });
  }

  // RF-008: sube el Excel, devuelve preview de validos/errores SIN persistir
  @Post('masiva/previsualizar')
  @Roles('ADMINISTRADOR')
  @UseInterceptors(FileInterceptor('archivo'))
  previsualizar(@UploadedFile() archivo: Express.Multer.File) {
    return this.afiliacionService.previsualizarCargaMasiva(archivo.buffer);
  }

  @Post('masiva/confirmar')
  @Roles('ADMINISTRADOR')
  confirmar(@Body() dto: { filas: any[] }, @Req() req: any) {
    return this.afiliacionService.confirmarCargaMasiva(dto.filas, req.user.id);
  }
}
