import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class ActualizarLineaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

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

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pvpCampania?: number;
}
