import axios from 'axios';
import { config } from './config';

/** Envia un mensaje de texto simple via Graph API (WhatsApp Cloud API). */
export async function enviarMensajeTexto(paraNumero: string, texto: string): Promise<void> {
  const url = `https://graph.facebook.com/${config.whatsappGraphApiVersion}/${config.whatsappPhoneNumberId}/messages`;

  try {
    await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        to: paraNumero,
        type: 'text',
        text: { body: texto },
      },
      { headers: { Authorization: `Bearer ${config.whatsappAccessToken}` } },
    );
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[whatsappClient] Error enviando mensaje:', err.response?.data ?? err.message);
  }
}

/** Marca un mensaje entrante como leido (check azul) — opcional, mejora UX. */
export async function marcarComoLeido(messageId: string): Promise<void> {
  const url = `https://graph.facebook.com/${config.whatsappGraphApiVersion}/${config.whatsappPhoneNumberId}/messages`;
  try {
    await axios.post(
      url,
      { messaging_product: 'whatsapp', status: 'read', message_id: messageId },
      { headers: { Authorization: `Bearer ${config.whatsappAccessToken}` } },
    );
  } catch {
    // No es critico si falla — no bloquea la respuesta al usuario.
  }
}
