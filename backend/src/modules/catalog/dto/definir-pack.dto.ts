import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsNumber, IsString, Max, Min, ValidateNested } from 'class-validator';

export class ComponentePackDto {
  @IsString()
  catalogLineId!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  descuentoPct!: number;
}

export class DefinirPackDto {
  // Lista vacía = "este producto deja de ser un pack" (se borran los componentes, el precio queda el último guardado).
  @IsArray()
  @ArrayUnique((c: ComponentePackDto) => c.catalogLineId)
  @ValidateNested({ each: true })
  @Type(() => ComponentePackDto)
  componentes!: ComponentePackDto[];
}
