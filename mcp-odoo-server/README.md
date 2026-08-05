# hasky-odoo-mcp

Servidor MCP standalone que expone Odoo (Haskell_Distribuidor) como *tools* que
cualquier cliente MCP puede llamar: Claude Desktop, Claude Code, Cowork, o el
propio agente Hasky si Odoo IA soporta MCP externo en el futuro.

Usa el mismo protocolo JSON-RPC que `backend/src/modules/odoo/odoo.client.ts`,
reimplementado sin NestJS para poder correr como proceso independiente.

## Tools que expone

| Tool | Qué hace |
|---|---|
| `buscar_productos` | Busca productos por nombre o código (default_code) |
| `consultar_stock` | Consulta stock disponible por ids de producto |
| `registrar_venta_perdida` | Crea un lead en CRM (Variante A del diseño de Hasky) |

## 1. Instalar

```bash
cd mcp-odoo-server
npm install
```

> Si esta carpeta ya trae un `node_modules` (por ejemplo, quedó uno a medio
> instalar desde una verificación previa), borralo primero a mano antes de
> `npm install` para evitar errores tipo `ENOTEMPTY`.

## 2. Configurar credenciales

```bash
cp .env.example .env
```

Completar `.env` con los mismos valores que usa el backend (`plataforma/odoo`
en AWS Secrets Manager, o tu `.env` local de `backend/`):

- `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`, `ODOO_COMPANY_ID`

**El `.env` nunca se commitea** — ya está en el patrón de `.gitignore` del repo,
verificalo si creás este archivo desde cero.

## 3. Compilar

```bash
npm run build
```

Esto genera `dist/index.js`. Cualquier error de tipos aparece acá antes de
intentar conectarlo a un cliente MCP.

## 4. Probar suelto, sin un cliente MCP todavía

El servidor habla por stdio, así que ejecutarlo directo (`node dist/index.js`)
se queda "colgado" esperando mensajes — es el comportamiento esperado, no un
error. Para probarlo de forma interactiva usá el **MCP Inspector**:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

Abre una UI en el navegador donde podés listar las tools y ejecutarlas a mano
(por ejemplo `buscar_productos` con `termino: "Shampoo"`) para confirmar que
llega a Odoo y devuelve datos reales antes de conectarlo a un asistente.

## 5. Registrar el servidor en un cliente MCP

### Claude Code (este entorno de desarrollo)

```bash
claude mcp add hasky-odoo -- node /ruta/absoluta/a/mcp-odoo-server/dist/index.js
```

O editando `.mcp.json` en la raíz del proyecto:

```json
{
  "mcpServers": {
    "hasky-odoo": {
      "command": "node",
      "args": ["/ruta/absoluta/a/mcp-odoo-server/dist/index.js"],
      "env": {
        "ODOO_URL": "...",
        "ODOO_DB": "...",
        "ODOO_USERNAME": "...",
        "ODOO_API_KEY": "...",
        "ODOO_COMPANY_ID": "2"
      }
    }
  }
}
```

### Claude Desktop

Editar `claude_desktop_config.json` (Configuración → Developer → Edit Config)
con el mismo bloque `mcpServers` de arriba, y reiniciar la app.

## 6. Probar end-to-end

Con el servidor registrado, preguntale a Claude algo que solo pueda responder
llamando a la tool, por ejemplo: *"Buscá en Odoo el stock del Shampoo Reconstrutor"*.
Si Claude invoca `buscar_productos` y `consultar_stock` y te devuelve datos
reales (no inventados), quedó conectado correctamente.

## Alcance actual y siguientes pasos

- Hoy es de solo-lectura salvo `registrar_venta_perdida` (a propósito: acota
  la superficie de escritura al único caso ya diseñado para Hasky).
- Antes de sumar más tools de escritura (crear pedidos, facturas, etc.),
  definir explícitamente qué puede escribir un asistente de IA sin
  confirmación humana — mismo criterio que ya se usó para Hasky Fase 3
  (`HASKY_agente_livechat_diseno.md`: toda escritura requiere confirmación
  explícita del asesor).
- El `apiKey` de este `.env` tiene los mismos permisos que el usuario técnico
  de Odoo — no hay aislamiento adicional a nivel de modelo/campo más allá de
  lo que ya impone el rol de ese usuario en Odoo.
