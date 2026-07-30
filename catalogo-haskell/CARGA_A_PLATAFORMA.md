# Carga de este catálogo a la plataforma comercial

Este documento conecta lo que hay en esta carpeta (el catálogo maestro
traducido, `productos_haskell.xlsx` + `imagenes_principales/`) con el
backend de la plataforma comercial (`backend/`) — el paso que
`README_catalogo.md` dejaba pendiente ("se conectan por SKU... cuando se
arme un catálogo de campaña").

## Dónde vive el código que hace la carga

- `backend/prisma/seeds/catalogo.seed.ts` — lee `productos_haskell.xlsx`,
  crea una campaña + catálogo publicado (canal RETAIL) y sus 143
  `CatalogLine`, copiando las fotos de `imagenes_principales/` a
  `backend/uploads/catalogo/`.
- `backend/prisma/seeds/demo-data.seed.ts` — crea asesores, transportistas
  y pedidos de prueba (inventados) en distintos estados del pipeline, para
  tener datos con que probar Pagos/Almacén/Delivery sin esperar ventas
  reales. Requiere haber corrido antes `catalogo.seed.ts`.

Ninguno de los dos corre automáticamente (no son parte del bootstrap de
producción) — son datos de desarrollo/demo, se invocan a mano:

```bash
cd backend
npm run seed:catalogo
npm run seed:demo
```

## Limitación conocida (2026-07-30)

`ts-node` no ejecuta ningún archivo bajo `prisma/` en la imagen Docker
actual del backend (mismo problema preexistente que ya afectaba a
`prisma/seed.ts`, el bootstrap del usuario administrador — no es algo que
haya roto esta carga). Mientras eso no se resuelva, para correr estos
scripts dentro de Docker hay que compilarlos a JS a mano o correrlos con
Node fuera de Docker, apuntando `CATALOGO_XLSX_PATH`/`CATALOGO_IMAGENES_DIR`
al Excel y la carpeta de imágenes reales.

## Parámetros de conversión de precio (BRL → PEN)

Igual que documenta este mismo README más arriba: tipo de cambio 0.67,
margen 25% — configurables por variable de entorno
(`CATALOGO_TIPO_CAMBIO`, `CATALOGO_MARGEN`) al correr el seed.
