import { IsNumber, IsOptional, IsPositive, IsString, Max } from 'class-validator';

export class SolicitarDescuentoDto {
  @IsNumber()
  @IsPositive()
  @Max(100)
  porcentaje!: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}
