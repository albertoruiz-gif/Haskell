import { Module } from '@nestjs/common';
import { GerentesComercialesService } from './gerentes-comerciales.service';
import { GerentesComercialesController } from './gerentes-comerciales.controller';

@Module({
  controllers: [GerentesComercialesController],
  providers: [GerentesComercialesService],
  exports: [GerentesComercialesService],
})
export class GerentesComercialesModule {}
