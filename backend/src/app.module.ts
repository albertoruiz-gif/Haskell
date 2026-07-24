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
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

// TODO (fuera de este scaffold, ver README "Lo que falta"):
// - NotificacionesModule: correo/WhatsApp, RF-037
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
  ],
  controllers: [HealthController],
  providers: [
    // Orden importa: primero autentica (JWT), despues autoriza por rol (RolesGuard).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
