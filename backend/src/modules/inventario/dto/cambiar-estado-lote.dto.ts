import { EstadoLote } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CambiarEstadoLoteDto {
  @IsEnum(EstadoLote)
  estado!: EstadoLote;

  @IsOptional()
  @IsString()
  motivo?: string;
}
