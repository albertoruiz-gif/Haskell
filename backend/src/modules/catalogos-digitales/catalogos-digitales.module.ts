import { Module } from '@nestjs/common';
import { CatalogosDigitalesController } from './catalogos-digitales.controller';
import { CatalogosDigitalesService } from './catalogos-digitales.service';

@Module({
  controllers: [CatalogosDigitalesController],
  providers: [CatalogosDigitalesService],
})
export class CatalogosDigitalesModule {}
