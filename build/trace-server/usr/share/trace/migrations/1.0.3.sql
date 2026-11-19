-- TRACE 1.0.3 — migration de sécurité (appliquée par le postinst lors d'une mise à jour)
-- TRACE-2026-001 : le rôle anonyme PostgREST « divagil » héritait des droits
-- agent/administrateur/lecteur. Toute requête sans jeton s'exécutait avec les droits
-- administrateur (lecture des hachés de mots de passe, création de comptes, suppressions).
BEGIN;
ALTER ROLE divagil NOINHERIT;
GRANT agent TO divagil WITH INHERIT FALSE, SET TRUE;
GRANT administrateur TO divagil WITH INHERIT FALSE, SET TRUE;
GRANT lecteur TO divagil WITH INHERIT FALSE, SET TRUE;
COMMIT;
