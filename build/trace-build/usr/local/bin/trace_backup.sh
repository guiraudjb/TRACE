#!/bin/bash
# Sauvegarde de la base TRACE

BACKUP_DIR="/mnt/savetrace"
DB_NAME="parc_mobilier_dgfip"
DATE=$(date +%Y-%m-%d)
FILE="$BACKUP_DIR/trace_backup_$DATE.dump"

# Sauvegarde compressée
/usr/bin/pg_dump -Fc -d $DB_NAME -f $FILE

# Nettoyage des sauvegardes de plus de 30 jours
find $BACKUP_DIR -type f -name "trace_backup_*.dump" -mtime +30 -exec rm {} \;
