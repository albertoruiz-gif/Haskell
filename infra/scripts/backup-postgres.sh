#!/usr/bin/env bash
# EP-20: backup diario de Postgres — corre vía cron en cada EC2 (Testeo/
# Producción, ver /etc/cron.d/postgres-backup en cada servidor, no
# versionado — se crea a mano una vez por SSM, igual que el cron de
# limpieza de disco).
#
# 1) Dump lógico comprimido a disco local (uploads/pgdata no se tocan).
# 2) Intenta subir una copia a S3 — best-effort: si el rol IAM de la
#    instancia todavía no tiene el permiso s3:PutObject sobre el bucket
#    (ver política inline "haskell-postgres-backups-s3-write" pendiente de
#    aplicar por Alberto), esto falla y el script sigue igual — el backup
#    local ya quedó hecho, que es lo que protege contra un dato mal escrito
#    o una migración que salió mal.
# 3) Poda backups locales de más de 14 días (no queremos llenar el disco
#    otra vez — el t3.small ya se quedó sin espacio una vez, ver
#    docs/LECCIONES_APRENDIDAS_INTEGRACIONES.md). S3 tiene su propia regla
#    de expiración a 60 días.
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="/home/ubuntu/backups"
AMBIENTE="${BACKUP_AMBIENTE:-desconocido}"  # "testeo" | "produccion", fijado en el cron
FECHA="$(date +%Y%m%d-%H%M%S)"
ARCHIVO="haskell-${AMBIENTE}-${FECHA}.sql.gz"
BUCKET="haskell-postgres-backups-efficax"

mkdir -p "$BACKUP_DIR"
cd "$INFRA_DIR"

docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$BACKUP_DIR/$ARCHIVO"
echo "[$(date)] Backup local OK: $BACKUP_DIR/$ARCHIVO ($(du -h "$BACKUP_DIR/$ARCHIVO" | cut -f1))"

if docker run --rm -v "$BACKUP_DIR:/backups" amazon/aws-cli s3 cp "/backups/$ARCHIVO" "s3://$BUCKET/$AMBIENTE/$ARCHIVO" >> "$BACKUP_DIR/backup.log" 2>&1; then
  echo "[$(date)] Subido a S3: s3://$BUCKET/$AMBIENTE/$ARCHIVO"
else
  echo "[$(date)] No se pudo subir a S3 (¿falta el permiso IAM todavía?) — el backup local igual quedó guardado." | tee -a "$BACKUP_DIR/backup.log"
fi

find "$BACKUP_DIR" -name 'haskell-*.sql.gz' -mtime +14 -delete
