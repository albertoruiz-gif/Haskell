import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { OrdersService } from './orders.service';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class RechazarPedidoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Cualquier asesor autenticado puede crear su propio pedido — no hace
  // falta @Roles, el asesorId sale del JWT, no del body.
  @Post()
  crear(@Body() dto: CrearPedidoDto, @Req() req: any) {
    return this.orders.crearPedidoDesdeItems(req.user.asesorId, dto.items);
  }

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'ALMACEN')
  listar(@Query('estado') estado?: EstadoPedido) {
    return this.orders.listarPedidos(estado);
  }

  @Patch(':id/validar-pago')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  validarPago(@Param('id') id: string, @Req() req: any) {
    return this.orders.validarPagoManual(id, req.user.id);
  }

  @Patch(':id/rechazar')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  rechazar(@Param('id') id: string, @Body() dto: RechazarPedidoDto, @Req() req: any) {
    return this.orders.rechazarPedido(id, req.user.id, dto.motivo);
  }
}
