#!/bin/bash

# --- CONFIGURATION ---
# Nombre de lignes à générer
COUNT=60000
# Fichier de sortie
OUTPUT="mobiliers.csv"
# Liste des statuts autorisés (extraits de la logique métier)
STATUS=("en_service" "dispo_reemploi" "en_maintenance" "au_rebut")

# --- EXTRACTION DES RÉFÉRENTIELS ---
# On extrait les IDs des lieux
LIEUX=($(tail -n +2 lieux.csv | cut -d',' -f1))

# On définit la plage d'IDs des gabarits
GAB_COUNT=27

# NOUVEAU : Déclaration d'un tableau classique pour les structures et d'un dictionnaire pour la correspondance
declare -a STRUCTURES
declare -A UA_LIEUX

# Lecture de structures.csv : on isole la colonne 1 (code_sages) et la colonne 3 (lieu_id)
while IFS=',' read -r code_sages lieu_id; do
    # Nettoyage des éventuels retours à la ligne (particulièrement si le CSV vient de Windows)
    code_sages=$(echo "$code_sages" | tr -d '\r')
    lieu_id=$(echo "$lieu_id" | tr -d '\r')
    
    STRUCTURES+=("$code_sages")
    
    # Si un lieu par défaut est renseigné pour cette structure, on l'enregistre dans le dictionnaire
    if [ -n "$lieu_id" ]; then
        UA_LIEUX["$code_sages"]="$lieu_id"
    fi
done < <(tail -n +2 structures.csv | awk -F',' '{print $1","$3}')

# --- GÉNÉRATION ---
echo "id_metier,gabarit_id,lieu_id,code_sages,statut,remarques" > $OUTPUT

echo "Génération de $COUNT lignes en cours..."

for ((i=1; i<=COUNT; i++))
do
    # Formatage de l'ID Métier (MOB-000001, etc.)
    ID_METIER=$(printf "MOB-%06d" $i)
    
    # Sélection aléatoire du gabarit et du statut
    GAB_ID=$((1 + RANDOM % GAB_COUNT))
    STAT=${STATUS[$RANDOM % ${#STATUS[@]}]}
    
    # Sélection aléatoire de la structure
    UA=${STRUCTURES[$RANDOM % ${#STRUCTURES[@]}]}
    
    # NOUVEAU : Application de la logique métier
    # On vérifie si la structure choisie possède un lieu par défaut dans notre dictionnaire
    if [ -n "${UA_LIEUX[$UA]}" ]; then
        LIEU_ID="${UA_LIEUX[$UA]}"
    else
        # Si aucun lieu n'est lié au service, on tire un lieu au hasard (mécanisme de secours)
        LIEU_ID=${LIEUX[$RANDOM % ${#LIEUX[@]}]}
    fi
    
    # Écriture dans le fichier (Remarques vides par défaut)
    echo "$ID_METIER,$GAB_ID,$LIEU_ID,$UA,$STAT," >> $OUTPUT
done

echo "Terminé ! Le fichier $OUTPUT est prêt."
