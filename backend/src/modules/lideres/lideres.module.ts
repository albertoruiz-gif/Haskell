import { Module } from '@nestjs/common';
import { LideresService } from './lideres.service';
import { LideresController } from './lideres.controller';

@Module({
  controllers: [LideresController],
  providers: [LideresService],
  exports: [LideresService],
})
export class LideresModule {}
