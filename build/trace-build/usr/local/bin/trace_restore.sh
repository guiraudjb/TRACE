#!/bin/bash
BACKUP_DIR="/mnt/savetrace"
DB_NAME="parc_mobilier_dgfip"
ITEMS_PER_PAGE=10

if [ "$EUID" -ne 0 ] && [ "$(whoami)" != "postgres" ]; then
  echo -e "\e[31mErreur : Ce script doit être exécuté avec 'su' ou par l'utilisateur 'postgres'.\e[0m"
  exit 1
fi

echo -e "\n\e[1;34m=== OUTIL DE RESTAURATION DE LA BASE DE DONNÉES TRACE ===\e[0m"

mapfile -t BACKUPS < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.dump" -printf "%T@ %p\n" | sort -nr | cut -d' ' -f2-)
TOTAL_BACKUPS=${#BACKUPS[@]}

if [ "$TOTAL_BACKUPS" -eq 0 ]; then
    echo -e "\e[33mAucune sauvegarde trouvée dans $BACKUP_DIR.\e[0m"
    exit 0
fi

afficher_page() {
    local PAGE=$1
    local START=$(( (PAGE - 1) * ITEMS_PER_PAGE ))
    local END=$(( START + ITEMS_PER_PAGE - 1 ))
    local TOTAL_PAGES=$(( (TOTAL_BACKUPS + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE ))
    echo -e "\n\e[1;36mSauvegardes disponibles (Page $PAGE/$TOTAL_PAGES) :\e[0m"
    echo "--------------------------------------------------------"
    for i in $(seq "$START" "$END"); do
        if [ "$i" -lt "$TOTAL_BACKUPS" ]; then
            FILE_PATH="${BACKUPS[$i]}"
            printf "\e[1;33m[%2d]\e[0m %-30s | %-8s | %s\n" "$((i + 1))" "$(basename "$FILE_PATH")" "$(du -h "$FILE_PATH" | cut -f1)" "$(stat -c "%y" "$FILE_PATH" | cut -d'.' -f1)"
        fi
    done
    echo "--------------------------------------------------------"
}

CURRENT_PAGE=1
TOTAL_PAGES=$(( (TOTAL_BACKUPS + ITEMS_PER_PAGE - 1) / ITEMS_PER_PAGE ))
while true; do
    afficher_page "$CURRENT_PAGE"
    echo -e "\nEntrez le \e[1;33mnuméro\e[0m du fichier à restaurer,"
    [ "$CURRENT_PAGE" -lt "$TOTAL_PAGES" ] && echo -e "tapez \e[1;32ms\e[0m (Suivant),"
    [ "$CURRENT_PAGE" -gt 1 ] && echo -e "tapez \e[1;32mp\e[0m (Précédent),"
    echo -e "ou \e[1;31mq\e[0m pour Quitter."
    read -rp "Choix : " CHOIX
    case $CHOIX in
        [qQ]) exit 0 ;;
        [sS]) [ "$CURRENT_PAGE" -lt "$TOTAL_PAGES" ] && ((CURRENT_PAGE++)) ;;
        [pP]) [ "$CURRENT_PAGE" -gt 1 ] && ((CURRENT_PAGE--)) ;;
        *)
            if [[ "$CHOIX" =~ ^[0-9]+$ ]] && [ "$CHOIX" -ge 1 ] && [ "$CHOIX" -le "$TOTAL_BACKUPS" ]; then
                SELECTED_FILE="${BACKUPS[$((CHOIX - 1))]}"
                break
            fi
            ;;
    esac
done

echo -e "\n\e[1;31m/!\\ ATTENTION /!\\\e[0m Restauration de : \e[1m$(basename "$SELECTED_FILE")\e[0m"
read -rp "Confirmer l'écrasement de '$DB_NAME' ? (Tapez OUI) : " CONFIRM
if [ "$CONFIRM" != "OUI" ]; then echo "Annulé."; exit 0; fi

sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();"
sudo -u postgres pg_restore --clean --if-exists -d "$DB_NAME" "$SELECTED_FILE"

if [ $? -eq 0 ]; then echo -e "\n\e[1;32m=== RESTAURATION TERMINÉE ===\e[0m"; else echo -e "\n\e[1;31m=== ERREUR ===\e[0m"; fi
