# Lecciones aprendidas — Integraciones y despliegue (Haskell)

**Propósito de este documento:** capturar cada dificultad real encontrada al integrar y desplegar esta plataforma, para poder replicar el proceso en otra cuenta/cliente sin volver a chocar contra los mismos problemas. No es un tutorial genérico — son gotchas reales, encontrados y resueltos en este proyecto específico, con la parte generalizable señalada aparte de la parte específica de Haskell.

**Última actualización:** 2026-08-13.

---

## 1. Despliegue en AWS EC2 vía SSM (sin CI/CD)

**Contexto:** no hay pipeline de CI/CD real en uso (existe un `.github/workflows/ci-cd.yml` pensado para Kubernetes/ECR, pero nunca se usó). El despliegue real es manual, desde una máquina local con AWS CLI, hacia 2 EC2 con Docker Compose (Testeo y Producción).

**Patrón que funciona:**
```
git pull → docker compose build backend frontend → docker compose up -d backend frontend
→ docker compose exec backend node node_modules/prisma/build/index.js migrate deploy
→ docker compose restart nginx → curl de verificación
```
`nginx` necesita reiniciarse siempre después de reconstruir un contenedor porque cachea la resolución DNS interna de Docker — si no, sigue apuntando al contenedor viejo.

> **2026-08-13 — cambio de `npx prisma migrate deploy` a invocación directa.** El Trivy `image scan` del job `build-and-scan-imagen` (CI/CD) marcaba HIGH/CRITICAL en las dependencias internas del npm global embebido en `node:20-alpine` (tar, glob, minimatch, brace-expansion, ip-address, picomatch, tmp...). Actualizar npm (`npm install -g npm@latest`) no sirvió: la versión `latest` (12.x) requiere Node ≥22 y el runtime usa Node 20 (`EBADENGINE`); fijar `npm@11` sí compiló pero igual dejó HIGH residuales, porque npm libera parches de sus propias dependencias internas con retraso frente a los CVEs publicados — el hallazgo iba a seguir reapareciendo con cada CVE nuevo hasta el próximo release de npm. La solución de raíz fue **borrar npm/npx/corepack del stage final** del Dockerfile y dejar de depender de `npx` en el despliegue: el paquete `prisma` ya viaja en `node_modules` (se instala como dependencia del backend), así que `node node_modules/prisma/build/index.js migrate deploy` corre la migración usando solo el runtime de Node, sin necesitar npm global en la imagen. Aplica igual para cualquier otro cliente con este mismo patrón de Dockerfile multi-stage sobre `node:*-alpine`.

### Dificultades encontradas y cómo se resolvieron

- **`aws ssm send-command` ejecuta como `root`, pero la llave de despliegue de GitHub vive en el usuario `ubuntu`.** `git pull` corrido directo (sin `sudo -u`) falla con `Host key verification failed` / `Permission denied (publickey)` porque busca la llave en `/root/.ssh/` (que no tiene ninguna) en vez de `/home/ubuntu/.ssh/id_ed25519_deploy` (donde de verdad está el deploy key, registrado como tal en el repo de GitHub). El error es engañoso: parece un problema de host key, pero la causa real es el usuario equivocado. Fix: `sudo -u ubuntu git -C /home/ubuntu/Haskell pull` para el pull; el resto del pipeline (`docker compose build/up/exec/restart`) sí puede correr como root sin problema. Por el mismo motivo, cualquier `git log`/`git status` posterior corrido como root sobre ese mismo repo tira `fatal: detected dubious ownership in repository` (git se queja de que el dueño del directorio, `ubuntu`, no coincide con el usuario que ejecuta, `root`) — hay que anteponer `sudo -u ubuntu` también ahí, no solo en el pull. Pasó en ambos ambientes (Testeo y Producción), así que es estructural del setup, no un caso aislado.

- **Forma del payload de `aws ssm send-command`**: con `--parameters file://ruta.json`, el JSON debe ser `{"commands":[...]}` a secas — **no** envuelto en `{"Parameters":{"commands":[...]}}` (esa forma envuelta solo es válida con `--cli-input-json`, no con `--parameters`). Error típico si te equivocás: `ParamValidation: Invalid type for parameter Parameters.Parameters`.

- **El JSON del payload no puede tener BOM** (Byte Order Mark). `[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)` en PowerShell agrega BOM por defecto → error `Expected: '=', received: '\ufeff'`. Hay que escribirlo así:
  ```powershell
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
  ```

- **Mojibake (acentos corruptos) al leer un script local para meterlo en el payload**: `Get-Content -Raw` en PowerShell 5.1 a veces malinterpreta la codificación de un archivo UTF-8 con tildes/ñ. Usar en cambio:
  ```powershell
  [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
  ```

- **Leer el resultado de `aws ssm get-command-invocation` revienta la consola de Windows** si la salida capturada tiene caracteres unicode (✔, ▲ — típicos de `npm`/`docker build`): `'charmap' codec can't encode character`. **El comando remoto ya terminó bien** — el crash es solo al *imprimir* el resultado en PowerShell. Solución: no pedir `StandardOutputContent` completo cuando puede tener unicode; pedir campos puntuales con `--query "Status"`, o mandar un segundo comando de verificación que solo imprima ASCII (códigos HTTP, `docker compose ps`, etc.).

- **Anidar shells (PowerShell → JSON → bash remoto → `docker exec` → `sh -c` → `psql -c`) genera un infierno de comillas** — variables como `$POSTGRES_USER` se expanden en el shell equivocado si no se escapan bien (backtick en PowerShell: `` `$POSTGRES_USER ``). **La solución que mejor funcionó:** evitar comandos inline complejos — codificar el script/SQL en base64, escribirlo a un archivo temporal en el servidor remoto, y ejecutar ese archivo (`bash script.sh` o `psql -f archivo.sql`) en vez de una sola línea con 4 niveles de comillas anidadas.

- **Los comandos de SSM no siempre corren en serie** — a veces sí, a veces se ejecutan en paralelo. No asumir que un comando "está en cola" solo porque otro sigue `InProgress`.

- **Si una llamada de PowerShell tarda más que el timeout de la herramienta (~120s), se manda a segundo plano con un ID que NO es el `CommandId` real de SSM.** Para recuperar el `CommandId` real: `aws ssm list-commands --instance-id <id> --max-items 3`.

- **Agotamiento de disco en las EC2** (7.6GB en Producción, 20GB en Testeo — volúmenes chicos) después de builds repetidos de Docker — el build cache se acumula rápido. Chequear antes de cada tanda de despliegues:
  ```bash
  df -h /
  sudo docker builder prune -af && sudo docker image prune -af
  ```
  Esto liberó entre 1.5GB y 11GB varias veces en esta sesión. **Recomendación a futuro: automatizar esta limpieza (cron semanal) en vez de acordarse a mano.**

- **Agotamiento de memoria** (instancias de 1.9GB RAM, sin swap) puede colgar un build durante 10-15 minutos sin fallar ni avisar — típicamente cuando `npm ci` necesita compilar un módulo nativo (`bcrypt`) desde el código fuente. Señal de que está pasando esto: el contenedor viejo sigue corriendo (no hay corte de servicio) pero el comando de SSM no termina nunca. Solución: `aws ssm cancel-command`, limpiar disco/caché, y reintentar **aislando el build** (solo `backend`, después solo `frontend` — nunca los dos juntos) para bajar el pico de memoria.

- **503 transitorio de GitHub al bajar binarios precompilados** (`bcrypt` descarga su `.node` prebuilt desde GitHub Releases) — no tiene que ver con el código, se resuelve solo reintentando el mismo build minutos después.

**Lección general (aplica a cualquier cliente):** en instancias EC2 chicas sin swap, cualquier integración que dependa de compilar módulos nativos de Node (bcrypt, sharp, etc.) es un punto frágil — vale la pena usar imágenes base con el binario ya compilado, o subir el tamaño de instancia, antes que pelear con esto cada vez.

---

## 2. Integración con Odoo (ERP)

**Cómo se conecta:** XML-RPC (no REST) — endpoints `common` (auth) y `object` (`execute_kw`), con usuario técnico + API key (Ajustes → Cuenta → Seguridad → Nueva clave API en Odoo).

### Dificultades / cosas no obvias

- **Multi-compañía en una sola base de Odoo**: esta instancia de Odoo (`efficaxba-online.odoo.com`) tiene *Efficax* y *Haskell* como compañías separadas dentro de la misma base. **Toda llamada necesita el `company_id` explícito** — confiar en el "por defecto" del usuario técnico es peligroso (puede operar sobre la compañía equivocada silenciosamente). Por eso `ODOO_COMPANY_ID` es una variable obligatoria (la app no arranca sin ella, fail-closed a propósito).

- **El envío de correo transaccional (activación de cuenta, recuperación de clave) se hace 100% a través de Odoo**, no de un servicio de correo aparte:
  ```ts
  // Crea un mail.mail y le pide a Odoo que lo mande
  await this.create('mail.mail', { email_to, subject, body_html, auto_delete: true });
  await this.execute('mail.mail', 'send', [[mailId]]);
  ```
  Esto **reemplaza por completo la necesidad de AWS SES** para correo transaccional — ver sección 4.

- **El dominio de envío real es el subdominio de Odoo** (`efficaxba-online.odoo.com` en este caso), no el dominio propio del cliente (`haskell.com.pe`). Pendiente sin resolver: confirmar si esto afecta la entregabilidad (¿cae en spam?) y si existe una pantalla de "dominio propio de correo" en Odoo Online que permita firmarlo como `haskell.com.pe` — **búsquedas por "dominio" en Ajustes no la encontraron** (llevó a "Seudónimo del dominio", que es para correo *entrante*, y a "Dominio" de Sitio Web, que no tiene nada que ver). Puede que Odoo Online no lo requiera porque ya firma con su propio dominio autenticado.

- **No tengo acceso directo al panel de Odoo** — solo a la API XML-RPC que ya usa la app para datos de negocio (productos, pedidos, contactos). Cualquier configuración que viva en un asistente de la interfaz de Odoo (verificación de dominio, credenciales de Culqi, RSA keys) **no se puede automatizar** — hay que pedirle a la persona que entre, y que pegue/capture lo que Odoo le muestra.

- **Sincronización de productos**: se hace por `default_code` (SKU) contra `product.product` — `OdooClient.buscarProductoIdPorSku()`. Cuidado: si un SKU no existe todavía en Odoo, cualquier integración que dependa de su ID (crear una línea de pedido, un item de lista de precios) debe fallar explícitamente, **nunca mandar un ID inventado o en 0** (ver sección 6, fue un bug real).

- **Widget de Live Chat**: el dominio de la instancia queda hardcodeado en el frontend (`frontend/src/app/layout.tsx`) — al replicar para otro cliente, hay que cambiarlo a mano por el subdominio de su propia instancia Odoo.

---

## 3. Pasarela de pagos — Culqi (Checkout Custom + Yape)

- **Llaves de prueba vs. reales**: `pk_test_.../sk_test_...` vs `pk_live_.../sk_live_...`. Hoy la plataforma solo tiene configuradas las de **test**.

- **La llave pública se hornea en el build del frontend, no se lee en tiempo de ejecución.** Next.js resuelve las variables `NEXT_PUBLIC_*` en el momento de `npm run build` (dentro del Dockerfile), no cuando el contenedor arranca. Consecuencia práctica: **cambiar la llave pública de Culqi exige reconstruir la imagen del frontend entero** — un simple restart del contenedor no alcanza, sigue sirviendo el bundle viejo con la llave vieja.

- **La llave RSA (PEM) no entra bien en un `.env`** porque son varias líneas y `.env` no maneja bien un valor multilínea sin comillas especiales. Solución adoptada: guardar el PEM con `\n` literales (texto, no salto de línea real) y reconstruirlo en código:
  ```ts
  rsaPublicKey: valor.replace(/\\n/g, '\n')
  ```

- **El cobro real** es `POST https://api.culqi.com/v2/charges` con `Authorization: Bearer <privateKey>` y el token que generó el widget en el navegador. El cifrado RSA/AES de ese token es un paso opcional de Culqi que **quedó sin implementar** — no se pudo confirmar en la documentación si `/v2/charges` con un `source_id` ya tokenizado lo exige o no. `rsaId`/`rsaPublicKey` están guardados pero sin consumir en ningún lado todavía.

- **Culqi audita el sitio web antes de aprobar llaves reales** — pide un checklist de cumplimiento (catálogo público, datos de contacto, Términos y Condiciones, Política de Cambios/Devoluciones, Libro de Reclamaciones — este último es un requisito legal de Perú, DS 011-2011-PCM, no específico de Culqi pero que Culqi también exige — ≥5 productos con foto/precio, SSL en todo). **Lección general: antes de pedir llaves de producción a cualquier pasarela de pago, revisar su checklist de aprobación de sitio — es más rápido cumplirlo primero que pelear un rechazo después.**

---

## 4. AWS SES — abandonado

**Lección principal: se pidió acceso de producción a SES sin haber revisado primero si ya existía otra vía para mandar correo.** Cuando se revisó el código, se confirmó que el 100% del correo transaccional de la app ya sale por Odoo (sección 2) — SES **nunca llegó a estar conectado a ningún flujo real** (cero referencias al SDK de AWS SES en todo el código).

AWS rechazó el aumento de límite dos veces, sin explicar criterios específicos (respuesta genérica tipo "no podemos aprobar en este momento, revise nuestras políticas"). Se decidió **dejar de perseguir ese caso** — no había ninguna funcionalidad real esperándolo.

**Cuándo sí valdría la pena en el futuro:** correo masivo/marketing (newsletters, campañas a muchos destinatarios), donde Odoo Online no está pensado para el volumen. No para correo transaccional, que ya funciona.

---

## 5. Base de datos (Prisma + Postgres)

- **Las migraciones se escriben a mano**, no con `prisma migrate dev` en el flujo de producción — conviven en `backend/prisma/migrations/YYYYMMDDHHmmss_descripcion/migration.sql`, aplicadas con `prisma migrate deploy` dentro del contenedor backend.

- **`prisma generate` hay que volver a correrlo cada vez que cambia el schema**, incluso en un contenedor Docker "limpio" para verificación local — si no, TypeScript tira errores falsos (`Property 'x' does not exist on type PrismaService`) que no tienen nada que ver con el código real, solo con que el cliente generado está desactualizado. Pasó varias veces esta sesión y hace perder tiempo si no se reconoce el patrón.

- **Extensión `unaccent` de Postgres** para búsqueda insensible a tildes — mucho más robusto que mantener una lista de sinónimos a mano (`champú`/`champu`/`shampoo`).

- **Migraciones de datos (no solo de esquema) conviene escribirlas idempotentes** — con `WHERE NOT EXISTS (...)` o similar — para poder re-ejecutarlas sin duplicar filas si algún día se recrea la base (se usó este patrón para la carga de inventario real).

---

## 6. Autenticación, sesiones y 2FA

- **Un JWT es "stateless" por diseño — revocarlo de verdad requiere un truco.** No hay forma de "borrar" un token ya emitido. Solución: guardar una marca de tiempo (`sesionesInvalidadasDesde`) por usuario, y comparar el `iat` (fecha de emisión) del token contra esa marca en cada request — un solo `SELECT` indexado por ID, barato. Cualquier cambio de clave, desactivación de cuenta, o "cerrar sesión forzado" solo necesita actualizar esa marca.

- **`otplib` (2FA/TOTP) cambió de API por completo entre versiones.** La v13 (la que instala `npm install otplib` por defecto) reescribió todo a un estilo funcional/por clases — nada de `authenticator.generateSecret()`/`.verify()`/`.keyuri()` como en la documentación clásica. **Fijar la versión a `^12.0.1`** si se busca la API simple y bien documentada.

- **Un secreto TOTP no se puede guardar como hash de una vía** (a diferencia de una contraseña) — hay que poder leerlo de vuelta para calcular el código esperado. Se cifra (AES-256-GCM) con una clave de entorno dedicada, nunca en texto plano en la base.

- **Bug real encontrado, no hipotético:** una integración que crea un `User` directo con Prisma (en vez de pasar por el servicio central de autenticación) se saltó por completo la lógica de plazo de gracia de 2FA — la cuenta hubiera quedado bloqueada sin aviso en su primer login. **Lección: cuando hay más de un lugar en el código que crea el mismo tipo de entidad, sacar la lógica compartida a una función/constante importada — no confiar en que "nadie más la va a necesitar".**

---

## 7. Variables de entorno del frontend (Next.js)

**La más cara de todas si no se sabe de antemano:** cualquier variable `NEXT_PUBLIC_*` se resuelve en el **build**, no en el arranque del contenedor. Si se cambia el valor en `infra/.env` y solo se reinicia el contenedor, el navegador sigue recibiendo el valor viejo (quedó compilado adentro del bundle de JavaScript). Hay que reconstruir la imagen completa.

---

## 8. Git / GitHub en Windows sin git en el PATH

- El binario real de git vive adentro de la instalación de GitHub Desktop, no en el PATH del sistema:
  `C:\Users\<usuario>\AppData\Local\GitHubDesktop\app-<version>\resources\app\git\cmd\git.exe`

- Para que `git push` no se cuelgue pidiendo credenciales de forma interactiva: `$env:GCM_INTERACTIVE = "always"` antes del push (usa el credential manager ya autenticado).

- **Nunca usar `git add -A` a ciegas antes de revisar `git status`** — en esta sesión casi se sube un archivo `.zip` de 11MB sin relación con el código porque estaba suelto en la carpeta del proyecto. El `.gitignore` ya cubre bien los secretos (`.env`, `*.pem`, `*.key`), pero no cubre "cualquier archivo random que alguien dejó ahí".

---

## 9. Entorno de pruebas / testing

- El proyecto arrancó con **cero archivos de test** (`*.spec.ts`) pese a tener `jest`/`ts-jest` instalados — el script `npm test` corría con `--passWithNoTests` para no romper CI. Había que crear primero `jest.config.js` (no existía ningún config) antes de que un solo test pudiera correr.

- **Sin Node.js instalado localmente en la máquina de desarrollo** — todo (`npm install`, `npm test`, `npx tsc --noEmit`, `npx prisma generate`) se corrió vía Docker con bind-mount:
  ```powershell
  docker run --rm -v "<ruta-local>:/app" -w /app node:20-alpine <comando>
  ```
  Esto deja los cambios (node_modules, package-lock.json) reflejados en el host gracias al mount.

---

## Pendientes (a la fecha de este documento)

| Pendiente | Estado | Bloqueado por |
|---|---|---|
| AWS SES | **Cerrado, no se persigue más** | Decisión tomada — Odoo ya cubre el correo transaccional |
| Dominio propio de correo en Odoo (SPF/DKIM para `haskell.com.pe`) | Abierto | No se encontró la pantalla correcta en Odoo; falta confirmar si realmente hace falta (revisar cabeceras de un correo real primero) |
| Culqi — cifrado RSA/AES del token de pago | Sin implementar | No se pudo confirmar en la documentación de Culqi si es obligatorio |
| Culqi — llaves de producción (live) | Pendiente | El usuario debe generarlas en su panel cuando esté listo para cobrar de verdad |
| Culqi — usuario/clave de prueba para el revisor | **Resuelto 2026-08-14** | Se reutilizó una cuenta de Asesor demo ya existente en Testeo (canal RETAIL, con dirección y tarifa activas — llega hasta el checkout de Culqi sin tocar EP-21 porque CONTADO_CULQI sigue siendo el default sin exigir Cliente), se le fijó una contraseña conocida vía hash bcrypt generado con el propio `bcrypt` del backend, y se verificó con un login real contra la API. Esto SÍ era una acción técnica que se podía hacer sin depender del usuario — la categoría anterior ("acción del usuario") estaba mal puesta. |
| EP-13 (boleta/factura electrónica) | Bloqueado | Falta elegir proveedor de comprobante electrónico (CPE) |
| EP-19 (cobertura de tests) | Arrancado, incompleto | Se agregaron tests junto a cada fix crítico (46 al momento de este documento) — falta cobertura del resto del sistema |
| EP-21 (clientes/crédito), EP-17 (notificaciones proactivas) | Sin empezar | Requieren definición de negocio antes de programar |
| Pantalla de gestión de cuentas administrativas | Resuelto | — |
| Revisión legal formal de Términos/Política de Cambios/Anexo III | Pendiente | Requiere abogado, deprioritizado a pedido del usuario |
| Automatizar limpieza de disco en las EC2 (`docker prune`) | Sugerido, no implementado | Hoy se hace a mano antes de cada tanda de despliegues |

---

*Este documento se arma para que cualquier sesión futura (de este agente o de otro) pueda retomar sin repetir el mismo descubrimiento por prueba y error. Actualizarlo cada vez que aparezca una dificultad nueva no cubierta acá.*
