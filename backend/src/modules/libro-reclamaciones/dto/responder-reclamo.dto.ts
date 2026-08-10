import { IsNotEmpty, IsString } from 'class-validator';

export class ResponderReclamoDto {
  @IsString()
  @IsNotEmpty()
  respuesta!: string;
}
