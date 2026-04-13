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
apt-get install -y postgresql postgresql-contrib nginx openssl

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
CREATE TABLE public.structures (code_sages VARCHAR(10) PRIMARY KEY, libelle TEXT NOT NULL);
CREATE TABLE public.lieux (id SERIAL PRIMARY KEY, nom TEXT NOT NULL, parent_id INTEGER REFERENCES public.lieux(id), type_lieu TEXT CHECK (type_lieu IN ('batiment', 'etage', 'bureau', 'local')));
CREATE TABLE public.utilisateurs (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, mot_de_passe_hash TEXT NOT NULL, nom_complet TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('agent', 'administrateur')) DEFAULT 'agent');
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
  result.token := auth.sign_jwt(json_build_object('role', _role, 'user_id', _id, 'exp', extract(epoch from now())::integer + 28800), '$JWT_SECRET');
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
END\$\$;

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
GRANT SELECT ON public.vue_mobiliers_recherche TO divagil, agent, administrateur;


GRANT agent TO divagil;
GRANT administrateur TO divagil;
GRANT USAGE ON SCHEMA public TO divagil, agent, administrateur;
GRANT ALL ON ALL TABLES IN SCHEMA public TO agent, administrateur;
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
\copy public.structures(code_sages, libelle) FROM '/tmp/trace_csv/structures.csv' DELIMITER ',' CSV HEADER;
\copy public.lieux(id, nom, parent_id, type_lieu) FROM '/tmp/trace_csv/lieux.csv' DELIMITER ',' CSV HEADER;
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
# 6. CONFIGURATION NGINX
# ------------------------------------------------------------------------------
echo -e "\n--- 6. Configuration Nginx ---"
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
# 7. RÉSUMÉ
# ------------------------------------------------------------------------------
echo -e "\n======================================================"
echo -e "\e[32m DÉPLOIEMENT RÉUSSI ET OPÉRATIONNEL ! \e[0m"
echo " URL d'accès : https://localhost"
echo " Identifiant : $ADMIN_EMAIL"
echo " Mot de passe: $ADMIN_PASS"
echo "======================================================"
