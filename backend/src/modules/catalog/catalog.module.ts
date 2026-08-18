import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { PricingModule } from '../pricing/pricing.module';
import { OdooModule } from '../odoo/odoo.module';
import { InventarioModule } from '../inventario/inventario.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { BuscadorCatalogo } from './buscador-catalogo';

@Module({
  imports: [PricingModule, OdooModule, InventarioModule, CampaignsModule],
  controllers: [CatalogController],
  providers: [BuscadorCatalogo],
})
export class CatalogModule {}
