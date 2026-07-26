import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CrearTransportistaDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  telefono!: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsNumber()
  @IsPositive()
  tarifaPorEntrega!: number;
}
