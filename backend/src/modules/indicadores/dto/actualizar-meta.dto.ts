import { IsDateString, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class ActualizarMetaDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  valorObjetivo?: number;

  // Para cerrar una meta a mano (ej. se cargó mal) sin borrarla — queda en
  // el historial pero deja de contar como vigente.
  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}
