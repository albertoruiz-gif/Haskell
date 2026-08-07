import { Module } from '@nestjs/common';
import { LideresService } from './lideres.service';
import { LideresController } from './lideres.controller';
import { PremiosModule } from '../premios/premios.module';

@Module({
  imports: [PremiosModule],
  controllers: [LideresController],
  providers: [LideresService],
  exports: [LideresService],
})
export class LideresModule {}
