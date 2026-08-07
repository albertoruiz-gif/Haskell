import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IndicadoresService } from './indicadores.service';

/**
 * Lectura del tablero gerencial — mismos 4 grupos del diseño acordado
 * (Gerencial, Comercial, Finanzas, Operaciones). Acceso: Administrador,
 * Gerente Comercial y Finanzas (confirmado con Alberto 2026-08-05). La
 * escritura de metas vive aparte en MetasController con permisos más
 * acotados (Administrador y Gerente Comercial).
 */
@Controller('indicadores')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS')
export class IndicadoresController {
  constructor(private readonly indicadores: IndicadoresService) {}

  @Get('gerencial')
  gerencial() {
    return this.indicadores.gerencial();
  }

  @Get('comercial')
  comercial() {
    return this.indicadores.comercial();
  }

  @Get('finanzas')
  finanzas() {
    return this.indicadores.finanzas();
  }

  @Get('operaciones')
  operaciones() {
    return this.indicadores.operaciones();
  }

  @Get('marketing')
  marketing() {
    return this.indicadores.marketing();
  }
}
