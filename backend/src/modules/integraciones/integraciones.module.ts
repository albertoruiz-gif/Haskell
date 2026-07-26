import { Module } from '@nestjs/common';
import { WhatsappIntegracionController } from './whatsapp.controller';
import { WhatsappIntegracionService } from './whatsapp.service';

@Module({
  controllers: [WhatsappIntegracionController],
  providers: [WhatsappIntegracionService],
})
export class IntegracionesModule {}
