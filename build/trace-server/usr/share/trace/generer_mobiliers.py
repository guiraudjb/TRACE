import csv
import random
import sys
import os

def generer_mobiliers(nb_mobiliers):
    print(f"Initialisation de la génération de {nb_mobiliers} mobiliers...")

    # 1. Lecture de gabarits.csv pour récupérer le nombre d'IDs disponibles
    if not os.path.exists('gabarits.csv'):
        print("Erreur : Le fichier 'gabarits.csv' est introuvable dans le dossier courant.")
        sys.exit(1)
        
    nb_gabarits = 0
    with open('gabarits.csv', 'r', encoding='utf-8') as f:
        # On compte les lignes moins la ligne d'en-tête (les IDs SERIAL PostgreSQL commencent à 1)
        nb_gabarits = sum(1 for line in f) - 1

    if nb_gabarits <= 0:
        print("Erreur : Le fichier 'gabarits.csv' est vide ou ne contient pas de données.")
        sys.exit(1)
        
    # 2. Lecture de structures.csv pour garantir la cohérence lieu/structure
    if not os.path.exists('structures.csv'):
        print("Erreur : Le fichier 'structures.csv' est introuvable.")
        sys.exit(1)

    structures_valides = []
    with open('structures.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            code_sages = row.get('code_sages', '').strip()
            lieu_id = row.get('lieu_id', '').strip()
            
            # On ne conserve que les structures qui ont bien été géolocalisées (lieu_id non vide)
            if code_sages and lieu_id:
                structures_valides.append({
                    'code_sages': code_sages,
                    'lieu_id': lieu_id
                })

    if not structures_valides:
        print("Erreur : Aucune structure avec un 'lieu_id' valide n'a été trouvée.")
        sys.exit(1)

    print(f" -> {nb_gabarits} gabarits détectés.")
    print(f" -> {len(structures_valides)} structures valides (avec lieu) détectées.")

    # 3. Génération aléatoire des données
    # Utilisation des statuts de l'ENUM de votre base de données avec des probabilités réalistes
    statuts = ['en_service', 'en_maintenance', 'dispo_reemploi', 'au_rebut']
    poids_statuts = [0.80, 0.05, 0.10, 0.05] # 80% en service, 10% dispo, etc.

    lignes_mobiliers = []
    
    for i in range(1, nb_mobiliers + 1):
        # Formatage de l'ID Métier (ex: MOB-000452)
        id_metier = f"MOB-{i:06d}"
        
        # Tirage d'un gabarit au hasard (de 1 à N)
        gabarit_id = random.randint(1, nb_gabarits)
        
        # Tirage d'une structure au hasard (garantit la cohérence du couple lieu/structure)
        struct_cible = random.choice(structures_valides)
        code_sages = struct_cible['code_sages']
        lieu_id = struct_cible['lieu_id']
        
        # Tirage du statut
        statut = random.choices(statuts, weights=poids_statuts, k=1)[0]
        
        lignes_mobiliers.append([id_metier, gabarit_id, lieu_id, code_sages, statut, ""])

    # 4. Écriture du fichier mobiliers.csv
    with open('mobiliers.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['id_metier', 'gabarit_id', 'lieu_id', 'code_sages', 'statut', 'remarques'])
        writer.writerows(lignes_mobiliers)

    print(f"\nSuccès : {nb_mobiliers} mobiliers ont été générés dans 'mobiliers.csv'.")
    print("Le fichier est prêt à être importé dans PostgreSQL.")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage : python generer_mobiliers.py <nombre_de_meubles>")
        print("Exemple : python generer_mobiliers.py 1500")
        sys.exit(1)
        
    try:
        nb = int(sys.argv[1])
        if nb <= 0:
            raise ValueError
    except ValueError:
        print("Erreur : Le nombre de meubles doit être un nombre entier positif.")
        sys.exit(1)
        
    generer_mobiliers(nb)
