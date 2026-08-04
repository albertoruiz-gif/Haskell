# Hasky — Agente IA de Chat en vivo (Odoo 19) · Diseño acordado

Fecha: 2026-08-02 · Estado: diseño cerrado, pendiente de implementación en Odoo

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Nombre | **Hasky** (voz: idea futura, Livechat de Odoo es solo texto) |
| Idioma / tono | Español, cordial-familiar, respuestas cortas |
| Información técnica | Sin restricción: puede dar descripción, beneficios, modo de uso y activos (info pública en el frasco y web de Brasil) |
| Ubicación del widget | Esquina inferior derecha, **toda la web** |
| Horario | 24/7 |
| Escalamiento | Por canal (definido 2026-08-03): Minorista → Líder de Equipo o Supervisor; Salones de Belleza y demás canales → Gerente Comercial. Cada operador requiere usuario de Odoo (asiento de pago). Etapa inicial: Alberto como único operador; al incorporar al equipo a Odoo se activa el enrutamiento por canal. |
| Compañía | Todo fijado a **Haskell_Distribuidor** (ID 2) |

## Fases

1. **Fase 1 — Productos (pública)**: consultas de catálogo, precios, presentaciones, disponibilidad. Requiere solo el catálogo cargado en Odoo.
2. **Fase 2 — Financiera (zona logueada de asesores)**: cobranzas pendientes y saldo de línea de crédito, cada asesor solo ve lo suyo. Requiere facturas y límites de crédito en Odoo + identificación del asesor en el chat.

## Registro de venta perdida (acordado 2026-08-02)

**Regla afinada 2026-08-03 (Variante A):** venta perdida = solo productos del catálogo Perú **sin stock** (lead "Venta perdida: [producto]", motivo "Sin stock Perú"). Productos/presentaciones que **no existen** en el catálogo Perú NO son venta perdida: se registran aparte como lead "Solicitud no disponible: [producto]" — señal de demanda para decidir futuras importaciones de Brasil.

Cuando un asesor pida un producto **sin stock** o **no disponible en Perú**, Hasky:
1. Pide **como máximo: nombre del asesor y producto** (cantidad si la ofrece espontáneamente). **Nunca pide datos de la clienta final.**
2. Crea una oportunidad en la app **CRM** y la marca como perdida con motivo:
   - "Sin stock Perú" (problema de reposición), o
   - "No disponible en Perú" (problema de surtido).
3. Queda con fecha, asesor, producto y cantidad → alimenta el KPI de ventas perdidas.

**Política de datos por canal (regla de negocio):**
- **Canal asesoras (venta directa):** la cartera de clientas es propiedad de la asesora. El CRM NO se explota comercialmente: el registro de venta perdida es solo estadístico (asesor + producto + cantidad), sin datos de la clienta final.
- **Canales Salones de Belleza y Retail:** el CRM SÍ se explota — los pedidos que llegan por los asesores de estos canales pueden registrar el cliente (salón/tienda), con seguimiento comercial completo.

En la práctica esto se configura separando los leads por **equipo de ventas/canal** en CRM, con captura de datos distinta por canal.

## Fase 3 — Asistente de cartera (canal Salones de Belleza y Retail)

Acordado 2026-08-02. Para asesores de Salones/Retail, Hasky además **escribe y consulta** la cartera del asesor:

**Registrar (con confirmación previa de Hasky antes de grabar):**
- Ventas futuras / acuerdos con el cliente (notas y actividades en la ficha del salón).
- Visitas programadas (actividades con fecha).
- Datos del cliente salón/tienda (contacto en CRM, asignado al asesor).

**Consultar (ejemplos):**
- "¿Cuál fue el acuerdo con mi cliente de la peluquería Rosita?"
- "¿Cuánto y qué le vendí la última vez?" (historial de pedidos)
- "¿Qué pagos pendientes tiene?" (facturas abiertas)
- "¿Cuánta línea de crédito disponible le queda?" (límite de crédito en la ficha)

**Condiciones de diseño:**
1. Solo en **zona logueada**: la identidad del asesor viaja al chat; las herramientas de Hasky filtran TODO por "clientes asignados a este asesor" (enforcement en la herramienta, no solo en el prompt). Un asesor nunca ve cartera ajena.
2. Toda escritura requiere confirmación explícita del asesor en el chat.
3. Depende de que pedidos/facturas del canal se registren en Odoo (integración web→Odoo ya planificada) y del campo límite de crédito configurado por cliente.

Indicador: reportes nativos de CRM por motivo de pérdida (por mes/producto/asesor); el backend de la web puede leerlos vía JSON-RPC (misma conexión ya probada, compañía Haskell_Distribuidor) para la pestaña de indicadores.

Requisitos: app CRM instalada (sin costo extra) + verificar en implementación que el agente IA puede crear registros (plan B nativo: paso guiado de chatbot que crea el lead).

## Contactos de escalamiento (definidos 2026-08-03)

| Cargo | Nombre | Email | WhatsApp |
|---|---|---|---|
| Gerente Comercial (Salones de Belleza y demás canales) | Rosalía Ruiz | rosiruiz0111@gmail.com | +51 960 997 929 |
| Líder de Equipo Minorista Zona 1 | Mercedes | mercedes@gmail.com | +51 996 138 672 |
| Líder de Equipo Minorista Zona 2 | Elí Nubelle | elinubelle@gmail.com | +51 992 196 590 |

Email automático: **PENDIENTE (pospuesto 2026-08-03 por decisión de Alberto).** Cuando se retome: 3 reglas de automatización en CRM (modo desarrollador → Técnico → Reglas de automatización), al crear lead con título que contenga "ESCALADO Minorista Zona 1" → Mercedes; "ESCALADO Minorista Zona 2" → Elí Nubelle; "ESCALADO" (general) → Rosalía (recibe copia de todo). Mientras tanto: Hasky da el WhatsApp del superior al asesor y el lead queda en CRM (Alberto lo ve como respaldo).

## Registro de clientes vía chat (acordado 2026-08-03)

- **Registrar (activo desde hoy, solo Salones de Belleza y Retail):** acuerdos, visitas programadas, pedidos futuros y datos del cliente (salón/tienda) — como leads con título "REGISTRO [cliente]: [tipo]", siempre con confirmación previa del asesor. Prohibido para canal Minorista (la cartera es de la asesora).
- **Consultar datos registrados (diferido):** deudas, acuerdos previos e historial NO se responden por el chat público — se activa cuando el widget viva en la zona logueada de la web (identidad verificada). Mientras tanto Hasky redirige al superior.

## Borrador de instrucciones (prompt) para Hasky

> Eres Hasky, el asistente virtual de Haskell Perú (Haskell_Distribuidor). Atiendes a asesoras y asesores de venta en español, con tono cercano y amable, respuestas breves y concretas.
>
> Puedes: buscar productos del catálogo Haskell (precios en soles, presentaciones, líneas, beneficios, modo de uso, activos) y responder preguntas frecuentes sobre pedidos y formas de pago (Yape).
>
> Reglas:
> 1. Nunca inventes precios, stock ni plazos: si no encuentras el dato en el sistema, dilo y ofrece pasar con una persona.
> 2. Nunca reveles información de un asesor a otro (pedidos, deudas, saldos).
> 3. Ante reclamos, problemas de pago o temas fuera del catálogo, transfiere la conversación al operador humano según el canal del asesor: canal Minorista → Líder de Equipo o Supervisor; los otros dos canales → Gerente Comercial. Si no sabes el canal del asesor, pregúntaselo antes de transferir.
> 4. Responde solo sobre productos y operaciones de Haskell_Distribuidor.
> 5. Si te preguntan por temas ajenos a Haskell, redirige con amabilidad.

## Checklist de implementación en Odoo (cuando toque)

1. Importar catálogo: `odoo_import_productos_haskell.xlsx` (este mismo folder) — 143 productos con SKU, PVP S/ (BRL×0.67×1.25), costo S/ (BRL×0.67), categorías y descripción completa. **Antes de importar: seleccionar compañía Haskell_Distribuidor arriba a la derecha.** Ruta: app Ventas → Productos → ⚙️ → Importar registros.
2. Instalar apps **Chat en vivo** e **IA** (menú Aplicaciones). Verificar saldo de créditos IA (Odoo IAP).
3. Crear el agente IA "Hasky" con el prompt de arriba; conectarle como fuentes el catálogo y las herramientas de búsqueda de productos.
4. Crear canal de Livechat, asignar a Hasky en las Reglas del canal, y a Alberto como operador de respaldo.
5. Probar dentro de Odoo (botón de prueba del canal) antes de publicar.
6. Copiar el snippet de incrustación del canal y agregarlo al frontend de la web (esquina inferior derecha, todas las páginas).

## Pendientes que condicionan la Fase 2

- Registrar facturas/cobranzas en Odoo (módulo Contabilidad).
- Configurar límite de crédito por asesor (ficha del cliente).
- Zona logueada de asesores en la web pasa identidad al chat.
- Usuarios Odoo para supervisores si se quiere escalamiento jerárquico real.
