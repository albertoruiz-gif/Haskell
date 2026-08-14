import { IsIn, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RegistrarCobroDto {
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
