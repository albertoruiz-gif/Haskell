import { AlcanceOferta } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CrearOfertaDto {
  @IsString()
  @IsNotEmpty()
  catalogId!: string;

  @IsOptional()
  @IsString()
  catalogLineId?: string;

  @IsEnum(AlcanceOferta)
  alcance!: AlcanceOferta;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descuentoPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  precioFijo?: number;

  @IsDateString()
  inicio!: string;

  @IsDateString()
  fin!: string;
}
