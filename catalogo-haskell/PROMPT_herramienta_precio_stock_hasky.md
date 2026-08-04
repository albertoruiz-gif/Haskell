# Prompt para Claude Code (VS Code) — Herramienta de precio/stock para Hasky (Odoo)

Copia y pega esto en Claude Code. Esta tarea es sobre Odoo directamente (vía su API externa) — no requiere tocar el repo de la plataforma web, aunque puedes ejecutarla desde cualquier proyecto con acceso a Python y a la API de Odoo.

---

## Contexto

Hasky es un agente de IA nativo de Odoo (Live Chat), configurado en Ajustes → IA → Agentes. Atiende a asesoras y asesores de venta de Haskell Perú. Ya tiene bien resuelta la identificación de productos (usa una Fuente/documento indexado con el catálogo). El problema confirmado: sus Temas activados hoy son solo "Natural Language Search", "Information retrieval" y "Create Leads" — ninguno consulta datos en vivo de `product.template` (precio, stock). Por eso, aunque identifica perfecto el producto y su código HSK-xxxx, nunca puede confirmar el precio: no tiene ninguna Herramienta conectada para eso.

## Objetivo de esta tarea

Crear una Herramienta (Acción de Servidor marcada para uso en IA) que Hasky pueda invocar para consultar precio y stock de un producto por su código HSK-xxxx, y conectarla al agente.

## Restricción técnica — igual que en las tareas anteriores

Odoo Online (SaaS): no se instalan módulos Python. Todo se crea como configuración vía API externa (XML-RPC o JSON-RPC) sobre `ir.actions.server` (tipo "Execute Code").

## Antes de construir — verifica, no asumas

1. Confirma en esta instancia de Odoo (19, según la config vista) cuál es el mecanismo exacto para marcar una Acción de Servidor como "Usar en IA" / disponible como Herramienta para un Agente — el nombre del campo o la relación puede variar según versión/módulos instalados. Revísalo en el modelo (`ir.actions.server` o el modelo de agentes de IA) antes de escribir código.
2. Confirma cómo un Agente de IA en esta instancia asocia Herramientas a Temas (si una Herramienta se cuelga directo de un Tema existente, o si hace falta crear un Tema nuevo tipo "Consulta de producto").

## Qué construir

1. Acción de Servidor (Python) que reciba como parámetro el código HSK-xxxx (o el nombre exacto del producto) y devuelva: nombre del producto, código, **todas** las presentaciones/variantes relacionadas si el producto pertenece a una misma línea con distintos tamaños (ej. 120 ml y 300 ml — Hasky ya tiene instrucción de mostrarlas todas), Precio de venta (`list_price`), y stock disponible (`qty_available`).
2. Filtra siempre por la compañía Haskell_Distribuidor.
3. Regla dura, no negociable: la respuesta de esta herramienta **nunca** debe incluir `standard_price` (Coste) — ni como campo devuelto, ni oculto, ni de ninguna forma. Es información interna que el asesor no debe poder ver, y si el modelo la recibe, existe riesgo de que la repita.
4. Conecta esta Acción de Servidor como Herramienta disponible para el agente Hasky (dentro de un Tema existente o uno nuevo, según lo que confirmes en el paso "Antes de construir").
5. Prueba en el chat de prueba de Hasky (botón "Prueba") preguntando por HSK-0017 ("Champu Cachos Si! 300 ml") y confirma que esta vez sí devuelve un precio real.

## Al terminar, reporta

- Cómo quedó estructurada la Acción de Servidor (nombre, ID, y qué modelo/campo la marca como Herramienta de IA en esta versión de Odoo).
- A qué Tema quedó asociada.
- Resultado de la prueba con HSK-0017.
- Si detectaste alguna limitación (ej. que esta versión de Odoo no soporte Herramientas custom de esta forma), repórtalo en vez de forzar una solución que no encaje — en ese caso, dime cuál sería la alternativa real disponible.
