import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AlcancePorcentaje, Canal } from '@prisma/client';
import { PricingService } from './pricing.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class ActualizarPorcentajeDto {
  alcance!: AlcancePorcentaje;
  porcentaje!: number;
  campaignId?: string;
  canal?: Canal;
}

@Controller('pricing')
@UseGuards(RolesGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  // Solo Administrador o Gerente comercial pueden tocar el % del asesor (RFD 3.2 + adenda v0.3)
  @Post('porcentaje-asesor')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  actualizar(@Body() dto: ActualizarPorcentajeDto, @Req() req: any) {
    return this.pricingService.actualizarPorcentaje({
      alcance: dto.alcance,
      porcentaje: dto.porcentaje,
      campaignId: dto.campaignId,
      canal: dto.canal,
      actorId: req.user.id,
    });
  }
}
