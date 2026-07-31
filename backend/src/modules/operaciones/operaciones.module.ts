import { Module } from '@nestjs/common';
import { OperacionesService } from './operaciones.service';
import { OperacionesController } from './operaciones.controller';
import { OdooModule } from '../odoo/odoo.module';
import { InventarioModule } from '../inventario/inventario.module';

@Module({
  imports: [OdooModule, InventarioModule],
  controllers: [OperacionesController],
  providers: [OperacionesService],
})
export class OperacionesModule {}
