/**
 * Base de FAQ editable por palabras clave. Los textos de respuesta son
 * PLACEHOLDER — reemplazalos por las politicas reales de Haskell/tu
 * operacion antes de publicar el bot (horarios reales, politica de cambios
 * real, etc.). El match es simple: si el mensaje del cliente contiene
 * alguna de las `palabrasClave`, se responde con `respuesta`.
 */
export type FaqEntry = {
  id: string;
  palabrasClave: string[];
  respuesta: string;
};

export const faqEntries: FaqEntry[] = [
  {
    id: 'horarios',
    palabrasClave: ['horario', 'horarios', 'atencion', 'atienden'],
    respuesta:
      'Nuestro horario de atención es [COMPLETAR: ej. lunes a sábado de 9:00 a 19:00]. ' +
      'Fuera de ese horario, tu mensaje queda registrado y te respondemos apenas abrimos.',
  },
  {
    id: 'pago',
    palabrasClave: ['pago', 'pagar', 'yape', 'tarjeta', 'como pago'],
    respuesta:
      'Por ahora el pago se confirma por Yape: realizas el Yape y un asesor valida el pago manualmente. ' +
      'Pronto sumaremos pago directo con tarjeta.',
  },
  {
    id: 'envios',
    palabrasClave: ['envio', 'envios', 'entrega', 'demora', 'cuanto tarda', 'delivery'],
    respuesta:
      'El tiempo de entrega depende de tu distrito — se calcula al armar tu pedido. ' +
      'Si ya tienes un pedido en curso, escribe "estado de mi pedido" y te digo en qué va.',
  },
  {
    id: 'cambios',
    palabrasClave: ['cambio', 'cambios', 'devolucion', 'devolver', 'defectuoso'],
    respuesta:
      '[COMPLETAR: política real de cambios y devoluciones]. ' +
      'Si tu producto llegó con algún problema, cuéntanos qué pasó y un asesor te ayuda.',
  },
  {
    id: 'contacto_humano',
    palabrasClave: ['asesor', 'persona', 'humano', 'hablar con alguien', 'ayuda'],
    respuesta:
      'Te conecto con un asesor en breve. Mientras tanto, contame brevemente qué necesitas para que lo tenga listo.',
  },
];

export const respuestaNoEntendido =
  'No estoy seguro de haber entendido tu mensaje 🙂. Puedo ayudarte con: horarios, medios de pago, envíos, ' +
  'cambios/devoluciones, o el estado de un pedido (escribe "estado de mi pedido"). ¿Sobre cuál quieres saber?';
