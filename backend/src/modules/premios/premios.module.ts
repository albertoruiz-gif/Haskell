import { Module } from '@nestjs/common';
import { PremiosController } from './premios.controller';
import { PremiosService } from './premios.service';

@Module({
  controllers: [PremiosController],
  providers: [PremiosService],
  exports: [PremiosService],
})
export class PremiosModule {}
