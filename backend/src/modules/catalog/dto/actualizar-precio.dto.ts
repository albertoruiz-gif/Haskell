import { IsNumber, IsPositive } from 'class-validator';

export class ActualizarPrecioDto {
  @IsNumber()
  @IsPositive()
  pvpCampania!: number;
}
