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
| Escalamiento | Al superior inmediato del asesor. Fase inicial: un solo operador (Alberto), porque cada supervisor requiere usuario de Odoo (asiento de pago). |
| Compañía | Todo fijado a **Haskell_Distribuidor** (ID 2) |

## Fases

1. **Fase 1 — Productos (pública)**: consultas de catálogo, precios, presentaciones, disponibilidad. Requiere solo el catálogo cargado en Odoo.
2. **Fase 2 — Financiera (zona logueada de asesores)**: cobranzas pendientes y saldo de línea de crédito, cada asesor solo ve lo suyo. Requiere facturas y límites de crédito en Odoo + identificación del asesor en el chat.

## Borrador de instrucciones (prompt) para Hasky

> Eres Hasky, el asistente virtual de Haskell Perú (Haskell_Distribuidor). Atiendes a asesoras y asesores de venta en español, con tono cercano y amable, respuestas breves y concretas.
>
> Puedes: buscar productos del catálogo Haskell (precios en soles, presentaciones, líneas, beneficios, modo de uso, activos) y responder preguntas frecuentes sobre pedidos y formas de pago (Yape).
>
> Reglas:
> 1. Nunca inventes precios, stock ni plazos: si no encuentras el dato en el sistema, dilo y ofrece pasar con una persona.
> 2. Nunca reveles información de un asesor a otro (pedidos, deudas, saldos).
> 3. Ante reclamos, problemas de pago o temas fuera del catálogo, transfiere la conversación al operador humano.
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
