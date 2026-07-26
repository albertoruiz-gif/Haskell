import { consultarPedido } from './backendClient';
import { faqEntries, respuestaNoEntendido } from './faqData';

const PALABRAS_ESTADO_PEDIDO = ['pedido', 'orden', 'estado', 'compra', 'delivery', 'entrega'];

const RANGO_DIACRITICOS = new RegExp('[\\u0300-\\u036f]', 'g');

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(RANGO_DIACRITICOS, ''); // saca tildes para el match de palabras clave
}

/** Busca en el mensaje algo que parezca una referencia de pedido (token
 * alfanumerico largo, ej. parte de un cuid) para pedir un pedido puntual
 * en vez del mas reciente. */
function extraerPosibleReferencia(texto: string): string | undefined {
  const tokens = texto.split(/\s+/);
  return tokens.find((t) => /^[a-z0-9]{8,}$/i.test(t) && /[0-9]/.test(t) && /[a-z]/i.test(t));
}

function esConsultaDeEstado(textoNormalizado: string): boolean {
  return PALABRAS_ESTADO_PEDIDO.some((p) => textoNormalizado.includes(p));
}

function buscarFaq(textoNormalizado: string): string | undefined {
  const match = faqEntries.find((entry) =>
    entry.palabrasClave.some((palabra) => textoNormalizado.includes(normalizarTexto(palabra))),
  );
  return match?.respuesta;
}

/** Devuelve el texto de respuesta para un mensaje entrante. `numeroWhatsapp`
 * es el wa_id que manda Meta (con codigo de pais, sin '+'). */
export async function generarRespuesta(numeroWhatsapp: string, textoOriginal: string): Promise<string> {
  const textoNormalizado = normalizarTexto(textoOriginal);

  if (esConsultaDeEstado(textoNormalizado)) {
    return responderEstadoPedido(numeroWhatsapp, textoOriginal);
  }

  const respuestaFaq = buscarFaq(textoNormalizado);
  if (respuestaFaq) return respuestaFaq;

  return respuestaNoEntendido;
}

async function responderEstadoPedido(numeroWhatsapp: string, textoOriginal: string): Promise<string> {
  const referencia = extraerPosibleReferencia(textoOriginal);

  try {
    const resultado = await consultarPedido(numeroWhatsapp, referencia);

    if (!resultado.encontrado) {
      switch (resultado.motivo) {
        case 'asesor_no_encontrado':
          return 'No encuentro una cuenta registrada con este número de WhatsApp. ' +
            'Si te registraste con otro número, escríbenos desde ese, o contactamos a un asesor.';
        case 'pedido_no_encontrado':
          return 'No encuentro pedidos asociados a tu cuenta todavía.';
        default:
          return 'No pude validar tu número. ¿Puedes escribirlo de nuevo o hablar con un asesor?';
      }
    }

    const partes = [
      `Pedido ${resultado.referenciaWeb}`,
      `Estado: ${resultado.estadoEs}`,
      `Total: S/ ${resultado.totalCulqi.toFixed(2)}`,
    ];
    if (resultado.entrega) {
      partes.push(`Entrega: ${resultado.entrega.estado}`);
    }
    return partes.join('\n');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[intentRouter] Error consultando el backend:', err);
    return 'Tuve un problema consultando tu pedido. Intenta de nuevo en unos minutos, o pide hablar con un asesor.';
  }
}
