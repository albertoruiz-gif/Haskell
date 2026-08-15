import { IsOptional, IsString } from 'class-validator';

// A diferencia de AprobarSolicitudDto (crédito), acá no se manda un monto
// aparte a aprobar — se aprueba el % ya solicitado tal cual, o se rechaza.
// Si el Gerente Comercial/General quiere un % distinto, rechaza y le pide
// al Asesor que mande una nueva solicitud con el % renegociado.
export class RechazarSolicitudDescuentoDto {
  @IsOptional()
  @IsString()
  motivoRechazo?: string;
}
