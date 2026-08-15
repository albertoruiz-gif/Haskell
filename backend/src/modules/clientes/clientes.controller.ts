import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { EstadoSolicitudCredito, EstadoSolicitudDescuento } from '@prisma/client';
import { ClientesService } from './clientes.service';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { SolicitarCreditoDto } from './dto/solicitar-credito.dto';
import { AprobarSolicitudDto, RechazarSolicitudDto } from './dto/resolver-solicitud.dto';
import { RegistrarCobroDto } from './dto/registrar-cobro.dto';
import { MarcarEstadoClienteDto } from './dto/marcar-estado-cliente.dto';
import { SolicitarDescuentoDto } from './dto/solicitar-descuento.dto';
import { RechazarSolicitudDescuentoDto } from './dto/resolver-solicitud-descuento.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const ROLES_GESTION_CREDITO = ['ADMINISTRADOR', 'GERENTE_COMERCIAL'];
// EP-04 — a diferencia del crédito, el descuento también puede aprobarlo
// GERENTE_GENERAL (obligatorio por encima del 5%, validado por monto dentro
// del service — ver ClientesService.aprobarSolicitudDescuento).
const ROLES_GESTION_DESCUENTO = ['ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GERENTE_GENERAL'];

@Controller()
@UseGuards(RolesGuard)
export class ClientesController {
  constructor(private readonly clientes: ClientesService) {}

  @Post('clientes')
  @Roles('ASESOR')
  crear(@Req() req: any, @Body() dto: CrearClienteDto) {
    return this.clientes.crear(req.user.asesorId, dto);
  }

  @Get('clientes')
  @Roles('ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR')
  listar(@Req() req: any) {
    // El Asesor solo ve sus propios clientes — Gerente Comercial/Administrador ven todos.
    const asesorId = req.user.rol === 'ASESOR' ? req.user.asesorId : undefined;
    return this.clientes.listar({ asesorId });
  }

  @Get('clientes/:id')
  @Roles('ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR')
  async obtener(@Req() req: any, @Param('id') id: string) {
    const cliente = await this.clientes.obtener(id);
    if (req.user.rol === 'ASESOR' && cliente.asesorId !== req.user.asesorId) {
      throw new ForbiddenException('Este cliente no te pertenece.');
    }
    return cliente;
  }

  @Patch('clientes/:id/estado')
  @Roles(...ROLES_GESTION_CREDITO)
  marcarEstado(@Param('id') id: string, @Body() dto: MarcarEstadoClienteDto) {
    return this.clientes.marcarEstado(id, dto.estado);
  }

  @Post('clientes/:id/solicitudes-credito')
  @Roles('ASESOR')
  async solicitarCredito(@Req() req: any, @Param('id') clienteId: string, @Body() dto: SolicitarCreditoDto) {
    const cliente = await this.clientes.obtener(clienteId);
    if (cliente.asesorId !== req.user.asesorId) {
      throw new ForbiddenException('Este cliente no te pertenece.');
    }
    return this.clientes.solicitarCredito(clienteId, req.user.id, dto);
  }

  @Get('solicitudes-credito')
  @Roles(...ROLES_GESTION_CREDITO)
  listarSolicitudes(@Query('estado') estado?: EstadoSolicitudCredito) {
    return this.clientes.listarSolicitudes({ estado });
  }

  @Patch('solicitudes-credito/:id/aprobar')
  @Roles(...ROLES_GESTION_CREDITO)
  aprobarSolicitud(@Req() req: any, @Param('id') id: string, @Body() dto: AprobarSolicitudDto) {
    return this.clientes.aprobarSolicitud(id, req.user.id, dto.lineaAprobada);
  }

  @Patch('solicitudes-credito/:id/rechazar')
  @Roles(...ROLES_GESTION_CREDITO)
  rechazarSolicitud(@Req() req: any, @Param('id') id: string, @Body() dto: RechazarSolicitudDto) {
    return this.clientes.rechazarSolicitud(id, req.user.id, dto.motivoRechazo);
  }

  // --- Descuentos por volumen (EP-04) ---

  @Post('clientes/:id/solicitudes-descuento')
  @Roles('ASESOR')
  async solicitarDescuento(@Req() req: any, @Param('id') clienteId: string, @Body() dto: SolicitarDescuentoDto) {
    const cliente = await this.clientes.obtener(clienteId);
    if (cliente.asesorId !== req.user.asesorId) {
      throw new ForbiddenException('Este cliente no te pertenece.');
    }
    return this.clientes.solicitarDescuento(clienteId, req.user.id, dto);
  }

  @Get('solicitudes-descuento')
  @Roles(...ROLES_GESTION_DESCUENTO)
  listarSolicitudesDescuento(@Query('estado') estado?: EstadoSolicitudDescuento) {
    return this.clientes.listarSolicitudesDescuento({ estado });
  }

  @Patch('solicitudes-descuento/:id/aprobar')
  @Roles(...ROLES_GESTION_DESCUENTO)
  aprobarSolicitudDescuento(@Req() req: any, @Param('id') id: string) {
    return this.clientes.aprobarSolicitudDescuento(id, req.user.id, req.user.rol);
  }

  @Patch('solicitudes-descuento/:id/rechazar')
  @Roles(...ROLES_GESTION_DESCUENTO)
  rechazarSolicitudDescuento(@Req() req: any, @Param('id') id: string, @Body() dto: RechazarSolicitudDescuentoDto) {
    return this.clientes.rechazarSolicitudDescuento(id, req.user.id, dto.motivoRechazo);
  }

  @Post('clientes/:id/cobros')
  @Roles('ASESOR', 'GERENTE_COMERCIAL', 'ADMINISTRADOR', 'FINANZAS')
  async registrarCobro(@Req() req: any, @Param('id') clienteId: string, @Body() dto: RegistrarCobroDto) {
    if (req.user.rol === 'ASESOR') {
      const cliente = await this.clientes.obtener(clienteId);
      if (cliente.asesorId !== req.user.asesorId) {
        throw new ForbiddenException('Este cliente no te pertenece.');
      }
    }
    return this.clientes.registrarCobro(clienteId, req.user.id, dto);
  }
}
