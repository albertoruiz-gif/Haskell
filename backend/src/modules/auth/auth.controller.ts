import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsString } from 'class-validator';
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
}
