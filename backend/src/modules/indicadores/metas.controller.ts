import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CrearMetaDto } from './dto/crear-meta.dto';
import { ActualizarMetaDto } from './dto/actualizar-meta.dto';

/**
 * Metas/objetivos por indicador del tablero gerencial (ver MetaIndicador en
 * schema.prisma — no vive en Odoo porque no hay un campo genérico ahí que
 * cubra ventas, margen, inventario y caja a la vez).
 *
 * Lectura: cualquier rol con acceso al tablero (Administrador, Gerente
 * Comercial, Finanzas). Escritura: solo quien puede fijar objetivos de
 * negocio (Administrador, Gerente Comercial) — decisión confirmada con Alberto.
 */
@Controller('metas')
@UseGuards(RolesGuard)
export class MetasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS')
  listar(@Query('indicador') indicador?: string) {
    return this.prisma.metaIndicador.findMany({
      where: {
        ...(indicador ? { indicador } : {}),
        OR: [{ vigenciaHasta: null }, { vigenciaHasta: { gt: new Date() } }],
      },
      orderBy: [{ indicador: 'asc' }, { vigenciaDesde: 'desc' }],
    });
  }

  @Post()
  @Roles('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL')
  async crear(@Body() dto: CrearMetaDto, @Req() req: any) {
    // Solo una meta vigente a la vez por par indicador+canal: cierra la
    // anterior (si existe) antes de crear la nueva, en vez de pisarla, para
    // conservar el historial de objetivos.
    await this.prisma.metaIndicador.updateMany({
      where: { indicador: dto.indicador, canal: dto.canal ?? null, vigenciaHasta: null },
      data: { vigenciaHasta: new Date() },
    });
    return this.prisma.metaIndicador.create({
      data: {
        indicador: dto.indicador,
        canal: dto.canal,
        valorObjetivo: dto.valorObjetivo,
        vigenciaDesde: dto.vigenciaDesde ? new Date(dto.vigenciaDesde) : new Date(),
        vigenciaHasta: dto.vigenciaHasta ? new Date(dto.vigenciaHasta) : null,
        actualizadoPorId: req.user.id,
      },
    });
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarMetaDto, @Req() req: any) {
    return this.prisma.metaIndicador.update({
      where: { id },
      data: {
        ...(dto.valorObjetivo !== undefined ? { valorObjetivo: dto.valorObjetivo } : {}),
        ...(dto.vigenciaHasta !== undefined ? { vigenciaHasta: new Date(dto.vigenciaHasta) } : {}),
        actualizadoPorId: req.user.id,
      },
    });
  }
}
