/* =============================================================================
   BASE DE DONNÉES mobiTrace - TRADUCTION POUR LES PROFILS ADMINISTRATIFS
   Ce fichier contient les "plans de construction" de l'application. 
   L'ordinateur lit ce fichier de haut en bas pour fabriquer tout le système.
============================================================================= */

-- =============================================================================
-- ÉTAPE 1 : LES OUTILS DE BASE ET LE VOCABULAIRE OFFICIEL
-- L'Objectif (Le Pourquoi) : Équiper l'ordinateur avec les bons outils (chiffrement) 
-- et forcer l'utilisation d'un vocabulaire strict pour éviter les erreurs de saisie.
-- =============================================================================

-- (L'Action) On ajoute une "boîte à outils" mathématique pour chiffrer les mots de passe.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- (L'Action) On ajoute une "boîte à outils" pour faire des recherches textuelles rapides (comme un mini-Google).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- (L'Action) On crée un dossier virtuel séparé appelé "auth" pour ranger les mécanismes de sécurité.
CREATE SCHEMA IF NOT EXISTS auth;

-- (L'Action) On définit une liste stricte de mots autorisés pour l'état d'un meuble. 
-- L'ordinateur refusera toute autre orthographe.
CREATE TYPE public.statut_mobilier AS ENUM ('en_service', 'en_maintenance', 'dispo_reemploi', 'au_rebut');

-- (L'Action) On crée un format spécial pour ranger les "badges d'accès électroniques" (Jetons JWT).
CREATE TYPE public.jwt_token AS (token text);


-- =============================================================================
-- ÉTAPE 2 : L'ORGANISATION DES CLASSEURS (La création des tables)
-- L'Objectif (Le Pourquoi) : Ne jamais saisir la même information deux fois. 
-- On sépare les adresses, les services et les meubles dans des classeurs 
-- différents, et on crée des "liens invisibles" entre eux.
-- =============================================================================

-- 1. Le classeur des Bâtiments (Lieux)
CREATE TABLE public.lieux (
    id SERIAL PRIMARY KEY, -- L'ordinateur donne un numéro de page unique à chaque bâtiment.
    nom TEXT NOT NULL      -- Le nom du bâtiment, obligatoire.
);

-- 2. Le classeur des Services Administratifs (Structures)
CREATE TABLE public.structures (
    code_sages VARCHAR(10) PRIMARY KEY,       -- Le code officiel du service sert de numéro de page unique.
    libelle TEXT NOT NULL,                    -- Le nom complet du service.
    lieu_id INTEGER REFERENCES public.lieux(id) -- Le lien invisible : on indique juste la page du bâtiment.
);

-- 3. Le classeur des Utilisateurs (Annuaire des agents)
CREATE TABLE public.utilisateurs (
    id SERIAL PRIMARY KEY,                    -- Un numéro unique par agent.
    email TEXT UNIQUE NOT NULL,               -- L'adresse mail, qui doit être unique (pas de doublon).
    mot_de_passe_hash TEXT NOT NULL,          -- Le mot de passe, stocké sous forme de texte indéchiffrable.
    nom_complet TEXT NOT NULL,                -- Le nom et prénom de l'agent.
    -- On force le rôle à être l'un de ces trois profils, avec "agent" par défaut :
    role TEXT NOT NULL CHECK (role IN ('agent', 'administrateur', 'lecteur')) DEFAULT 'agent'
);

-- 4. Le classeur du Catalogue National (Modèles de meubles)
CREATE TABLE public.gabarits (
    id SERIAL PRIMARY KEY,                                -- Un numéro unique pour chaque modèle.
    reference_catalogue VARCHAR(50) UNIQUE NOT NULL,      -- La référence fournisseur unique (ex: BUR-001).
    categorie TEXT,                                       -- La famille du meuble (Assise, Rangement...).
    nom_descriptif TEXT NOT NULL,                         -- Le libellé complet.
    caracteristiques JSONB DEFAULT '{}'::jsonb,           -- Un tiroir flexible pour ranger des infos techniques (dimensions, couleurs).
    photo_base64 TEXT                                     -- La photo du meuble, convertie en texte pour être stockée.
);

-- 5. Le grand registre de l'Inventaire (Les meubles sur le terrain)
CREATE TABLE public.mobiliers (
    uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),                        -- L'immatriculation informatique universelle du meuble.
    id_metier VARCHAR(20) UNIQUE,                                           -- Le numéro d'inventaire lisible pour les humains (ex: MOB-042).
    gabarit_id INTEGER REFERENCES public.gabarits(id),                      -- Le lien invisible vers le modèle du catalogue.
    lieu_id INTEGER REFERENCES public.lieux(id),                            -- Le lien invisible vers le bâtiment.
    code_sages VARCHAR(10) REFERENCES public.structures(code_sages),        -- Le lien invisible vers le service affecté.
    statut statut_mobilier DEFAULT 'en_service',                            -- L'état actuel, pris dans notre liste stricte définie plus haut.
    remarques TEXT,                                                         -- Un espace pour des notes libres.
    date_saisie TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP          -- L'ordinateur horodate automatiquement la création de la fiche.
);


-- =============================================================================
-- ÉTAPE 3 : LA MACHINE À ÉTIQUETER (Le numéroteur automatique)
-- L'Objectif (Le Pourquoi) : Pour suivre un équipement, il lui faut une plaque 
-- unique. On automatise la numérotation pour éviter tout doublon humain.
-- =============================================================================

-- (L'Action) On crée un "compteur" mécanique qui démarre à 1.
CREATE SEQUENCE public.seq_mobilier_id START 1;

-- (L'Action) On fabrique le "tampon automatique". 
-- Il regarde si la fiche a un numéro métier. Si non, il prend le numéro du compteur, 
-- ajoute des zéros devant, et colle "MOB-" au début.
CREATE OR REPLACE FUNCTION public.set_mob_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.id_metier := 'MOB-' || LPAD(nextval('public.seq_mobilier_id')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- (L'Action) On ordonne à l'ordinateur de frapper ce tampon SUR CHAQUE NOUVELLE FICHE 
-- juste avant de la ranger dans le registre de l'inventaire.
CREATE TRIGGER trigger_set_mob_id
BEFORE INSERT ON public.mobiliers
FOR EACH ROW EXECUTE FUNCTION public.set_mob_id();


-- =============================================================================
-- ÉTAPE 4 : L'OPTIMISATION DES RECHERCHES (Les sommaires cachés)
-- L'Objectif (Le Pourquoi) : Retrouver instantanément une information au milieu 
-- de 100 000 meubles sans que le système ne ralentisse.
-- =============================================================================

-- (L'Action) L'ordinateur se crée des "sommaires" invisibles (des INDEX).
-- C'est comme l'index à la fin d'un livre : au lieu de lire tout le livre pour 
-- trouver un mot, on regarde le sommaire qui nous donne tout de suite la page.
CREATE INDEX idx_mobiliers_gabarit ON public.mobiliers(gabarit_id);        -- Sommaire pour trier par modèle
CREATE INDEX idx_mobiliers_ua ON public.mobiliers(code_sages);             -- Sommaire pour trier par service
CREATE INDEX idx_mobiliers_statut ON public.mobiliers(statut);             -- Sommaire pour trier par état
CREATE INDEX idx_mobiliers_lieu ON public.mobiliers(lieu_id);              -- Sommaire pour trier par bâtiment

-- (L'Action) Sommaires ultra-puissants (GIN) pour chercher un mot précis caché dans 
-- des données techniques ou pour retrouver un meuble même avec une faute de frappe.
CREATE INDEX idx_gabarits_caract ON public.gabarits USING GIN (caracteristiques);
CREATE INDEX idx_mobiliers_search_trgm ON public.mobiliers USING gin ((id_metier || ' ' || COALESCE(remarques, '')) gin_trgm_ops);


-- =============================================================================
-- ÉTAPE 5 : LES BADGES DE SÉCURITÉ (Fonctions d'authentification)
-- L'Objectif (Le Pourquoi) : S'assurer que chaque personne qui utilise l'application 
-- est bien qui elle prétend être, et lui confier un "bracelet de sécurité".
-- =============================================================================

-- (L'Action) Des fonctions techniques pour encoder les informations pour qu'elles voyagent sur internet en toute sécurité.
CREATE OR REPLACE FUNCTION auth.url_encode(data bytea) RETURNS text AS $$SELECT translate(encode(data, 'base64'), E'+/=\n', '-_');$$ LANGUAGE sql;

-- (L'Action) La fabrication du "badge électronique" (Jeton JWT). L'ordinateur fabrique une carte d'identité virtuelle et la signe pour qu'elle soit infalsifiable.
CREATE OR REPLACE FUNCTION auth.sign_jwt(payload json, secret text) RETURNS text AS $$DECLARE
  header_b64 text; payload_b64 text; signature text;
BEGIN
  header_b64 := auth.url_encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  payload_b64 := auth.url_encode(convert_to(payload::text, 'utf8'));
  signature := auth.url_encode(hmac(convert_to(header_b64 || '.' || payload_b64, 'utf8'), convert_to(secret, 'utf8'), 'sha256'));
  RETURN header_b64 || '.' || payload_b64 || '.' || signature;
END;$$ LANGUAGE plpgsql;

-- (L'Action) La porte d'entrée (Le Login). L'agent tape son mail et mot de passe.
CREATE OR REPLACE FUNCTION public.login(email text, password text) RETURNS public.jwt_token AS $$
DECLARE
  _role text; _id int; _token text; result public.jwt_token;
BEGIN
  -- L'ordinateur vérifie dans l'annuaire si le mot de passe correspond.
  SELECT u.role, u.id INTO _role, _id FROM public.utilisateurs u 
  WHERE u.email = login.email AND u.mot_de_passe_hash = crypt(login.password, u.mot_de_passe_hash);
  
  -- Si c'est faux, on bloque tout.
  IF _role IS NULL THEN RAISE EXCEPTION 'Identifiants incorrects'; END IF;
  
  -- Si c'est bon, on lui imprime son "badge" valable 8 heures (28800 secondes).
  _token := auth.sign_jwt(json_build_object('role', _role, 'user_id', _id, 'email', login.email, 'exp', extract(epoch from now())::integer + 28800), '__JWT_SECRET__');
  
  -- On place ce badge dans un "coffre-fort" sur l'ordinateur de l'agent (un Cookie Sécurisé).
  perform set_config('response.headers', '[{"Set-Cookie": "trace_token=' || _token || '; Path=/api; HttpOnly; Secure; SameSite=Strict"}]', true);

  result.token := 'Session démarrée';
  RETURN result;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (L'Action) La porte de sortie (La Déconnexion). On détruit le badge de l'agent.
CREATE OR REPLACE FUNCTION public.logout() RETURNS void AS $$
BEGIN
  perform set_config('response.headers', '[{"Set-Cookie": "trace_token=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0"}]', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (L'Action) Le "Miroir d'identité". Permet à l'application de demander "Qui suis-je ?" à partir de son badge.
CREATE OR REPLACE FUNCTION public.me() RETURNS json AS $$
DECLARE
  _email text;
  _role text;
BEGIN
  _email := current_setting('request.jwt.claims', true)::json->>'email';
  _role := current_setting('request.jwt.claims', true)::json->>'role';
  IF _email IS NULL THEN RETURN NULL; END IF;
  RETURN json_build_object('email', _email, 'role', _role);
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- ÉTAPE 6 : GESTION DU PERSONNEL (Administration)
-- L'Objectif (Le Pourquoi) : Permettre aux chefs de créer ou dépanner des comptes.
-- =============================================================================

-- (L'Action) Ajouter un nouvel employé. On chiffre son mot de passe immédiatement avant de le ranger.
CREATE OR REPLACE FUNCTION public.creer_utilisateur(_email TEXT, _password TEXT, _role TEXT) RETURNS void AS $$BEGIN
    INSERT INTO public.utilisateurs (email, mot_de_passe_hash, nom_complet, role) VALUES (_email, crypt(_password, gen_salt('bf')), split_part(_email, '@', 1), _role);
END;$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (L'Action) Changer le mot de passe d'un employé qui l'a oublié.
CREATE OR REPLACE FUNCTION public.reinitialiser_mdp(_email TEXT, _new_password TEXT) RETURNS void AS $$BEGIN
    UPDATE public.utilisateurs SET mot_de_passe_hash = crypt(_new_password, gen_salt('bf')) WHERE email = _email;
END;$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- ÉTAPE 7 : LE CLOISONNEMENT DES POUVOIRS (Création des Rôles)
-- L'Objectif (Le Pourquoi) : Déclarer officiellement à l'ordinateur les 3 profils.
-- =============================================================================

DO $$BEGIN
    -- 'divagil' est l'utilisateur technique (le moteur logiciel).
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'divagil') THEN 
        CREATE ROLE divagil WITH LOGIN PASSWORD '__DB_PASS__'; 
    ELSE
        ALTER ROLE divagil WITH PASSWORD '__DB_PASS__';
    END IF;
    
    -- Création des profils métiers (ce ne sont pas des comptes de connexion, mais des casquettes de droits).
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'agent') THEN CREATE ROLE agent NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'administrateur') THEN CREATE ROLE administrateur NOLOGIN; END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lecteur') THEN CREATE ROLE lecteur NOLOGIN; END IF;
END$$;


-- =============================================================================
-- ÉTAPE 8 : LA LOUPE MAGIQUE ET LES FILTRES INTELLIGENTS
-- L'Objectif (Le Pourquoi) : Rendre l'application simple à utiliser pour les agents.
-- =============================================================================

-- (L'Action) Le "Trieur de filtres". Si je clique sur "Bâtiment X", ce moteur 
-- supprime automatiquement des listes déroulantes les services qui n'y sont pas.
CREATE OR REPLACE FUNCTION public.get_filtres_disponibles(
    p_lieu_id INTEGER DEFAULT NULL,
    p_code_sages VARCHAR DEFAULT NULL,
    p_gabarit_id INTEGER DEFAULT NULL
) RETURNS jsonb AS $$
DECLARE
    v_lieux jsonb; v_structures jsonb; v_gabarits jsonb;
BEGIN
    SELECT jsonb_agg(DISTINCT l.*) INTO v_lieux FROM public.lieux l WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.lieu_id = l.id AND (p_code_sages IS NULL OR m.code_sages = p_code_sages) AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id));
    SELECT jsonb_agg(DISTINCT s.*) INTO v_structures FROM public.structures s WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.code_sages = s.code_sages AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id) AND (p_gabarit_id IS NULL OR m.gabarit_id = p_gabarit_id));
    SELECT jsonb_agg(DISTINCT g.*) INTO v_gabarits FROM public.gabarits g WHERE EXISTS (SELECT 1 FROM public.mobiliers m WHERE m.gabarit_id = g.id AND (p_lieu_id IS NULL OR m.lieu_id = p_lieu_id) AND (p_code_sages IS NULL OR m.code_sages = p_code_sages));
    RETURN jsonb_build_object('lieux', COALESCE(v_lieux, '[]'::jsonb), 'structures', COALESCE(v_structures, '[]'::jsonb), 'gabarits', COALESCE(v_gabarits, '[]'::jsonb));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- On autorise tout le monde à utiliser ce trieur.
GRANT EXECUTE ON FUNCTION public.get_filtres_disponibles(INTEGER, VARCHAR, INTEGER) TO divagil, agent, administrateur, lecteur;

-- (L'Action) Un petit outil pour pouvoir lire facilement les données techniques.
CREATE OR REPLACE FUNCTION public.caracteristiques_txt(g public.gabarits) RETURNS text AS $$
  SELECT g.caracteristiques::text;
$$ LANGUAGE sql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.caracteristiques_txt(public.gabarits) TO divagil, agent, administrateur, lecteur;

-- (L'Action) Le "Tableau de Bord Consolidé". Au lieu d'ouvrir 4 classeurs, 
-- on rassemble le numéro de meuble, sa photo, son service et son adresse sur 
-- un seul écran transparent, pour faciliter la recherche.
CREATE OR REPLACE VIEW public.vue_mobiliers_recherche AS
SELECT m.*, g.nom_descriptif AS gabarit_nom, g.categorie AS gabarit_categorie, g.caracteristiques::text AS gabarit_json_txt, g.photo_base64 AS gabarit_photo, s.libelle AS structure_libelle, l.nom AS lieu_nom
FROM public.mobiliers m JOIN public.gabarits g ON m.gabarit_id = g.id JOIN public.structures s ON m.code_sages = s.code_sages JOIN public.lieux l ON m.lieu_id = l.id;

-- Tout le monde a le droit de lire ce tableau de bord.
GRANT SELECT ON public.vue_mobiliers_recherche TO divagil, agent, administrateur, lecteur;


-- =============================================================================
-- ÉTAPE 9 : DISTRIBUTION DES CLÉS (Règles de sécurité sur les données)
-- L'Objectif (Le Pourquoi) : Appliquer rigoureusement ce que chaque profil a 
-- le droit de faire dans l'application pour empêcher toute destruction de donnée.
-- =============================================================================

-- L'utilisateur logiciel "divagil" porte tous les badges pour pouvoir travailler.
GRANT agent TO divagil;
GRANT administrateur TO divagil;
GRANT lecteur TO divagil;
GRANT USAGE ON SCHEMA public TO divagil, agent, administrateur, lecteur;

-- Droits du LECTEUR : Il a les clés pour lire (SELECT) tous les classeurs, et c'est tout.
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lecteur;

-- Droits de l'AGENT : Il a les clés pour lire, ajouter (INSERT) et modifier (UPDATE) 
-- l'inventaire des meubles. Il n'a AUCUN DROIT de supprimer une ligne.
GRANT SELECT, INSERT, UPDATE ON TABLE public.mobiliers TO agent;
GRANT SELECT ON TABLE public.gabarits, public.lieux, public.structures TO agent;
GRANT USAGE, SELECT ON SEQUENCE public.seq_mobilier_id TO agent;

-- Droits de l'ADMINISTRATEUR : Il a le passe-partout. Il peut créer, modifier, 
-- et supprimer (DELETE) des informations dans toute l'application.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO administrateur;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO administrateur;


-- =============================================================================
-- ÉTAPE 10 : SÉCURITÉ ABSOLUE DE L'ANNUAIRE (Les mots de passe)
-- L'Objectif (Le Pourquoi) : Personne ne doit pouvoir voler les comptes.
-- =============================================================================

-- On interdit formellement à tout le monde de lire le classeur des mots de passe.
REVOKE ALL ON TABLE public.utilisateurs FROM PUBLIC, agent, lecteur;
-- Seul l'administrateur a le droit d'y accéder pour gérer le personnel.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.utilisateurs TO administrateur;

-- On précise qui a le droit d'utiliser les fonctions de connexion et d'administration.
GRANT EXECUTE ON FUNCTION public.login(text, text) TO divagil;
REVOKE EXECUTE ON FUNCTION public.creer_utilisateur(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creer_utilisateur(text, text, text) TO administrateur;
REVOKE EXECUTE ON FUNCTION public.reinitialiser_mdp(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reinitialiser_mdp(text, text) TO administrateur;
GRANT EXECUTE ON FUNCTION public.me() TO divagil, agent, administrateur, lecteur;
GRANT EXECUTE ON FUNCTION public.logout() TO divagil, agent, administrateur, lecteur;

-- (L'Action) On crée informatiquement le tout premier compte Administrateur 
-- pour ne pas être bloqué dehors lors de l'installation.
INSERT INTO utilisateurs (email, mot_de_passe_hash, nom_complet, role) 
VALUES ('__ADMIN_EMAIL__', crypt('__ADMIN_PASS__', gen_salt('bf')), 'Administrateur', 'administrateur') ON CONFLICT (email) DO NOTHING;


-- =============================================================================
-- ÉTAPE 11 : LE JOURNAL DE BORD INFALSIFIABLE (L'Audit de sécurité)
-- L'Objectif (Le Pourquoi) : Avoir un historique officiel et indestructible de 
-- chaque mouvement dans l'application, en cas de litige ou de disparition de matériel.
-- =============================================================================

-- 1. On fabrique le cahier de bord.
CREATE TABLE public.audit_logs (
    id SERIAL PRIMARY KEY, 
    date_action TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, 
    utilisateur VARCHAR(255), 
    action VARCHAR(50), 
    id_metier VARCHAR(50), 
    details TEXT
);

-- 2. On retire l'accès à ce cahier pour tout le monde (les agents ne doivent pas voir l'historique de sécurité).
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC, agent, administrateur, lecteur;
-- 3. On autorise uniquement les chefs à "lire" le cahier.
GRANT SELECT ON public.audit_logs TO divagil, administrateur;

-- 4. LES CADENAS NUMÉRIQUES : On interdit formellement la rature (UPDATE) ou la déchirure 
-- de page (DELETE). Ce cahier de bord est scellé.
CREATE RULE no_update_audit AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;

-- 5. Le Secrétaire de l'Inventaire (Enregistrement des actions sur les meubles)
CREATE OR REPLACE FUNCTION public.log_mobilier_action() RETURNS TRIGGER AS $$
DECLARE
    v_user VARCHAR(255); v_details TEXT := '';
BEGIN
    -- Il regarde qui a fait l'action en lisant le badge.
    BEGIN v_user := current_setting('request.jwt.claims', true)::json->>'email'; EXCEPTION WHEN OTHERS THEN v_user := 'Système'; END;
    
    -- Si c'est un ajout de meuble (INSERT)
    IF TG_OP = 'INSERT' THEN 
        INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'CRÉATION', NEW.id_metier, 'Nouvel équipement intégré au parc.'); RETURN NEW;
    
    -- Si c'est une modification de meuble (UPDATE), il compare l'ancienne fiche avec la nouvelle
    -- et note méticuleusement, phrase par phrase, ce qui a été modifié.
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.code_sages IS DISTINCT FROM NEW.code_sages THEN v_details := v_details || 'Affectation : ' || COALESCE(OLD.code_sages, 'Aucune') || ' -> ' || COALESCE(NEW.code_sages, 'Aucune') || '. '; END IF;
        IF OLD.lieu_id IS DISTINCT FROM NEW.lieu_id THEN v_details := v_details || 'Lieu physique modifié (Nouvel ID Lieu : ' || COALESCE(NEW.lieu_id::text, 'Aucun') || '). '; END IF;
        IF OLD.statut IS DISTINCT FROM NEW.statut THEN v_details := v_details || 'Statut : ' || COALESCE(OLD.statut::text, 'N/A') || ' -> ' || COALESCE(NEW.statut::text, 'N/A') || '. '; END IF;
        IF OLD.gabarit_id IS DISTINCT FROM NEW.gabarit_id THEN v_details := v_details || 'Modèle (Gabarit) remplacé. '; END IF;
        IF OLD.remarques IS DISTINCT FROM NEW.remarques THEN v_details := v_details || 'Remarques mises à jour. '; END IF;
        
        IF v_details <> '' THEN INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'MODIFICATION', NEW.id_metier, v_details); END IF;
        RETURN NEW;
    
    -- Si c'est une suppression (DELETE)
    ELSIF TG_OP = 'DELETE' THEN 
        INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, 'SUPPRESSION', OLD.id_metier, 'Équipement supprimé définitivement.'); RETURN OLD; 
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- On attache ce secrétaire au classeur des meubles.
CREATE TRIGGER trig_audit_mobiliers AFTER INSERT OR UPDATE OR DELETE ON public.mobiliers FOR EACH ROW EXECUTE FUNCTION public.log_mobilier_action();


-- =============================================================================
-- ÉTAPE 12 : LE GARDE-FOU MÉTIER (Le verrou de sécurité sur les modèles)
-- L'Objectif (Le Pourquoi) : Un agent ne doit jamais pouvoir transformer une 
-- armoire en fauteuil par erreur. Seul un chef a ce droit de correction.
-- =============================================================================

-- 1. Le vérificateur de badges
CREATE OR REPLACE FUNCTION public.check_mobilier_update_rights()
RETURNS TRIGGER AS $$
DECLARE
    v_role TEXT;
BEGIN
    -- Il regarde le profil de la personne connectée
    BEGIN 
        v_role := current_setting('request.jwt.claims', true)::json->>'role'; 
    EXCEPTION WHEN OTHERS THEN 
        v_role := 'agent'; 
    END;

    -- Si la personne essaie de changer de modèle de meuble ET qu'elle n'est pas "administrateur", on fait disjoncter le système.
    IF OLD.gabarit_id IS DISTINCT FROM NEW.gabarit_id AND v_role != 'administrateur' THEN
        RAISE EXCEPTION 'ACTION_BLOQUEE: Seul un administrateur peut modifier le modèle (gabarit) d''un équipement.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. On installe ce vigile sur la porte des modifications de l'inventaire.
CREATE TRIGGER trig_check_mob_update
BEFORE UPDATE ON public.mobiliers
FOR EACH ROW EXECUTE FUNCTION public.check_mobilier_update_rights();


-- =============================================================================
-- ÉTAPE 13 : LES AUTRES SECRÉTAIRES DE L'AUDIT
-- L'Objectif (Le Pourquoi) : Étendre la traçabilité à tout le reste de l'application.
-- (Modifications des services, des adresses, des comptes et du catalogue)
-- =============================================================================

-- Secrétaire Administratif (Gère l'historique des utilisateurs, services et lieux)
CREATE OR REPLACE FUNCTION public.log_admin_action() RETURNS TRIGGER AS $$
DECLARE
    v_user VARCHAR(255); v_action VARCHAR(50); v_cible VARCHAR(50); v_details TEXT := '';
BEGIN
    BEGIN v_user := current_setting('request.jwt.claims', true)::json->>'email'; EXCEPTION WHEN OTHERS THEN v_user := 'Système (Admin)'; END;
    IF TG_OP = 'INSERT' THEN v_action := 'CRÉATION'; ELSIF TG_OP = 'UPDATE' THEN v_action := 'MODIFICATION'; ELSIF TG_OP = 'DELETE' THEN v_action := 'SUPPRESSION'; END IF;
    
    -- Notes concernant la gestion du personnel
    IF TG_TABLE_NAME = 'utilisateurs' THEN
        v_cible := COALESCE(NEW.email, OLD.email);
        IF TG_OP = 'INSERT' THEN v_details := 'Nouveau compte créé avec le rôle : ' || NEW.role; END IF;
        IF TG_OP = 'UPDATE' THEN v_details := 'Mise à jour du compte (mot de passe ou rôle).'; END IF;
        IF TG_OP = 'DELETE' THEN v_details := 'Accès révoqué et compte supprimé.'; END IF;
    -- Notes concernant l'organigramme (Services)
    ELSIF TG_TABLE_NAME = 'structures' THEN
        v_cible := COALESCE(NEW.code_sages, OLD.code_sages);
        IF TG_OP = 'INSERT' THEN v_details := 'Nouveau service ajouté : ' || NEW.libelle; END IF;
        IF TG_OP = 'UPDATE' THEN v_details := 'Libellé ou rattachement du service modifié.'; END IF;
        IF TG_OP = 'DELETE' THEN v_details := 'Service retiré du référentiel.'; END IF;
    -- Notes concernant la cartographie (Bâtiments)
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


-- Secrétaire du Catalogue (Gère l'historique des modèles de meubles)
CREATE OR REPLACE FUNCTION public.log_gabarit_action() RETURNS TRIGGER AS $$
DECLARE
    v_user VARCHAR(255); 
    v_action VARCHAR(50); 
    v_cible VARCHAR(50); 
    v_details TEXT := '';
BEGIN
    BEGIN v_user := current_setting('request.jwt.claims', true)::json->>'email'; EXCEPTION WHEN OTHERS THEN v_user := 'Système'; END;

    IF TG_OP = 'INSERT' THEN v_action := 'CRÉATION'; ELSIF TG_OP = 'UPDATE' THEN v_action := 'MODIFICATION'; ELSIF TG_OP = 'DELETE' THEN v_action := 'SUPPRESSION'; END IF;

    v_cible := COALESCE(NEW.reference_catalogue, OLD.reference_catalogue);

    IF TG_OP = 'INSERT' THEN 
        v_details := 'Nouveau modèle ajouté : ' || NEW.nom_descriptif; 
    ELSIF TG_OP = 'UPDATE' THEN 
        IF OLD.reference_catalogue IS DISTINCT FROM NEW.reference_catalogue THEN v_details := v_details || 'Réf : ' || OLD.reference_catalogue || ' -> ' || NEW.reference_catalogue || '. '; END IF;
        IF OLD.nom_descriptif IS DISTINCT FROM NEW.nom_descriptif THEN v_details := v_details || 'Désignation mise à jour. '; END IF;
        IF OLD.categorie IS DISTINCT FROM NEW.categorie THEN v_details := v_details || 'Catégorie modifiée. '; END IF;
        IF OLD.caracteristiques IS DISTINCT FROM NEW.caracteristiques THEN v_details := v_details || 'Attributs techniques (JSON) modifiés. '; END IF;
        IF OLD.photo_base64 IS DISTINCT FROM NEW.photo_base64 THEN v_details := v_details || 'Photo mise à jour. '; END IF;
        IF v_details = '' THEN v_details := 'Mise à jour mineure.'; END IF;
    ELSIF TG_OP = 'DELETE' THEN 
        v_details := 'Modèle définitivement retiré du catalogue.'; 
    END IF;

    INSERT INTO public.audit_logs (utilisateur, action, id_metier, details) VALUES (v_user, v_action, v_cible, 'CATALOGUE : ' || v_details);
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- On affecte chaque secrétaire à son classeur respectif :
CREATE TRIGGER trig_audit_gabarits AFTER INSERT OR UPDATE OR DELETE ON public.gabarits FOR EACH ROW EXECUTE FUNCTION public.log_gabarit_action();
CREATE TRIGGER trig_audit_utilisateurs AFTER INSERT OR UPDATE OR DELETE ON public.utilisateurs FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
CREATE TRIGGER trig_audit_structures AFTER INSERT OR UPDATE OR DELETE ON public.structures FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();
CREATE TRIGGER trig_audit_lieux AFTER INSERT OR UPDATE OR DELETE ON public.lieux FOR EACH ROW EXECUTE FUNCTION public.log_admin_action();


-- =============================================================================
-- ÉTAPE 14 : LES EN-TÊTES OFFICIELS (Configuration générale de l'interface)
-- L'Objectif (Le Pourquoi) : Permettre à l'administration de changer les noms 
-- du Ministère affichés sur les documents sans avoir à redévelopper l'application.
-- =============================================================================

-- On crée un petit tiroir pour les variables de texte.
CREATE TABLE public.parametres (
    cle VARCHAR(50) PRIMARY KEY,
    valeur TEXT NOT NULL
);

-- On y insère les en-têtes officiels de l'État.
INSERT INTO public.parametres (cle, valeur) VALUES
('nom_administration', 'MINISTÈRE DE L''ÉCONOMIE'),
('nom_direction', 'Direction Générale des Finances Publiques');

-- Tout le monde peut lire ces en-têtes à l'écran.
GRANT SELECT ON public.parametres TO divagil, agent, administrateur, lecteur;
-- Seuls les administrateurs ont le droit de les modifier via leur interface.
GRANT UPDATE ON public.parametres TO administrateur;
