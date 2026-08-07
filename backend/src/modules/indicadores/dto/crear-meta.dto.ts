import { Canal } from '@prisma/client';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { INDICADORES_VALIDOS } from '../indicadores.constants';

export class CrearMetaDto {
  @IsString()
  @IsIn(INDICADORES_VALIDOS)
  indicador!: string;

  // Sin canal = meta global del indicador. Con canal = meta específica para
  // ese canal (ej. margen bruto por canal difiere entre Salones y Retail).
  @IsOptional()
  @IsEnum(Canal)
  canal?: Canal;

  @IsNumber()
  @IsPositive()
  valorObjetivo!: number;

  @IsOptional()
  @IsDateString()
  vigenciaDesde?: string;

  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}
