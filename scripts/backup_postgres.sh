#!/bin/bash
# backup_postgres.sh
# Backup and restore script for Dockerized Postgres (prod)
# Usage:
#   ./backup_postgres.sh backup   # to create backup.sql
#   ./backup_postgres.sh restore  # to restore from backup.sql

set -e
# Allow overriding container/database/user for backup/restore
CONTAINER="postgres-financials-db"
USER="postgres"
DB="financials"
BACKUP_FILE="backup.sql"

# Usage: ./backup_postgres.sh backup [container] [db] [user]
#        ./backup_postgres.sh restore [container] [db] [user]

if [ "$1" == "backup" ]; then
  [ -n "$2" ] && CONTAINER="$2"
  [ -n "$3" ] && DB="$3"
  [ -n "$4" ] && USER="$4"
  echo "Backing up $DB from $CONTAINER to $BACKUP_FILE..."
  docker exec $CONTAINER pg_dump -U $USER $DB > $BACKUP_FILE
  echo "Backup complete: $BACKUP_FILE"
elif [ "$1" == "restore" ]; then
  [ -n "$2" ] && CONTAINER="$2"
  [ -n "$3" ] && DB="$3"
  [ -n "$4" ] && USER="$4"
  if [ ! -f $BACKUP_FILE ]; then
    echo "Backup file $BACKUP_FILE not found!"
    exit 1
  fi
  echo "Restoring $DB in $CONTAINER from $BACKUP_FILE..."
  cat $BACKUP_FILE | docker exec -i $CONTAINER psql -U $USER $DB
  echo "Restore complete."
else
  echo "Usage: $0 [backup|restore] [container] [db] [user]"
  exit 1
fi
