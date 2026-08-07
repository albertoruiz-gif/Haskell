# Prompt para Claude Code — Tablero de indicadores gerenciales (frontend)

Pegar este brief completo en Claude Code, parado en la raíz del repo (`Haskell/`).

---

## Contexto

Ya existe el backend del tablero de indicadores gerenciales (Prisma + NestJS, en `backend/`). Falta construir la pantalla real en `frontend/` (Next.js 14, App Router, Tailwind), replicando el diseño que ya se validó como maqueta. Este documento describe exactamente qué hay hecho, qué diseño replicar, y qué falta.

**Actualizado 2026-08-06** tras revisión de Alberto — ver "Correcciones" al final de cada sección afectada; son más importantes que el texto original si se contradicen.

## Qué ya existe en el backend (no crear de nuevo, solo consumir)

- **Modelo `MetaIndicador`** en `backend/prisma/schema.prisma` (migración `20260805020000_metas_indicadores`): `indicador` (string), `canal` (enum `Canal` opcional — `SALONES_BELLEZA` | `RETAIL` | `COMERCIO_MINORISTA`, null = meta global), `valorObjetivo` (decimal), `vigenciaDesde`/`vigenciaHasta`, `actualizadoPorId`.
- **`GET /metas?indicador=`** — lista metas vigentes (vigenciaHasta null o futura). Roles: `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`, `FINANZAS`.
- **`POST /metas`** `{ indicador, canal?, valorObjetivo, vigenciaDesde?, vigenciaHasta? }` — crea una meta nueva y cierra automáticamente la anterior vigente para el mismo par indicador+canal (no hace falta cerrarla a mano desde el frontend). Roles: `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`.
- **`PATCH /metas/:id`** `{ valorObjetivo?, vigenciaHasta? }`. Mismos roles que crear.
- **`GET /indicadores/gerencial|comercial|finanzas|operaciones|marketing`** — devuelve, por cada indicador de esa pestaña, `{ indicador, valorActual, meta, canal }`. Roles: `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`, `FINANZAS`.
- **Los 17 indicadores canónicos** están en `backend/src/modules/indicadores/indicadores.constants.ts` (`INDICADORES_COMERCIALES`, `INDICADORES_FINANCIEROS`, `INDICADORES_OPERATIVOS`, `INDICADORES_MARKETING_DIGITAL`). Usar exactamente esas claves en el frontend (no inventar otras).
- **`INDICADORES_MARKETING_DIGITAL = ['ltv_cliente', 'cac']`** — sumados a pedido de Alberto (2026-08-06). Los dos van a devolver `valorActual: null` por bastante tiempo: `cac` depende de `GastoMarketing` (ver abajo) más una fuente de "clientes nuevos" del período todavía sin definir; `ltv_cliente` depende de la Fase 3 de Hasky (cartera por cliente) y solo tiene sentido para Salones/Retail, no para Minorista (ahí la cartera es de la asesora, no se registra clienta final). Mostrarlos en el tablero igual, con el mismo estado "pendiente de cálculo" que el resto.
- **Modelo `GastoMarketing`** (migración `20260806010000_gastos_marketing`): carga manual de gasto de marketing/publicidad — `descripcion`, `canal` opcional, `monto`, `periodoDesde`/`periodoHasta`. **`GET /gastos-marketing?desde=&hasta=`** (mismos roles de lectura) y **`POST /gastos-marketing`** (`ADMINISTRADOR`/`GERENTE_GENERAL`/`GERENTE_COMERCIAL`). No hace falta pantalla propia todavía — alcanza con un formulario simple dentro de la pestaña Metas o Marketing, no es prioritario para esta iteración.
- **`valorActual` hoy devuelve `null` para el 100% de los indicadores, sin excepción** (no "casi todos" — literal, ni uno tiene el cálculo conectado todavía; ver TODOs en `indicadores.service.ts`). El frontend debe mostrar un estado "pendiente de cálculo" cuando `valorActual` sea `null`, nunca inventar un número. **En la práctica, el tablero terminado va a mostrar "pendiente de cálculo" en las 17 métricas el primer día** — es esperado, no es un bug de la pantalla nueva.
- **Login ya existe y es funcional**: `POST /auth/login` `{ email, password }` → `{ accessToken, usuario: { id, nombre, rol, canal } }`, página en `frontend/src/app/login/page.tsx`. El JWT trae `rol` (uno de `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL`, `GESTOR_CATALOGO`, `LIDER_MINORISTA`, `VENDEDOR`, `ASESOR`, `ALMACEN`, `TRANSPORTISTA`, `FINANZAS`). **Corrección importante:** ver sección 0.
- **`GERENTE_GENERAL`** — rol nuevo (migración `20260806200000_agregar_gerente_general`), agregado a pedido de Alberto. Es puramente un rol de visibilidad por ahora (no tiene módulo de gestión propio como `GerenteComercial`/`Lider`) — acceso total al tablero, igual que `ADMINISTRADOR`/`GERENTE_COMERCIAL`. Todavía no existe ningún usuario con este rol creado — no hay pantalla de alta de Gerente General, se crea por ahora igual que un `ADMINISTRADOR` (a mano en la base o pidiendo que se agregue el endpoint si hace falta).
- **`GET /lideres/:id/equipo`** (nuevo, `backend/src/modules/lideres/lideres.service.ts`) — resumen del equipo de un Líder: `{ comisionPct, totalVentaPvp, comisionGanada, cantidadPedidos, cantidadAsesores, asesores: [{ asesorId, codigo, nombre, totalVentaPvp, comisionAsesor, cantidadPedidos }] }`, con `asesores` ordenado de mayor a menor venta (ranking "quién vende más"). `comisionAsesor` es el margen real de cada asesor (PVP − precio con descuento que paga a la empresa, ya vive en cada `OrderItem`), no un dato inventado. Roles: `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `LIDER_MINORISTA` (un líder solo puede pedir su propio `:id`, devuelve 403 si pide el de otro). **Esto NO usa datos de Odoo — es 100% real hoy, no va a mostrar "pendiente de cálculo".**

## Lo que falta y hay que construir

### 0. Auth en el frontend — CORREGIDO, no es "prerrequisito desde cero"

**El texto original de este prompt decía que no existía login y pedía construir uno con cookie httpOnly + middleware. Eso es incorrecto y quedó obsoleto:** ya existe un login funcional (`frontend/src/app/login/page.tsx`) que guarda la sesión en **`localStorage`** (`frontend/src/lib/auth.ts`, función `saveSession`) y la usa el resto de la app (`frontend/src/lib/api.ts` lee el token de ahí para el header `Authorization`).

Decisión (Alberto, 2026-08-06): **reusar este mecanismo existente, no construir uno paralelo con cookies.** Migrar toda la app a cookie httpOnly es una tarea aparte, mucho más grande, y tener dos sistemas de auth conviviendo (uno por cookie solo para Indicadores, el resto por localStorage) sería peor que mantener uno solo, aunque no sea el ideal de seguridad a largo plazo.

Lo que sí falta construir (esto es real, no está hecho):

- Un guard de ruta en el cliente (ej. un componente wrapper o hook que lea `getUsuario()` de `lib/auth.ts` y redirija a `/login` si no hay sesión, o a una pantalla de "sin acceso" si el rol no corresponde) — hoy no existe ningún guard, cualquier ruta es alcanzable si se conoce la URL.
- La ruta `/indicadores` debe rechazar a cualquier rol que no sea `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL` o `FINANZAS`.
- **Los Líderes (`LIDER_MINORISTA`) NO entran a `/indicadores`** — tienen su propia ruta separada, ver sección 5 (nueva).

### 1. Ruta `/indicadores` con 6 pestañas

Cuatro pestañas iguales a la maqueta ya validada, más dos nuevas. **Visible en el nav principal (junto a Catálogo/Gestión/Almacén/Delivery) solo para `ADMINISTRADOR`, `GERENTE_GENERAL`, `GERENTE_COMERCIAL` y `FINANZAS`.**

**Gerencial** — semáforo de estado por área (Comercial/Finanzas/Operaciones, clickeable para saltar a esa pestaña) + los 5 indicadores comerciales y 5 financieros más prioritarios en cards grandes + gráfica "Ventas netas vs meta" de los últimos 6 meses.

**Comercial / Finanzas / Operaciones** — cards grandes para los 5 indicadores prioritarios de esa pestaña, tiles chicos para los secundarios, y una gráfica de barras de composición (ventas por canal / rentabilidad por canal / pedidos por estado — usar los 3 valores reales del enum `Canal`, no 4 canales como en la maqueta de chat).

**Marketing digital (nueva)** — solo 2 cards (`ltv_cliente`, `cac`), casi seguro mostrando "pendiente de cálculo" por ahora. No hace falta gráfica de composición acá, con las cards y su drill-down (sección 2) alcanza.

**Metas (nueva)** — ver sección 3.

### 2. Interacción por indicador: clic → panel de detalle

Al hacer clic en cualquier card o tile de indicador se abre un panel (arriba del contenido, con botón cerrar) con:

- Valor actual + delta (o "pendiente de cálculo" si `valorActual` es `null`).
- Selector de período: Día / Semana / Mes / Bimestre / Trimestre / Semestre / Año — cambia el agrupamiento de la serie histórica.
- Gráfica de línea con al menos 10 períodos visibles, más un control deslizante (`range`) para retroceder más atrás en el historial.
- **La meta de ese indicador (traída de `GET /metas?indicador=`) se dibuja como línea de referencia punteada gris** sobre la misma gráfica, igual que ya se hace en la gráfica "Ventas netas vs meta" de Gerencial — así se ve de un vistazo si el indicador va por encima o por debajo del objetivo. Si el indicador tiene metas por canal, mostrar la meta del canal correspondiente cuando aplique, o la meta global si no hay una específica por canal. **Corrección: ver el gap de backend en la sección 3 antes de asumir que esto ya viene resuelto del lado del servidor.**
- Debajo, tabla de seguimiento "Problema-causa / Acciones correctivas / Fecha de solución / Responsable / Estado": botón "Agregar fila" (las nuevas quedan siempre arriba), contenedor con scroll que muestra ~3 filas y encabezado fijo, columna Estado con selector Pendiente/Concluido que cambia de color. (Esto puede seguir siendo solo de UI por ahora — no hay tabla en Postgres para estas filas todavía; si se quiere que persista, avisar para diseñar esa tabla aparte.)

### 3. Pestaña Metas — nueva

Listado de los 17 indicadores canónicos (`indicadores.constants.ts`), agrupados por Comercial/Financiero/Operativo/Marketing digital. Por cada uno:

- Si el indicador es de alcance por canal (hoy: `margen_bruto_canal`; dejar el mecanismo genérico por si se suman otros), mostrar **una fila por canal** (`SALONES_BELLEZA`, `RETAIL`, `COMERCIO_MINORISTA`) más una fila "Global" opcional.
- Si no, una sola fila con la meta global.
- Cada fila: valor objetivo actual (si existe, si no "sin meta definida"), input para cargar/actualizar, y quién la actualizó por última vez.
- Guardar llama a `POST /metas` (el backend ya se encarga de cerrar la meta anterior). Solo visible/editable para `ADMINISTRADOR`, `GERENTE_GENERAL` y `GERENTE_COMERCIAL` — `FINANZAS` puede ver el tablero pero no esta pestaña de edición (o la ve en modo solo lectura, a definir si hace falta).

**Corrección/gap real de backend (esto NO es solo "consumir", hay que tocar el backend):** la pestaña Metas en sí (crear/editar metas por canal) funciona tal cual está descrito arriba — `POST /metas` con `canal` ya guarda bien una meta por canal. **El problema está en la sección 2 (drill-down) y en las gráficas de las pestañas 1**: `GET /indicadores/comercial|finanzas|operaciones` (`indicadores.service.ts`, método `armarValor`) siempre devuelve `canal: null` y solo lee la meta *global* de cada indicador, ignorando si existen metas por canal. O sea: hoy no hay forma de pedirle al backend "dame el valor/meta de `margen_bruto_canal` para Retail" — la respuesta es siempre una sola fila agregada. Si se necesita esto para el lanzamiento, avisar para extender `armarValor`/los endpoints antes de construir la UI que depende de eso; si no, dejarlo con un TODO visible y mostrar solo la meta global en el drill-down por ahora.

### 4. Diseño visual a replicar

- Reusar la paleta ya definida en `tailwind.config.ts` (**no inventar hex nuevos**): `bosque` (verde marca — activo de pestañas, íconos de acento, líneas de tendencia en las gráficas), `crema` (fondo), `musgo`/`acento`/`promo` donde corresponda. Para semáforos de estado (a favor/en riesgo) sumar verde/ámbar/rojo semánticos si no existen ya en la config — agregarlos a `tailwind.config.ts` en vez de hardcodear. **Confirmado: hoy no existen, hay que agregarlos.**
- Cards con fondo suave, radio `rounded-card` (ya definido, 16px), un punto o ícono chico en `bosque` junto al label del indicador, valor grande abajo, delta con flecha de color según esté por encima/debajo de meta.
- Tabs con estado activo en `bosque`/`crema` (fondo claro, texto oscuro, borde verde), igual criterio que la maqueta.
- **Gráficas: se recomienda [Recharts](https://recharts.org/)** (no hay ninguna librería de charts instalada todavía — se confirmó, hay que instalar una desde cero). Se prefiere sobre Chart.js/D3 para este caso porque es nativamente React/declarativo (menos código imperativo), tiene `<ReferenceLine>` listo para la línea de meta punteada sin trabajo extra, y `<Brush>` para el control deslizante de rango del drill-down (sección 2) — ambos son justo los dos requisitos más específicos de este prompt. Línea verde `bosque` para el valor real, línea gris punteada (`<ReferenceLine strokeDasharray="4 4">`) para la meta.

### 5. Vista de Líder — "Mi equipo" (nueva, separada del tablero gerencial)

Los Líderes (`LIDER_MINORISTA`) no ven las 6 pestañas de arriba — tienen su propia pantalla, más simple, con datos 100% reales hoy (no depende de Odoo ni de ningún cálculo pendiente):

- Nueva pestaña en el nav principal, visible solo para `LIDER_MINORISTA` (y opcionalmente `ADMINISTRADOR`/`GERENTE_COMERCIAL` para supervisión, reusando la misma pantalla con un selector de líder).
- Consume `GET /lideres/:id/equipo` (el `:id` del líder logueado ya viene en `usuario.liderId` desde `/auth/login`, agregado 2026-08-06 — antes solo estaba dentro del JWT, no en la respuesta).
- Contenido: comisión total del líder (`comisionGanada`, ya calculada como `comisionPct % del totalVentaPvp` del equipo), total vendido por el equipo (`totalVentaPvp`), y una tabla ranking de asesores (`asesores`, ya viene ordenada de mayor a menor venta) con columnas: nombre, código, total vendido, comisión del asesor, cantidad de pedidos.
- No hace falta drill-down ni selector de período para esta vista en esta iteración — es una foto del estado actual, igual que hoy el endpoint no acepta rango de fechas.

## Qué NO hacer

- No inventar el cálculo de `valorActual` para indicadores que dependen de Odoo (ventas, márgenes, inventario) sin validar el domain/campos reales — dejarlo en el estado "pendiente de cálculo" que ya devuelve el backend.
- No usar 4 canales (Asesoras/Salones/Retail/Web) como en la maqueta de chat — el enum `Canal` real solo tiene 3 valores.
- No construir un segundo sistema de auth por cookie httpOnly solo para esta pantalla — reusar `lib/auth.ts` (localStorage) como el resto de la app (ver sección 0).
- No hardcodear colores nuevos si ya existe un token equivalente en `tailwind.config.ts`.
- No mostrar la pestaña de Indicadores gerenciales a `LIDER_MINORISTA` — ese rol usa la vista aparte de la sección 5.
