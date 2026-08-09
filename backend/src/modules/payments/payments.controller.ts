import { Body, Controller, Param, Post, Req } from '@nestjs/common';
import { CulqiService } from './culqi.service';
import { PagarPedidoDto } from './dto/pagar-pedido.dto';

/**
 * Cargo automático Culqi (RF-018 a RF-021, PROMPT_culqi_integracion.md).
 * Sin @Roles — igual que POST /orders, lo dispara el propio asesor dueño
 * del pedido; CulqiService.ejecutarCargo valida la pertenencia.
 */
@Controller('orders')
export class PaymentsController {
  constructor(private readonly culqi: CulqiService) {}

  @Post(':id/pagar')
  pagar(@Param('id') id: string, @Body() dto: PagarPedidoDto, @Req() req: any) {
    return this.culqi.ejecutarCargo(id, dto.culqiToken, req.user.asesorId);
  }
}
