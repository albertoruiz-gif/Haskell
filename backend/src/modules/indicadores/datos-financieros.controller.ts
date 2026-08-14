import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GuardarDatoFinancieroDto } from './dto/guardar-dato-financiero.dto';

/** Carga manual mensual que alimenta las fórmulas de Finanzas — ver IndicadoresService.finanzas(). */
@Controller('datos-financieros')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE_GENERAL', 'GERENTE_COMERCIAL', 'FINANZAS')
export class DatosFinancierosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  listar() {
    return this.prisma.datoFinancieroMensual.findMany({ orderBy: { periodo: 'desc' }, take: 24 });
  }

  // Upsert por mes — cargar de nuevo el mismo mes corrige, no duplica.
  @Post()
  guardar(@Body() dto: GuardarDatoFinancieroDto, @Req() req: any) {
    const fecha = new Date(dto.periodo);
    const periodo = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- se descarta "periodo" a propósito, ya se usa arriba normalizado
    const { periodo: _p, ...datos } = dto;
    return this.prisma.datoFinancieroMensual.upsert({
      where: { periodo },
      update: { ...datos, registradoPorId: req.user.id },
      create: { ...datos, periodo, registradoPorId: req.user.id },
    });
  }
}
