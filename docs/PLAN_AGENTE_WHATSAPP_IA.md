# Plan: agente de WhatsApp con IA — piloto Haskell → solución multi-cliente

Plan de trabajo, no código. Cubre cómo llevar el agente de WhatsApp de "prueba con Haskell,
gratis" a "producto reutilizable que se puede cobrar a terceros", sin comprometerse a la parte
multi-cliente antes de validar que el agente funciona bien con un solo cliente real.

## Decisiones ya tomadas (no se repiten en cada fase)

| Tema | Decisión |
|---|---|
| Conexión WhatsApp | Migrar el número real de WhatsApp Business de Haskell a **Meta Cloud API** (oficial). Cero riesgo de baneo, sigue sin costo de plataforma (solo plantillas fuera de ventana de 24h). Se pierde el uso simultáneo del número en el teléfono. |
| Modelo de lenguaje | Autoalojado con **Ollama** — sin costo por token. Empezar **solo con CPU** (Qwen 7B o Mistral 7B cuantizado); pedir cuota de GPU en AWS únicamente si medimos que la latencia no alcanza. |
| Embeddings | Autoalojados con Ollama (**bge-m3**, mejor en español; `nomic-embed-text` como alternativa liviana). Nada de AWS Bedrock ni servicio pago — rompería la premisa de "gratis". |
| Almacén vectorial | **pgvector** sobre el Postgres que el backend ya usa — no se suma infraestructura nueva. |
| Nube | Todo en la **misma cuenta de AWS** donde ya vive la web de Haskell (que tiene prioridad) — evita una segunda cuenta, credenciales duplicadas, y costo/latencia de cruzar de nube (Azure quedó técnicamente empatado para este caso, así que no se justifica separar). |
| Servidor del agente | Instancia EC2 **aparte** del clúster EKS de la web (para no competir por recursos con backend/frontend). |
| Alcance funcional | Catálogo (precio, código, nombre o "algo que cubra una necesidad" → búsqueda semántica), políticas de devolución, estado de pedido, y si está al día en pagos (esto último depende de Odoo real, ver riesgos). |
| Reutilización | El motor del agente (Ollama + RAG + orquestación) se separa de los datos de cada cliente (empresa, WhatsApp, Odoo, base de conocimiento) desde el diseño, aunque el wizard multi-cliente se construya recién en la Fase 2. |
| Monetización futura | Servidor dedicado + reporte de uso para cobrar a terceros — pendiente de Fase 3, con asesoría legal antes de firmar el primer cliente externo (no lo resuelve el código). |

## Lo que ya existe (fundación construida antes de este plan)

No se descarta, se amplía:

- `backend/src/modules/integraciones/` — `ServiceKeyGuard` + `GET /integraciones/whatsapp/pedido`, autenticación servicio-a-servicio (header `x-service-key`) para que el bot consulte pedidos sin JWT de usuario.
- `whatsapp-bot/` — microservicio Express/TypeScript aparte: webhook de Meta (verificación + recepción), cliente de envío vía Graph API, router de intención **por palabras clave** (FAQ estático + estado de pedido).

Lo que hoy es una regla simple de palabras clave, en la Fase 1 se reemplaza por clasificación de
intención + recuperación semántica (RAG) + generación con el LLM local — la estructura de
webhook/envío/endpoint de integración no cambia, solo el "cerebro" de `intentRouter.ts`.

## Fase 1 — Piloto Haskell, gratis, un solo cliente

Objetivo: validar que el agente responde bien, en menos de 10 segundos, a los ~30 usuarios de
Haskell, antes de invertir en la parte reutilizable.

1. **Migración WhatsApp**: seguir el flujo oficial de Meta para pasar el número actual de
   Haskell a Cloud API (Meta for Developers > WhatsApp > migrar número existente).
2. **Servidor del agente**: una instancia EC2 solo CPU (sin pedir cuota GPU todavía) con Docker,
   corriendo Ollama con el modelo de chat + el modelo de embeddings.
3. **Base de conocimiento inicial**:
   - Catálogo: los 143 productos ya traducidos (`productos_haskell.xlsx` / `CatalogLine` en
     Postgres) se indexan como embeddings — resuelve búsqueda por nombre, código, precio o
     necesidad ("algo para el frizz").
   - Políticas de devolución: **falta que las redactes o me las pases** — hoy solo existen
     placeholders en `whatsapp-bot/src/faqData.ts`.
   - FAQ general: ya redactado (horarios, pago, envíos) — falta completar los datos reales
     (horario real, política real) donde el archivo dice `[COMPLETAR]`.
4. **pgvector**: activar la extensión en el Postgres existente, tabla de embeddings con
   referencia a cada producto/documento fuente.
5. **Estado de pedido + Odoo**: el estado interno (pagado, en camino, etc.) ya está resuelto por
   el endpoint existente. "Si está al día en pagos" contra Odoo **no puede funcionar con datos
   reales todavía** — `ODOO_API_KEY` está vacío y falta el mapeo SKU↔Odoo (son TODOs ya
   documentados en el código, no nuevos). El bot puede responder con el estado interno mientras
   tanto, dejando la pregunta de pagos para cuando Odoo esté conectado de verdad.
6. **Reemplazo del router de intención**: intención (FAQ / catálogo / estado de pedido) +
   recuperación semántica sobre pgvector + respuesta generada por el modelo local, en vez de
   coincidencia de palabras clave.
7. **Medición**: correr tráfico de prueba real y medir tiempo de respuesta. Si CPU no alcanza los
   ~10 segundos aceptados, recién ahí se pide la cuota de GPU en AWS (Service Quotas, con 1-2
   semanas de margen).

**Lo que necesito de ti para arrancar esta fase**: el contenido real de la política de
devoluciones y los datos reales de FAQ (horario, etc.); confirmación de que puedes iniciar la
migración del número de WhatsApp de Haskell a Cloud API; y, cuando quieras avanzar con Odoo real,
las credenciales del usuario técnico (no las voy a pedir para tipearlas yo, las cargas tú
directamente igual que Culqi).

## Fase 2 — Preparar la reutilización (wizard multi-cliente), aún sin cobrar

No se activa hasta que la Fase 1 esté funcionando bien. Objetivo: que agregar un cliente nuevo
sea configuración, no código nuevo.

1. **Separar motor de datos**: el "motor" (conexión a Ollama, orquestador RAG, cliente de
   WhatsApp) pasa a leer todo lo específico de cada cliente desde un registro de configuración
   (tenant), no desde archivos fijos como `faqData.ts` hoy.
2. **Wizard de onboarding**, cinco pasos:
   - Datos de la empresa (nombre, rubro, tono de voz, idioma, horario, contacto de escalamiento).
   - Conexión WhatsApp (cada cliente con su propio número/credenciales Cloud API — el webhook ya
     enruta por `phone_number_id`, que es distinto por número).
   - Conexión Odoo opcional, con un paso de **prueba de conexión** antes de activar (valida que
     existan los modelos/campos que el bot necesita).
   - Carga de base de conocimiento (catálogo, políticas, FAQ) — se procesa a embeddings sola.
   - Revisión y activación.
3. **Aislamiento de datos por cliente** en pgvector (columna `tenant_id` o esquema separado) —
   que la respuesta a un cliente jamás use contenido de otro.
4. **Enrutamiento del webhook** por `phone_number_id` hacia la configuración del cliente
   correspondiente.

## Fase 3 — Productizar y cobrar a terceros

1. Servidor dedicado (deja de ser "gratis"), dimensionado para varios clientes concurrentes —
   recién ahí se evalúa GPU en serio según el volumen real acumulado.
2. Credenciales de Odoo por cliente cifradas de forma individual (ej. una entrada por cliente en
   AWS Secrets Manager) — nunca un `.env` compartido como en la Fase 1.
3. Reporte de uso (mensajes/tokens por cliente) para poder facturar.
4. **Antes de firmar el primer cliente externo**: términos de servicio y un acuerdo de
   tratamiento de datos con asesoría legal real — al procesar los datos de los clientes de tus
   clientes pasas a ser responsable de ese tratamiento, y esto no lo resuelve el wizard ni el
   código. Te lo señalo para que lo veas con un abogado, no es algo que yo pueda redactar de
   forma vinculante.

## Riesgos abiertos a vigilar

- **Odoo por cliente**: usuario técnico de solo lectura y acotado a los modelos necesarios,
  nunca el usuario administrador del cliente — esto aplica ya desde que Haskell conecte Odoo
  real, no solo en la Fase 3.
- **Límite de tasa de Odoo Online**: cachear respuestas cortas en vez de consultar en vivo en
  cada mensaje, para no toparse con el límite con varios clientes activos.
- **Latencia con CPU**: si el modelo de 7B no llega a los ~10 segundos en la práctica, la cuota
  de GPU en AWS tarda de 1 a 3 días hábiles en aprobarse (a veces más en cuentas nuevas) —
  pedirla con margen, no el mismo día que se necesita.
