#!/bin/bash

# --- CONFIGURATION ---
# Nombre de lignes à générer
COUNT=100000
# Fichier de sortie
OUTPUT="mobiliers.csv"
# Liste des statuts autorisés (extraits de la logique métier)
STATUS=("en_service" "dispo_reemploi" "en_maintenance" "au_rebut")

# --- EXTRACTION DES RÉFÉRENTIELS ---
# On extrait les IDs des lieux et les codes SAGES des structures (en sautant l'en-tête)
LIEUX=($(tail -n +2 lieux.csv | cut -d',' -f1))
STRUCTURES=($(tail -n +2 structures.csv | cut -d',' -f1))
# On définit la plage d'IDs des gabarits (1 à 27 suite à notre mise à jour du catalogue)
GAB_COUNT=27

# --- GÉNÉRATION ---
echo "id_metier,gabarit_id,lieu_id,code_sages,statut,remarques" > $OUTPUT

echo "Génération de $COUNT lignes en cours..."

for ((i=1; i<=COUNT; i++))
do
    # Formatage de l'ID Métier (MOB-000001, etc.)
    ID_METIER=$(printf "MOB-%06d" $i)
    
    # Sélection aléatoire
    GAB_ID=$((1 + RANDOM % GAB_COUNT))
    LIEU_ID=${LIEUX[$RANDOM % ${#LIEUX[@]}]}
    UA=${STRUCTURES[$RANDOM % ${#STRUCTURES[@]}]}
    STAT=${STATUS[$RANDOM % ${#STATUS[@]}]}
    
    # Écriture dans le fichier (Remarques vides par défaut)
    echo "$ID_METIER,$GAB_ID,$LIEU_ID,$UA,$STAT," >> $OUTPUT
done

echo "Terminé ! Le fichier $OUTPUT est prêt."
