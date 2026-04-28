#!/bin/bash
# ==============================================================================
# SCRIPT DE DÉPLOIEMENT AUTOMATISÉ - TRACE (DGFIP)
# ==============================================================================
# Arrêt immédiat du script en cas d'erreur critique
set -e

# ==============================================================================
# VARIABLES DE CONFIGURATION GLOBALE
# ==============================================================================
DB_NAME="parc_mobilier_dgfip"
ADMIN_EMAIL="admin@dgfip.finances.gouv.fr"
# Génération de mots de passe forts, sans caractères parasites pour Bash/SQL (' " \ $)
DB_PASS=$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 24)
# Le JWT_SECRET doit être très long (min 32 caractères) pour l'algorithme HS256
JWT_SECRET=$(tr -dc 'A-Za-z0-9_-' < /dev/urandom | head -c 48)
# Mot de passe administrateur (16 caractères)
#ADMIN_PASS=$(tr -dc 'A-Za-z0-9!_-' < /dev/urandom | head -c 16)
ADMIN_PASS="admin"

# Chemins
WEB_ROOT="/var/www/html/TRACE"
SSL_DIR="/etc/ssl/trace"

echo -e "\n======================================================"
echo " DÉBUT DU DÉPLOIEMENT DE TRACE"
echo "======================================================"

# ------------------------------------------------------------------------------
# 1. PRÉPARATION ET DÉPENDANCES
# ------------------------------------------------------------------------------
echo -e "\n--- 1. Nettoyage et installation des dépendances ---"
systemctl stop trace-api 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true

apt-get update
apt-get install -y postgresql postgresql-contrib nginx openssl sudo

# ------------------------------------------------------------------------------
# 2. INSTALLATION POSTGREST ET FRONTEND
# ------------------------------------------------------------------------------
echo -e "\n--- 2. Installation de PostgREST et des fichiers Web ---"
if ! command -v postgrest &> /dev/null; then
    if [ -f "./postgrest" ]; then
        cp ./postgrest /usr/local/bin/postgrest
        chmod +x /usr/local/bin/postgrest
        echo "PostgREST installé."
    else
        echo "ERREUR CRITIQUE : Binaire 'postgrest' introuvable."
        exit 1
    fi
fi

# Préparation du dossier Web
mkdir -p /var/www/html
cp -r TRACE /var/www/html/
chmod -R 755 $WEB_ROOT
chmod 644 $WEB_ROOT/*.csv 2>/dev/null || true

# ------------------------------------------------------------------------------
# 3. CONFIGURATION SSL
# ------------------------------------------------------------------------------
echo -e "\n--- 3. Génération des certificats SSL ---"
mkdir -p $SSL_DIR
# Génération sans prompt
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/trace.key" -out "$SSL_DIR/trace.crt" \
    -subj "/C=FR/ST=Paris/L=Paris/O=DGFIP/OU=TRACE/CN=localhost" 2>/dev/null

# Correction critique : Le master process Nginx (root) doit pouvoir lire la clé
#chown root:root "$SSL_DIR/trace.key"
#chmod 600 "$SSL_DIR/trace.key"

# 1. On donne tout à postgres
chown postgres:postgres "$SSL_DIR/trace.key" "$SSL_DIR/trace.crt"

# 2. Droits ultra-restrictifs (Postgres l'exige, Nginx-root s'en moque)
chmod 600 "$SSL_DIR/trace.key"
chmod 644 "$SSL_DIR/trace.crt"

# 3. On s'assure que Nginx peut au moins entrer dans le dossier
# (Il faut le droit 'x' sur les dossiers parents)
chmod 755 $SSL_DIR

# ------------------------------------------------------------------------------
# 4. INITIALISATION DE LA BASE DE DONNÉES
# ------------------------------------------------------------------------------
usermod -aG ssl-cert postgres

# 2. Redémarre le cluster
pg_ctlcluster 17 main start

echo -e "\n--- 4. Initialisation de la base de données ---"
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
mkdir -p /tmp/trace_csv
cp "$SCRIPT_DIR"/*.csv /tmp/trace_csv/ 2>/dev/null || true
chmod 644 /tmp/trace_csv/*.csv 2>/dev/null || true

# On tue les connexions pour pouvoir écraser la base
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" > /dev/null 2>&1 || true
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;"
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"

# Injection du schéma (On utilise EOF sans guillemets ici pour injecter les variables shell)
sudo -u postgres psql -d $DB_NAME << EOF

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Requis pour la recherche textuelle rapide

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TYPE public.statut_mobilier AS ENUM ('en_service', 'en_maintenance', 'dispo_reemploi', 'au_rebut');
CREATE TYPE public.jwt_token AS (token text);

-- Tables
CREATE TABLE public.lieux (id SERIAL PRIMARY KEY, nom TEXT NOT NULL, parent_id INTEGER REFERENCES public.lieux(id), type_lieu TEXT CHECK (type_lieu IN ('batiment', 'etage', 'bureau', 'local')));
CREATE TABLE public.structures (code_sages VARCHAR(10) PRIMARY KEY, libelle TEXT NOT NULL, lieu_id INTEGER REFERENCES public.lieux(id));
CREATE TABLE public.utilisateurs (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, mot_de_passe_hash TEXT NOT NULL, nom_complet TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('agent', 'administrateur', 'lecteur')) DEFAULT 'agent');
CREATE TABLE public.gabarits (id SERIAL PRIMARY KEY, reference_catalogue VARCHAR(50) UNIQUE NOT NULL, categorie TEXT, nom_descriptif TEXT NOT NULL, caracteristiques JSONB DEFAULT '{}'::jsonb);
CREATE TABLE public.mobiliers (uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(), id_metier VARCHAR(20) UNIQUE, gabarit_id INTEGER REFERENCES public.gabarits(id), lieu_id INTEGER REFERENCES public.lieux(id), code_sages VARCHAR(10) REFERENCES public.structures(code_sages), statut statut_mobilier DEFAULT 'en_service', remarques TEXT, date_saisie TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

-- =============================================================================
-- AJOUT : Séquence et fonction pour l'auto-génération des ID Métier
-- =============================================================================
CREATE SEQUENCE public.seq_mobilier_id START 1;

CREATE OR REPLACE FUNCTION public.set_mob_id()
RETURNS TRIGGER AS \$\$
BEGIN
  NEW.id_metier := 'MOB-' || LPAD(nextval('public.seq_mobilier_id')::TEXT, 6, '0');
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;



-- =============================================================================
-- INDEX DE PERFORMANCE (Optimisation 1M lignes)
-- =============================================================================
-- Index B-Tree pour les filtres et jointures (complexité O(log n))
CREATE INDEX idx_mobiliers_gabarit ON public.mobiliers(gabarit_id);
CREATE INDEX idx_mobiliers_ua ON public.mobiliers(code_sages);
CREATE INDEX idx_mobiliers_statut ON public.mobiliers(statut);
CREATE INDEX idx_mobiliers_lieu ON public.mobiliers(lieu_id);

-- Index GIN pour les recherches dans le JSON (caractéristiques techniques)
CREATE INDEX idx_gabarits_caract ON public.gabarits USING GIN (caracteristiques);

-- Index GIN Trigram pour la recherche globale (ID métier + Remarques)
-- Remplace les ILIKE '%...%' lents par une recherche vectorielle
CREATE INDEX idx_mobiliers_search_trgm ON public.mobiliers 
USING gin ((id_metier || ' ' || COALESCE(remarques, '')) gin_trgm_ops);


-- Fonctions Authentification (Attention aux \$\$ pour échapper le shell)
CREATE OR REPLACE FUNCTION auth.url_encode(data bytea) RETURNS text AS \$\$SELECT translate(encode(data, 'base64'), E'+/=\\n', '-_');\$\$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION auth.sign_jwt(payload json, secret text) RETURNS text AS \$\$DECLARE
  header_b64 text; payload_b64 text; signature text;
BEGIN
  header_b64 := auth.url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  payload_b64 := auth.url_encode(convert_to(payload::text, 'utf8'));
  signature := auth.url_encode(hmac(convert_to(header_b64 || '.' || payload_b64, 'utf8'), convert_to(secret, 'utf8'), 'sha256'));
  RETURN header_b64 || '.' || payload_b64 || '.' || signature;
END;\$\$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.login(email text, password text) RETURNS public.jwt_token AS \$\$DECLARE
  _role text; _id int; result public.jwt_token;
BEGIN
  SELECT u.role, u.id INTO _role, _id FROM public.utilisateurs u WHERE u.email = login.email AND u.mot_de_passe_hash = crypt(login.password, u.mot_de_passe_hash);
  IF _role IS NULL THEN RAISE EXCEPTION 'Identifiants incorrects'; END IF;
  result.token := auth.sign_jwt(json_build_object('role', _role, 'user_id', _id, 'email', login.email, 'exp', extract(epoch from now())::integer + 28800), '$JWT_SECRET');
  RETURN result;
END;\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Administration
CREATE OR REPLACE FUNCTION public.creer_utilisateur(_email TEXT, _password TEXT, _role TEXT) RETURNS void AS \$\$BEGIN
    INSERT INTO public.utilisateurs (email, mot_de_passe_hash, nom_complet, role) VALUES (_email, crypt(_password, gen_salt('bf')), split_part(_email, '@', 1), _role);
END;\$\$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reinitialiser_mdp(_email TEXT, _new_password TEXT) RETURNS void AS \$\$BEGIN
    UPDATE public.utilisateurs SET mot_de_passe_hash = crypt(_new_password, gen_salt('bf')) WHERE email = _email;
END;\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rôles et Droits
DO \$\$BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'divagil') THEN 
        CREATE ROLE divagil WITH LOGIN PASSWORD '$DB_PASS'; 
    ELSE
        -- Si le rôle existe déjà, on met à jour son mot de passe avec le nouveau
        ALTER ROLE divagil WITH PASSWORD '$DB_PASS';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agent') THEN CREATE ROLE agent NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'administrateur') THEN CREATE ROLE administrateur NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lecteur') THEN CREATE ROLE lecteur NOLOGIN; END IF;
END\$\$;


-- =============================================================================
-- MOTEUR DE FACETTES (Filtres intelligents pour le Front-End)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_filtres_disponibles(
    p_lieu_id INTEGER DEFAULT NULL,
    p_code_sages VARCHAR DEFAULT NULL,
    p_gabarit_id INTEGER DEFAULT NULL
) RETURNS jsonb AS \$\$
DECLARE
    v_lieux jsonb;
    v_structures jsonb;
    v_gabarits jsonb;
BEGIN
    -- 1. Lieux contenant au moins un équipement correspondant aux filtres
    SELECT jsonb_agg(DISTINCT l.*) INTO v_lieux
    FROM public.lieux l
    WHERE EXISTS (
        SELECT 1 FROM public.mobiliers m
        WHERE m.lieu_id = l.id
        AND (p_code_sages IS NULL OR m.code_sages = p_code_sages)
        AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id)
    );

    -- 2. Services (UA) possédant au moins un équipement correspondant
    SELECT jsonb_agg(DISTINCT s.*) INTO v_structures
    FROM public.structures s
    WHERE EXISTS (
        SELECT 1 FROM public.mobiliers m
        WHERE m.code_sages = s.code_sages
        AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id)
        AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id)
    );

    -- 3. Modèles (Gabarits) physiquement présents
    SELECT jsonb_agg(DISTINCT g.*) INTO v_gabarits
    FROM public.gabarits g
    WHERE EXISTS (
        SELECT 1 FROM public.mobiliers m
        WHERE m.gabarit_id = g.id
        AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id)
        AND (p_code_sages IS NULL OR m.code_sages = p_code_sages)
    );

    -- Retourne un JSON consolidé
    RETURN jsonb_build_object(
        'lieux', COALESCE(v_lieux, '[]'::jsonb),
        'structures', COALESCE(v_structures, '[]'::jsonb),
        'gabarits', COALESCE(v_gabarits, '[]'::jsonb)
    );
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

-- Autorisation d'exécution pour les rôles de l'API
GRANT EXECUTE ON FUNCTION public.get_filtres_disponibles(INTEGER, VARCHAR, INTEGER) TO divagil, agent, administrateur, lecteur;
CREATE OR REPLACE FUNCTION public.caracteristiques_txt(g public.gabarits) 
RETURNS text AS \$\$
  SELECT g.caracteristiques::text;
\$\$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.caracteristiques_txt(public.gabarits) TO divagil, agent, administrateur, lecteur;


-- 1. Création d'une vue qui rassemble toutes les informations textuelles
CREATE OR REPLACE VIEW public.vue_mobiliers_recherche AS
SELECT 
    m.*,
    g.nom_descriptif AS gabarit_nom,
    g.categorie AS gabarit_categorie,
    g.caracteristiques::text AS gabarit_json_txt, -- Conversion du JSON en texte pour la recherche
    s.libelle AS structure_libelle,
    l.nom AS lieu_nom
FROM public.mobiliers m
JOIN public.gabarits g ON m.gabarit_id = g.id
JOIN public.structures s ON m.code_sages = s.code_sages
JOIN public.lieux l ON m.lieu_id = l.id;

-- 2. On donne les droits d'accès à l'API
GRANT SELECT ON public.vue_mobiliers_recherche TO divagil, agent, administrateur, lecteur;

GRANT agent TO divagil;
GRANT administrateur TO divagil;
GRANT lecteur TO divagil;
GRANT USAGE ON SCHEMA public TO divagil, agent, administrateur, lecteur;
GRANT ALL ON ALL TABLES IN SCHEMA public TO agent, administrateur;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lecteur;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO agent, administrateur;

GRANT EXECUTE ON FUNCTION public.login(text, text) TO divagil;
REVOKE EXECUTE ON FUNCTION public.creer_utilisateur(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creer_utilisateur(text, text, text) TO administrateur;
REVOKE EXECUTE ON FUNCTION public.reinitialiser_mdp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reinitialiser_mdp(text, text) TO administrateur;

-- Insertion Admin
INSERT INTO utilisateurs (email, mot_de_passe_hash, nom_complet, role) 
VALUES ('$ADMIN_EMAIL', crypt('$ADMIN_PASS', gen_salt('bf')), 'Administrateur', 'administrateur') ON CONFLICT (email) DO NOTHING;

-- Import CSV depuis le dossier temporaire sécurisé
\copy public.lieux(id, nom, parent_id, type_lieu) FROM '/tmp/trace_csv/lieux.csv' DELIMITER ',' CSV HEADER;
\copy public.structures(code_sages, libelle, lieu_id) FROM '/tmp/trace_csv/structures.csv' DELIMITER ',' CSV HEADER;
SELECT setval('public.lieux_id_seq', (SELECT MAX(id) FROM public.lieux));
\copy public.gabarits(reference_catalogue, categorie, nom_descriptif, caracteristiques) FROM '/tmp/trace_csv/gabarits.csv' DELIMITER ',' CSV HEADER;
\copy public.mobiliers(id_metier, gabarit_id, lieu_id, code_sages, statut, remarques) FROM '/tmp/trace_csv/mobiliers.csv' DELIMITER ',' CSV HEADER;

-- =============================================================================
-- AJOUT : Activation du trigger d'ID Métier APRES l'import
-- =============================================================================
-- 1. On met à jour la séquence en fonction du plus grand ID importé du CSV
SELECT setval('public.seq_mobilier_id', COALESCE((SELECT MAX(CAST(SUBSTRING(id_metier FROM 5) AS INTEGER)) FROM public.mobiliers), 0));

-- 2. On attache le trigger pour toutes les futures insertions
CREATE TRIGGER trig_set_mob_id
BEFORE INSERT ON public.mobiliers
FOR EACH ROW
EXECUTE FUNCTION public.set_mob_id();

-- =============================================================================
-- AJOUT : TABLE ET TRIGGER POUR LE JOURNAL D'AUDIT (TRAÇABILITÉ)
-- =============================================================================
CREATE TABLE public.audit_logs (
    id SERIAL PRIMARY KEY,
    date_action TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    utilisateur VARCHAR(255),
    action VARCHAR(50),
    id_metier VARCHAR(50),
    details TEXT
);

-- Seul l'administrateur a le droit de lire ce journal, personne ne peut le modifier
GRANT SELECT ON public.audit_logs TO divagil, administrateur;
CREATE OR REPLACE FUNCTION public.log_mobilier_action()
RETURNS TRIGGER AS \$\$
DECLARE
    v_user VARCHAR(255);
    v_details TEXT := '';
BEGIN
    -- Extraction de l'email de l'agent
    BEGIN
        v_user := current_setting('request.jwt.claims', true)::json->>'email';
    EXCEPTION WHEN OTHERS THEN
        v_user := 'Système';
    END;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (utilisateur, action, id_metier, details)
        VALUES (v_user, 'CRÉATION', NEW.id_metier, 'Nouvel équipement intégré au parc.');
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- 1. Changement de Service (UA)
        IF OLD.code_sages IS DISTINCT FROM NEW.code_sages THEN
            v_details := v_details || 'Affectation : ' || COALESCE(OLD.code_sages, 'Aucune') || ' -> ' || COALESCE(NEW.code_sages, 'Aucune') || '. ';
        END IF;
        
        -- 2. Changement de Lieu (La correction est ici)
        IF OLD.lieu_id IS DISTINCT FROM NEW.lieu_id THEN
            v_details := v_details || 'Lieu physique modifié (Nouvel ID Lieu : ' || COALESCE(NEW.lieu_id::text, 'Aucun') || '). ';
        END IF;
        
        -- 3. Changement de Statut
        IF OLD.statut IS DISTINCT FROM NEW.statut THEN
            v_details := v_details || 'Statut : ' || COALESCE(OLD.statut::text, 'N/A') || ' -> ' || COALESCE(NEW.statut::text, 'N/A') || '. ';
        END IF;
        
        -- 4. Changement de Modèle (Gabarit)
        IF OLD.gabarit_id IS DISTINCT FROM NEW.gabarit_id THEN
            v_details := v_details || 'Modèle (Gabarit) remplacé. ';
        END IF;

        -- 5. Changement des Remarques
        IF OLD.remarques IS DISTINCT FROM NEW.remarques THEN
            v_details := v_details || 'Remarques mises à jour. ';
        END IF;

        -- Si au moins un champ a été modifié, on écrit dans le journal !
        IF v_details <> '' THEN
            INSERT INTO public.audit_logs (utilisateur, action, id_metier, details)
            VALUES (v_user, 'MODIFICATION', NEW.id_metier, v_details);
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (utilisateur, action, id_metier, details)
        VALUES (v_user, 'SUPPRESSION', OLD.id_metier, 'Équipement supprimé définitivement.');
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;


-- On attache ce radar à la table mobiliers
CREATE TRIGGER trig_audit_mobiliers
AFTER INSERT OR UPDATE OR DELETE ON public.mobiliers
FOR EACH ROW EXECUTE FUNCTION public.log_mobilier_action();

-- =============================================================================
-- AJOUT : TRAÇABILITÉ DES ACTIONS D'ADMINISTRATION
-- =============================================================================
CREATE OR REPLACE FUNCTION public.log_admin_action()
RETURNS TRIGGER AS \$\$
DECLARE
    v_user VARCHAR(255);
    v_action VARCHAR(50);
    v_cible VARCHAR(50);
    v_details TEXT := '';
BEGIN
    BEGIN
        v_user := current_setting('request.jwt.claims', true)::json->>'email';
    EXCEPTION WHEN OTHERS THEN
        v_user := 'Système (Admin)';
    END;

    IF TG_OP = 'INSERT' THEN v_action := 'CRÉATION';
    ELSIF TG_OP = 'UPDATE' THEN v_action := 'MODIFICATION';
    ELSIF TG_OP = 'DELETE' THEN v_action := 'SUPPRESSION';
    END IF;

    IF TG_TABLE_NAME = 'utilisateurs' THEN
        v_cible := COALESCE(NEW.email, OLD.email);
        IF TG_OP = 'INSERT' THEN v_details := 'Nouveau compte créé avec le rôle : ' || NEW.role; END IF;
        IF TG_OP = 'UPDATE' THEN v_details := 'Mise à jour du compte (mot de passe ou rôle).'; END IF;
        IF TG_OP = 'DELETE' THEN v_details := 'Accès révoqué et compte supprimé.'; END IF;

    ELSIF TG_TABLE_NAME = 'structures' THEN
        v_cible := COALESCE(NEW.code_sages, OLD.code_sages);
        IF TG_OP = 'INSERT' THEN v_details := 'Nouveau service ajouté : ' || NEW.libelle; END IF;
        IF TG_OP = 'UPDATE' THEN v_details := 'Libellé ou rattachement du service modifié.'; END IF;
        IF TG_OP = 'DELETE' THEN v_details := 'Service retiré du référentiel.'; END IF;

    ELSIF TG_TABLE_NAME = 'lieux' THEN
        v_cible := 'Lieu ID ' || COALESCE(NEW.id, OLD.id);
        IF TG_OP = 'INSERT' THEN v_details := 'Nouveau bâtiment/site ajouté : ' || NEW.nom; END IF;
        IF TG_OP = 'UPDATE' THEN v_details := 'Nom du lieu modifié (Nouveau : ' || NEW.nom || ').'; END IF;
        IF TG_OP = 'DELETE' THEN v_details := 'Lieu retiré du référentiel.'; END IF;
    END IF;

    INSERT INTO public.audit_logs (utilisateur, action, id_metier, details)
    VALUES (v_user, v_action, v_cible, 'ADMINISTRATION : ' || v_details);

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trig_audit_utilisateurs
AFTER INSERT OR UPDATE OR DELETE ON public.utilisateurs
FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();

CREATE TRIGGER trig_audit_structures
AFTER INSERT OR UPDATE OR DELETE ON public.structures
FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();

CREATE TRIGGER trig_audit_lieux
AFTER INSERT OR UPDATE OR DELETE ON public.lieux
FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();


ANALYZE public.mobiliers;
ANALYZE public.gabarits;
EOF

# ------------------------------------------------------------------------------
# 5. SERVICE POSTGREST
# ------------------------------------------------------------------------------
echo -e "\n--- 5. Configuration du Backend PostgREST ---"
cat << EOF > /etc/trace-api.conf
db-uri = "postgres://divagil:${DB_PASS}@localhost:5432/${DB_NAME}"
db-schema = "public"
db-anon-role = "divagil"
jwt-secret = "${JWT_SECRET}"
server-port = 3000
server-host = "127.0.0.1"
EOF

cat << 'EOF' > /etc/systemd/system/trace-api.service
[Unit]
Description=API PostgREST TRACE
After=postgresql.service
Requires=postgresql.service

[Service]
ExecStart=/usr/local/bin/postgrest /etc/trace-api.conf
Restart=always
RestartSec=3
SyslogIdentifier=trace-api

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now trace-api

# ------------------------------------------------------------------------------
# 7. MAINTENANCE AUTOMATISÉE (CRON)
# ------------------------------------------------------------------------------
echo -e "\n--- 7. Configuration de la purge automatique des logs (3 mois) ---"

# On définit la commande de purge en utilisant la variable de base de données du script
PURGE_CMD="psql -d $DB_NAME -c \"DELETE FROM public.audit_logs WHERE date_action < CURRENT_DATE - INTERVAL '3 months';\""

# On ajoute la tâche au crontab de l'utilisateur postgres (s'exécute tous les jours à minuit)
# L'utilisation de 'crontab -l' permet de ne pas écraser les tâches existantes
(crontab -u postgres -l 2>/dev/null; echo "0 0 * * * $PURGE_CMD") | crontab -u postgres -

echo "Tâche planifiée ajoutée pour l'utilisateur postgres."

# ------------------------------------------------------------------------------
# 7. MAINTENANCE AUTOMATISÉE (CRON)
# ------------------------------------------------------------------------------
echo -e "\n--- 7. Configuration de la purge automatique des logs (3 mois) ---"

# Création d'un fichier cron système dédié (plus propre et 100% fiable)
cat << EOF > /etc/cron.d/trace_purge_logs
# Purge quotidienne des logs d'audit TRACE (plus de 3 mois)
0 0 * * * postgres /usr/bin/psql -d $DB_NAME -c "DELETE FROM public.audit_logs WHERE date_action < CURRENT_DATE - INTERVAL '3 months';"
EOF

# Les fichiers dans /etc/cron.d/ doivent avoir des permissions strictes
chmod 644 /etc/cron.d/trace_purge_logs

echo "Tâche planifiée créée dans /etc/cron.d/trace_purge_logs"

# ------------------------------------------------------------------------------
# 8. SAUVEGARDE AUTOMATIQUE (BACKUP)
# ------------------------------------------------------------------------------
echo -e "\n--- 8. Configuration de la sauvegarde automatique ---"

BACKUP_DIR="/mnt/savetrace"
mkdir -p $BACKUP_DIR
chown postgres:postgres $BACKUP_DIR

# Création du script de sauvegarde avec rotation (30 jours)
cat << 'EOF' > /usr/local/bin/trace_backup.sh
#!/bin/bash
BACKUP_DIR="/mnt/savetrace"
DB_NAME="parc_mobilier_dgfip"
DATE=$(date +%Y-%m-%d)
FILE="$BACKUP_DIR/trace_backup_$DATE.dump"

# Sauvegarde compressée
/usr/bin/pg_dump -Fc -d $DB_NAME -f $FILE

# Nettoyage des sauvegardes de plus de 30 jours
find $BACKUP_DIR -type f -name "trace_backup_*.dump" -mtime +30 -exec rm {} \;
EOF

chmod +x /usr/local/bin/trace_backup.sh
chown postgres:postgres /usr/local/bin/trace_backup.sh

# Création de la tâche Cron système (à 02h00 du matin)
cat << EOF > /etc/cron.d/trace_backup
# Sauvegarde quotidienne de la base TRACE à 02h00
0 2 * * * postgres /usr/local/bin/trace_backup.sh
EOF

chmod 644 /etc/cron.d/trace_backup

# ------------------------------------------------------------------------------
# 9. OUTIL DE RESTAURATION INTERACTIF (RESTORE)
# ------------------------------------------------------------------------------
echo -e "\n--- 9. Création de l'outil de restauration interactif ---"

# Utilisation de 'EOF' entre guillemets pour que les variables du script de restauration 
# ne soient pas interprétées pendant l'exécution de instrace.sh
cat << 'EOF' > /usr/local/bin/trace_restore.sh
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
EOF

chmod +x /usr/local/bin/trace_restore.sh
chown postgres:postgres /usr/local/bin/trace_restore.sh


# ------------------------------------------------------------------------------
# 10. CONFIGURATION NGINX
# ------------------------------------------------------------------------------
echo -e "\n--- 6. Configuration Nginx ---"

# =============================================================================
# AJOUT : Génération du fichier de configuration mutualisable (config.ini)
# =============================================================================

cat << 'EOF' > /etc/nginx/sites-available/trace
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name _;

    ssl_certificate /etc/ssl/trace/trace.crt;
    ssl_certificate_key /etc/ssl/trace/trace.key;

    # CORRECTION : Le chemin pointe bien vers le dossier TRACE
    root /var/www/html/;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_cookie_path / "/api/; HttpOnly; Secure; SameSite=Strict";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_hide_header X-Powered-By;
        server_tokens off;
    }
}
EOF

ln -sf /etc/nginx/sites-available/trace /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

# ------------------------------------------------------------------------------
# 11. RÉSUMÉ
# ------------------------------------------------------------------------------
echo -e "\n======================================================"
echo -e "\e[32m DÉPLOIEMENT RÉUSSI ET OPÉRATIONNEL ! \e[0m"
echo " URL d'accès : https://localhost"
echo " Identifiant : $ADMIN_EMAIL"
echo " Mot de passe: $ADMIN_PASS"
echo "======================================================"
