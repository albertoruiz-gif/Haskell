import { Module } from '@nestjs/common';
import { AfiliacionService } from './afiliacion.service';
import { AfiliacionController } from './afiliacion.controller';

@Module({
  controllers: [AfiliacionController],
  providers: [AfiliacionService],
  exports: [AfiliacionService],
})
export class AfiliacionModule {}
