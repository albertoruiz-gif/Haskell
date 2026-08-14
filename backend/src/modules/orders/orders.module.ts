import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PricingModule } from '../pricing/pricing.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { OdooModule } from '../odoo/odoo.module';
import { InventarioModule } from '../inventario/inventario.module';
import { OperacionesModule } from '../operaciones/operaciones.module';
import { ClientesModule } from '../clientes/clientes.module';

@Module({
  imports: [PricingModule, CampaignsModule, OdooModule, InventarioModule, OperacionesModule, ClientesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
