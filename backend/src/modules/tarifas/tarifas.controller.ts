import { BadRequestException, Body, Controller, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from '../../config/prisma.service';
import { TarifasService } from './tarifas.service';
import { CrearTarifaDto } from './dto/crear-tarifa.dto';
import { ActualizarTarifaDto } from './dto/actualizar-tarifa.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

// Tarifario de envío por distrito (RF-016): precio al asesor y plazo de
// entrega (RF-030) que se congela en cada pedido al pagar.
@Controller('tarifas')
@UseGuards(RolesGuard)
@Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')
export class TarifasController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tarifas: TarifasService,
  ) {}

  @Get()
  listar() {
    return this.prisma.tarifa.findMany({ orderBy: { distrito: 'asc' } });
  }

  @Post()
  crear(@Body() dto: CrearTarifaDto) {
    return this.prisma.tarifa.create({ data: dto });
  }

  @Patch(':id')
  actualizar(@Param('id') id: string, @Body() dto: ActualizarTarifaDto) {
    return this.prisma.tarifa.update({ where: { id }, data: dto });
  }

  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo'))
  async importar(@UploadedFile() archivo: Express.Multer.File) {
    if (!archivo) throw new BadRequestException('Subí un archivo Excel (.xlsx) o CSV.');
    const esCSV = archivo.originalname.toLowerCase().endsWith('.csv') || archivo.mimetype === 'text/csv';
    return this.tarifas.importar(archivo.buffer, esCSV);
  }
}
