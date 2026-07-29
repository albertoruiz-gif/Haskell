import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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
  linea?: string;

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

  // Pack simple: ids de otras líneas de este mismo catálogo que este
  // producto incluye — solo informativo, ver comentario en schema.prisma.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  componentesIds?: string[];
}
