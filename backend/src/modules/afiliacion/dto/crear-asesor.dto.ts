import { Type } from 'class-transformer';
import { IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Canal } from '@prisma/client';

export class DireccionDto {
  @IsString()
  @IsNotEmpty()
  departamento!: string;

  @IsString()
  @IsNotEmpty()
  provincia!: string;

  @IsString()
  @IsNotEmpty()
  distrito!: string;

  @IsString()
  @IsNotEmpty()
  direccion!: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  pais?: string;
}

export class CrearAsesorDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  nombres!: string;

  @IsString()
  @IsNotEmpty()
  apellidos!: string;

  @IsString()
  @IsNotEmpty()
  tipoDocumento!: string;

  @IsString()
  @IsNotEmpty()
  numeroDocumento!: string; // DNI

  @IsDateString()
  fechaNacimiento!: string;

  @IsString()
  @IsNotEmpty()
  telefonoPrincipal!: string;

  @IsString()
  @IsNotEmpty()
  numeroYape!: string;

  @IsEnum(Canal)
  canal!: Canal;

  @ValidateNested()
  @Type(() => DireccionDto)
  direccion!: DireccionDto;
}
