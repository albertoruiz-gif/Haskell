import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class AprobarSolicitudDto {
  @IsNumber()
  @IsPositive()
  lineaAprobada!: number;
}

export class RechazarSolicitudDto {
  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
