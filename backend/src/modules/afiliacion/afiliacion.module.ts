import { Module } from '@nestjs/common';
import { AfiliacionService } from './afiliacion.service';
import { AfiliacionController } from './afiliacion.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [AfiliacionController],
  providers: [AfiliacionService],
  exports: [AfiliacionService],
})
export class AfiliacionModule {}
