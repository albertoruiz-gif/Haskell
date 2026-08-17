import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EstadoPedido } from '@prisma/client';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { OrdersService } from './orders.service';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class RechazarPedidoDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}

class RegistrarDepositoDto {
  @IsString()
  @IsNotEmpty()
  numeroOperacion!: string;

  @IsString()
  @IsNotEmpty()
  banco!: string;

  @IsOptional()
  @IsString()
  comprobanteUrl?: string;
}

@Controller('orders')
@UseGuards(RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Cualquier asesor autenticado puede crear su propio pedido — no hace
  // falta @Roles, el asesorId sale del JWT, no del body.
  @Post()
  crear(@Body() dto: CrearPedidoDto, @Req() req: any) {
    return this.orders.crearPedidoDesdeItems(req.user.asesorId, dto.items, {
      clienteId: dto.clienteId,
      formaPago: dto.formaPago,
      solicitudDescuentoId: dto.solicitudDescuentoId,
    });
  }

  @Get()
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'ALMACEN')
  listar(@Query('estado') estado?: EstadoPedido) {
    return this.orders.listarPedidos(estado);
  }

  // EP-12 — el Asesor ve el seguimiento de su propio pedido (número,
  // estado, transportista/entrega si ya hay). Roles administrativos
  // también pueden, para dar soporte sin tener que buscar en /orders.
  @Get(':id/seguimiento')
  @Roles('ASESOR', 'ADMINISTRADOR', 'GERENTE_COMERCIAL', 'ALMACEN')
  seguimiento(@Param('id') id: string, @Req() req: any) {
    return this.orders.obtenerSeguimiento(id, req.user.asesorId ?? null, req.user.rol);
  }

  @Patch(':id/validar-pago')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  validarPago(@Param('id') id: string, @Req() req: any) {
    return this.orders.validarPagoManual(id, req.user.id);
  }

  // EP-21 — el Asesor carga el comprobante una vez que su Cliente depositó
  // (dato que no existe todavía al crear el pedido).
  @Patch(':id/deposito')
  @Roles('ASESOR')
  registrarDeposito(@Param('id') id: string, @Body() dto: RegistrarDepositoDto) {
    return this.orders.registrarDeposito(id, dto);
  }

  @Patch(':id/deposito/validar')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'FINANZAS')
  validarDeposito(@Param('id') id: string, @Req() req: any) {
    return this.orders.validarDeposito(id, req.user.id);
  }

  @Patch(':id/rechazar')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  rechazar(@Param('id') id: string, @Body() dto: RechazarPedidoDto, @Req() req: any) {
    return this.orders.rechazarPedido(id, req.user.id, dto.motivo);
  }
}
