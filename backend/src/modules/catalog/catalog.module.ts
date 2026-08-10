import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { PricingModule } from '../pricing/pricing.module';
import { OdooModule } from '../odoo/odoo.module';
import { BuscadorCatalogo } from './buscador-catalogo';

@Module({
  imports: [PricingModule, OdooModule],
  controllers: [CatalogController],
  providers: [BuscadorCatalogo],
})
export class CatalogModule {}
