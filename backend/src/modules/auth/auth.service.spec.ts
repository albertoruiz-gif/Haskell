import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { cifrarSecretoTotp } from './totp-crypto';

process.env.TOTP_ENCRYPTION_KEY ??= 'clave-de-test-no-usar-en-produccion';

// EP-01 (auditoría 2026-08-12): estos tres caminos son los que ahora deben
// invalidar sesiones vigentes (además de que exista un cierre explícito) —
// ver jwt.strategy.spec.ts para cómo se usa sesionesInvalidadasDesde.
describe('AuthService — invalidación de sesiones (EP-01)', () => {
  function crearService() {
    const prisma = {
      user: {
        findUniqueOrThrow: jest.fn(),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'user-1', ...data })),
      },
      tokenAcceso: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new AuthService(prisma as any, {} as any, {} as any);
    return { service, prisma };
  }

  it('desactivarUsuario() desactiva Y cierra la sesión vigente', async () => {
    const { service, prisma } = crearService();
    await service.desactivarUsuario('user-1', 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ activo: false, sesionesInvalidadasDesde: expect.any(Date) }) }),
    );
  });

  it('cerrarSesiones() cierra la sesión sin tocar "activo"', async () => {
    const { service, prisma } = crearService();
    await service.cerrarSesiones('user-1', 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { sesionesInvalidadasDesde: expect.any(Date) } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accion: 'CERRAR_SESIONES' }) }),
    );
  });

  it('cambiarPasswordPropia() con clave correcta actualiza la clave Y cierra la sesión actual', async () => {
    const { service, prisma } = crearService();
    const passwordHash = await bcrypt.hash('vieja123', 12);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash });

    await service.cambiarPasswordPropia('user-1', 'vieja123', 'nuevaclave123');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sesionesInvalidadasDesde: expect.any(Date) }) }),
    );
  });

  it('cambiarPasswordPropia() con clave actual incorrecta NO toca nada', async () => {
    const { service, prisma } = crearService();
    const passwordHash = await bcrypt.hash('vieja123', 12);
    prisma.user.findUniqueOrThrow.mockResolvedValue({ id: 'user-1', passwordHash });

    await expect(service.cambiarPasswordPropia('user-1', 'clave-mala', 'nuevaclave123')).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('establecerPassword() (link de activación/recuperación) también cierra sesiones vigentes', async () => {
    const { service, prisma } = crearService();
    prisma.tokenAcceso.findUnique.mockResolvedValue({
      id: 'token-1',
      userId: 'user-1',
      tipo: 'RECUPERACION',
      usadoEn: null,
      expiraEn: new Date(Date.now() + 60_000),
    });

    await service.establecerPassword('token-crudo-cualquiera', 'nuevaclave123');
    const llamadaUpdateUser = prisma.user.update.mock.calls.find((c: any) => c[0].where.id === 'user-1');
    expect(llamadaUpdateUser[0].data).toEqual(expect.objectContaining({ sesionesInvalidadasDesde: expect.any(Date) }));
  });
});

// EP-18 (2026-08-13): 2FA obligatorio para roles administrativos, con
// plazo de gracia — decisiones tomadas con el usuario: TOTP (app
// autenticadora), solo ADMINISTRADOR/GERENTE_GENERAL/GERENTE_COMERCIAL/
// FINANZAS, obligatorio con gracia, reset manual por un admin. La
// verificación TOTP usa la librería real (no mockeada) para probar el
// flujo completo, no solo que se llamó a algo.
describe('AuthService — 2FA (EP-18)', () => {
  function usuarioBase(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1',
      email: 'gerente@haskell.pe',
      nombre: 'Gerente Uno',
      rol: 'GERENTE_COMERCIAL',
      activo: true,
      passwordHash: '',
      asesor: null,
      transportista: null,
      lider: null,
      gerenteComercial: null,
      totpSecret: null,
      totpActivadoEn: null,
      totpGraciaHasta: null,
      ...overrides,
    };
  }

  function crearService(usuarioEnBD: ReturnType<typeof usuarioBase>) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(usuarioEnBD),
        findUniqueOrThrow: jest.fn().mockResolvedValue(usuarioEnBD),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...usuarioEnBD, ...data })),
      },
      auditLog: { count: jest.fn().mockResolvedValue(0), create: jest.fn().mockResolvedValue({}) },
    };
    const jwt = { sign: jest.fn((payload: object) => JSON.stringify(payload)) };
    const service = new AuthService(prisma as any, jwt as any, {} as any);
    return { service, prisma, jwt };
  }

  describe('login()', () => {
    it('un rol que no requiere 2FA entra directo, como siempre', async () => {
      const { service } = crearService(usuarioBase({ rol: 'ASESOR', passwordHash: await bcrypt.hash('clave123', 12) }));
      const resultado: any = await service.login('gerente@haskell.pe', 'clave123');
      expect(resultado.accessToken).toBeDefined();
      expect(resultado.requiere2fa).toBeUndefined();
    });

    it('rol administrativo, 2FA activo → pide el código (no entrega token completo)', async () => {
      const { service } = crearService(
        usuarioBase({ passwordHash: await bcrypt.hash('clave123', 12), totpActivadoEn: new Date() }),
      );
      const resultado: any = await service.login('gerente@haskell.pe', 'clave123');
      expect(resultado.requiere2fa).toBe(true);
      expect(resultado.accessToken).toBeUndefined();
      expect(JSON.parse(resultado.tokenTemporal).scope).toBe('pendiente_2fa');
    });

    it('rol administrativo, sin 2FA pero DENTRO del plazo de gracia → entra, con aviso', async () => {
      const graciaHasta = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const { service } = crearService(usuarioBase({ passwordHash: await bcrypt.hash('clave123', 12), totpGraciaHasta: graciaHasta }));
      const resultado: any = await service.login('gerente@haskell.pe', 'clave123');
      expect(resultado.accessToken).toBeDefined();
      expect(resultado.debeConfigurar2fa).toBe(true);
      expect(resultado.graciaHasta).toEqual(graciaHasta);
    });

    it('rol administrativo, sin 2FA y el plazo de gracia YA VENCIÓ → obliga a configurar antes de entrar', async () => {
      const graciaVencida = new Date(Date.now() - 60_000);
      const { service } = crearService(usuarioBase({ passwordHash: await bcrypt.hash('clave123', 12), totpGraciaHasta: graciaVencida }));
      const resultado: any = await service.login('gerente@haskell.pe', 'clave123');
      expect(resultado.debeConfigurarAhora).toBe(true);
      expect(resultado.accessToken).toBeUndefined();
      expect(JSON.parse(resultado.tokenTemporal).scope).toBe('setup_2fa');
    });
  });

  describe('generarSecreto2FA() + activar2FA()', () => {
    it('genera un secreto, lo guarda cifrado, y un código válido para ese secreto activa 2FA de verdad', async () => {
      const usuario = usuarioBase();
      const { service, prisma } = crearService(usuario);

      const { secreto, qrDataUrl } = await service.generarSecreto2FA('user-1');
      expect(qrDataUrl).toMatch(/^data:image\/png/);
      // Lo que se guardó en la base NO es el secreto en texto plano.
      const guardado = prisma.user.update.mock.calls[0][0].data.totpSecret;
      expect(guardado).not.toBe(secreto);

      // Simula que el usuario ya escaneó el QR: la próxima lectura de la
      // base debe devolver el secreto recién cifrado.
      usuario.totpSecret = guardado;
      const codigoValido = authenticator.generate(secreto);

      const resultado: any = await service.activar2FA('user-1', codigoValido);
      expect(resultado.accessToken).toBeDefined();
      expect(prisma.user.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { totpActivadoEn: expect.any(Date) } }),
      );
    });

    it('activar2FA() con un código incorrecto NO activa nada', async () => {
      const secreto = authenticator.generateSecret();
      const usuario = usuarioBase({ totpSecret: cifrarSecretoTotp(secreto) });
      const { service, prisma } = crearService(usuario);

      await expect(service.activar2FA('user-1', '000000')).rejects.toThrow();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verificarLogin2FA()', () => {
    it('código correcto entrega el token completo', async () => {
      const secreto = authenticator.generateSecret();
      const usuario = usuarioBase({ totpSecret: cifrarSecretoTotp(secreto), totpActivadoEn: new Date() });
      const { service } = crearService(usuario);

      const resultado: any = await service.verificarLogin2FA('user-1', authenticator.generate(secreto));
      expect(resultado.accessToken).toBeDefined();
    });

    it('código incorrecto rechaza y deja rastro en AuditLog', async () => {
      const secreto = authenticator.generateSecret();
      const usuario = usuarioBase({ totpSecret: cifrarSecretoTotp(secreto), totpActivadoEn: new Date() });
      const { service, prisma } = crearService(usuario);

      await expect(service.verificarLogin2FA('user-1', '000000')).rejects.toThrow();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accion: '2FA_FALLIDO' }) }));
    });
  });

  describe('resetear2FA()', () => {
    it('limpia el secreto y la activación (recuperación por un admin)', async () => {
      const { service, prisma } = crearService(usuarioBase({ totpSecret: 'algo', totpActivadoEn: new Date() }));
      await service.resetear2FA('user-1', 'admin-1');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { totpSecret: null, totpActivadoEn: null } }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ accion: 'RESETEAR_2FA' }) }));
    });
  });
});
