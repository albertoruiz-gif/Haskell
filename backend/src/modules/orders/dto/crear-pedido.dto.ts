import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';

class ItemPedidoDto {
  @IsString()
  catalogLineId!: string;

  @IsInt()
  @IsPositive()
  cantidad!: number;
}

export class CrearPedidoDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  items!: ItemPedidoDto[];

  // EP-21 — solo aplica en canales SALONES_BELLEZA/RETAIL (OrdersService lo
  // valida). En COMERCIO_MINORISTA se ignoran, el pedido siempre es
  // CONTADO_CULQI como hasta ahora.
  @IsOptional()
  @IsString()
  clienteId?: string;

  @IsOptional()
  @IsIn(['CONTADO_CULQI', 'CONTADO_DEPOSITO', 'AL_CREDITO'])
  formaPago?: 'CONTADO_CULQI' | 'CONTADO_DEPOSITO' | 'AL_CREDITO';

  // EP-04 — id de una SolicitudDescuento ya APROBADA para este cliente, uso único.
  @IsOptional()
  @IsString()
  solicitudDescuentoId?: string;
}
