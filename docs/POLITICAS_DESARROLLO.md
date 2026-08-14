# Políticas de desarrollo — Haskell

**Propósito:** un solo documento que reúne la metodología, la estructura y las prácticas de auditoría/verificación que rigen este proyecto — para que cualquier persona o agente de IA pueda retomarlo sin tener que ir a buscar tres documentos distintos en tres carpetas distintas.

**Última actualización:** 2026-08-13.

---

## 0. Los tres documentos y cómo se relacionan

Este proyecto ya tenía gobernanza formal antes de este documento — acá no se reinventa nada, se consolida:

| Documento | Dónde vive | Qué es |
|---|---|---|
| **`Metodologia_Efficax_Spec_Driven_Development.md`** | `C:\Users\Lenovo ideaPad\Desktop\SDD\` (fuera de este repo) | El marco **completo** de Efficax (E-SDD): 8 fases, 7 gates formales, roles dedicados (Product Owner, QA, Arquitecto...), ADRs, plantilla de especificación. Pensado para proyectos con equipo completo. |
| **`CONSTITUTION.md`** | Raíz de este repo | El **contrato operativo real** para este proyecto — una versión ligera de E-SDD, sin los 7 gates formales ni roles dedicados (no existen todavía en Haskell). Es la que de verdad aplica día a día. |
| **Este documento** (`docs/POLITICAS_DESARROLLO.md`) | `docs/` de este repo | Resume ambos + agrega lo que CONSTITUTION.md no cubre: la práctica real de auditoría de seguridad y el checklist de verificación antes de cada despliegue. |

**Regla de precedencia:** si algo de este documento contradice a `CONSTITUTION.md`, gana `CONSTITUTION.md` — actualizar ese archivo primero, este después.

---

## 1. Principio rector (heredado de E-SDD)

> La especificación es la fuente de verdad. El código es un subproducto de la especificación, no al revés.

En este proyecto, la versión ligera de esa regla (§7 de `CONSTITUTION.md`) es:

- **Cambio de regla de negocio no trivial** (estados, permisos, cálculos de dinero o stock) → primero un `SPEC-XXX.md` corto en `docs/specs/` (actores/permisos, estados, matriz de transiciones, invariantes `INV-XXX`, criterios Given/When/Then — plantilla completa en la Metodología §6).
- **No hay Product Owner ni QA dedicados** en este proyecto → el equivalente de esas aprobaciones es **la confirmación explícita del usuario en el chat**, antes de tocar algo del nivel "⚠️ Preguntar primero" (ver §3 abajo).
- **Cambio chico y de bajo riesgo** (fix puntual, ajuste de estilos/texto) → no necesita `SPEC-XXX.md`.

En la práctica de esta sesión, esto se aplicó como: antes de construir algo grande y nuevo (2FA, Clientes/Crédito), se presentan las opciones con una recomendación y se piden decisiones concretas (con `AskUserQuestion` cuando son 1-4 decisiones puntuales) — **eso es el gate G2 de la Metodología completa ("especificación validada"), en su versión de una sola persona.**

---

## 2. Estructura real del repositorio

```
backend/src/modules/<feature>/   → un módulo NestJS por capacidad
                                    (*.controller.ts, *.service.ts, *.module.ts, dto/, *.spec.ts)
backend/src/common/               → guards y decorators compartidos (roles, scope, service-key, public)
backend/src/config/               → PrismaService, SecretsService (AWS Secrets Manager en producción)
backend/prisma/schema.prisma      → schema único
backend/prisma/migrations/        → nunca se edita una migración ya aplicada; siempre una nueva
backend/prisma/seeds/             → cada seed exporta seedX(prisma) + bloque if (require.main === module)
frontend/src/app/                 → rutas de Next.js App Router
frontend/src/components/          → componentes, agrupados por dominio (admin/, auth/, catalogo/, ui/...)
frontend/src/lib/                 → helpers compartidos (api.ts, auth.ts...)
docs/                             → documentación de arquitectura, operación y specs
docs/specs/                       → un SPEC-XXX.md por funcionalidad no trivial (nuevo, todavía sin usar)
infra/                            → docker-compose.yml (local + EC2), k8s/ (manifiestos EKS, no usados hoy)
.github/workflows/ci-cd.yml       → pipeline definido pero no es el camino real de despliegue (ver
                                     docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md §1 — el despliegue real es
                                     manual vía SSM a 2 EC2, no vía este pipeline)
```

**No duplicar lógica de negocio entre controlador, servicio y frontend** — un único lugar calcula cada regla. Ejemplo real de esta sesión: `stockDisponible` se deriva siempre de los lotes en `InventarioService`, nunca se vuelve a calcular en otra capa. Cuando se encontró una violación de esto (`GerentesComercialesService` duplicaba la lógica de creación de usuario en vez de reusar `AuthService.crearUsuario()`, y por eso se le olvidó una regla nueva) se corrigió sacando la lógica compartida a un archivo aparte (`roles-2fa.ts`) — ver `docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md §6`.

---

## 3. Sistema de 3 niveles de autonomía (de `CONSTITUTION.md` §6)

### ✅ Siempre hacer, sin preguntar
- Correr `tsc --noEmit` (backend y frontend) y la suite de `jest` antes de dar un cambio por terminado.
- Convertir cualquier alta de datos de prueba en un seed reutilizable — nunca dejarla como un comando suelto.
- Crear una migración nueva de Prisma cuando cambia el schema — nunca editar una ya aplicada.
- Actualizar `docs/` cuando la implementación revele que el plan original estaba incompleto.

### ⚠️ Preguntar primero (confirmación explícita en el chat)
- Agregar/actualizar dependencias de `package.json`.
- Cambiar el schema de forma que afecte datos ya existentes, o cualquier migración destructiva.
- Modificar el pipeline de CI/CD, `docker-compose.yml` o los manifiestos de `infra/k8s/`.
- Cambiar una regla de negocio ya implementada sin antes registrarla en la especificación.
- Acciones difíciles de revertir o de cara al usuario final: reiniciar una EC2 de Producción, tocar precios/stock reales, cambiar credenciales de pago.

### 🚫 Nunca hacer
- Subir secretos, llaves o credenciales al repo (`.env` real nunca; sí `.env.example`).
- Borrar o comentar un test que falla para poder avanzar — diagnosticar la causa, o documentar por qué el escenario dejó de aplicar.
- Editar `node_modules/` o una migración ya aplicada.
- Ignorar un error de TypeScript o una advertencia del compilador.
- Incluir archivos de datos crudos ajenos al código en un commit (ejemplo real: un `.zip` de 11MB que quedó suelto en la carpeta del proyecto — nunca se subió sin confirmación explícita).

---

## 4. La práctica real de auditoría (no está en CONSTITUTION.md — se agrega acá)

Esta sesión estableció un patrón de auditoría en dos modalidades distintas, ambas verificadas contra el código real, nunca contra suposiciones:

### 4.1 Auditoría de seguridad
Ciclo: **revisar código real → listar hallazgos concretos con escenario de falla → corregir los más críticos → verificar en vivo que la corrección funciona** (ej.: 7 intentos de login rápidos para confirmar que el bloqueo por intentos fallidos realmente corta al quinto intento, no solo en la lectura del código).

No se aceptó "parece que funciona" — cada corrección crítica de esta sesión (bloqueo de cuenta, rate limiting, path traversal en subida de archivos, secreto JWT fail-closed, CORS, revocación de sesión, `odooProductId` hardcodeado, guardas de estado de pedido) se verificó con al menos una prueba automatizada real, no solo lectura de código.

### 4.2 Auditoría de pendientes/épicas
Ciclo: **leer el reporte existente → verificar cada afirmación contra el código actual (no asumir que sigue vigente) → corregir el reporte donde ya cambió → priorizar por criticidad real (riesgo de plata/datos, no por orden de la lista) → atacar de mayor a menor riesgo**.

Ejemplo real: un reporte de pendientes decía "43% completo, 4 pendientes" en la épica de usuarios — al revisar el código se encontró que 2 de esos 4 ya estaban resueltos por un trabajo de seguridad posterior a la fecha del reporte. Se corrigió el reporte antes de seguir, en vez de trabajar sobre un diagnóstico desactualizado.

**Regla general: un reporte o una memoria vieja es un punto de partida, no un hecho — se verifica contra el código antes de citarlo como cierto.**

---

## 5. Checklist de verificación antes de cada despliegue (práctica real, no está en CONSTITUTION.md)

Aplicado sin excepción en cada cambio de esta sesión, chico o grande:

1. `npx prisma generate` (backend) — si el schema cambió, evita errores de TypeScript fantasma por un cliente Prisma desactualizado.
2. `npx jest` (backend) — toda la suite, no solo los tests nuevos.
3. `npx tsc --noEmit` (backend **y** frontend, por separado).
4. Recién ahí: `git add` (revisando `git status` primero, nunca `-A` a ciegas) → commit con mensaje que referencia qué regla/épica se está tocando → push.
5. Desplegar primero a **Testeo**, nunca directo a Producción.
6. Verificar Testeo con una llamada real (`curl` a un endpoint, o una consulta SQL de confirmación) — no asumir que "compiló" significa "funciona en el servidor".
7. Recién con Testeo verificado, desplegar a **Producción**.
8. Verificar Producción igual que Testeo.
9. Para cambios que tocan datos reales (precios, stock, credenciales) — confirmación explícita del usuario antes del paso 7, aunque Testeo ya haya salido bien.

Ver `docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md §1` para las dificultades técnicas específicas de este checklist (disco lleno, memoria agotada, cómo leer resultados sin que la consola de Windows explote con caracteres unicode).

---

## 6. Testing — política real, no aspiracional

El proyecto arrancó con cero tests. La política que se siguió (y que continúa) no fue "parar todo y escribir tests de todo el sistema" — fue:

- **Todo fix de una regla crítica (invariante, transición de estado, cálculo de dinero o stock) trae sus propios tests, en el mismo cambio, no como tarea aparte.**
- Los tests verifican **comportamiento real**, no que "se llamó a una función". Ejemplo: los tests de 2FA usan la librería TOTP real (no mockeada) — generan un secreto de verdad, calculan un código válido para ese secreto exacto, y confirman que el sistema lo acepta y que un código cualquiera no.
- `jest.config.js` no existía — se creó la primera vez que hizo falta, no antes.

---

## 7. Idioma y estilo del código

- Nombres de variables, comentarios y términos de negocio: **español**, consistente con el equipo y el cliente.
- Los comentarios explican **por qué**, no qué (el código ya dice qué) — con fecha y contexto cuando corrige algo (`// Auditoría de seguridad 2026-08-10: ...`, `// EP-18 (2026-08-12): ...`).
- Comunicación con el usuario: español neutro de Latinoamérica, sin modismos regionales.

---

## 8. Qué falta para acercarse más a E-SDD completo

Del checklist de adopción de la Metodología (`Metodologia_Efficax_Spec_Driven_Development.md` §14), lo que este proyecto todavía no tiene:

- Ningún `SPEC-XXX.md` real todavía en `docs/specs/` (la carpeta existe como convención, no como práctica usada).
- Sin ADRs (`ADR-XXX`) registrados para decisiones de arquitectura ya tomadas.
- Sin ambientes de QA separados con gate de Product Owner formal — hoy la aprobación es la confirmación del usuario en el chat.
- Sin pipeline de CI/CD real bloqueando despliegues (existe el archivo, no se usa).

Esto no es urgente per se, pero sí un objetivo claro si el proyecto crece o se replica para otro cliente con equipo más grande.

---

*Documento vivo — actualizar cuando la práctica real diverja de lo escrito acá, igual que `CONSTITUTION.md`.*
