# Arquitectura

Monolito modular con frontend y backend separados lógicamente (según RFD 9.1), contenedorizado y desplegado en Kubernetes sobre AWS.

```
┌──────────────┐      HTTPS       ┌───────────────────┐      HTTPS       ┌────────────────┐
│   Asesores/   │ ───────────────▶│  Frontend Next.js  │ ───────────────▶│  Backend NestJS │
│  Gerencia/    │◀─────────────── │  (catálogo, carrito,│◀───────────────│  (API REST,     │
│  Almacén (web)│                 │   backoffice, PWA)  │                 │   reglas,       │
└──────────────┘                 └───────────────────┘                 │   integraciones)│
                                                                          └───────┬────────┘
                                                                                  │
                                                    ┌─────────────────────────────┼───────────────────────────┐
                                                    │                             │                            │
                                                    ▼                             ▼                            ▼
                                          ┌───────────────────┐        ┌──────────────────┐        ┌─────────────────────┐
                                          │  PostgreSQL (RDS)  │        │  Odoo 19 Online   │        │  Culqi Checkout      │
                                          │  datos web,         │        │  JSON-RPC/XML-RPC │        │  Custom (Yape)        │
                                          │  campañas, pedidos   │        │  productos, stock, │        │  tokenización + cargo │
                                          └───────────────────┘        │  ventas, CPE,      │        └─────────────────────┘
                                                                        │  picking            │
                                                                        └──────────────────┘
```

## Por qué esta arquitectura

- **Monolito modular, no microservicios** — así lo fija el RFD (2.4, 9.1) para el MVP; los módulos backend (identidad, campañas, comercio, pagos, operaciones, integración, analítica) están separados por carpeta/dominio dentro de un mismo servicio NestJS, lo que permite partirlos en microservicios más adelante sin reescribir la lógica de negocio.
- **PostgreSQL como fuente web**, Odoo como fuente de productos/stock/ventas confirmadas/comprobantes — evita duplicar la lógica de inventario y contabilidad, tal como exige RN-028.
- **Culqi Checkout Custom** — el frontend solo tokeniza (llave pública), el backend ejecuta el cargo con la llave privada (nunca sale del servidor), cumpliendo RF-018/RF-019/RNF-005.

## Integración con Odoo 19 Online

**Decisión: la web consulta y escribe en Odoo mediante la API externa JSON-RPC/XML-RPC (JSON-2) de Odoo, con un usuario técnico y API key.** Se descartan los webhooks salientes de Odoo porque Odoo Online (sin Odoo.sh) no permite instalar módulos con código personalizado que disparen eventos hacia afuera — solo expone la API externa estándar. Si más adelante se migra a Odoo.sh, se puede añadir un módulo que dispare webhooks para casos donde Odoo sea el originador del evento (ej. ajuste manual de stock hecho directo en Odoo).

| Objeto web | Modelo Odoo | Dirección | Método |
|---|---|---|---|
| Asesor/cliente | `res.partner` | Web → Odoo | `create` / `write` |
| Producto | `product.template`, `product.product` | Odoo → Web | `search_read` (sync periódico) |
| Stock | `stock.quant` | Odoo → Web | `search_read` (consulta en caliente antes de pagar) |
| Pedido | `sale.order`, `sale.order.line` | Web → Odoo | `create` tras pago aprobado |
| Comprobante | `account.move` | Odoo → Web | `search_read` (referencia y descarga) |
| Picking | `stock.picking`, `stock.move` | Bidireccional | `search_read` + `write` (confirmar picking) |
| CRM (si aplica a prospección de asesores) | `crm.lead`, `crm.stage` | Web → Odoo | `create` / `write` |
| Cobranzas | `account.payment` | Odoo → Web | `search_read` (conciliación) |

El cliente Odoo (`backend/src/modules/odoo/odoo.client.ts`) implementa `authenticate`, `searchRead`, `create`, `write` genéricos sobre JSON-RPC — cualquier modelo nuevo se integra sin tocar el transporte.

### Accesibilidad de red

Odoo Online es SaaS con endpoint HTTPS público (`https://<tu-instancia>.odoo.com/jsonrpc`) — **no requiere VPN ni bastión**. El backend se conecta por salida HTTPS estándar desde los pods de EKS. Si en el futuro configurás IP allowlisting en Odoo, hay que salir por una IP fija: se resuelve con un NAT Gateway único para el clúster (documentado en `DESPLIEGUE_AWS.md`) y no cambia el código de la API.

### Reintentos y consistencia

Toda llamada a Odoo pasa por una cola de reintentos (RF-035): si Odoo no responde, el evento queda pendiente con motivo visible y se reintenta sin duplicar (idempotencia por `referenciaWeb` única en `sale.order`).

## Módulos backend (NestJS)

| Módulo | Responsabilidad | RFD |
|---|---|---|
| `pricing` | Cálculo de precio asesor (% configurable), total Culqi, redondeo | RN-008 a RN-010 (adenda) |
| `campaigns` | Campañas, catálogos por canal, versiones, aprobación, ofertas temporales | RF-040 a RF-050 |
| `catalog` | Catálogo publicado visible por canal, búsqueda, disponibilidad | RF-011 a RF-013 |
| `odoo` | Cliente JSON-RPC genérico + mapeos por modelo | 8.2 |
| `orders` | Carrito → pedido, snapshot histórico de precios | RF-014 a RF-022 |
| `payments` | Culqi Checkout Custom, idempotencia, estados de pago | RF-018 a RF-021 |

Módulos pendientes de scaffolding explícito (ver TODOs en `app.module.ts`): identidad/auth completo, afiliación y carga Excel, operaciones (picking/packing/despacho), notificaciones, analítica/reportes, comprobantes electrónicos.
