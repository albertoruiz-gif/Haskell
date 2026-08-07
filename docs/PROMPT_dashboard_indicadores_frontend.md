# Prompt para Claude Code — Tablero de indicadores gerenciales (frontend)

Pegar este brief completo en Claude Code, parado en la raíz del repo (`Haskell/`).

---

## Contexto

Ya existe el backend del tablero de indicadores gerenciales (Prisma + NestJS, en `backend/`). Falta construir la pantalla real en `frontend/` (Next.js 14, App Router, Tailwind), replicando el diseño que ya se validó como maqueta. Este documento describe exactamente qué hay hecho, qué diseño replicar, y qué falta.

## Qué ya existe en el backend (no crear de nuevo, solo consumir)

- **Modelo `MetaIndicador`** en `backend/prisma/schema.prisma` (migración `20260805020000_metas_indicadores`): `indicador` (string), `canal` (enum `Canal` opcional — `SALONES_BELLEZA` | `RETAIL` | `COMERCIO_MINORISTA`, null = meta global), `valorObjetivo` (decimal), `vigenciaDesde`/`vigenciaHasta`, `actualizadoPorId`.
- **`GET /metas?indicador=`** — lista metas vigentes (vigenciaHasta null o futura). Roles: `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `FINANZAS`.
- **`POST /metas`** `{ indicador, canal?, valorObjetivo, vigenciaDesde?, vigenciaHasta? }` — crea una meta nueva y cierra automáticamente la anterior vigente para el mismo par indicador+canal (no hace falta cerrarla a mano desde el frontend). Roles: `ADMINISTRADOR`, `GERENTE_COMERCIAL`.
- **`PATCH /metas/:id`** `{ valorObjetivo?, vigenciaHasta? }`. Mismos roles que crear.
- **`GET /indicadores/gerencial|comercial|finanzas|operaciones|marketing`** — devuelve, por cada indicador de esa pestaña, `{ indicador, valorActual, meta, canal }`. Roles: `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `FINANZAS`.
- **Los 17 indicadores canónicos** están en `backend/src/modules/indicadores/indicadores.constants.ts` (`INDICADORES_COMERCIALES`, `INDICADORES_FINANCIEROS`, `INDICADORES_OPERATIVOS`, `INDICADORES_MARKETING_DIGITAL`). Usar exactamente esas claves en el frontend (no inventar otras).
- **`INDICADORES_MARKETING_DIGITAL = ['ltv_cliente', 'cac']`** — sumados a pedido de Alberto (2026-08-06). Los dos van a devolver `valorActual: null` por bastante tiempo: `cac` depende de `GastoMarketing` (ver abajo) más una fuente de "clientes nuevos" del período todavía sin definir; `ltv_cliente` depende de la Fase 3 de Hasky (cartera por cliente) y solo tiene sentido para Salones/Retail, no para Minorista (ahí la cartera es de la asesora, no se registra clienta final). Mostrarlos en el tablero igual, con el mismo estado "pendiente de cálculo" que el resto.
- **Modelo `GastoMarketing`** (migración `20260806010000_gastos_marketing`): carga manual de gasto de marketing/publicidad — `descripcion`, `canal` opcional, `monto`, `periodoDesde`/`periodoHasta`. **`GET /gastos-marketing?desde=&hasta=`** (mismos 3 roles de lectura) y **`POST /gastos-marketing`** (`ADMINISTRADOR`/`GERENTE_COMERCIAL`). No hace falta pantalla propia todavía — alcanza con un formulario simple dentro de la pestaña Metas o Marketing, no es prioritario para esta iteración.
- **`valorActual` hoy devuelve `null` para casi todos los indicadores a propósito** — el cálculo real contra Odoo todavía no está validado (ver comentarios TODO en `indicadores.service.ts`). El frontend debe mostrar un estado "pendiente de cálculo" cuando `valorActual` sea `null`, nunca inventar un número.
- **Login ya existe**: `POST /auth/login` `{ email, password }` → `{ accessToken, usuario: { id, nombre, rol, canal } }`. El JWT trae `rol` (uno de `ADMINISTRADOR`, `GERENTE_COMERCIAL`, `GESTOR_CATALOGO`, `LIDER_MINORISTA`, `VENDEDOR`, `ASESOR`, `ALMACEN`, `TRANSPORTISTA`, `FINANZAS`).

## Lo que falta y hay que construir

### 0. Auth mínima en el frontend (prerrequisito — hoy no existe nada)

`frontend/src/app/page.tsx` solo hace `redirect('/catalogo')`; no hay login, ni manejo de JWT, ni ningún guard de rol todavía. Antes de la pantalla de indicadores, armar:

- Página de login que llame a `POST /auth/login` y guarde el `accessToken` en una **cookie httpOnly** (vía Route Handler de Next.js que haga el proxy al backend y setee la cookie — no guardar el JWT en `localStorage`).
- `middleware.ts` que lea la cookie, decodifique el rol (o llame a un endpoint `/auth/me` si hace falta agregarlo) y redirija a login si no hay sesión.
- Un guard de rol reutilizable para rutas protegidas — la ruta de indicadores debe rechazar a cualquier rol que no sea `ADMINISTRADOR`, `GERENTE_COMERCIAL` o `FINANZAS`.

Si esto excede el alcance de esta tarea, como mínimo dejar un mecanismo simple (aunque sea provisorio) y comentado como tal, para no bloquear el resto.

### 1. Ruta `/indicadores` con 6 pestañas

Cuatro pestañas iguales a la maqueta ya validada, más dos nuevas:

**Gerencial** — semáforo de estado por área (Comercial/Finanzas/Operaciones, clickeable para saltar a esa pestaña) + los 5 indicadores comerciales y 5 financieros más prioritarios en cards grandes + gráfica "Ventas netas vs meta" de los últimos 6 meses.

**Comercial / Finanzas / Operaciones** — cards grandes para los 5 indicadores prioritarios de esa pestaña, tiles chicos para los secundarios, y una gráfica de barras de composición (ventas por canal / rentabilidad por canal / pedidos por estado — usar los 3 valores reales del enum `Canal`, no 4 canales como en la maqueta de chat).

**Marketing digital (nueva)** — solo 2 cards (`ltv_cliente`, `cac`), casi seguro mostrando "pendiente de cálculo" por ahora. No hace falta gráfica de composición acá, con las cards y su drill-down (sección 2) alcanza.

**Metas (nueva)** — ver sección 3.

### 2. Interacción por indicador: clic → panel de detalle

Al hacer clic en cualquier card o tile de indicador se abre un panel (arriba del contenido, con botón cerrar) con:

- Valor actual + delta (o "pendiente de cálculo" si `valorActual` es `null`).
- Selector de período: Día / Semana / Mes / Bimestre / Trimestre / Semestre / Año — cambia el agrupamiento de la serie histórica.
- Gráfica de línea con al menos 10 períodos visibles, más un control deslizante (`range`) para retroceder más atrás en el historial.
- **La meta de ese indicador (traída de `GET /metas?indicador=`) se dibuja como línea de referencia punteada gris** sobre la misma gráfica, igual que ya se hace en la gráfica "Ventas netas vs meta" de Gerencial — así se ve de un vistazo si el indicador va por encima o por debajo del objetivo. Si el indicador tiene metas por canal, mostrar la meta del canal correspondiente cuando aplique, o la meta global si no hay una específica por canal.
- Debajo, tabla de seguimiento "Problema-causa / Acciones correctivas / Fecha de solución / Responsable / Estado": botón "Agregar fila" (las nuevas quedan siempre arriba), contenedor con scroll que muestra ~3 filas y encabezado fijo, columna Estado con selector Pendiente/Concluido que cambia de color. (Esto puede seguir siendo solo de UI por ahora — no hay tabla en Postgres para estas filas todavía; si se quiere que persista, avisar para diseñar esa tabla aparte.)

### 3. Pestaña Metas — nueva

Listado de los 17 indicadores canónicos (`indicadores.constants.ts`), agrupados por Comercial/Financiero/Operativo/Marketing digital. Por cada uno:

- Si el indicador es de alcance por canal (hoy: `margen_bruto_canal`; dejar el mecanismo genérico por si se suman otros), mostrar **una fila por canal** (`SALONES_BELLEZA`, `RETAIL`, `COMERCIO_MINORISTA`) más una fila "Global" opcional.
- Si no, una sola fila con la meta global.
- Cada fila: valor objetivo actual (si existe, si no "sin meta definida"), input para cargar/actualizar, y quién la actualizó por última vez.
- Guardar llama a `POST /metas` (el backend ya se encarga de cerrar la meta anterior). Solo visible/editable para `ADMINISTRADOR` y `GERENTE_COMERCIAL` — `FINANZAS` puede ver el tablero pero no esta pestaña de edición (o la ve en modo solo lectura, a definir si hace falta).

### 4. Diseño visual a replicar

- Reusar la paleta ya definida en `tailwind.config.ts` (**no inventar hex nuevos**): `bosque` (verde marca — activo de pestañas, íconos de acento, líneas de tendencia en las gráficas), `crema` (fondo), `musgo`/`acento`/`promo` donde corresponda. Para semáforos de estado (a favor/en riesgo) sumar verde/ámbar/rojo semánticos si no existen ya en la config — agregarlos a `tailwind.config.ts` en vez de hardcodear.
- Cards con fondo suave, radio `rounded-card` (ya definido, 16px), un punto o ícono chico en `bosque` junto al label del indicador, valor grande abajo, delta con flecha de color según esté por encima/debajo de meta.
- Tabs con estado activo en `bosque`/`crema` (fondo claro, texto oscuro, borde verde), igual criterio que la maqueta.
- Gráficas: Chart.js (o la librería de charts que ya usen si suman una), línea verde `bosque` para el valor real, línea gris punteada para la meta.

## Qué NO hacer

- No inventar el cálculo de `valorActual` para indicadores que dependen de Odoo (ventas, márgenes, inventario) sin validar el domain/campos reales — dejarlo en el estado "pendiente de cálculo" que ya devuelve el backend.
- No usar 4 canales (Asesoras/Salones/Retail/Web) como en la maqueta de chat — el enum `Canal` real solo tiene 3 valores.
- No guardar el JWT en `localStorage`.
- No hardcodear colores nuevos si ya existe un token equivalente en `tailwind.config.ts`.
