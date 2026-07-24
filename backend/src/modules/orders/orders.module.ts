import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PricingModule } from '../pricing/pricing.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [PricingModule, CampaignsModule, OdooModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
