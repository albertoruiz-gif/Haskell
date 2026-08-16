import { RolUsuario } from '@prisma/client';
import { ArrayMinSize, IsArray, IsEnum } from 'class-validator';

export class ActualizarPermisoDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(RolUsuario, { each: true })
  roles!: RolUsuario[];
}
