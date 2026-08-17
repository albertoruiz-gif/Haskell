import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReprogramarEntregaDto {
  @IsDateString()
  fechaReprogramada!: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
