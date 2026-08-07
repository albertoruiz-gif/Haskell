import { Module } from '@nestjs/common';
import { OdooModule } from '../odoo/odoo.module';
import { MetasController } from './metas.controller';
import { GastoMarketingController } from './gasto-marketing.controller';
import { IndicadoresController } from './indicadores.controller';
import { IndicadoresService } from './indicadores.service';

@Module({
  imports: [OdooModule],
  controllers: [MetasController, GastoMarketingController, IndicadoresController],
  providers: [IndicadoresService],
})
export class IndicadoresModule {}
