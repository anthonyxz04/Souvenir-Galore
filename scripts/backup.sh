#!/usr/bin/env bash
# Back up the Souvenir Galore database (and local image storage, if used).
#
#   ./scripts/backup.sh                 # uses DATABASE_URL from the environment or .env
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh
#   ./scripts/backup.sh --compose       # dump from the docker-compose "db" container
#
# Produces timestamped files in $BACKUP_DIR (default ./backups):
#   db-YYYYmmdd-HHMMSS.dump      PostgreSQL custom-format dump (restore with pg_restore)
#   storage-YYYYmmdd-HHMMSS.tgz  local uploads (only when STORAGE_DRIVER=local)
# Keeps the newest $KEEP_DAYS days of backups (default 14).
#
# Copy the backups OFF this server (another provider or region). A backup that
# lives next to the database it protects is not a backup. See docs/BACKUP.md.

set -euo pipefail
umask 077

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

DB_FILE="$BACKUP_DIR/db-$STAMP.dump"

if [[ "${1:-}" == "--compose" ]]; then
  docker compose exec -T db pg_dump -U souvenir -d souvenir_galore --format=custom --no-owner --no-privileges > "$DB_FILE"
  STORAGE_SOURCE="compose"
else
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "DATABASE_URL is not set." >&2
    exit 1
  fi
  # Prisma's ?schema=public parameter is not understood by pg_dump.
  PG_URL="${DATABASE_URL%%\?*}"
  pg_dump "$PG_URL" --format=custom --no-owner --no-privileges --file="$DB_FILE"
  STORAGE_SOURCE="local"
fi

# Sanity check: the dump must be readable.
pg_restore --list "$DB_FILE" > /dev/null
echo "✓ database → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

if [[ "${STORAGE_DRIVER:-local}" == "local" ]]; then
  STORAGE_FILE="$BACKUP_DIR/storage-$STAMP.tgz"
  if [[ "$STORAGE_SOURCE" == "compose" ]]; then
    docker compose exec -T app tar -czf - -C /app storage > "$STORAGE_FILE"
  elif [[ -d "${STORAGE_LOCAL_DIR:-./storage}" ]]; then
    tar -czf "$STORAGE_FILE" -C "$(dirname "${STORAGE_LOCAL_DIR:-./storage}")" "$(basename "${STORAGE_LOCAL_DIR:-./storage}")"
  fi
  [[ -f "${STORAGE_FILE}" ]] && echo "✓ images   → $STORAGE_FILE ($(du -h "$STORAGE_FILE" | cut -f1))"
fi

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'storage-*.tgz' \) -mtime +"$KEEP_DAYS" -delete
echo "Done. Backups older than $KEEP_DAYS days were removed from $BACKUP_DIR."
