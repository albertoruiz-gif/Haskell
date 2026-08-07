import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PremiosService } from './premios.service';
import { CrearNivelDto, ActualizarNivelDto } from './dto/guardar-nivel.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PrismaService } from '../../config/prisma.service';

@Controller('premios')
@UseGuards(RolesGuard)
export class PremiosController {
  constructor(
    private readonly premios: PremiosService,
    private readonly prisma: PrismaService,
  ) {}

  // --- Escala (Gestión → Premios) ---

  @Get('niveles')
  niveles(@Query('canal') canal: string) {
    if (!canal) throw new BadRequestException('Falta el parámetro canal.');
    return this.premios.nivelesVigentes(canal);
  }

  @Post('niveles')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  crear(@Body() dto: CrearNivelDto, @Req() req: any) {
    return this.premios.crearNivel(req.user.id, dto);
  }

  @Patch('niveles/:id')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarNivelDto, @Req() req: any) {
    return this.premios.actualizarNivel(id, req.user.id, dto);
  }

  @Delete('niveles/:id')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  retirar(@Param('id') id: string) {
    return this.premios.retirarNivel(id);
  }

  // --- Progreso del propio asesor (Carrito) ---

  @Get('mi-resumen')
  @Roles('ASESOR')
  miResumen(@Req() req: any) {
    return this.premios.resumenAsesor(req.user.asesorId);
  }

  @Get('mi-serie')
  @Roles('ASESOR')
  miSerie(@Query('meses') meses: string, @Req() req: any) {
    return this.premios.serieMensualAsesor(req.user.asesorId, Number(meses) || 6);
  }

  @Get('mi-historial')
  @Roles('ASESOR')
  miHistorial(@Req() req: any) {
    return this.premios.historialPremios(req.user.asesorId);
  }

  // --- Vista del Líder/Gerente/Admin sobre un asesor puntual (drill-down desde Mi equipo) ---

  @Get('asesor/:asesorId/serie')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA')
  async serieDeAsesor(@Param('asesorId') asesorId: string, @Query('meses') meses: string, @Req() req: any) {
    await this.verificarAccesoAsesor(asesorId, req.user);
    return this.premios.serieMensualAsesor(asesorId, Number(meses) || 6);
  }

  @Get('asesor/:asesorId/historial')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'LIDER_MINORISTA')
  async historialDeAsesor(@Param('asesorId') asesorId: string, @Req() req: any) {
    await this.verificarAccesoAsesor(asesorId, req.user);
    return this.premios.historialPremios(asesorId);
  }

  private async verificarAccesoAsesor(asesorId: string, user: any) {
    if (user.rol !== 'LIDER_MINORISTA') return;
    const asesor = await this.prisma.asesor.findUniqueOrThrow({ where: { id: asesorId } });
    if (asesor.liderId !== user.liderId) {
      throw new ForbiddenException('Solo podés ver el progreso de asesores de tu propio equipo.');
    }
  }
}
