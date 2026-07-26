import { IsNumber, IsPositive } from 'class-validator';

export class ActualizarTarifaTransportistaDto {
  @IsNumber()
  @IsPositive()
  tarifaPorEntrega!: number;
}
