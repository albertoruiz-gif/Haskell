import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CrearTarifaDto {
  @IsString()
  @IsNotEmpty()
  distrito!: string;

  @IsOptional()
  @IsString()
  zona?: string;

  @IsNumber()
  @IsPositive()
  precio!: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  slaHoras?: number;
}
