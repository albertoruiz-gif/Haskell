import { IsInt, IsNumber, IsObject, IsOptional, Max, Min } from 'class-validator';

export class ActualizarConfiguracionDto {
  // Entre 5 min (no tiene sentido reservar menos que lo que tarda pagar por
  // Yape) y 24h (una reserva más larga que eso ya no es "temporal", es
  // bloquear stock indefinidamente).
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  minutosReservaStock?: number;

  // EP-16 — margen en soles aceptado entre lo declarado por el Asesor y el
  // total real del pedido antes de que validarDeposito() lo rechace.
  @IsOptional()
  @IsNumber()
  @Min(0)
  toleranciaConciliacionSoles?: number;

  // EP-16 — interruptores genéricos clave->boolean. No se valida el
  // contenido de las claves acá (son libres, ver ConfiguracionService) —
  // solo que cada valor sea booleano.
  @IsOptional()
  @IsObject()
  featureFlags?: Record<string, boolean>;
}
