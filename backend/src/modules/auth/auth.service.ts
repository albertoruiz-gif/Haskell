import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';

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
    private readonly odoo: OdooClient,
  ) {}

  private readonly MAX_INTENTOS_FALLIDOS = 5;
  // Auditoria de seguridad 2026-08-10: MAX_INTENTOS_FALLIDOS existia pero
  // nunca se usaba — no habia ningun bloqueo real, solo quedaba el intento
  // registrado en el log. Ventana deslizante (no contador persistente):
  // se cuenta cuantos LOGIN_FALLIDO tiene el usuario en los ultimos N
  // minutos: al pasar el umbral, se bloquea el login aunque la clave sea
  // correcta, hasta que la ventana se vacíe sola.
  private readonly MINUTOS_VENTANA_BLOQUEO = 15;
  // Activación: 24h, para dar tiempo a que la asesora revise su correo sin
  // apurarla. Recuperación: 30 min, es una accion sensible de seguridad y
  // el usuario normalmente la hace en el momento.
  private readonly MINUTOS_EXPIRACION_ACTIVACION = 60 * 24;
  private readonly MINUTOS_EXPIRACION_RECUPERACION = 30;

  async login(email: string, password: string, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { asesor: true, transportista: true, lider: true, gerenteComercial: true },
    });

    if (!user || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    const desde = new Date(Date.now() - this.MINUTOS_VENTANA_BLOQUEO * 60_000);
    const intentosRecientes = await this.prisma.auditLog.count({
      where: { actorId: user.id, accion: 'LOGIN_FALLIDO', createdAt: { gte: desde } },
    });
    if (intentosRecientes >= this.MAX_INTENTOS_FALLIDOS) {
      throw new UnauthorizedException(
        `Demasiados intentos fallidos — probá de nuevo en ${this.MINUTOS_VENTANA_BLOQUEO} minutos o usá "¿Olvidaste tu contraseña?".`,
      );
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
      liderId: user.lider?.id ?? null,
      gerenteComercialId: user.gerenteComercial?.id ?? null,
    };

    await this.prisma.auditLog.create({
      data: { actorId: user.id, accion: 'LOGIN_OK', entidad: 'User', entidadId: user.id },
    });

    return {
      accessToken: this.jwt.sign(payload, { expiresIn: '8h' }), // RNF-007: expiracion por politica
      // liderId expuesto para que el frontend arme la URL de "Mi equipo"
      // (GET /lideres/:id/equipo) sin tener que decodificar el JWT a mano.
      usuario: { id: user.id, nombre: user.nombre, rol: user.rol, canal: payload.canal, liderId: payload.liderId },
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

  private hashToken(tokenCrudo: string): string {
    return crypto.createHash('sha256').update(tokenCrudo).digest('hex');
  }

  private urlFrontend(): string {
    // Cada servidor (Testeo/Producción) define FRONTEND_URL en su propio
    // backend/.env — ver backend/.env.example. Sin esto, el link del correo
    // apuntaría a localhost en cualquier ambiente real.
    return (process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, '');
  }

  /** Crea el token de un solo uso y dispara el correo (activación o recuperación) vía Odoo — ver OdooClient.enviarCorreo. */
  private async generarYEnviarToken(userId: string, email: string, nombre: string, tipo: 'ACTIVACION' | 'RECUPERACION') {
    const tokenCrudo = crypto.randomBytes(32).toString('hex');
    const minutos = tipo === 'ACTIVACION' ? this.MINUTOS_EXPIRACION_ACTIVACION : this.MINUTOS_EXPIRACION_RECUPERACION;

    await this.prisma.tokenAcceso.create({
      data: {
        userId,
        tokenHash: this.hashToken(tokenCrudo),
        tipo,
        expiraEn: new Date(Date.now() + minutos * 60_000),
      },
    });

    // Misma pantalla del frontend para ambos casos (solo "definí tu clave con
    // este link") — no hace falta que sepa si es activación o recuperación.
    const link = `${this.urlFrontend()}/restablecer-password?token=${tokenCrudo}`;
    const asunto = tipo === 'ACTIVACION' ? 'Activa tu cuenta en Haskell' : 'Recupera tu contraseña en Haskell';
    const accion = tipo === 'ACTIVACION' ? 'activar tu cuenta y elegir tu contraseña' : 'elegir una nueva contraseña';
    const vigencia = minutos < 60 ? `${minutos} minutos` : `${Math.round(minutos / 60)} horas`;
    const htmlCuerpo = `
      <p>Hola ${nombre},</p>
      <p>Hacé clic en el siguiente enlace para ${accion}. El enlace expira en ${vigencia}.</p>
      <p><a href="${link}">${link}</a></p>
      <p>Si no solicitaste esto, podés ignorar este correo.</p>
    `;

    try {
      await this.odoo.enviarCorreo({ para: email, asunto, htmlCuerpo });
    } catch (e) {
      // No tumbamos el alta ni la solicitud de recuperación si el correo
      // falla — el token queda creado igual (se puede reenviar). Se
      // registra para diagnóstico, no se propaga el error al llamador.
      console.error('No se pudo enviar el correo de acceso vía Odoo:', (e as Error).message);
    }
  }

  /** Llamado por afiliación/líderes/gerentes comerciales/transportistas al dar de alta un usuario nuevo (RF-001/RF-009). */
  async iniciarActivacion(userId: string, email: string, nombre: string) {
    await this.generarYEnviarToken(userId, email, nombre, 'ACTIVACION');
  }

  /** RF-001: "olvidé mi contraseña". Respuesta siempre genérica — nunca revela si el correo existe en el sistema. */
  async solicitarRecuperacion(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.activo) {
      await this.generarYEnviarToken(user.id, user.email, user.nombre, 'RECUPERACION');
    }
    return { mensaje: 'Si el correo existe en el sistema, te enviamos un enlace para continuar.' };
  }

  private async validarToken(tokenCrudo: string) {
    const token = await this.prisma.tokenAcceso.findUnique({ where: { tokenHash: this.hashToken(tokenCrudo) } });
    if (!token || token.usadoEn || token.expiraEn < new Date()) {
      throw new UnauthorizedException('El enlace no es válido o ya expiró — solicitá uno nuevo.');
    }
    return token;
  }

  /** Confirma el link (activación o recuperación) y fija la nueva clave — de un solo uso. */
  async establecerPassword(tokenCrudo: string, nuevaPassword: string) {
    const token = await this.validarToken(tokenCrudo);
    const passwordHash = await bcrypt.hash(nuevaPassword, 12);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
      this.prisma.tokenAcceso.update({ where: { id: token.id }, data: { usadoEn: new Date() } }),
    ]);
    await this.prisma.auditLog.create({
      data: {
        actorId: token.userId,
        accion: token.tipo === 'ACTIVACION' ? 'ACTIVAR_CUENTA' : 'RECUPERAR_PASSWORD',
        entidad: 'User',
        entidadId: token.userId,
      },
    });
    return { mensaje: 'Contraseña actualizada correctamente.' };
  }

  /** Cambio de clave por el propio usuario logueado — exige la clave actual (distinto del reseteo por link). */
  async cambiarPasswordPropia(userId: string, passwordActual: string, passwordNueva: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valida = await bcrypt.compare(passwordActual, user.passwordHash);
    if (!valida) throw new UnauthorizedException('La contraseña actual no es correcta.');

    const passwordHash = await bcrypt.hash(passwordNueva, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, accion: 'CAMBIAR_PASSWORD', entidad: 'User', entidadId: userId },
    });
    return { mensaje: 'Contraseña actualizada correctamente.' };
  }
}
