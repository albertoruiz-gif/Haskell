import axios from 'axios';
import { config } from './config';

export type RespuestaPedido =
  | {
      encontrado: true;
      referenciaWeb: string;
      estado: string;
      estadoEs: string;
      totalCulqi: number;
      creadoEn: string;
      pagadoEn: string | null;
      entrega: { estado: string; receptor: string | null } | null;
    }
  | { encontrado: false; motivo: 'telefono_invalido' | 'asesor_no_encontrado' | 'pedido_no_encontrado' };

/** Consulta el endpoint interno del backend (protegido con x-service-key). */
export async function consultarPedido(telefono: string, referencia?: string): Promise<RespuestaPedido> {
  const { data } = await axios.get<RespuestaPedido>(`${config.backendApiUrl}/integraciones/whatsapp/pedido`, {
    params: { telefono, referencia },
    headers: { 'x-service-key': config.backendServiceKey },
  });
  return data;
}
