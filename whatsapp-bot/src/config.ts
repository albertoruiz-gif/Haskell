import 'dotenv/config';

function requerido(nombre: string, valor: string | undefined): string {
  if (!valor) {
    // No tiramos error al importar (rompería el arranque en dev antes de
    // configurar nada); cada handler valida lo que necesita en el momento.
    // eslint-disable-next-line no-console
    console.warn(`[config] Falta la variable de entorno ${nombre} — configurala en .env`);
  }
  return valor ?? '';
}

export const config = {
  port: Number(process.env.PORT ?? 3100),

  whatsappAccessToken: requerido('WHATSAPP_ACCESS_TOKEN', process.env.WHATSAPP_ACCESS_TOKEN),
  whatsappPhoneNumberId: requerido('WHATSAPP_PHONE_NUMBER_ID', process.env.WHATSAPP_PHONE_NUMBER_ID),
  whatsappVerifyToken: requerido('WHATSAPP_VERIFY_TOKEN', process.env.WHATSAPP_VERIFY_TOKEN),
  whatsappGraphApiVersion: process.env.WHATSAPP_GRAPH_API_VERSION ?? 'v21.0',

  backendApiUrl: requerido('BACKEND_API_URL', process.env.BACKEND_API_URL),
  backendServiceKey: requerido('BACKEND_SERVICE_KEY', process.env.BACKEND_SERVICE_KEY),
};
