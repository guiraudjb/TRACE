-- =============================================================================
-- SCHEMA BASE DE DONNÉES - TRACE (DGFIP)
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE TYPE public.statut_mobilier AS ENUM ('en_service', 'en_maintenance', 'dispo_reemploi', 'au_rebut');
CREATE TYPE public.jwt_token AS (token text);

-- Tables
CREATE TABLE public.lieux (id SERIAL PRIMARY KEY, nom TEXT NOT NULL, parent_id INTEGER REFERENCES public.lieux(id), type_lieu TEXT CHECK (type_lieu IN ('batiment', 'etage', 'bureau', 'local')));
CREATE TABLE public.structures (code_sages VARCHAR(10) PRIMARY KEY, libelle TEXT NOT NULL, lieu_id INTEGER REFERENCES public.lieux(id));
CREATE TABLE public.utilisateurs (id SERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, mot_de_passe_hash TEXT NOT NULL, nom_complet TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('agent', 'administrateur', 'lecteur')) DEFAULT 'agent');
CREATE TABLE public.gabarits (id SERIAL PRIMARY KEY, reference_catalogue VARCHAR(50) UNIQUE NOT NULL, categorie TEXT, nom_descriptif TEXT NOT NULL, caracteristiques JSONB DEFAULT '{}'::jsonb, photo_base64 TEXT);
CREATE TABLE public.mobiliers (uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(), id_metier VARCHAR(20) UNIQUE, gabarit_id INTEGER REFERENCES public.gabarits(id), lieu_id INTEGER REFERENCES public.lieux(id), code_sages VARCHAR(10) REFERENCES public.structures(code_sages), statut statut_mobilier DEFAULT 'en_service', remarques TEXT, date_saisie TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);

-- Séquence et fonction pour l'auto-génération des ID Métier
CREATE SEQUENCE public.seq_mobilier_id START 1;

CREATE OR REPLACE FUNCTION public.set_mob_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.id_metier := 'MOB-' || LPAD(nextval('public.seq_mobilier_id')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Index de Performance
CREATE INDEX idx_mobiliers_gabarit ON public.mobiliers(gabarit_id);
CREATE INDEX idx_mobiliers_ua ON public.mobiliers(code_sages);
CREATE INDEX idx_mobiliers_statut ON public.mobiliers(statut);
CREATE INDEX idx_mobiliers_lieu ON public.mobiliers(lieu_id);
CREATE INDEX idx_gabarits_caract ON public.gabarits USING GIN (caracteristiques);
CREATE INDEX idx_mobiliers_search_trgm ON public.mobiliers USING gin ((id_metier || ' ' || COALESCE(remarques, '')) gin_trgm_ops);

-- Fonctions Authentification
CREATE OR REPLACE FUNCTION auth.url_encode(data bytea) RETURNS text AS $$SELECT translate(encode(data, 'base64'), E'+/=\n', '-_');$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION auth.sign_jwt(payload json, secret text) RETURNS text AS $$DECLARE
  header_b64 text; payload_b64 text; signature text;
BEGIN
  header_b64 := auth.url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  payload_b64 := auth.url_encode(convert_to(payload::text, 'utf8'));
  signature := auth.url_encode(hmac(convert_to(header_b64 || '.' || payload_b64, 'utf8'), convert_to(secret, 'utf8'), 'sha256'));
  RETURN header_b64 || '.' || payload_b64 || '.' || signature;
END;$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.login(email text, password text) RETURNS public.jwt_token AS $$DECLARE
  _role text; _id int; result public.jwt_token;
BEGIN
  SELECT u.role, u.id INTO _role, _id FROM public.utilisateurs u WHERE u.email = login.email AND u.mot_de_passe_hash = crypt(login.password, u.mot_de_passe_hash);
  IF _role IS NULL THEN RAISE EXCEPTION 'Identifiants incorrects'; END IF;
  result.token := auth.sign_jwt(json_build_object('role', _role, 'user_id', _id, 'email', login.email, 'exp', extract(epoch from now())::integer + 28800), '__JWT_SECRET__');
  RETURN result;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Administration
CREATE OR REPLACE FUNCTION public.creer_utilisateur(_email TEXT, _password TEXT, _role TEXT) RETURNS void AS $$BEGIN
    INSERT INTO public.utilisateurs (email, mot_de_passe_hash, nom_complet, role) VALUES (_email, crypt(_password, gen_salt('bf')), split_part(_email, '@', 1), _role);
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reinitialiser_mdp(_email TEXT, _new_password TEXT) RETURNS void AS $$BEGIN
    UPDATE public.utilisateurs SET mot_de_passe_hash = crypt(_new_password, gen_salt('bf')) WHERE email = _email;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rôles et Droits
DO $$BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'divagil') THEN 
        CREATE ROLE divagil WITH LOGIN PASSWORD '__DB_PASS__'; 
    ELSE
        ALTER ROLE divagil WITH PASSWORD '__DB_PASS__';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agent') THEN CREATE ROLE agent NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'administrateur') THEN CREATE ROLE administrateur NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lecteur') THEN CREATE ROLE lecteur NOLOGIN; END IF;
END$$;

-- Moteur de facettes
CREATE OR REPLACE FUNCTION public.get_filtres_disponibles(
    p_lieu_id INTEGER DEFAULT NULL,
    p_code_sages VARCHAR DEFAULT NULL,
    p_gabarit_id INTEGER DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_lieux jsonb;
    v_structures jsonb;
    v_gabarits jsonb;
BEGIN
    SELECT jsonb_agg(DISTINCT l.*) INTO v_lieux FROM public.lieux l WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.lieu_id = l.id AND (p_code_sages IS NULL OR m.code_sages = p_code_sages) AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id));
    SELECT jsonb_agg(DISTINCT s.*) INTO v_structures FROM public.structures s WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.code_sages = s.code_sages AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id) AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id));
    SELECT jsonb_agg(DISTINCT g.*) INTO v_gabarits FROM public.gabarits g WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.gabarit_id = g.id AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id) AND (p_code_sages IS NULL OR m.code_sages = p_code_sages));
    RETURN jsonb_build_object('lieux', COALESCE(v_lieux, '[]'::jsonb), 'structures', COALESCE(v_structures, '[]'::jsonb), 'gabarits', COALESCE(v_gabarits, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_filtres_disponibles(INTEGER, VARCHAR, INTEGER) TO divagil, agent, administrateur, lecteur;

CREATE OR REPLACE FUNCTION public.caracteristiques_txt(g public.gabarits) RETURNS text AS $$
  SELECT g.caracteristiques::text;
$$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.caracteristiques_txt(public.gabarits) TO divagil, agent, administrateur, lecteur;

-- Vues et Permissions
CREATE OR REPLACE VIEW public.vue_mobiliers_recherche AS
SELECT m.*, g.nom_descriptif AS gabarit_nom, g.categorie AS gabarit_categorie, g.caracteristiques::text AS gabarit_json_txt, g.photo_base64 AS gabarit_photo, s.libelle AS structure_libelle, l.nom AS lieu_nom
FROM public.mobiliers m JOIN public.gabarits g ON m.gabarit_id = g.id JOIN public.structures s ON m.code_sages = s.code_sages JOIN public.lieux l ON m.lieu_id = l.id;

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

-- Insertion Admin initial
INSERT INTO utilisateurs (email, mot_de_passe_hash, nom_complet, role) 
VALUES ('__ADMIN_EMAIL__', crypt('__ADMIN_PASS__', gen_salt('bf')), 'Administrateur', 'administrateur') ON CONFLICT (email) DO NOTHING;

-- Traçabilité (Audit logs)
CREATE TABLE public.audit_logs (id SERIAL PRIMARY KEY, date_action TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, utilisateur VARCHAR(255), action VARCHAR(50), id_metier VARCHAR(50), details TEXT);
GRANT SELECT ON public.audit_logs TO divagil, administrateur;

CREATE OR REPLACE FUNCTION public.log_mobilier_action() RETURNS TRIGGER AS $$
DECLARE
    v_user VARCHAR(255); v_details TEXT := '';
BEGIN
    BEGIN v_user := current_setting('request.jwt.claims', true)::json->>'email'; EXCEPTION WHEN OTHERS THEN v_user := 'Système'; END;
    IF TG_OP = 'INSERT' THEN INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'CRÉATION', NEW.id_metier, 'Nouvel équipement intégré au parc.'); RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.code_sages IS DISTINCT FROM NEW.code_sages THEN v_details := v_details || 'Affectation : ' || COALESCE(OLD.code_sages, 'Aucune') || ' -> ' || COALESCE(NEW.code_sages, 'Aucune') || '. '; END IF;
        IF OLD.lieu_id IS DISTINCT FROM NEW.lieu_id THEN v_details := v_details || 'Lieu physique modifié (Nouvel ID Lieu : ' || COALESCE(NEW.lieu_id::text, 'Aucun') || '). '; END IF;
        IF OLD.statut IS DISTINCT FROM NEW.statut THEN v_details := v_details || 'Statut : ' || COALESCE(OLD.statut::text, 'N/A') || ' -> ' || COALESCE(NEW.statut::text, 'N/A') || '. '; END IF;
        IF OLD.gabarit_id IS DISTINCT FROM NEW.gabarit_id THEN v_details := v_details || 'Modèle (Gabarit) remplacé. '; END IF;
        IF OLD.remarques IS DISTINCT FROM NEW.remarques THEN v_details := v_details || 'Remarques mises à jour. '; END IF;
        IF v_details <> '' THEN INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'MODIFICATION', NEW.id_metier, v_details); END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'SUPPRESSION', OLD.id_metier, 'Équipement supprimé définitivement.'); RETURN OLD; END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trig_audit_mobiliers AFTER INSERT OR UPDATE OR DELETE ON public.mobiliers FOR EACH ROW EXECUTE FUNCTION public.log_mobilier_action();

CREATE OR REPLACE FUNCTION public.log_admin_action() RETURNS TRIGGER AS $$
DECLARE
    v_user VARCHAR(255); v_action VARCHAR(50); v_cible VARCHAR(50); v_details TEXT := '';
BEGIN
    BEGIN v_user := current_setting('request.jwt.claims', true)::json->>'email'; EXCEPTION WHEN OTHERS THEN v_user := 'Système (Admin)'; END;
    IF TG_OP = 'INSERT' THEN v_action := 'CRÉATION'; ELSIF TG_OP = 'UPDATE' THEN v_action := 'MODIFICATION'; ELSIF TG_OP = 'DELETE' THEN v_action := 'SUPPRESSION'; END IF;
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
    INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, v_action, v_cible, 'ADMINISTRATION : ' || v_details);
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trig_audit_utilisateurs AFTER INSERT OR UPDATE OR DELETE ON public.utilisateurs FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
CREATE TRIGGER trig_audit_structures AFTER INSERT OR UPDATE OR DELETE ON public.structures FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
CREATE TRIGGER trig_audit_lieux AFTER INSERT OR UPDATE OR DELETE ON public.lieux FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
