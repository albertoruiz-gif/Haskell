import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

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
  ],
  controllers: [HealthController],
  providers: [
    // Orden importa: primero autentica (JWT), despues autoriza por rol (RolesGuard).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
