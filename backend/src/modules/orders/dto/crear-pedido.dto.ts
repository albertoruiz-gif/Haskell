import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsPositive, IsString, ValidateNested } from 'class-validator';

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
}
