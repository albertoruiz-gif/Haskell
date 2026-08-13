import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermiteScopeParcial } from '../../common/decorators/permite-scope-parcial.decorator';

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

class CodigoTotpDto {
  @IsString()
  @Length(6, 6, { message: 'El código tiene 6 dígitos.' })
  codigo!: string;
}

@Controller('auth')
@UseGuards(RolesGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Auditoria de seguridad 2026-08-10: antes no habia NADA que frenara
  // fuerza bruta acá (ni limite de requests, ni bloqueo de cuenta pese a
  // existir MAX_INTENTOS_FALLIDOS sin usar en AuthService). El limite por
  // IP frena scripts automatizados; el bloqueo por cuenta (dentro de
  // AuthService.login) cubre el caso de intentos distribuidos entre
  // varias IPs contra el mismo email.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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

  // EP-01: cerrar la sesión de alguien sin desactivar la cuenta (celular
  // perdido/robado, sospecha de acceso indebido, etc.) — la próxima vez que
  // ese token intente usarse, JwtStrategy lo rechaza y pide loguearse de nuevo.
  @Patch('usuarios/:id/cerrar-sesiones')
  @Roles('ADMINISTRADOR')
  cerrarSesiones(@Param('id') id: string, @Req() req: any) {
    return this.authService.cerrarSesiones(id, req.user.id);
  }

  // EP-18: reset de 2FA por un admin (perdió el celular, sospecha de acceso
  // indebido) — deja la cuenta sin 2FA activo, forzando reconfigurar en el
  // próximo login (no le da un plazo de gracia nuevo, ver AuthService).
  @Patch('usuarios/:id/resetear-2fa')
  @Roles('ADMINISTRADOR')
  resetear2FA(@Param('id') id: string, @Req() req: any) {
    return this.authService.resetear2FA(id, req.user.id);
  }

  @Get('2fa/estado')
  estado2FA(@Req() req: any) {
    return this.authService.estado2FA(req.user.id);
  }

  // EP-18: genera el QR/secreto de 2FA — accesible con sesión normal
  // (activación voluntaria desde Mi cuenta) O con el token temporal
  // 'setup_2fa' que entrega login() cuando ya venció el plazo de gracia
  // (ver PermiteScopeParcial / ScopeGuard).
  @Post('2fa/generar')
  @PermiteScopeParcial('setup_2fa')
  generar2FA(@Req() req: any) {
    return this.authService.generarSecreto2FA(req.user.id);
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('2fa/activar')
  @PermiteScopeParcial('setup_2fa')
  activar2FA(@Body() dto: CodigoTotpDto, @Req() req: any) {
    return this.authService.activar2FA(req.user.id, dto.codigo);
  }

  // Segundo paso del login cuando la cuenta YA tiene 2FA activo — requiere
  // el tokenTemporal que devolvió /auth/login como Bearer (NO es @Public():
  // sigue necesitando un JWT válido, solo que de scope restringido).
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('2fa/verificar-login')
  @PermiteScopeParcial('pendiente_2fa')
  verificarLogin2FA(@Body() dto: CodigoTotpDto, @Req() req: any) {
    return this.authService.verificarLogin2FA(req.user.id, dto.codigo);
  }

  @Get('usuarios')
  @Roles('ADMINISTRADOR', 'ALMACEN')
  listarPorRol(@Query('rol') rol: string) {
    return this.authService.listarPorRol(rol);
  }

  // RF-001: "olvidé mi contraseña" — sin @Roles porque el usuario todavía no tiene sesión.
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('olvide-password')
  olvidePassword(@Body() dto: OlvidePasswordDto) {
    return this.authService.solicitarRecuperacion(dto.email);
  }

  // Confirma el link recibido por correo (activación o recuperación) y fija la clave nueva.
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
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
