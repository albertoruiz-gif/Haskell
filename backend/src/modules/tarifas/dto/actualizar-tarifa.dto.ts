import { IsBoolean, IsInt, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class ActualizarTarifaDto {
  @IsOptional()
  @IsNumber()
  @IsPositive()
  precio?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  slaHoras?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
