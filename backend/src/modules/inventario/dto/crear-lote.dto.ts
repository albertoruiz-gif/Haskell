import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CrearLoteDto {
  @IsString()
  @IsNotEmpty()
  catalogLineId!: string;

  @IsString()
  @IsNotEmpty()
  numeroLote!: string;

  @IsOptional()
  @IsString()
  proveedor?: string;

  @IsOptional()
  @IsString()
  paisOrigen?: string;

  @IsOptional()
  @IsString()
  ordenCompra?: string;

  @IsOptional()
  @IsString()
  documentoImportacion?: string;

  @IsOptional()
  @IsDateString()
  fechaFabricacion?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimiento?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadImportada?: number;

  @IsInt()
  @Min(0)
  cantidadRecibida!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cantidadDanada?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoFob?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoFleteSeguro?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gastosAduaneros?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoTotalNacionalizado?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoUnitarioReal?: number;

  @IsOptional()
  @IsString()
  ubicacionAlmacen?: string;
}
