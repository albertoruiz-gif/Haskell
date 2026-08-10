import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../config/prisma.service';
import { CrearReclamoDto } from './dto/crear-reclamo.dto';

/**
 * Libro de Reclamaciones — obligación legal en Perú (DS 011-2011-PCM y
 * normativa asociada) para toda web que ofrezca productos/servicios,
 * independiente de si hay pasarela de pago o no. Autoconstruido acá para
 * no depender de un SaaS externo ni tener costo recurrente — ver
 * docs/PROMPT_culqi_requisitos_web.md para el detalle de requisitos.
 */
@Injectable()
export class LibroReclamacionesService {
  constructor(private readonly prisma: PrismaService) {}

  private generarCodigo(): string {
    // Legible y corto para que el consumidor lo pueda copiar/anotar a mano
    // (ej. "RC-M1A2B3-9F2C"), no un cuid largo — no necesita ser secreto,
    // solo único: GET /libro-reclamaciones/:codigo es de consulta pública.
    const marcaTiempo = Date.now().toString(36).toUpperCase();
    const azar = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `RC-${marcaTiempo}-${azar}`;
  }

  async crear(dto: CrearReclamoDto) {
    const codigo = this.generarCodigo();
    const reclamo = await this.prisma.reclamo.create({
      data: { ...dto, codigo },
    });
    return { codigo: reclamo.codigo, fecha: reclamo.createdAt };
  }

  /** Consulta pública — el consumidor ve el estado de SU reclamo con el código que recibió, sin necesitar cuenta. */
  async buscarPorCodigo(codigo: string) {
    const reclamo = await this.prisma.reclamo.findUnique({
      where: { codigo },
      select: {
        codigo: true,
        tipo: true,
        estado: true,
        bienOServicioReclamado: true,
        detalle: true,
        respuesta: true,
        createdAt: true,
        respondidoEn: true,
      },
    });
    if (!reclamo) throw new NotFoundException('No existe ningún reclamo con ese código.');
    return reclamo;
  }

  listar() {
    return this.prisma.reclamo.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async responder(id: string, respuesta: string, actorId: string) {
    return this.prisma.reclamo.update({
      where: { id },
      data: { respuesta, estado: 'RESPONDIDO', respondidoPorId: actorId, respondidoEn: new Date() },
    });
  }
}
