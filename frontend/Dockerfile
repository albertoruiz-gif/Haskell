FROM node:20-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ARG NEXT_PUBLIC_ODOO_LIVECHAT_ACTIVO
ENV NEXT_PUBLIC_ODOO_LIVECHAT_ACTIVO=${NEXT_PUBLIC_ODOO_LIVECHAT_ACTIVO}
ARG NEXT_PUBLIC_CULQI_PUBLIC_KEY
ENV NEXT_PUBLIC_CULQI_PUBLIC_KEY=${NEXT_PUBLIC_CULQI_PUBLIC_KEY}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
# Igual que en backend/Dockerfile: parches de SO (openssl/libcrypto3 vía
# apk upgrade) y elimina el npm/npx global embebido, cuyas dependencias
# internas (tar, glob, minimatch, brace-expansion...) traían CVEs
# HIGH/CRITICAL en el escaneo de Trivy. El frontend en runtime no invoca
# npm/npx para nada (`CMD ["node", "server.js"]` standalone de Next.js), así
# que a diferencia del backend no hace falta reemplazarlo por nada: se borra
# sin más.
RUN apk update && apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
