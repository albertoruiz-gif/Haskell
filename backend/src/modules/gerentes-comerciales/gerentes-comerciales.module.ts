import { Module } from '@nestjs/common';
import { GerentesComercialesService } from './gerentes-comerciales.service';
import { GerentesComercialesController } from './gerentes-comerciales.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [GerentesComercialesController],
  providers: [GerentesComercialesService],
  exports: [GerentesComercialesService],
})
export class GerentesComercialesModule {}
