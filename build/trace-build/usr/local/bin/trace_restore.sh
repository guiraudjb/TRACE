#!/bin/bash
BACKUP_DIR="/mnt/savetrace"
DB_NAME="parc_mobilier_dgfip"
ITEMS_PER_PAGE=10

if [ "$EUID" -ne 0 ] && [ "$(whoami)" != "postgres" ]; then
  echo -e "\e[31mErreur : Ce script doit être exécuté avec 'sudo' ou par l'utilisateur 'postgres'.\e[0m"
  exit 1
fi

echo -e "\n\e[1;34m=== OUTIL DE RESTAURATION DE LA BASE DE DONNÉES TRACE ===\e[0m"

mapfile -t BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.dump" -printf "%T@ %p\n" | sort -nr | cut -d' ' -f2-)
TOTAL_BACKUPS=${#BACKUPS[@]}

if [ "$TOTAL_BACKUPS" -eq 0 ]; then
    echo -e "\e[33mAucune sauvegarde trouvée dans $BACKUP_DIR.\e[0m"
    exit 0
fi

# ... (Copiez ici le reste de votre fonction afficher_page et de la boucle while de votre script instrace.sh) ...
# ... (Jusqu'au sudo -u postgres pg_restore --clean --if-exists -d "$DB_NAME" "$SELECTED_FILE") ...

if [ $? -eq 0 ]; then echo -e "\n\e[1;32m=== RESTAURATION TERMINÉE ===\e[0m"; else echo -e "\n\e[1;31m=== ERREUR ===\e[0m"; fi
