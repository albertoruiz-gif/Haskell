import { IsNotEmpty, IsString } from 'class-validator';

export class PagarPedidoDto {
  @IsString()
  @IsNotEmpty()
  culqiToken!: string;
}
