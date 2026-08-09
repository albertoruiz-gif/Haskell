import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcrypt';
import { Canal } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuthService } from '../auth/auth.service';

export interface FilaAfiliacion {
  fila: number;
  codigo_asesor: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno?: string;
  tipo_documento: string;
  numero_documento: string;
  fecha_nacimiento: string;
  telefono_principal: string;
  numero_yape: string;
  correo?: string;
  canal: string;
  codigo_lider?: string;
  direccion_1: string;
  departamento_1: string;
  provincia_1: string;
  distrito_1: string;
  referencia_1?: string;
}

export interface ErrorFila {
  fila: number;
  campo: string;
  motivo: string;
}

@Injectable()
export class AfiliacionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // RF-006/RF-009: alta individual con validaciones obligatorias.
  // liderQueAfilia: cuando un Lider (rol LIDER_MINORISTA) crea el asesor,
  // se ignora el canal recibido — se fuerza a COMERCIO_MINORISTA y el
  // asesor queda vinculado a ese líder (es lo único que puede afiliar).
  async crearAsesorIndividual(
    data: {
      email: string;
      nombres: string;
      apellidos: string;
      tipoDocumento: string;
      numeroDocumento: string;
      fechaNacimiento: Date;
      telefonoPrincipal: string;
      numeroYape: string;
      canal: Canal;
      direccion: { departamento: string; provincia: string; distrito: string; direccion: string; referencia?: string; pais?: string };
    },
    liderQueAfilia?: string,
  ) {
    const documentoExistente = await this.prisma.asesor.findUnique({ where: { numeroDocumento: data.numeroDocumento } });
    if (documentoExistente) {
      throw new BadRequestException(`Ya existe un asesor con documento ${data.numeroDocumento}.`);
    }

    const tarifa = await this.prisma.tarifa.findUnique({ where: { distrito: data.direccion.distrito } });
    if (!tarifa || !tarifa.activa) {
      throw new BadRequestException(`El distrito "${data.direccion.distrito}" no tiene tarifa activa (RF-007).`);
    }

    const claveTemporal = Math.random().toString(36).slice(-10);
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await bcrypt.hash(claveTemporal, 12),
        nombre: `${data.nombres} ${data.apellidos}`.trim(),
        rol: 'ASESOR',
      },
    });

    const asesor = await this.prisma.asesor.create({
      data: {
        userId: user.id,
        codigo: `AS-${Date.now()}`,
        apellidos: data.apellidos,
        tipoDocumento: data.tipoDocumento,
        numeroDocumento: data.numeroDocumento,
        fechaNacimiento: data.fechaNacimiento,
        telefonoPrincipal: data.telefonoPrincipal,
        numeroYape: data.numeroYape,
        canal: liderQueAfilia ? 'COMERCIO_MINORISTA' : data.canal,
        liderId: liderQueAfilia,
        direcciones: { create: { ...data.direccion, predeterminada: true } },
      },
      include: { direcciones: true },
    });

    await this.authService.iniciarActivacion(user.id, user.email, user.nombre);
    return asesor;
  }

  // Listado para el panel de administrador (alta/baja de asesores). Un
  // Lider solo ve a los suyos (liderIdPropio fuerza el filtro, ignorando
  // cualquier otro valor recibido).
  async listarAsesores(filtros?: { canal?: Canal; activo?: boolean; liderIdPropio?: string }) {
    return this.prisma.asesor.findMany({
      where: {
        canal: filtros?.liderIdPropio ? 'COMERCIO_MINORISTA' : filtros?.canal,
        liderId: filtros?.liderIdPropio,
        user: filtros?.activo !== undefined ? { activo: filtros.activo } : undefined,
      },
      include: {
        user: { select: { id: true, email: true, nombre: true, activo: true } },
        direcciones: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** RF-008: sube el Excel, valida SIN persistir, devuelve válidos/advertencias/errores fila por fila. */
  async previsualizarCargaMasiva(buffer: Buffer): Promise<{ validos: FilaAfiliacion[]; errores: ErrorFila[] }> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const hoja = workbook.worksheets[0];
    if (!hoja) throw new BadRequestException('El archivo no tiene hojas.');

    const encabezados = (hoja.getRow(1).values as any[]).map((v) => String(v ?? '').trim());
    const validos: FilaAfiliacion[] = [];
    const errores: ErrorFila[] = [];
    const documentosVistosEnArchivo = new Set<string>();

    for (let i = 2; i <= hoja.rowCount; i++) {
      const row = hoja.getRow(i);
      if (row.values.length === 0) continue;

      const obtener = (nombreCol: string) => {
        const idx = encabezados.indexOf(nombreCol);
        return idx >= 0 ? String(row.getCell(idx).value ?? '').trim() : '';
      };

      const fila: FilaAfiliacion = {
        fila: i,
        codigo_asesor: obtener('codigo_asesor'),
        nombres: obtener('nombres'),
        apellido_paterno: obtener('apellido_paterno'),
        apellido_materno: obtener('apellido_materno'),
        tipo_documento: obtener('tipo_documento'),
        numero_documento: obtener('numero_documento'),
        fecha_nacimiento: obtener('fecha_nacimiento'),
        telefono_principal: obtener('telefono_principal'),
        numero_yape: obtener('numero_yape'),
        correo: obtener('correo'),
        canal: obtener('canal'),
        codigo_lider: obtener('codigo_lider'),
        direccion_1: obtener('direccion_1'),
        departamento_1: obtener('departamento_1'),
        provincia_1: obtener('provincia_1'),
        distrito_1: obtener('distrito_1'),
        referencia_1: obtener('referencia_1'),
      };

      let filaValida = true;
      const marcarError = (campo: string, motivo: string) => {
        errores.push({ fila: i, campo, motivo });
        filaValida = false;
      };

      if (!fila.numero_documento) marcarError('numero_documento', 'Documento vacío.');
      else if (documentosVistosEnArchivo.has(fila.numero_documento)) marcarError('numero_documento', 'Documento duplicado dentro del archivo.');
      else documentosVistosEnArchivo.add(fila.numero_documento);

      if (fila.numero_documento) {
        const existe = await this.prisma.asesor.findUnique({ where: { numeroDocumento: fila.numero_documento } });
        if (existe) marcarError('numero_documento', 'Ya existe un asesor con este documento.');
      }

      if (!fila.nombres) marcarError('nombres', 'Nombres vacío.');
      if (!fila.numero_yape) marcarError('numero_yape', 'Número Yape vacío.');
      if (!fila.telefono_principal) marcarError('telefono_principal', 'Teléfono vacío.');
      if (!Object.values(Canal).includes(fila.canal as Canal)) marcarError('canal', `Canal "${fila.canal}" no reconocido.`);
      if (!fila.distrito_1) marcarError('distrito_1', 'Distrito vacío.');
      else {
        const tarifa = await this.prisma.tarifa.findUnique({ where: { distrito: fila.distrito_1 } });
        if (!tarifa || !tarifa.activa) marcarError('distrito_1', `Distrito "${fila.distrito_1}" sin tarifa activa.`);
      }
      if (!fila.fecha_nacimiento || isNaN(Date.parse(fila.fecha_nacimiento))) {
        marcarError('fecha_nacimiento', 'Formato de fecha inválido.');
      }

      if (filaValida) validos.push(fila);
    }

    return { validos, errores };
  }

  /** Confirma la importación: solo persiste las filas ya validadas por previsualizarCargaMasiva. */
  async confirmarCargaMasiva(filas: FilaAfiliacion[], actorId: string) {
    const creados = [];
    for (const fila of filas) {
      const claveTemporal = Math.random().toString(36).slice(-10);
      const user = await this.prisma.user.create({
        data: {
          email: fila.correo || `${fila.numero_documento}@pendiente.local`,
          passwordHash: await bcrypt.hash(claveTemporal, 12),
          nombre: `${fila.nombres} ${fila.apellido_paterno}`.trim(),
          rol: 'ASESOR',
        },
      });
      const asesor = await this.prisma.asesor.create({
        data: {
          userId: user.id,
          codigo: fila.codigo_asesor || `AS-${Date.now()}-${fila.fila}`,
          apellidos: fila.apellido_paterno + (fila.apellido_materno ? ` ${fila.apellido_materno}` : ''),
          tipoDocumento: fila.tipo_documento,
          numeroDocumento: fila.numero_documento,
          fechaNacimiento: new Date(fila.fecha_nacimiento),
          telefonoPrincipal: fila.telefono_principal,
          numeroYape: fila.numero_yape,
          canal: fila.canal as Canal,
          direcciones: {
            create: {
              departamento: fila.departamento_1,
              provincia: fila.provincia_1,
              distrito: fila.distrito_1,
              direccion: fila.direccion_1,
              referencia: fila.referencia_1,
              predeterminada: true,
            },
          },
        },
      });
      // Carga masiva: muchas filas no traen correo real (se les pone un
      // placeholder @pendiente.local, ver arriba) — no tiene sentido
      // intentar enviarles un correo de activación a esa dirección falsa.
      if (fila.correo) {
        await this.authService.iniciarActivacion(user.id, user.email, user.nombre);
      }
      creados.push(asesor);
    }

    await this.prisma.auditLog.create({
      data: {
        actorId,
        accion: 'CARGA_MASIVA_AFILIACION',
        entidad: 'Asesor',
        entidadId: 'lote',
        valoresDespues: { cantidad: creados.length },
      },
    });

    return { creados: creados.length };
  }
}
