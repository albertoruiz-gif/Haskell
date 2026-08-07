# Prompt para Claude en VS Code — Conectar Culqi (cargo automático, reemplaza Yape manual)

Pega esto tal cual en Claude Code, en la raíz del repo `Haskell`.

---

## Contexto

Ya existen llaves de prueba de Culqi (`pk_test_`/`sk_test_`) y un par de llaves RSA cargadas en `backend/.env` (variables `CULQI_PUBLIC_KEY`, `CULQI_PRIVATE_KEY`, `CULQI_RSA_ID`, `CULQI_RSA_PUBLIC_KEY` — ya existen en `backend/.env.example` y en `backend/.env`, este último gitignored). No necesitas tocar esos valores ni preguntarlos: ya están en `.env`.

Hoy el pago es 100% manual (RF-018 tal como se diseñó sin credenciales reales): el asesor crea el pedido, paga por Yape fuera del sistema, y un gerente/administrador lo valida a mano en `Gestión → Pagos` (`PagosTab.tsx`, endpoint `PATCH /orders/:id/validar-pago`). **El objetivo de este cambio es reemplazar esa validación manual por un cargo automático real contra la API de Culqi**, usando el flujo de Yape de Culqi (tokenización en frontend, cargo en backend).

## Código existente que ya hace parte del trabajo — no lo recrees

- `backend/src/modules/payments/culqi.service.ts` — `CulqiService.ejecutarCargo(orderId, culqiToken)` ya existe: valida límite Yape (S/2000, RN-015), chequea idempotencia contra `Payment` (RF-020), llama a `POST https://api.culqi.com/v2/charges` con la llave privada, guarda el `Payment`, y si queda `aprobado` llama a `ordersService.confirmarPagoYEnviarAOdoo(orderId)` (esto ya crea el pedido en Odoo). **Tiene un bug**: el payload que manda a Culqi no incluye `email`, que la API de Culqi exige siempre en la creación de un cargo. Hay que agregarlo — el email está en `order.asesor.user.email` (necesitas incluir esa relación en el `findUniqueOrThrow`).
- `backend/src/config/secrets.service.ts` — método `culqi()` ya expone `publicKey/privateKey/rsaId/rsaPublicKey` leyendo de AWS Secrets Manager con fallback a las env vars de `.env`. No lo modifiques.
- `backend/src/modules/orders/orders.service.ts` — `confirmarPagoYEnviarAOdoo(orderId)` ya existe y es idempotente (por `referenciaWeb`). `validarPagoManual` es el flujo manual que este cambio reemplaza como camino principal — no lo borres todavía, pero deja de ser el botón por defecto (ver abajo).
- `backend/src/modules/payments/payments.module.ts` — ya importa `OrdersModule` y ya está registrado en `app.module.ts`. Solo le falta un controller.
- `frontend/src/app/carrito/page.tsx` — flujo de carrito y checkout real y funcional, termina en `POST /orders` y hoy muestra "pendiente de validación de pago — un gerente lo confirma al recibir el Yape". Esa pantalla de éxito cambia (ver abajo).
- `frontend/src/components/admin/PagosTab.tsx` — panel de gerencia que hoy lista pedidos `PENDIENTE_PAGO` con botones "Validar pago" / "Rechazar".

## Qué implementar

### 1. Backend — `PaymentsController` (no existe todavía)

Crea `backend/src/modules/payments/payments.controller.ts`:
- `POST /orders/:id/pagar` — recibe `{ culqiToken: string }` en el body (DTO con `class-validator`, `@IsString() @IsNotEmpty()`), llama a `culqiService.ejecutarCargo(id, dto.culqiToken)`, devuelve el `Payment`. Sin `@Roles` — igual que `POST /orders`, lo dispara el propio asesor dueño del pedido (valida en el service que el `orderId` le pertenece a `req.user.asesorId`, siguiendo el mismo patrón que ya usa `crearPedidoDesdeItems`).
- Regístralo en `payments.module.ts` (`controllers: [PaymentsController]`).

### 2. Backend — arreglar el payload de `ejecutarCargo`

En `culqi.service.ts`:
- Cambia el `findUniqueOrThrow` para incluir `asesor: { include: { user: true } }`.
- Agrega `email: order.asesor.user.email` al body del POST a `/v2/charges`, junto a `amount`, `currency_code`, `source_id`.
- Antes de tocar nada de cifrado RSA, verifica contra `https://docs.culqi.com/es/documentacion/pagos-online/pagos-online/cargo-unico/tokens-yape` si la creación del token Yape específicamente exige el payload cifrado RSA/AES (la doc general de "Llaves RSA" dice que aplica a "ciertos endpoints" sin listarlos todos aquí) — si no lo exige para `/v2/charges` con un `source_id` ya tokenizado, no implementes el cifrado todavía; si sí lo exige, sigue el ejemplo de cifrado híbrido AES-256-GCM + RSA-OAEP-SHA256 de esa documentación y usa el header `x-culqi-rsa-id`.

### 3. Frontend — tokenizar Yape antes de pagar

En `carrito/page.tsx`, el botón "Pagar con Yape" hoy solo hace `POST /orders`. Cambia el flujo a:
1. Cargar el SDK `Culqi.js` de Culqi (agregar el script, ver `https://docs.culqi.com/es/documentacion/pagos-online/cargo-unico/tokens-yape` para el método exacto de generar un token Yape — típicamente pide número de celular del cliente + código de verificación de 6 dígitos).
2. `POST /orders` (sin cambios) para crear el pedido.
3. Pedir al usuario su celular Yape + código de verificación (agrega estos dos campos al formulario, reemplazando el botón único actual).
4. Generar el token Yape con el SDK usando la llave pública (nunca la privada en el frontend).
5. `POST /orders/:id/pagar` con `{ culqiToken }`.
6. Si `estado === 'aprobado'` → pantalla de éxito real (pedido pagado y confirmado, ya no dice "pendiente de validación"). Si `rechazado` → mostrar el motivo (`merchant_message` de la respuesta de Culqi) y permitir reintentar.

La llave pública va en una env var de frontend nueva, `NEXT_PUBLIC_CULQI_PUBLIC_KEY` (en `frontend/.env.local`, que ya está en `.gitignore` por el patrón `.env.*.local`). Nunca pongas ahí la llave privada ni la RSA.

### 4. Frontend — simplificar `PagosTab.tsx`

Como el cargo ahora es automático, el botón "Validar pago" deja de ser la vía principal. Cambia el panel a modo monitoreo: sigue listando pedidos y su estado real (`PAGADO` ya viene del cargo automático), pero el botón "Validar pago" solo debería quedar disponible como override manual de excepción (por ejemplo, renómbralo a "Marcar como pagado manualmente" y dilo explícitamente en el texto de ayuda) — no lo elimines del todo por si el cargo automático falla y hay que resolver un caso puntual a mano.

## Datos de prueba para validar el flujo

- Celular Yape de prueba: `900 000 001`, código de verificación: cualquier valor de 6 dígitos.
- Si en algún punto agregan pago con tarjeta además de Yape: Visa `4111 1111 1111 1111`, exp `09/30`, CVV `123` (venta exitosa). Hay tarjetas de prueba adicionales para forzar rechazos específicos en `https://docs.culqi.com/es/documentacion/pagos-online/tarjetas-de-prueba`.

## Qué NO hacer

- No mandes la llave privada (`CULQI_PRIVATE_KEY`) ni la RSA al frontend — solo `CULQI_PUBLIC_KEY`.
- No hardcodees ninguna llave en el código; ya existen las env vars, solo úsalas.
- No borres `validarPagoManual` ni su endpoint — se mantiene como excepción manual.
- No dupliques la llamada a `confirmarPagoYEnviarAOdoo`; ya está encadenada dentro de `ejecutarCargo` cuando el pago queda aprobado — no la vuelvas a llamar desde el controller.
- No asumas el formato exacto del token Yape sin confirmarlo en la doc de "Tokens Yape" — no está copiado en este prompt porque no se verificó línea por línea.
