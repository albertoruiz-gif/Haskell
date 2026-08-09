import { Module } from '@nestjs/common';
import { LideresService } from './lideres.service';
import { LideresController } from './lideres.controller';
import { PremiosModule } from '../premios/premios.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PremiosModule, AuthModule],
  controllers: [LideresController],
  providers: [LideresService],
  exports: [LideresService],
})
export class LideresModule {}
