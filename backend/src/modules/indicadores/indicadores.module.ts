import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { MetasController } from './metas.controller';
import { GastoMarketingController } from './gasto-marketing.controller';
import { DatosFinancierosController } from './datos-financieros.controller';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';

@Module({
  imports: [OdooModule],
  controllers: [MetasController, GastoMarketingController, DatosFinancierosController, IndicadoresController],
  providers: [IndicadoresService],
})
export class IndicadoresModule {}
