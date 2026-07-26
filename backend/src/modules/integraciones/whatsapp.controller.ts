import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ServiceKeyGuard } from '../../common/guards/service-key.guard';
import { WhatsappIntegracionService } from './whatsapp.service';

/**
 * Endpoints internos consumidos por el microservicio whatsapp-bot (aparte,
 * en Co Work/Haskell/whatsapp-bot). No los usa ningun usuario humano ni el
 * frontend web: @Public() los saca del JwtAuthGuard global y ServiceKeyGuard
 * exige el header x-service-key en su lugar (ver WHATSAPP_BOT_SERVICE_KEY).
 */
@Controller('integraciones/whatsapp')
@Public()
@UseGuards(ServiceKeyGuard)
export class WhatsappIntegracionController {
  constructor(private readonly whatsapp: WhatsappIntegracionService) {}

  @Get('pedido')
  async pedido(@Query('telefono') telefono?: string, @Query('referencia') referencia?: string) {
    if (!telefono) {
      throw new BadRequestException('Falta el parametro telefono.');
    }
    return this.whatsapp.consultarPedido(telefono, referencia);
  }
}
