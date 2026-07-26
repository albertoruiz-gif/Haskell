import { Module } from '@nestjs/common';
import { TransportistasService } from './transportistas.service';
import { TransportistasController } from './transportistas.controller';

@Module({
  controllers: [TransportistasController],
  providers: [TransportistasService],
  exports: [TransportistasService],
})
export class TransportistasModule {}
