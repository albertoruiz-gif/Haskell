import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class OlvidePasswordDto {
  @IsEmail()
  email!: string;
}

class RestablecerPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  nuevaPassword!: string;
}

class CambiarPasswordDto {
  @IsString()
  passwordActual!: string;

  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  passwordNueva!: string;
}

@Controller('auth')
@UseGuards(RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.authService.login(dto.email, dto.password, req.ip);
  }

  @Patch('usuarios/:id/desactivar')
  @Roles('ADMINISTRADOR')
  desactivar(@Param('id') id: string, @Req() req: any) {
    return this.authService.desactivarUsuario(id, req.user.id);
  }

  @Patch('usuarios/:id/reactivar')
  @Roles('ADMINISTRADOR')
  reactivar(@Param('id') id: string, @Req() req: any) {
    return this.authService.reactivarUsuario(id, req.user.id);
  }

  @Get('usuarios')
  @Roles('ADMINISTRADOR', 'ALMACEN')
  listarPorRol(@Query('rol') rol: string) {
    return this.authService.listarPorRol(rol);
  }

  // RF-001: "olvidé mi contraseña" — sin @Roles porque el usuario todavía no tiene sesión.
  @Public()
  @Post('olvide-password')
  olvidePassword(@Body() dto: OlvidePasswordDto) {
    return this.authService.solicitarRecuperacion(dto.email);
  }

  // Confirma el link recibido por correo (activación o recuperación) y fija la clave nueva.
  @Public()
  @Post('restablecer-password')
  restablecerPassword(@Body() dto: RestablecerPasswordDto) {
    return this.authService.establecerPassword(dto.token, dto.nuevaPassword);
  }

  // Cambio de clave por el propio usuario logueado (sin @Roles: cualquier rol autenticado).
  @Patch('mi-password')
  cambiarMiPassword(@Body() dto: CambiarPasswordDto, @Req() req: any) {
    return this.authService.cambiarPasswordPropia(req.user.id, dto.passwordActual, dto.passwordNueva);
  }
}
