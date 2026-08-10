import { IsEmail, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TipoReclamo } from '@prisma/client';

export class CrearReclamoDto {
  @IsEnum(TipoReclamo)
  tipo!: TipoReclamo;

  @IsString()
  @IsNotEmpty()
  consumidorNombre!: string;

  @IsString()
  @IsNotEmpty()
  consumidorTipoDocumento!: string;

  @IsString()
  @IsNotEmpty()
  consumidorNumeroDocumento!: string;

  @IsString()
  @IsNotEmpty()
  consumidorDomicilio!: string;

  @IsString()
  @IsNotEmpty()
  consumidorTelefono!: string;

  @IsEmail()
  consumidorEmail!: string;

  @IsString()
  @IsNotEmpty()
  bienOServicioReclamado!: string;

  @IsOptional()
  @IsNumber()
  montoReclamado?: number;

  @IsString()
  @IsNotEmpty()
  detalle!: string;

  @IsString()
  @IsNotEmpty()
  pedidoConsumidor!: string;
}
