import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CrearGastoMarketingDto } from './dto/crear-gasto-marketing.dto';

/**
 * Carga manual de gasto de marketing/publicidad — es el numerador de CAC
 * (ver INDICADORES_MARKETING_DIGITAL en indicadores.constants.ts). No hay
 * integración con plataformas de ads todavía, así que esto se carga a mano
 * por período/canal. Mismos permisos que MetasController: cualquiera con
 * acceso al tablero puede ver, solo Administrador/Gerente Comercial cargan.
 */
@Controller('gastos-marketing')
@UseGuards(RolesGuard)
export class GastoMarketingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS')
  listar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.prisma.gastoMarketing.findMany({
      where: {
        ...(desde ? { periodoHasta: { gte: new Date(desde) } } : {}),
        ...(hasta ? { periodoDesde: { lte: new Date(hasta) } } : {}),
      },
      orderBy: { periodoDesde: 'desc' },
    });
  }

  @Post()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  crear(@Body() dto: CrearGastoMarketingDto, @Req() req: any) {
    return this.prisma.gastoMarketing.create({
      data: {
        descripcion: dto.descripcion,
        canal: dto.canal,
        monto: dto.monto,
        periodoDesde: new Date(dto.periodoDesde),
        periodoHasta: new Date(dto.periodoHasta),
        registradoPorId: req.user.id,
      },
    });
  }
}
