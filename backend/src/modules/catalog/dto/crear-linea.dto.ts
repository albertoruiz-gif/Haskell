import { IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CrearLineaDto {
  @IsString()
  @IsNotEmpty()
  catalogId!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsString()
  subcategoria?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  beneficios?: string;

  @IsOptional()
  @IsString()
  propiedades?: string;

  @IsOptional()
  @IsString()
  modoUso?: string;

  @IsOptional()
  @IsString()
  activos?: string;

  @IsNumber()
  @IsPositive()
  pvpCampania!: number;
}
