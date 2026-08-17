#!/usr/bin/env bash
# EP-20: restaurar Postgres desde un dump (uno hecho por backup-postgres.sh,
# local o bajado de S3 con `docker run --rm -v $PWD:/out amazon/aws-cli s3 cp
# s3://haskell-postgres-backups-efficax/<ambiente>/<archivo> /out/`).
#
# DESTRUCTIVO — reemplaza la base de datos actual entera. Pide confirmación
# explícita a propósito, para que no se pueda correr por accidente ni
# copiando/pegando el comando sin pensar.
#
# Uso: ./restore-postgres.sh /ruta/al/backup.sql.gz
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVO="${1:-}"

if [ -z "$ARCHIVO" ] || [ ! -f "$ARCHIVO" ]; then
  echo "Uso: $0 /ruta/al/backup.sql.gz"
  exit 1
fi

echo "⚠️  Esto va a BORRAR y reemplazar la base de datos actual con el contenido de:"
echo "    $ARCHIVO"
echo "Escribí 'restaurar' (sin comillas) para confirmar, cualquier otra cosa cancela:"
read -r CONFIRMACION
if [ "$CONFIRMACION" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

cd "$INFRA_DIR"
gunzip -c "$ARCHIVO" | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
echo "Restauración completa."
