import { Module } from '@nestjs/common';
import { TransportistasService } from './transportistas.service';
import { TransportistasController } from './transportistas.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TransportistasController],
  providers: [TransportistasService],
  exports: [TransportistasService],
})
export class TransportistasModule {}
