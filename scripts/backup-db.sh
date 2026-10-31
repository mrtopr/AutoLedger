#!/usr/bin/env bash
# ==============================================================================
# TradeLedger ERP — Automated Database & Store Backup Script
# ==============================================================================
# Usage: ./scripts/backup-db.sh
# Cron example (Every day at 02:00 AM):
#   0 2 * * * /path/to/B2B_Platform/scripts/backup-db.sh >> /var/log/tradeledger_backup.log 2>&1
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

echo "================================================================="
echo "[$(date -Iseconds)] Starting TradeLedger ERP automated backup..."
echo "================================================================="

# 1. PostgreSQL Database Backup
if [ -n "${DATABASE_URL:-}" ]; then
  DB_BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.dump.gz"
  echo "Backing up PostgreSQL database to $DB_BACKUP_FILE..."

  # Run pg_dump with custom compressed format piped through gzip
  if pg_dump "$DATABASE_URL" -F c | gzip > "$DB_BACKUP_FILE"; then
    FILE_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
    echo "SUCCESS: PostgreSQL backup completed ($FILE_SIZE)."
  else
    echo "ERROR: PostgreSQL backup failed!" >&2
    exit 1
  fi
else
  echo "NOTICE: DATABASE_URL not set. Skipping PostgreSQL dump."
fi

# 2. LocalStore Snapshot Backup
LOCAL_STORE_PATH="./.data/store.json"
if [ -f "$LOCAL_STORE_PATH" ]; then
  STORE_BACKUP_FILE="$BACKUP_DIR/localstore_backup_${TIMESTAMP}.json.gz"
  echo "Backing up localStore to $STORE_BACKUP_FILE..."
  gzip -c "$LOCAL_STORE_PATH" > "$STORE_BACKUP_FILE"
  echo "SUCCESS: LocalStore backup completed."
fi

# 3. Apply Retention Policy (Delete backups older than RETENTION_DAYS)
echo "Applying retention policy: removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -type f -name "*backup_*" -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "================================================================="
echo "[$(date -Iseconds)] Automated backup job finished successfully."
echo "================================================================="
