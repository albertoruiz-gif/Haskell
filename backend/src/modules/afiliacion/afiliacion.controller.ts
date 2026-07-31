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

  // Un Lider ve solo a los suyos (Comercio Minorista) — Administrador y
  // Gerente Comercial ven todo (supervisión general, ver auditoría UX).
  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA')
  listar(@Query('canal') canal: Canal | undefined, @Query('activo') activo: string | undefined, @Req() req: any) {
    return this.afiliacionService.listarAsesores({
      canal,
      activo: activo === undefined ? undefined : activo === 'true',
      liderIdPropio: req.user.rol === 'LIDER_MINORISTA' ? req.user.liderId : undefined,
    });
  }

  // Un Lider solo puede afiliar asesores de Comercio Minorista, y quedan
  // vinculados a él automáticamente (ver crearAsesorIndividual).
  @Post('individual')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA')
  crearIndividual(@Body() dto: CrearAsesorDto, @Req() req: any) {
    return this.afiliacionService.crearAsesorIndividual(
      { ...dto, fechaNacimiento: new Date(dto.fechaNacimiento) },
      req.user.rol === 'LIDER_MINORISTA' ? req.user.liderId : undefined,
    );
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
