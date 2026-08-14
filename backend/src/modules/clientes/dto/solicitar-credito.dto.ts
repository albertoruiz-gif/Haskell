import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class SolicitarCreditoDto {
  @IsNumber()
  @IsPositive()
  lineaSolicitada!: number;

  @IsOptional()
  @IsString()
  motivo?: string;
}
