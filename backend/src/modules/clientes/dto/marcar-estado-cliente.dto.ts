import { IsIn } from 'class-validator';

export class MarcarEstadoClienteDto {
  @IsIn(['ACTIVO', 'MOROSO', 'BLOQUEADO'])
  estado!: 'ACTIVO' | 'MOROSO' | 'BLOQUEADO';
}
