# Prompt para Claude en VS Code — Requisitos de aprobación web de Culqi

Pega esto tal cual en Claude Code, en la raíz del repo `Haskell`. Los datos reales del negocio ya están cargados abajo (confirmados por Alberto).

## Datos reales del negocio (ya confirmados)

- **Titular:** Juan Alberto Ruiz Díaz — persona natural con negocio, RUC 10095397757 (RER), operando bajo la marca comercial **Haskell / Haskell Cosméticos**.
- **Dirección:** Av. Géminis H-16, San Borja, Lima, Perú.
- **Teléfono:** +51 999 420 044.
- **Correo:** alberto.ruiz@efficaxba.com (alterno: ja.ruidiaz@gmail.com).
- **Sitio:** haskell.com.pe.
- **Redes sociales:** @haskell_distribuidor — **confirmar en qué red(es) exactas (Instagram/Facebook/TikTok) antes de poner los íconos en el footer**, Alberto solo dio el handle sin especificar plataforma.
- **Plazo de devolución:** 7 días calendario, el costo del envío de devolución lo asume la empresa.
- **Productos públicos:** no hace falta elegir 5 a mano — el endpoint público (sección 1) los trae dinámicamente desde el catálogo ya cargado en Postgres (`destacado: true`, o los últimos publicados si hay menos de 5 destacados). Antes de dar por cumplido el requisito de Culqi, verifica que al menos 5 líneas publicadas tengan `imagenUrl` cargada — si no, súbelas primero desde `POST /catalogo/admin/lineas/:id/foto`.

---

## Contexto

Culqi no aprueba la afiliación si la web no cumple un checklist básico de comercio real y transparente. Hoy casi todo el sitio (`Haskell/frontend`) vive detrás de login de asesor — no hay nada público. Además, el Libro de Reclamaciones es una obligación legal en Perú (DS 011-2011-PCM, DS 006-2014-PCM, Ley 31435) independiente de Culqi: toda web que ofrezca productos/servicios debe tenerlo, exista o no pasarela de pago.

Se decidió **autoconstruir el Libro de Reclamaciones dentro de Haskell** (no contratar un SaaS externo) para no tener costo recurrente ni dependencia de terceros.

## Checklist de Culqi → qué construir

| Requisito Culqi | Qué hacer |
|---|---|
| Qué vende el negocio | Home pública `/` con descripción del negocio |
| Datos de contacto | Footer + página `/contacto` |
| Íconos de redes sociales | Footer |
| Términos y condiciones | Página `/legal/terminos-y-condiciones` |
| Política de cambios/devoluciones | Página `/legal/politica-de-cambios-y-devoluciones` |
| Libro de Reclamaciones (INDECOPI) | Módulo propio, ver sección dedicada abajo |
| Mínimo 5 productos públicos con foto/descripción/precio | Endpoint público + página `/catalogo` (o sección en home) sin login |
| Carrito/botón Comprar | Ya existe (`carrito/page.tsx`) — solo falta que el visitante pueda *ver* el catálogo antes de loguearse; comprar puede seguir requiriendo cuenta de asesor, eso no lo objeta Culqi |
| Usuario/contraseña de prueba para Culqi | Ya lo tiene Alberto (cuentas de asesor reales de prueba) — no requiere cambios de código |
| SSL en toda la web | Ya está (Let's Encrypt) — no requiere cambios |

## Código existente que ya sirve — no lo recrees

- `backend/prisma/schema.prisma` — `CatalogLine` ya tiene `imagenUrl`, `imagenesAdicionales`, `destacado` (booleano), `descripcion`, `pvpCampania`. No falta nada en el modelo para el catálogo público.
- `backend/src/modules/catalog/catalog.controller.ts` — `GET /catalogo` ya existe pero requiere JWT y filtra por canal del usuario logueado. Hay que agregar un endpoint **nuevo y separado**, no modificar este.
- Subida de fotos ya funciona: `POST /catalogo/admin/lineas/:id/foto` — si los 5+ productos elegidos no tienen `imagenUrl` cargada todavía, hay que subirlas primero desde ahí antes de que el catálogo público tenga algo que mostrar.
- `frontend/src/app/carrito/page.tsx`, `frontend/src/components/admin/PagosTab.tsx` — flujo de compra ya funcional, no lo toques salvo lo indicado en `PROMPT_culqi_integracion.md` (ese es otro prompt, para el cargo automático de Culqi).

## 1. Backend — endpoint público de catálogo

Nuevo endpoint en `catalog.controller.ts`, **sin** `@UseGuards`/`@Roles` (público):

```
GET /catalogo/publico
```

- Trae líneas de catálogos con `estado: 'PUBLICADO'`, `destacado: true`, de cualquier canal (o el canal principal del negocio — decidir cuál si hay más de uno).
- Si hay menos de 5 con `destacado: true`, completa hasta 5 con las más recientes publicadas (no dejar la vitrina pública con menos de 5, es justo lo que pide Culqi).
- Devuelve **solo** `sku, nombre, descripcion, pvp (pvpCampania), imagenUrl, imagenesAdicionales` — nunca `precioAsesor` ni datos de stock/inventario, eso es información interna del canal de asesoras.

## 2. Frontend — páginas públicas (fuera del layout autenticado)

Revisa primero cómo `frontend/src/app/layout.tsx` decide qué requiere sesión — las páginas nuevas van fuera de ese guard.

- **`/` (home pública)**: qué vende el negocio (2-3 párrafos), sección con los productos de `GET /catalogo/publico` (foto, nombre, descripción corta, precio), footer.
- **`/contacto`**: teléfono, correo, dirección física, íconos de redes sociales (con links reales).
- **Footer global** (para que aparezca en todas las páginas públicas y logueadas): enlaces a Términos y Condiciones, Política de Cambios y Devoluciones, Libro de Reclamaciones, datos de contacto, íconos de redes sociales. El enlace al Libro de Reclamaciones debe llegar en **máximo 2 clics** desde cualquier página pública (ley, no solo buena práctica).

## 3. Libro de Reclamaciones — autoconstruido

Requisitos legales verificados (DS 011-2011-PCM y normativa asociada):
- Accesible en ≤2 clics desde cualquier página pública.
- Aviso informativo visible (formato "Anexo III") en checkout/pago, página de contacto, términos y condiciones, y en el correo de confirmación de compra si existe.
- Al recibir un reclamo, generar **constancia electrónica inmediata con código único y fecha** — mostrarla en pantalla y permitir imprimirla o (si hay forma de enviar correo, ver nota abajo) mandarla al email del consumidor.
- Conservar los reclamos mínimo 2 años.
- El formulario debe distinguir **Reclamo** (disconformidad con el producto/servicio) de **Queja** (disconformidad con la atención, no con el producto en sí) — son categorías legales distintas, no cosméticas.
- Campos mínimos del formulario: datos del consumidor (nombre, tipo y N° de documento, domicilio, teléfono, correo), identificación del bien/servicio reclamado, tipo (reclamo/queja), detalle, y el pedido concreto del consumidor.

**Backend** — nuevo módulo `backend/src/modules/libro-reclamaciones/`:
- Modelo Prisma `Reclamo`: `id, codigo String @unique (código correlativo o UUID corto legible), tipo (enum RECLAMO|QUEJA), consumidorNombre, consumidorTipoDocumento, consumidorNumeroDocumento, consumidorDomicilio, consumidorTelefono, consumidorEmail, bienOServicioReclamado String, montoReclamado Decimal?, detalle String, pedidoConsumidor String, estado (enum RECIBIDO|EN_PROCESO|RESPONDIDO), respuesta String?, respondidoPorId String?, createdAt, respondidoEn DateTime?`.
- Migración siguiendo la convención ya usada en el proyecto (`prisma/migrations/YYYYMMDDHHMMSS_descripcion/migration.sql`).
- `POST /libro-reclamaciones` — público, sin guard, crea el reclamo, genera `codigo` único, devuelve `{ codigo, fecha }` para mostrar la constancia en pantalla.
- `GET /libro-reclamaciones/:codigo` — público, para que el consumidor consulte el estado de su propio reclamo con el código que recibió.
- `GET /libro-reclamaciones` y `PATCH /libro-reclamaciones/:id/responder` — con `@Roles('ADMINISTRADOR', 'GERENTE_COMERCIAL')`, para gestionar y responder reclamos desde el panel interno.
- Nota sobre el correo de confirmación: **no existe todavía un servicio de envío de emails en el backend** (se revisó — no hay `nodemailer` ni integración SES). Si quieren mandar la constancia por correo automáticamente, eso es trabajo adicional (nuevo servicio de email) — para la primera versión, mostrar el código en pantalla y permitir imprimir/copiar es suficiente para cumplir la ley (que exige "permitir" imprimir o enviar copia, no necesariamente que sea automático por correo si el usuario puede copiarlo/imprimirlo él mismo). Confírmalo si quieren ir más allá.

**Frontend**:
- `/legal/libro-de-reclamaciones` — formulario público con los campos de arriba, muestra el código de constancia al enviar.
- Componente reutilizable con el aviso "Anexo III" (texto abajo), insertado en checkout, `/contacto` y `/legal/terminos-y-condiciones`. **Verifica el texto exacto del Anexo III contra el DS 011-2011-PCM antes de publicarlo** — el texto de abajo es la versión comúnmente citada, no fue copiada letra por letra de una fuente oficial en este prompt:

> Este establecimiento cuenta con un Libro de Reclamaciones a disposición del consumidor, conforme a lo establecido en el Código de Protección y Defensa del Consumidor. Puede acceder a él en: [enlace a /legal/libro-de-reclamaciones].

## 4. Contenido — Términos y Condiciones y Política de Cambios/Devoluciones

Van como borrador abajo. **No son asesoría legal — son plantillas base que deben pasar por revisión de un abogado antes de publicarse**, especialmente los plazos de devolución (la ley peruana exige mínimo 7 días calendario para desistimiento en ventas a distancia, Art. 45 del Código de Protección y Defensa del Consumidor — verificar que el plazo que se publique no sea menor a eso).

### `/legal/terminos-y-condiciones` (borrador)

```markdown
# Términos y Condiciones

**Juan Alberto Ruiz Díaz**, persona natural con negocio identificada con RUC **10095397757** (acogido al Régimen Especial de Renta — RER), operando bajo la marca comercial **Haskell / Haskell Cosméticos**, con domicilio en **Av. Géminis H-16, San Borja, Lima, Perú** (en adelante, "la Empresa"), pone a disposición de los usuarios el presente sitio web sujeto a los siguientes términos:

## 1. Objeto
La Empresa comercializa **productos de belleza y cuidado personal** a través de este sitio (haskell.com.pe) y de su red de asesoras/asesores comerciales.

## 2. Registro y cuentas
El acceso a la compra requiere registro como asesor/a autorizado/a. La Empresa se reserva el derecho de verificar la identidad de los usuarios registrados.

## 3. Precios y pagos
Los precios se muestran en Soles (S/) e incluyen los impuestos de ley. El pago se procesa mediante Culqi (Yape) u otros medios que la Empresa habilite. Todo pedido queda sujeto a confirmación de pago y disponibilidad de stock.

## 4. Envíos
Los plazos y costos de envío se calculan según el distrito de entrega registrado, y se muestran antes de confirmar el pedido.

## 5. Cambios y devoluciones
Ver [Política de Cambios y Devoluciones](/legal/politica-de-cambios-y-devoluciones).

## 6. Libro de Reclamaciones
La Empresa cuenta con Libro de Reclamaciones Virtual conforme al Código de Protección y Defensa del Consumidor. [Acceder aquí](/legal/libro-de-reclamaciones).

## 7. Protección de datos personales
Los datos personales recopilados se tratan conforme a la Ley N° 29733, Ley de Protección de Datos Personales, y su reglamento. **[PLACEHOLDER: confirmar si existe una Política de Privacidad separada o si se incluye aquí — no fue definida todavía]**.

## 8. Contacto
alberto.ruiz@efficaxba.com · +51 999 420 044 · Av. Géminis H-16, San Borja, Lima, Perú

## 9. Modificaciones
La Empresa puede modificar estos términos en cualquier momento; la versión vigente es la publicada en este sitio.

*Última actualización: [PLACEHOLDER: fecha de publicación — poner la fecha real al momento de publicar]*
```

### `/legal/politica-de-cambios-y-devoluciones` (borrador)

```markdown
# Política de Cambios y Devoluciones

## Desistimiento (ventas a distancia)
Conforme al Art. 45 del Código de Protección y Defensa del Consumidor, el consumidor tiene derecho a desistirse de la compra dentro de los **7 días calendario** siguientes a la recepción del producto, sin necesidad de expresar causa, siempre que el producto no haya sido usado y conserve su empaque original.

## Cómo solicitar un cambio o devolución
1. Escribir a **alberto.ruiz@efficaxba.com** o al **+51 999 420 044** indicando el número de pedido.
2. La Empresa confirma la procedencia del cambio/devolución en un plazo de **[PLACEHOLDER: plazo — no fue definido, sugerir 2 días hábiles]**.
3. El costo de envío de la devolución lo asume **la Empresa**.

## Productos no sujetos a devolución
**[PLACEHOLDER: ej. "productos de higiene personal abiertos o usados, por razones sanitarias" — definir con el negocio antes de publicar]**.

## Reembolsos
Los reembolsos se realizan por el mismo medio de pago utilizado, en un plazo de **[PLACEHOLDER: plazo — no fue definido, sugerir 7 días hábiles]** desde la confirmación de la devolución.

## Reclamos
Si no está conforme con la resolución, puede presentar un reclamo en nuestro [Libro de Reclamaciones](/legal/libro-de-reclamaciones).

*Última actualización: [PLACEHOLDER: fecha]*
```

## Qué NO hacer

- No inventes RUC, dirección, teléfono o redes sociales — todos los `[PLACEHOLDER]` deben venir de Alberto antes de publicar.
- No publiques el texto del Anexo III ni los plazos de devolución sin verificarlos contra la norma oficial vigente — son los dos puntos con más riesgo legal si están mal.
- No expongas `precioAsesor`, stock, ni ningún dato interno del canal de asesoras en el endpoint público de catálogo.
- No elimines ni modifiques el `GET /catalogo` existente (autenticado) — el público es un endpoint nuevo y separado.
- No conectes el Libro de Reclamaciones a envío automático de correo si no existe ya un servicio de email — deja el código de constancia visible en pantalla como cumplimiento mínimo, y flagea el envío por correo como mejora futura si no está resuelto.

## Lo único que sigue pendiente antes de publicar

- Confirmar en qué red(es) social(es) exactas está `@haskell_distribuidor` (Instagram/Facebook/TikTok) para linkear los íconos del footer correctamente.
- Definir la lista de productos excluidos de devolución (higiene personal abierta, etc.).
- Definir los plazos de confirmación de cambio/devolución y de reembolso (dejé sugeridos 2 y 7 días hábiles como punto de partida, no son definitivos).
- Que un abogado revise el texto final de Términos, Política de Cambios y el aviso Anexo III antes de publicarlos — siguen siendo plantilla, no asesoría legal.
