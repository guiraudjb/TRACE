import sys
import csv
import requests

def generer_fichiers(code_input):
    is_wildcard = code_input.endswith('*')
    base_code = code_input.rstrip('*')
    
    if is_wildcard:
        code_dept = base_code[1:] if base_code.startswith('0') and len(base_code) == 3 else base_code
        print(f"Initialisation (Mode Multi-Directions) - Requête : {code_input} (Dép: {code_dept})")
    else:
        if code_input.startswith('0') and len(code_input) == 3:
            code_dept = code_input[1:]
        elif len(code_input) == 3 and code_input.endswith('0') and not code_input.startswith('97'):
            code_dept = code_input[:2] 
        else:
            code_dept = code_input
        print(f"Initialisation (Direction Unique) - Requête : {code_input} (Dép: {code_dept})")

    # ==========================================
    # 1. Récupération des Structures (en mémoire)
    # ==========================================
    print("\n[1/3] Téléchargement et extraction des structures DGFiP...")
    url_structures = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/fichier-des-structures-de-la-dgfip/exports/csv"
    params_structures = {'delimiter': ';'}
    
    structures_brutes = []
    core_ids_utiles = set()
    
    try:
        resp_struct = requests.get(url_structures, params=params_structures)
        resp_struct.raise_for_status()
        
        reader = csv.DictReader(resp_struct.text.splitlines(), delimiter=';')
        
        for row in reader:
            dir_hierarchique = row.get('dir_hierarchique', '').strip()
            match_dir = dir_hierarchique.startswith(base_code) if is_wildcard else (dir_hierarchique == code_input)
                
            if match_dir:
                code_ua = row.get('code_ua', '').strip()
                date_limite = row.get('date_limite_validite1', '').strip()
                etat = row.get('etat', '').strip().upper()
                
                # Conservation de votre règle stricte : <= 7 caractères
                if code_ua and len(code_ua) <= 7 and date_limite == '99999999' and etat != 'A':
                    lib_1 = row.get('libelle_long_1', '').strip()
                    lib_2 = row.get('libelle_long_2', '').strip()
                    adresse_codifiee = row.get('adresse_codifiee', '').strip().upper()
                    
                    numero_complet = row.get('adresse_dans_la_voie', '').strip()
                    if not numero_complet:
                        numero = row.get('numero_dans_la_voie', row.get('numero_voie', '')).strip()
                        indice = row.get('indice_de_repetition', row.get('indice_repetition', '')).strip()
                        numero_complet = f"{numero} {indice}".strip()
                    
                    core_id_struct = ""
                    if len(adresse_codifiee) >= 16:
                        core_id_struct = adresse_codifiee[7:16]
                        core_ids_utiles.add(core_id_struct)
                    
                    structures_brutes.append({
                        'code_sages': code_ua,
                        'libelle': f"{lib_1} {lib_2}".strip(),
                        'numero': numero_complet,
                        'core_id': core_id_struct
                    })
                
        print(f" -> {len(structures_brutes)} structures actives identifiées.")
    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la récupération des structures : {e}")
        sys.exit(1)


    # ==========================================
    # 2. Récupération de la Topographie (TOPO)
    # ==========================================
    print("\n[2/3] Interrogation de l'API topographique (Rues ET Communes)...")
    topo_voies = {}
    topo_communes = {}
    
    if core_ids_utiles:
        url_topo = "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/topo-fichier-des-entites-topographiques/exports/csv"
        params_topo = {
            'where': f"code_dep='{code_dept}' and (code_type_topo='13' or code_type_topo='14')", 
            'delimiter': ';'
        }
        
        try:
            resp_topo = requests.get(url_topo, params=params_topo, stream=True)
            resp_topo.raise_for_status()
            reader = csv.DictReader(resp_topo.text.splitlines(), delimiter=';')
            
            for row in reader:
                c_dep = row.get('code_dep', '').strip()
                c_com = row.get('code_commune', row.get('code_com', '')).strip()
                c_voie = row.get('code_voie', '').strip()
                type_topo = row.get('code_type_topo', '').strip()
                
                c_com = c_com.zfill(2) if len(c_dep) == 3 else c_com.zfill(3)
                c_voie = c_voie.zfill(4)
                
                if type_topo == '13':
                    commune_id = f"{c_dep}{c_com}".upper()
                    topo_communes[commune_id] = row.get('libelle', '').strip()
                
                elif type_topo == '14':
                    core_id_topo = f"{c_dep}{c_com}{c_voie}".upper()
                    if core_id_topo in core_ids_utiles:
                        nature = row.get('nature_de_voie', row.get('nature_voie', '')).strip()
                        libelle_voie = row.get('libelle', '').strip()
                        topo_voies[core_id_topo] = f"{nature} {libelle_voie}".strip()
                    
        except requests.exceptions.RequestException as e:
            print(f"Erreur lors de la récupération des données TOPO : {e}")
            sys.exit(1)


    # ==========================================
    # 3. Consolidation et Génération des CSV
    # ==========================================
    print("\n[3/3] Formatage final et génération des fichiers CSV...")
    
    lieux_uniques = {}
    lieu_id_counter = 1
    
    lignes_structures = []
    
    for struct in structures_brutes:
        core_id = struct['core_id']
        nom_rue = topo_voies.get(core_id)
        
        if nom_rue:
            commune_id = core_id[:5]
            nom_commune = topo_communes.get(commune_id, "")
            
            adresse_brute = f"{struct['numero']} {nom_rue} {nom_commune}"
            adresse_propre = " ".join(adresse_brute.split())
            
            if adresse_propre not in lieux_uniques:
                lieux_uniques[adresse_propre] = lieu_id_counter
                lieu_id_counter += 1
                
            lieu_id = lieux_uniques[adresse_propre]
        else:
            lieu_id = None # Utilisation de None pour générer un champ vide parfait pour le NULL SQL
            
        lignes_structures.append([struct['code_sages'], struct['libelle'], lieu_id])

    # Écriture de lieux.csv
    with open('lieux.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['id', 'nom'])
        for adresse, l_id in sorted(lieux_uniques.items(), key=lambda x: x[1]):
            writer.writerow([l_id, adresse])
            
    print(f" -> {len(lieux_uniques)} lieux uniques et propres instanciés dans lieux.csv.")

    # Écriture de structures.csv
    with open('structures.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f, delimiter=';')
        writer.writerow(['code_sages', 'libelle', 'lieu_id'])
        writer.writerows(lignes_structures)
            
    print(f" -> {len(lignes_structures)} services associés dans structures.csv.")
    print("\nOpération terminée. Fichiers prêts pour l'import PostgreSQL.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python extraction_mobitrace.py <code_direction>")
        sys.exit(1)
        
    code_input = sys.argv[1].upper()
    generer_fichiers(code_input)
