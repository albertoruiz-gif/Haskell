import { IsISO8601, IsNumber, IsOptional } from 'class-validator';

export class GuardarDatoFinancieroDto {
  @IsISO8601()
  periodo!: string; // cualquier fecha del mes a registrar

  @IsNumber() costoVentas!: number;
  @IsNumber() cobros!: number;
  @IsNumber() pagosProveedores!: number;
  @IsNumber() gastosOperativos!: number;
  @IsNumber() sueldos!: number;
  @IsNumber() impuestos!: number;
  @IsNumber() inventarioPromedio!: number;
  @IsNumber() cuentasPorCobrarPromedio!: number;
  @IsNumber() cuentasPorPagarPromedio!: number;
  @IsNumber() compras!: number;
  @IsNumber() cuentasPorCobrarVencidas!: number;

  @IsOptional() @IsNumber() costoImportadoUnitario?: number;
}
