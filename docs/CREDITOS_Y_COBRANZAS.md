# Créditos y cobranzas (EP-21) — lógica, reglas de negocio y controles

**Estado:** 100% implementado y desplegado (Testeo y Producción).
**Módulo:** `backend/src/modules/clientes/` (`ClientesService`, `ClientesController`).
**Última actualización de este documento:** 2026-08-19.

Este documento explica, para quien no vaya a leer el código, qué hace el
sistema hoy en materia de créditos y cobranzas: qué reglas aplica, quién
puede hacer qué, y qué controles técnicos existen para que nada se pueda
hacer fuera de orden. Al final hay una sección de lo que **todavía no**
existe, para no generar una falsa sensación de cobertura.

---

## 1. Alcance: quién opera a crédito

Solo dos canales manejan la figura de "Cliente" (el cliente final del
Asesor, a quien se le abre una línea de crédito) y por lo tanto pueden
comprar `AL_CREDITO`:

- **Salón de Belleza** (`SALONES_BELLEZA`)
- **Retail** (`RETAIL`)

**Comercio Minorista nunca tiene Cliente ni crédito** — en ese canal el
Asesor compra para sí mismo, siempre al contado (Yape/Culqi o depósito).

Esto se aplica en código con una lista fija, no con configuración:
`ClientesService.CANALES_CON_CREDITO = ['SALONES_BELLEZA', 'RETAIL']`
([clientes.service.ts:34](../backend/src/modules/clientes/clientes.service.ts#L34)).
Crear un Cliente o pedir crédito desde cualquier otro canal se rechaza con
`BadRequestException` antes de tocar la base de datos.

---

## 2. Las 4 piezas del modelo de datos

| Modelo | Qué representa | Vida útil |
|---|---|---|
| `Cliente` | El cliente final de un Asesor (Salón/Retail). Tiene su propia línea de crédito. | Permanente |
| `SolicitudCredito` | Pedido de línea de crédito (o de ampliarla) para un Cliente. | Una vez resuelta (aprobada/rechazada), queda como historial — no se reutiliza |
| `SolicitudDescuento` | Descuento por volumen negociado para **un pedido puntual** (EP-04) — no es parte de la línea de crédito. | Se "consume" al usarse en un pedido; nunca queda vigente para compras futuras |
| `RegistroCobro` | Un pago que el Cliente hizo contra su deuda acumulada. | Una vez resuelto (validado/rechazado), queda como historial |

### Campos clave de `Cliente`

- `estado`: `ACTIVO` / `MOROSO` / `BLOQUEADO`.
- `lineaCreditoAprobada`: `null` mientras no tenga una `SolicitudCredito`
  aprobada — en ese caso, **debe pagar contado** (depósito o Culqi), no
  puede pedir `AL_CREDITO` aunque exista como Cliente.
- `saldoUtilizado`: cuánto de su línea tiene comprometido en pedidos
  `AL_CREDITO` todavía no cobrados. Se mantiene con incrementos/decrementos
  atómicos (nunca se recalcula desde cero).
- `odooPartnerId`: el Cliente se sincroniza como `res.partner` en Odoo
  (best-effort — si Odoo está caído, la operación local igual se completa;
  se reintenta en la próxima sincronización, nunca bloquea el negocio).

---

## 3. Flujo 1 — línea de crédito

```
Asesor pide crédito ──► PENDIENTE ──► Gerente Comercial/Administrador resuelve
                                          │
                              ┌───────────┴───────────┐
                          APROBADA                RECHAZADA
                              │
              Cliente.lineaCreditoAprobada = monto aprobado
              Cliente.estado = ACTIVO
```

**Reglas duras:**

- **La aprobación SIEMPRE la resuelve `GERENTE_COMERCIAL` (o `ADMINISTRADOR`)** — nunca el propio Asesor, nunca automático, sin excepción por canal ni por monto ([clientes.service.ts:14-15](../backend/src/modules/clientes/clientes.service.ts#L14-L15)).
- Un Cliente **no puede tener dos solicitudes de crédito pendientes a la vez** — si ya tiene una sin resolver, `solicitarCredito` la rechaza de entrada ([clientes.service.ts:129-139](../backend/src/modules/clientes/clientes.service.ts#L129-L139)).
- Solo se puede aprobar/rechazar una solicitud que esté en `PENDIENTE` — si ya fue resuelta, se rechaza el intento con el estado real en el mensaje (no se puede "re-aprobar" ni "re-rechazar").
- El Asesor que la pide **solo puede pedir crédito para sus propios Clientes** — el controller valida `cliente.asesorId === req.user.asesorId` antes de llamar al servicio ([clientes.controller.ts:65-70](../backend/src/modules/clientes/clientes.controller.ts#L65-L70)).
- Aprobar y activar al Cliente es una **transacción atómica** (`$transaction`): la `SolicitudCredito` pasa a `APROBADA` y el `Cliente` se actualiza (`lineaCreditoAprobada`, `estado: ACTIVO`) en el mismo paso — no puede quedar una sin la otra.

---

## 4. Flujo 2 — comprar `AL_CREDITO`

Un pedido `AL_CREDITO` **no pasa por Culqi ni por validación manual de pago**
— queda `PAGADO` de una vez, porque quien autoriza el crédito ya fue
`GERENTE_COMERCIAL` al aprobar la línea, no se vuelve a pedir autorización
en cada compra puntual ([orders.service.ts:308-322](../backend/src/modules/orders/orders.service.ts#L308-L322)).

Antes de eso, `OrdersService.crearPedidoDesdeItems` llama a
`ClientesService.reservarCredito(clienteId, totalPedido)`
([clientes.service.ts:303-320](../backend/src/modules/clientes/clientes.service.ts#L303-L320)), que revisa **en este orden**:

1. **¿El cliente está `ACTIVO`?** Si está `MOROSO` o `BLOQUEADO`, se rechaza el pedido — "debe pagar contado (depósito o Culqi)".
2. **¿Tiene línea de crédito aprobada?** Si `lineaCreditoAprobada` es `null`, se rechaza — "debe pagar contado".
3. **¿El pedido entra en el cupo disponible?** `saldoDisponible = lineaCreditoAprobada − saldoUtilizado`. Si el pedido supera eso, se rechaza con el monto exacto que le queda disponible.

Si pasa las tres, se **compromete** el monto (`saldoUtilizado += totalPedido`) — recién ahí se crea el pedido.

**Si el pedido se cancela después** (por ejemplo, no había stock real al
reservar, o Gerencia lo rechaza), el cupo se devuelve automáticamente vía
`liberarCredito` — ver [orders.service.ts:302-305](../backend/src/modules/orders/orders.service.ts#L302-L305) (falta de stock) y
[orders.service.ts:506-508](../backend/src/modules/orders/orders.service.ts#L506-L508) (`rechazarPedido`). Sin esto, el cliente quedaría con
cupo "fantasma" ocupado por un pedido que nunca se concretó.

---

## 5. Flujo 3 — descuento por volumen (EP-04)

Distinto de la línea de crédito: **no es un beneficio permanente del
Cliente**, es una excepción de precio para **un pedido puntual**, que se
"gasta" al usarse.

```
Asesor pide descuento (%) ──► PENDIENTE ──► se resuelve por nivel según el %
                                                │
                              ┌─────────────────┴─────────────────┐
                       ≤ 5%: Gerente Comercial            > 5%: Gerente General
                       (o Administrador)                  (o Administrador)
                                │                                  │
                            APROBADA ──► se usa UNA VEZ en un pedido (Order.solicitudDescuentoId)
```

**Reglas:**

- El umbral está en código, no es configurable: `UMBRAL_APROBACION_GERENTE_COMERCIAL = 5` ([clientes.service.ts:185](../backend/src/modules/clientes/clientes.service.ts#L185)). Por encima de 5%, si quien intenta aprobar es `GERENTE_COMERCIAL`, se rechaza con `ForbiddenException` explicando que hace falta Gerente General — **esta validación depende del monto solicitado, no solo del rol**, por eso vive en el servicio y no alcanza con el decorador `@Roles` del controller.
- Nunca se aplica sobre el envío (RN-009) — solo sobre el subtotal de productos.
- Uso único: `Order.solicitudDescuentoId` es `@unique` a nivel de base de datos como última red, además de que `OrdersService` valida que la solicitud no tenga ya un `pedido` asociado antes de dejarla usar.
- Solo aplica a los canales con Cliente (Salón/Retail) — igual que el crédito.

---

## 6. Flujo 4 — cobranza ("cobranza ligera", sin conciliación bancaria automática)

Registrar un cobro **no descuenta la deuda de inmediato** — nace
`PENDIENTE` con el comprobante adjunto, y recién se aplica cuando alguien
con permiso lo valida. Mismo patrón que crédito y descuento: quien registra
nunca se autoaprueba.

```
Asesor (u otro rol autorizado) registra el cobro
  + monto, método (depósito/culqi/efectivo), comprobante (imagen o PDF)
        │
        ▼
    PENDIENTE ──► alguien de Gerencia/Finanzas valida o rechaza
        │
        ├── VALIDADO ──► saldoUtilizado -= monto (recortado a 0, nunca negativo)
        │                Si estaba MOROSO y el saldo llega a 0 ──► vuelve a ACTIVO solo
        │
        └── RECHAZADO ──► no toca el saldo (nunca lo tocó) — solo queda constancia
```

**Reglas y controles:**

- El comprobante acepta imagen (JPG/PNG/WEBP) o PDF, máximo 5 MB — validado por tipo real de archivo, no por extensión ([multer-cobro.config.ts](../backend/src/common/upload/multer-cobro.config.ts)); el nombre en disco no depende de nada que mande el cliente (evita path traversal).
- El Asesor solo puede registrar cobros de **sus propios** Clientes; Gerencia Comercial/Administrador/Finanzas pueden hacerlo por cualquiera.
- **Un cobro mal ingresado nunca deja `saldoUtilizado` negativo** — si se registra un monto mayor a la deuda real, se recorta a 0 en vez de reventar o dejar un saldo negativo sin sentido ([clientes.service.ts:266-267](../backend/src/modules/clientes/clientes.service.ts#L266-L267)).
- Reactivación automática **parcial**: si el cliente estaba `MOROSO` y el cobro deja el saldo en 0, vuelve solo a `ACTIVO`. Si estaba `BLOQUEADO`, **no** se levanta automático — ese es un paso manual aparte (`marcarEstado`), a propósito, porque bloquear es una decisión más seria que marcar mora.
- Solo se puede validar/rechazar un cobro que esté `PENDIENTE` — no se puede resolver dos veces.

---

## 7. Roles y permisos — quién puede hacer qué

Extraído directo del catálogo real de permisos
(`backend/src/modules/permisos/permisos-catalogo.ts:53-69`). Estos son los
roles **por defecto**; recordar que desde EP-01 son reconfigurables en
caliente desde Gestión → Permisos sin necesidad de deploy — esta tabla
puede quedar desactualizada si alguien reasigna un permiso ahí.

| Acción | Roles por defecto |
|---|---|
| Registrar un cliente | `ASESOR` (solo para sí — sus propios clientes) |
| Ver/listar clientes | `ASESOR` (solo los suyos), `GERENTE_COMERCIAL`, `ADMINISTRADOR` (todos) |
| Cambiar estado de un cliente (activo/moroso/bloqueado) | `ADMINISTRADOR`, `GERENTE_COMERCIAL` |
| Pedir línea de crédito | `ASESOR` (solo para sus clientes) |
| Ver / aprobar / rechazar solicitudes de crédito | `ADMINISTRADOR`, `GERENTE_COMERCIAL` |
| Pedir descuento por volumen | `ASESOR` (solo para sus clientes) |
| Ver / aprobar / rechazar solicitudes de descuento | `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `GERENTE_GENERAL` (Gerente Comercial limitado a ≤5%) |
| Registrar un cobro | `ASESOR` (solo sus clientes), `GERENTE_COMERCIAL`, `ADMINISTRADOR`, `FINANZAS` |
| Ver bandeja de cobros / validar / rechazar | `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `FINANZAS` |

`FINANZAS` entra específicamente en cobros (no en crédito ni descuento)
porque es quien de verdad concilia depósitos en la práctica — así no
depende de pasar todo por Gerencia Comercial.

**Pantallas en Gestión:** `frontend/src/components/admin/CreditosTab.tsx`
(solicitudes de crédito/descuento) y `CobrosTab.tsx` (bandeja de cobros).

---

## 8. Controles técnicos transversales (aplican a los 4 flujos)

- **Nadie se autoaprueba.** Quien pide crédito/descuento o registra un
  cobro nunca es quien lo resuelve — separación de funciones aplicada en
  cada uno de los tres flujos de aprobación.
- **No se puede resolver dos veces.** `aprobarSolicitud`, `rechazarSolicitud`,
  `aprobarSolicitudDescuento`, `validarCobro`, etc. — todos chequean primero
  que el registro siga en `PENDIENTE` antes de tocar nada; si ya fue
  resuelto, tiran `BadRequestException` con el estado real.
- **Pertenencia del Asesor.** En cada endpoint donde el Asesor actúa sobre
  un Cliente (crear cobro, pedir crédito/descuento, ver detalle), el
  controller valida que ese Cliente sea suyo (`cliente.asesorId ===
  req.user.asesorId`) antes de dejarlo pasar — un Asesor nunca puede operar
  sobre el cliente de otro.
- **Odoo nunca bloquea la operación real.** La sincronización a `res.partner`
  es best-effort: si Odoo está caído, el cliente se crea/aprueba igual en la
  plataforma, y el error solo queda en el log — mismo criterio que el resto
  de la integración con Odoo en este proyecto.
- **Consistencia transaccional donde hay dos escrituras relacionadas.**
  Aprobar crédito (`SolicitudCredito` + `Cliente`) y validar un cobro
  (`RegistroCobro` + `Cliente`) usan `$transaction` — no puede quedar una
  mitad aplicada y la otra no.

---

## 9. Lo que hoy NO existe (para no sobreestimar la cobertura)

- **Sin rastro en `AuditLog`.** A diferencia de `OrdersService` (que sí
  audita validar pago, validar depósito, rechazar pedido), ninguna acción
  de `ClientesService` queda registrada en `AuditLog` hoy — no hay forma de
  ver, desde auditoría, quién aprobó qué línea de crédito o qué cobro,
  más allá de los campos `revisadoPorId`/`resueltoEn` que sí quedan en cada
  registro individual.
- **La mora es 100% manual.** `Cliente.estado = MOROSO` lo pone una persona
  a mano (`marcarEstado`) — no hay ningún cálculo de "esta deuda ya venció"
  todavía. No existe el concepto de fecha de vencimiento ni de plazo de
  crédito (30/60/90 días) en el modelo de datos actual.
- **Sin conciliación bancaria.** Validar un cobro es una confirmación
  visual humana de que la plata llegó — no hay integración con ningún
  banco ni con el estado de cuenta de Odoo todavía.

### Diseño ya acordado para cerrar el punto de la mora (pendiente de construir)

Definido con Alberto el 2026-08-18, bloqueado por EP-13 (ver
`docs/CI_MEJORAS_FUTURAS.md` / tablero vivo — falta que la plataforma cree
una factura real en Odoo por pedido, hoy solo crea el `sale.order`):

1. **Plazo de crédito con aprobación por nivel**, agregado a
   `SolicitudCredito`: hasta 30 días lo aprueba `GERENTE_COMERCIAL`
   (default), más de 30 días (60, 90+) solo `GERENTE_GENERAL` — mismo
   patrón de umbral que ya existe hoy para el % de descuento.
2. **Fecha de vencimiento por pedido**, no por cliente en general: cada
   pedido `AL_CREDITO` calcularía la suya (`pagadoEn + plazoDiasCredito`).
3. **Alcance acotado a Salón de Belleza únicamente** (no Retail) — decisión
   explícita de Alberto.
4. **La morosidad se leería desde Odoo, no con un cálculo propio de
   antigüedad/FIFO.** `Cliente.odooPartnerId` ya sincroniza como
   `res.partner` (con `credit_limit` nativo de Odoo), y `OdooClient.
   obtenerComprobante` ya sabe leer la factura (`account.move`) de un
   pedido. Odoo trackea nativamente vencimiento y saldo pendiente por
   factura — la idea es que el cliente mande el voucher con el número de
   factura que cancela, y que la conciliación bancaria puntual la resuelva
   Odoo (que ya tiene ese mecanismo), no una reconciliación manual hecha a
   mano en esta base de datos.

El bloqueo real, en una frase: **sin factura real en Odoo (EP-13) no hay
contra qué medir un vencimiento.** Ese es el siguiente paso.
