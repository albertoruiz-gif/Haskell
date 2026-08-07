import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

enum CanalDto {
  SALONES_BELLEZA = 'SALONES_BELLEZA',
  RETAIL = 'RETAIL',
  COMERCIO_MINORISTA = 'COMERCIO_MINORISTA',
}

export class CrearNivelDto {
  @IsEnum(CanalDto)
  canal!: CanalDto;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @IsPositive()
  montoMinimo!: number;
}

export class ActualizarNivelDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsNumber()
  @IsPositive()
  montoMinimo!: number;
}
