#!/bin/bash

# ==============================================================================
# SCRIPT DE SAUVEGARDE MULTIPLE - TRACE
# ==============================================================================

BACKUP_DIR="/mnt/savetrace"
DB_NAME="parc_mobilier"

# Ajout de l'heure, minute et seconde pour garantir l'unicité du nom de fichier
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILE="$BACKUP_DIR/trace_backup_$DATE.dump"

echo "Début de la sauvegarde : $FILE"

# Exécution de la sauvegarde compressée[cite: 10]
if /usr/bin/pg_dump -Fc -d "$DB_NAME" -f "$FILE"; then
    echo "Succès : Base de données '$DB_NAME' sauvegardée."
else
    echo "Erreur : Échec lors de la sauvegarde de la base de données."
    exit 1
fi

# Nettoyage des sauvegardes datant de plus de 30 jours[cite: 10]
echo "Nettoyage des anciennes sauvegardes..."
find "$BACKUP_DIR" -type f -name "trace_backup_*.dump" -mtime +30 -exec rm -f {} \;

echo "Terminé."
exit 0
