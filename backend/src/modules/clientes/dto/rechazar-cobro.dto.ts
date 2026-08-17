import { IsOptional, IsString } from 'class-validator';

export class RechazarCobroDto {
  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
