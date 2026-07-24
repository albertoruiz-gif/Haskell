import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Canal, EstadoCatalogo } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CampaignsService } from './campaigns.service';
import { CrearOfertaDto } from './dto/crear-oferta.dto';
import { PrismaService } from '../../config/prisma.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

class CrearCampaniaDto {
  @IsString()
  @IsNotEmpty()
  codigo!: string;

  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsDateString()
  fechaInicio!: string;

  @IsDateString()
  fechaFin!: string;

  @IsArray()
  @IsEnum(Canal, { each: true })
  canalesObjetivo!: Canal[];
}

class CrearCatalogoDto {
  @IsEnum(Canal)
  canal!: Canal;
}

class ObservarCatalogoDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

class PublicarCatalogoDto {
  @IsDateString()
  vigenciaDesde!: string;

  @IsDateString()
  vigenciaHasta!: string;
}

class SuspenderCatalogoDto {
  @IsString()
  @IsNotEmpty()
  motivo!: string;
}

@Controller('campaigns')
@UseGuards(RolesGuard)
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('ADMINISTRADOR')
  crearCampania(@Body() dto: CrearCampaniaDto) {
    return this.campaigns.crearCampania({
      ...dto,
      fechaInicio: new Date(dto.fechaInicio),
      fechaFin: new Date(dto.fechaFin),
    });
  }

  // Listado sin filtro de canal del JWT — GET /catalogo no sirve para
  // admins (canal viene null si el usuario no es asesor).
  @Get('catalogos')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  listarCatalogos(@Query('estado') estado?: EstadoCatalogo) {
    return this.prisma.catalog.findMany({
      where: estado ? { estado } : undefined,
      select: {
        id: true,
        canal: true,
        version: true,
        estado: true,
        campaign: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':campaignId/catalogos')
  @Roles('ADMINISTRADOR', 'GESTOR_CATALOGO')
  crearCatalogo(@Param('campaignId') campaignId: string, @Body() dto: CrearCatalogoDto, @Req() req: any) {
    return this.campaigns.crearCatalogoPorCanal(campaignId, dto.canal, req.user.id);
  }

  @Post('catalogos/:catalogId/aprobar')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  aprobarCatalogo(@Param('catalogId') catalogId: string, @Req() req: any) {
    return this.campaigns.aprobarCatalogo(catalogId, req.user.id);
  }

  @Post('catalogos/:catalogId/observar')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  observarCatalogo(@Param('catalogId') catalogId: string, @Body() dto: ObservarCatalogoDto, @Req() req: any) {
    return this.campaigns.observarCatalogo(catalogId, req.user.id, dto.motivo);
  }

  @Post('catalogos/:catalogId/publicar')
  @Roles('ADMINISTRADOR')
  publicarCatalogo(@Param('catalogId') catalogId: string, @Body() dto: PublicarCatalogoDto) {
    return this.campaigns.publicarCatalogo(catalogId, new Date(dto.vigenciaDesde), new Date(dto.vigenciaHasta));
  }

  @Post('catalogos/:catalogId/suspender')
  @Roles('ADMINISTRADOR')
  suspenderCatalogo(@Param('catalogId') catalogId: string, @Body() dto: SuspenderCatalogoDto, @Req() req: any) {
    return this.campaigns.suspenderCatalogo(catalogId, req.user.id, dto.motivo);
  }

  @Post('ofertas')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
  crearOferta(@Body() dto: CrearOfertaDto, @Req() req: any) {
    return this.campaigns.crearOfertaTemporal({
      ...dto,
      inicio: new Date(dto.inicio),
      fin: new Date(dto.fin),
      creadoPorId: req.user.id,
    });
  }

  @Get('ofertas')
  @Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL', 'GESTOR_CATALOGO')
  listarOfertas(@Query('catalogId') catalogId?: string) {
    return this.campaigns.listarOfertas(catalogId);
  }

  @Get('ofertas/vigente')
  ofertaVigente(@Query('catalogLineId') catalogLineId: string) {
    return this.campaigns.ofertaVigentePara(catalogLineId);
  }
}
