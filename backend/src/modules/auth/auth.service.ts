import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../config/prisma.service';

/**
 * RF-001: iniciar/cerrar sesión con credenciales individuales, intentos
 * fallidos registrados, sesión con expiración por política (RNF-007).
 * El JWT lleva rol y canal (si el usuario es un asesor) para que
 * RolesGuard y el filtrado por canal (RF-048) funcionen sin ida y vuelta
 * a la base en cada request.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private readonly MAX_INTENTOS_FALLIDOS = 5;

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { asesor: true, transportista: true },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const passwordValida = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValida) {
      // RF-001: los intentos fallidos quedan registrados
      await this.prisma.auditLog.create({
        data: {
          actorId: user.id,
          accion: 'LOGIN_FALLIDO',
          entidad: 'User',
          entidadId: user.id,
          motivo: ip ? `IP ${ip}` : undefined,
        },
      });
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      canal: user.asesor?.canal ?? null,
      asesorId: user.asesor?.id ?? null,
      transportistaId: user.transportista?.id ?? null,
    };

    await this.prisma.auditLog.create({
      data: { actorId: user.id, accion: 'LOGIN_OK', entidad: 'User', entidadId: user.id },
    });

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: '8h' }), // RNF-007: expiracion por politica
      usuario: { id: user.id, nombre: user.nombre, rol: user.rol, canal: payload.canal },
    };
  }

  async crearUsuario(data: { email: string; password: string; nombre: string; rol: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: { email: data.email, passwordHash, nombre: data.nombre, rol: data.rol as any },
    });
  }

  // RF-003: desactivar sin borrar historial
  async desactivarUsuario(userId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'DESACTIVAR_USUARIO', entidad: 'User', entidadId: userId },
    });
    return this.prisma.user.update({ where: { id: userId }, data: { activo: false } });
  }

  async reactivarUsuario(userId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'REACTIVAR_USUARIO', entidad: 'User', entidadId: userId },
    });
    return this.prisma.user.update({ where: { id: userId }, data: { activo: true } });
  }

  // Para asignar transportista (Almacén) o cualquier otro selector por rol.
  async listarPorRol(rol: string) {
    return this.prisma.user.findMany({
      where: { rol: rol as any, activo: true },
      select: { id: true, nombre: true, email: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // TODO RF-001: flujo de recuperacion segura de acceso (envio de link firmado por correo, expira en X minutos)
}
