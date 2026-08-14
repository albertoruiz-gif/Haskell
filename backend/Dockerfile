FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
# Poda las devDependencies (eslint, jest, ts-node, @nestjs/cli...) antes de
# copiar node_modules al runtime: además de aligerar la imagen, esas
# herramientas de desarrollo arrastraban sus propias dependencias
# transitivas (glob, picomatch, tmp) con CVEs HIGH que Trivy marcaba, pese a
# no usarse nunca en producción. `prisma` se movió a "dependencies" en
# package.json porque migrate deploy sí corre en runtime.
RUN npm prune --omit=dev

FROM node:20-alpine AS runtime
# Actualiza paquetes del SO (parches de seguridad de Alpine, ej. openssl) y
# elimina el npm/npx global embebido en la imagen base: sus dependencias
# internas (tar, glob, minimatch, brace-expansion, ip-address, picomatch,
# tmp...) traen CVEs HIGH/CRITICAL que Trivy marca en el escaneo de imagen, y
# como npm libera parches de esas dependencias con retraso frente a los CVEs
# publicados, "actualizar npm" no evita que vuelvan a aparecer — solo
# borrarlo lo hace. El despliegue real ya NO depende de `npx`: las
# migraciones se aplican con `node node_modules/prisma/build/index.js
# migrate deploy` (ver docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md), que solo
# usa el runtime de Node y el paquete `prisma` ya presente en node_modules.
RUN apk update && apk upgrade --no-cache && apk add --no-cache openssl \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
RUN mkdir -p uploads && chown -R app:app /app
USER app
EXPOSE 3000
CMD ["node", "dist/main.js"]
