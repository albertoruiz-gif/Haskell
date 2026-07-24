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

  @IsNumber()
  @IsPositive()
  pvpCampania!: number;
}
