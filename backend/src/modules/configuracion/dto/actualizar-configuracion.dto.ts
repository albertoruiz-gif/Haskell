import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ActualizarConfiguracionDto {
  // Entre 5 min (no tiene sentido reservar menos que lo que tarda pagar por
  // Yape) y 24h (una reserva más larga que eso ya no es "temporal", es
  // bloquear stock indefinidamente).
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutosReservaStock?: number;
}
