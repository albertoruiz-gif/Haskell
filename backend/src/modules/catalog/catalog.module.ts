import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [PricingModule],
  controllers: [CatalogController],
})
export class CatalogModule {}
