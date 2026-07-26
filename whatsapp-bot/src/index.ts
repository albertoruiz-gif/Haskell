import express, { Request, Response } from 'express';
import { config } from './config';
import { enviarMensajeTexto, marcarComoLeido } from './whatsappClient';
import { generarRespuesta } from './intentRouter';

const app = express();
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

/**
 * Verificacion del webhook (una sola vez, cuando lo configuras en Meta for
 * Developers > tu app > WhatsApp > Configuracion > Webhooks). Meta llama
 * GET con estos query params; si el token coincide, hay que devolver
 * exactamente el valor de hub.challenge en texto plano.
 */
app.get('/webhook', (req: Request, res: Response) => {
  const modo = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (modo === 'subscribe' && token === config.whatsappVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

/**
 * Mensajes entrantes. Respondemos 200 de inmediato (Meta reintenta si no
 * responde rapido) y procesamos/enviamos la respuesta por separado via
 * la Graph API (no es un request/response tipo HTTP normal).
 */
app.post('/webhook', async (req: Request, res: Response) => {
  res.sendStatus(200);

  try {
    const entry = req.body?.entry?.[0];
    const cambio = entry?.changes?.[0]?.value;
    const mensaje = cambio?.messages?.[0];

    if (!mensaje) return; // status updates (entregado/leido) u otros eventos, ignoramos

    const numeroWhatsapp: string = mensaje.from;

    if (mensaje.id) {
      marcarComoLeido(mensaje.id).catch(() => {});
    }

    if (mensaje.type !== 'text') {
      await enviarMensajeTexto(numeroWhatsapp, 'Por ahora solo puedo leer mensajes de texto 🙂. ¿Puedes escribirme tu consulta?');
      return;
    }

    const texto: string = mensaje.text?.body ?? '';
    const respuesta = await generarRespuesta(numeroWhatsapp, texto);
    await enviarMensajeTexto(numeroWhatsapp, respuesta);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhook] Error procesando mensaje entrante:', err);
  }
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`whatsapp-bot escuchando en :${config.port}`);
});
