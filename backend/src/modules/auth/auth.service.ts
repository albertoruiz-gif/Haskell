import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../config/prisma.service';
import { OdooClient } from '../odoo/odoo.client';
import { cifrarSecretoTotp, descifrarSecretoTotp } from './totp-crypto';
import { ROLES_2FA, calcularGracia2FA } from './roles-2fa';

type UsuarioConRelaciones = {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  asesor: { canal: string; id: string } | null;
  transportista: { id: string } | null;
  lider: { id: string } | null;
  gerenteComercial: { id: string } | null;
};

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

  // EP-18 (2026-08-12): roles que ven plata/datos de todos — el resto
  // (asesoras, almacén, transportistas...) no lo necesita para no sumarle
  // fricción al uso diario desde el celular. Ver roles-2fa.ts.
  private readonly ROLES_2FA: readonly string[] = ROLES_2FA;
  private readonly MINUTOS_TOKEN_2FA_PENDIENTE = 5; // ya tiene 2FA activo, solo falta el código
  private readonly MINUTOS_TOKEN_2FA_SETUP = 15; // tiene que configurarlo antes de seguir
  private readonly EMISOR_TOTP = 'Haskell';

  private basePayload(user: UsuarioConRelaciones) {
    return {
      sub: user.id,
      email: user.email,
      rol: user.rol,
      canal: user.asesor?.canal ?? null,
      asesorId: user.asesor?.id ?? null,
      transportistaId: user.transportista?.id ?? null,
      liderId: user.lider?.id ?? null,
      gerenteComercialId: user.gerenteComercial?.id ?? null,
    };
  }

  /** Token completo (acceso normal) — el único que RolesGuard/ScopeGuard dejan pasar sin restricción. */
  private async firmarTokenCompleto(user: UsuarioConRelaciones) {
    const payload = this.basePayload(user);
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

  /** Token temporal (EP-18): solo sirve para los 1-2 endpoints de 2FA que el paso pendiente necesita — ver ScopeGuard. */
  private firmarTokenTemporal(user: UsuarioConRelaciones, scope: 'pendiente_2fa' | 'setup_2fa', minutos: number) {
    return this.jwt.sign({ ...this.basePayload(user), scope }, { expiresIn: `${minutos}m` });
  }

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

    // EP-18: la clave era correcta, pero para roles administrativos eso no
    // alcanza — todavía falta el segundo factor (o, si nunca lo configuró
    // y ya venció su plazo de gracia, configurarlo ya mismo).
    if (this.ROLES_2FA.includes(user.rol)) {
      if (user.totpActivadoEn) {
        return {
          requiere2fa: true,
          nombre: user.nombre,
          tokenTemporal: this.firmarTokenTemporal(user, 'pendiente_2fa', this.MINUTOS_TOKEN_2FA_PENDIENTE),
        };
      }
      const enGracia = user.totpGraciaHasta && user.totpGraciaHasta.getTime() > Date.now();
      if (!enGracia) {
        return {
          debeConfigurarAhora: true,
          nombre: user.nombre,
          tokenTemporal: this.firmarTokenTemporal(user, 'setup_2fa', this.MINUTOS_TOKEN_2FA_SETUP),
        };
      }
      // Todavía en su plazo de gracia: entra normal, pero con el aviso para
      // que el frontend le muestre que le queda X días para configurarlo.
      const resultado = await this.firmarTokenCompleto(user);
      return { ...resultado, debeConfigurar2fa: true, graciaHasta: user.totpGraciaHasta };
    }

    return this.firmarTokenCompleto(user);
  }

  /** EP-18: para que Mi cuenta sepa si mostrar "Activar 2FA" o "Ya está activo". */
  async estado2FA(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { rol: true, totpActivadoEn: true } });
    return { requerido: this.ROLES_2FA.includes(user.rol), activo: !!user.totpActivadoEn };
  }

  /** EP-18: primer paso de configuración — genera un secreto nuevo (todavía inactivo hasta confirmar con activar2FA) y su QR. */
  async generarSecreto2FA(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secreto = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: userId }, data: { totpSecret: cifrarSecretoTotp(secreto) } });

    const otpauthUrl = authenticator.keyuri(user.email, this.EMISOR_TOTP, secreto);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    // El secreto en texto plano solo se devuelve UNA vez, acá — para quien
    // no pueda escanear el QR y necesite escribirlo a mano en su app.
    return { secreto, qrDataUrl };
  }

  /** EP-18: confirma el código contra el secreto recién generado y activa 2FA — si venía de un login forzado, ya entrega el acceso completo. */
  async activar2FA(userId: string, codigo: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { asesor: true, transportista: true, lider: true, gerenteComercial: true },
    });
    if (!user.totpSecret) {
      throw new BadRequestException('Primero generá un código QR desde "Configurar 2FA".');
    }
    const valido = authenticator.verify({ token: codigo, secret: descifrarSecretoTotp(user.totpSecret) });
    if (!valido) {
      throw new UnauthorizedException('El código no es correcto — fijate que tu app tenga la hora bien sincronizada.');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { totpActivadoEn: new Date() } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, accion: 'ACTIVAR_2FA', entidad: 'User', entidadId: userId },
    });
    return this.firmarTokenCompleto(user);
  }

  /** EP-18: segundo paso del login cuando el usuario YA tiene 2FA activo. */
  async verificarLogin2FA(userId: string, codigo: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { asesor: true, transportista: true, lider: true, gerenteComercial: true },
    });
    if (!user.totpSecret || !user.totpActivadoEn) {
      throw new UnauthorizedException('Esta cuenta no tiene 2FA activo.');
    }
    const valido = authenticator.verify({ token: codigo, secret: descifrarSecretoTotp(user.totpSecret) });
    if (!valido) {
      await this.prisma.auditLog.create({
        data: { actorId: userId, accion: '2FA_FALLIDO', entidad: 'User', entidadId: userId },
      });
      throw new UnauthorizedException('El código no es correcto.');
    }
    return this.firmarTokenCompleto(user);
  }

  /** EP-18: recuperación por un admin — "perdí el celular"/sospecha de acceso indebido. No renueva el plazo de gracia a propósito (ver comentario en schema.prisma). */
  async resetear2FA(userId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'RESETEAR_2FA', entidad: 'User', entidadId: userId },
    });
    return this.prisma.user.update({ where: { id: userId }, data: { totpSecret: null, totpActivadoEn: null } });
  }

  async crearUsuario(data: { email: string; password: string; nombre: string; rol: string }) {
    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: { email: data.email, passwordHash, nombre: data.nombre, rol: data.rol as any, totpGraciaHasta: calcularGracia2FA(data.rol) },
    });
  }

  /** Gestión de cuentas administrativas (EP-18) — ADMINISTRADOR/GERENTE_GENERAL/GERENTE_COMERCIAL/FINANZAS, las únicas que usan 2FA. */
  async listarUsuariosAdministrativos() {
    return this.prisma.user.findMany({
      where: { rol: { in: this.ROLES_2FA as any[] } },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, totpActivadoEn: true, createdAt: true },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  /** Alta de una cuenta administrativa nueva — dispara el correo de activación (RF-001), igual que el resto de las altas. */
  async crearUsuarioAdministrativo(data: { email: string; nombre: string; rol: string }) {
    if (!this.ROLES_2FA.includes(data.rol)) {
      throw new BadRequestException(`Rol inválido para una cuenta administrativa: ${data.rol}.`);
    }
    const claveTemporal = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(claveTemporal, 12);
    const user = await this.prisma.user.create({
      data: { email: data.email, passwordHash, nombre: data.nombre, rol: data.rol as any, totpGraciaHasta: calcularGracia2FA(data.rol) },
    });
    await this.iniciarActivacion(user.id, user.email, user.nombre);
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
  }

  // RF-003: desactivar sin borrar historial. EP-01: además de bloquear
  // logins nuevos, corta YA cualquier sesión que ya tuviera abierta —
  // antes, desactivar a alguien no le hacía nada a su token vigente.
  async desactivarUsuario(userId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'DESACTIVAR_USUARIO', entidad: 'User', entidadId: userId },
    });
    return this.prisma.user.update({
      where: { id: userId },
      data: { activo: false, sesionesInvalidadasDesde: new Date() },
    });
  }

  // EP-01: "cerrar sesión en todos los dispositivos" sin desactivar la
  // cuenta — para el caso de "perdí el celular" o "me robaron la sesión",
  // donde la persona sigue trabajando pero necesita volver a loguearse.
  async cerrarSesiones(userId: string, actorId: string) {
    await this.prisma.auditLog.create({
      data: { actorId, accion: 'CERRAR_SESIONES', entidad: 'User', entidadId: userId },
    });
    return this.prisma.user.update({ where: { id: userId }, data: { sesionesInvalidadasDesde: new Date() } });
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

    // EP-01: si esto es una recuperación por "olvidé mi contraseña", puede
    // ser justamente porque alguien más tiene la cuenta comprometida con
    // una sesión abierta — fijar la clave nueva sin cortar esa sesión
    // vieja dejaría a quien la robó con acceso igual.
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash, sesionesInvalidadasDesde: new Date() } }),
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

  /**
   * Cambio de clave por el propio usuario logueado — exige la clave actual
   * (distinto del reseteo por link). EP-01: esto también invalida la sesión
   * actual (incluida la que está haciendo el cambio) — el usuario tiene que
   * volver a loguearse con la clave nueva. Es la misma convención que usan
   * la mayoría de los sitios ("por tu seguridad, iniciá sesión de nuevo")
   * y evita que una sesión vieja (ej. en otro dispositivo, con la clave
   * anterior ya comprometida) siga viva después del cambio.
   */
  async cambiarPasswordPropia(userId: string, passwordActual: string, passwordNueva: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valida = await bcrypt.compare(passwordActual, user.passwordHash);
    if (!valida) throw new UnauthorizedException('La contraseña actual no es correcta.');

    const passwordHash = await bcrypt.hash(passwordNueva, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash, sesionesInvalidadasDesde: new Date() } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, accion: 'CAMBIAR_PASSWORD', entidad: 'User', entidadId: userId },
    });
    return { mensaje: 'Contraseña actualizada correctamente. Volvé a iniciar sesión con tu nueva contraseña.' };
  }
}
