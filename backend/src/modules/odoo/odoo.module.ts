import { Module } from '@nestjs/common';
import { OdooClient } from './odoo.client';

@Module({
  providers: [OdooClient],
  exports: [OdooClient],
})
export class OdooModule {}
