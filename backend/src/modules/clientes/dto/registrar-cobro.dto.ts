import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RegistrarCobroDto {
  // EP-21: este endpoint ahora acepta multipart/form-data (para el
  // comprobante adjunto) — los campos de texto llegan como string, no como
  // JSON tipado. @Type(() => Number) los convierte antes de validar
  // (ValidationPipe global ya corre con transform:true, ver main.ts).
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  monto!: number;

  @IsIn(['deposito', 'culqi', 'efectivo'])
  metodo!: string;

  @IsOptional()
  @IsString()
  numeroOperacion?: string;

  @IsOptional()
  @IsString()
  banco?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}
