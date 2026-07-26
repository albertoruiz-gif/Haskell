# whatsapp-bot — Bot de WhatsApp para Haskell

Microservicio aparte (no toca `backend/` ni `frontend/`) que responde por WhatsApp: FAQ general
(horarios, pago, envíos, cambios) y estado de pedido, consultando el backend de la plataforma.

## Qué hace y qué no

Hace: responde preguntas frecuentes con texto fijo (editable en `src/faqData.ts`) y consulta el
estado de un pedido por el número de WhatsApp del que escribe (busca al asesor por teléfono en
la base de datos, vía un endpoint interno del backend).

No hace (fuera de alcance de esta primera versión): no muestra catálogo/precios, no toma pedidos
nuevos por chat. Si más adelante quieres sumar eso, es una extensión de `src/intentRouter.ts`.

## 1. Crear la app en Meta for Developers (modo sandbox/prueba, gratis)

1. Entra a [developers.facebook.com](https://developers.facebook.com/), crea una cuenta de
   desarrollador si no tienes, y crea una App nueva de tipo **Negocio**.
2. Dentro de la app, agrega el producto **WhatsApp**.
3. Se abre el panel **WhatsApp > Configuración de la API**. Ahí Meta te da automáticamente,
   sin pedirte nada más:
   - Un **número de teléfono de prueba** (el remitente del bot).
   - Un **Id de número de teléfono** (`WHATSAPP_PHONE_NUMBER_ID`).
   - Un botón **Generar token de acceso** → copia ese valor a `WHATSAPP_ACCESS_TOKEN`.
     Dura ~24 horas; mientras estés probando, cada vez que expire vuelves a este panel y generas
     uno nuevo. Para producción real se reemplaza por un token permanente de un "System User"
     (eso ya es un paso posterior, cuando tengas Meta Business verificado).
4. En la misma pantalla, en la sección de número **destinatario de prueba**, agrega tu propio
   número de WhatsApp (o hasta 5 números) para poder probar — Meta exige verificarlos ahí antes
   de que el bot les pueda escribir.

## 2. Configurar el Verify Token

Inventa cualquier string (ej. `haskell-bot-2026-verify`) y ponlo en `WHATSAPP_VERIFY_TOKEN` en tu
`.env`. Este valor lo vas a repetir manualmente en el panel de Meta en el paso 4 — tiene que ser
idéntico en ambos lados.

## 3. Desplegar el bot para tener una URL pública HTTPS

Meta **exige** una URL HTTPS pública para el webhook — no acepta `localhost`. La forma más rápida
sin instalar nada extra es desplegar este servicio en Railway (u otro hosting): Railway te da un
dominio HTTPS apenas conectas el repo, sin configurar certificados.

Variables de entorno a cargar en el hosting (mismas que en `.env.example`):
`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_GRAPH_API_VERSION`, `BACKEND_API_URL` (la URL pública de tu backend NestJS),
`BACKEND_SERVICE_KEY` (debe ser igual a `WHATSAPP_BOT_SERVICE_KEY` en el backend).

Alternativa para probar en tu máquina sin desplegar todavía: un túnel como ngrok
(`ngrok http 3100`) te da una URL HTTPS temporal apuntando a tu `localhost:3100`.

## 4. Configurar el Webhook en Meta

En **WhatsApp > Configuración > Webhooks**:

1. Click en **Editar** junto a Callback URL.
2. **Callback URL**: `https://tu-dominio/webhook`.
3. **Verify token**: el mismo string que pusiste en `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verificar y guardar** — Meta le pega un GET a tu `/webhook`; si tu servicio ya está
   corriendo y el token coincide, se verifica solo (ver `src/index.ts`, ruta `GET /webhook`).
5. Debajo, en **Campos del Webhook**, suscríbete a **messages**.

## 5. Correr en local

```bash
npm install
cp .env.example .env   # completa los valores
npm run dev
```

## 6. Probar

Desde el número que agregaste como "destinatario de prueba" en el paso 1, escríbele al número de
prueba de Meta. Prueba con:

- `"horarios"` → respuesta de FAQ.
- `"estado de mi pedido"` → busca tu Asesor por el número desde el que escribes y responde con
  el pedido más reciente. Si tu número de WhatsApp de prueba no coincide con ningún
  `telefonoPrincipal`/`telefonoSecundario` real en la base de datos, vas a recibir el mensaje de
  "no encuentro una cuenta registrada" — es esperado en pruebas, revisa/actualiza un Asesor de
  prueba con ese número para validar el flujo completo.

## Notas de seguridad

`WHATSAPP_ACCESS_TOKEN` y `BACKEND_SERVICE_KEY` son credenciales — nunca las subas al repo (el
`.gitignore` ya excluye `.env`). El endpoint que este bot consume en el backend
(`GET /integraciones/whatsapp/pedido`) está protegido por `ServiceKeyGuard`: solo responde si el
header `x-service-key` coincide con `WHATSAPP_BOT_SERVICE_KEY` del backend — no hay JWT de
usuario porque quien llama es este microservicio, no una persona logueada.
