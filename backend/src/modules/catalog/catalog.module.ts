import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { PricingModule } from '../pricing/pricing.module';
import { OdooModule } from '../odoo/odoo.module';

@Module({
  imports: [PricingModule, OdooModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
