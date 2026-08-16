import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReasignarLiderDto {
  @IsString()
  @IsNotEmpty()
  liderId!: string;

  @IsOptional()
  @IsString()
  motivo?: string;
}
