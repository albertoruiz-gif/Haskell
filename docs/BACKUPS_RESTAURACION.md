# Backups y restauración de Postgres (EP-20)

**Estado al 2026-08-17:** backup local automático funcionando en Testeo y
Producción. Backup a S3 (para sobrevivir la pérdida total de una instancia,
no solo un dato mal escrito) queda con el bucket ya creado, pero **falta un
paso manual de Alberto** para que el rol de las EC2 tenga permiso de subir —
ver sección "Pendiente" abajo.

## Qué hace `infra/scripts/backup-postgres.sh`

Corre una vez por día vía cron en cada EC2 (Testeo y Producción, cron
separado en cada una — no versionado, igual que el cron de limpieza de
disco, ver `docs/CI_MEJORAS_FUTURAS.md`):

1. `pg_dump` completo de la base, comprimido con gzip, a
   `/home/ubuntu/backups/haskell-<ambiente>-<fecha>.sql.gz`.
2. Intenta subir una copia a `s3://haskell-postgres-backups-efficax/<ambiente>/`
   usando el contenedor oficial `amazon/aws-cli` (no hace falta instalar
   nada en la instancia). Si el rol IAM todavía no tiene permiso, esto
   falla en silencio (queda registrado en `/home/ubuntu/backups/backup.log`)
   pero **el backup local ya quedó hecho** — no se pierde nada por eso.
3. Borra backups locales de más de 14 días (el disco del t3.small es
   chico — ya se quedó sin espacio una vez, no conviene acumular ahí). En
   S3 la regla de expiración es de 60 días (configurada en el bucket).

## Cron instalado (por SSM, una vez por servidor)

Testeo (`/etc/cron.d/postgres-backup`):
```
10 4 * * * ubuntu BACKUP_AMBIENTE=testeo /home/ubuntu/Haskell/infra/scripts/backup-postgres.sh >> /var/log/postgres-backup.log 2>&1
```

Producción — mismo archivo, `BACKUP_AMBIENTE=produccion`.

## Pendiente — permiso IAM para subir a S3

El bucket `haskell-postgres-backups-efficax` ya existe (privado, cifrado
por defecto, expiración a 60 días). Falta darle al rol `haskell-ec2-role`
permiso para escribir ahí — Claude Code no pudo aplicarlo solo (bloqueado
por el clasificador de permisos, cambios de IAM). Para habilitarlo, correr
esto una vez desde la consola de AWS o con tus propias credenciales de
`aws` CLI:

```bash
aws iam put-role-policy \
  --role-name haskell-ec2-role \
  --policy-name haskell-postgres-backups-s3-write \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::haskell-postgres-backups-efficax",
        "arn:aws:s3:::haskell-postgres-backups-efficax/*"
      ]
    }]
  }'
```

No hace falta reiniciar nada después — el próximo backup (o uno corrido a
mano) ya sube solo a S3 en cuanto el permiso esté puesto.

## Cómo restaurar

**Destructivo — reemplaza la base de datos actual entera.** Pensado para
un desastre real, no para uso casual.

```bash
# 1. Conseguir el dump (local ya está en /home/ubuntu/backups/, o bajarlo de S3):
docker run --rm -v $PWD:/out amazon/aws-cli s3 cp \
  s3://haskell-postgres-backups-efficax/<testeo|produccion>/<archivo>.sql.gz /out/

# 2. Restaurar (pide confirmación escrita, no corre solo):
cd infra
./scripts/restore-postgres.sh /home/ubuntu/backups/<archivo>.sql.gz
```

## Verificar que el cron está corriendo

```bash
cat /var/log/postgres-backup.log   # última corrida
ls -la /home/ubuntu/backups/       # dumps locales
cat /home/ubuntu/backups/backup.log  # si algún intento de subir a S3 falló, queda acá
```
