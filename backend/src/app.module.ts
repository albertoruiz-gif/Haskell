import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OdooModule } from './modules/odoo/odoo.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { HealthController } from './modules/health/health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { AfiliacionModule } from './modules/afiliacion/afiliacion.module';
import { OperacionesModule } from './modules/operaciones/operaciones.module';
import { TransportistasModule } from './modules/transportistas/transportistas.module';
import { LideresModule } from './modules/lideres/lideres.module';
import { InventarioModule } from './modules/inventario/inventario.module';
import { GerentesComercialesModule } from './modules/gerentes-comerciales/gerentes-comerciales.module';
import { TarifasModule } from './modules/tarifas/tarifas.module';
import { IntegracionesModule } from './modules/integraciones/integraciones.module';
import { CatalogosDigitalesModule } from './modules/catalogos-digitales/catalogos-digitales.module';
import { IndicadoresModule } from './modules/indicadores/indicadores.module';
import { PremiosModule } from './modules/premios/premios.module';
import { LibroReclamacionesModule } from './modules/libro-reclamaciones/libro-reclamaciones.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { ClientesModule } from './modules/clientes/clientes.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ScopeGuard } from './common/guards/scope.guard';

// TODO (fuera de este scaffold, ver README "Lo que falta"):
// - Notificaciones: el correo de activación/recuperación de clave (RF-001) ya
//   se envía vía OdooClient.enviarCorreo mientras AWS SES siga en sandbox
//   (caso 178577914400530) — falta WhatsApp saliente (RF-037) para el resto
//   de notificaciones (hoy integraciones/whatsapp.service.ts solo responde
//   consultas entrantes, no puede enviar mensajes por su cuenta).
// - AnaliticaModule: paneles y exportaciones, RF-031 a RF-033
@Module({
  imports: [
    ConfigModule,
    // Rate limit global (auditoria de seguridad 2026-08-10): sin esto, no
    // habia NADA que frenara fuerza bruta/scraping contra la API — ni acá
    // ni en nginx. Limite por defecto generoso (uso normal de la app no lo
    // toca); el login tiene su propio limite mas estricto via @Throttle,
    // ver AuthController.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthModule,
    AfiliacionModule,
    PricingModule,
    CampaignsModule,
    CatalogModule,
    OdooModule,
    OrdersModule,
    PaymentsModule,
    OperacionesModule,
    TransportistasModule,
    LideresModule,
    GerentesComercialesModule,
    InventarioModule,
    TarifasModule,
    IntegracionesModule,
    CatalogosDigitalesModule,
    IndicadoresModule,
    PremiosModule,
    LibroReclamacionesModule,
    ConfiguracionModule,
    ClientesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Orden importa: primero el limite de requests (asi corta flood ANTES
    // de gastar trabajo en autenticar), despues autentica (JWT), despues
    // ScopeGuard (EP-18: corta un token temporal de 2FA antes de que
    // llegue a nada que no sea su propio flujo), despues autoriza por rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ScopeGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
