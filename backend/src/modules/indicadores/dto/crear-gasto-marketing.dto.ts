import { Canal } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CrearGastoMarketingDto {
  @IsString()
  @IsNotEmpty()
  descripcion!: string;

  @IsOptional()
  @IsEnum(Canal)
  canal?: Canal;

  @IsNumber()
  @IsPositive()
  monto!: number;

  @IsDateString()
  periodoDesde!: string;

  @IsDateString()
  periodoHasta!: string;
}
