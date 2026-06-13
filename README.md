# mobiTrace — Traçabilité, Réemploi et Affectation Circulaire des Équipements

**mobiTrace** est une application souveraine développée initialement par et pour la Direction Générale des Finances Publiques (DGFiP). Elle modernise, fluidifie et sécurise la gestion du parc mobilier de l'administration, de son intégration au catalogue jusqu'à sa réaffectation ou sa mise au rebut.

Dans une démarche d'écoresponsabilité et d'économie circulaire, mobiTrace simplifie le suivi physique des équipements à l'aide de QR Codes et d'une application satellite nomade fonctionnant hors-ligne.

---

## Fonctionnalités principales

- **Inventaire & Traçabilité :** Consultation rapide via indexation vectorielle (Trigram GIN) et journal d'audit intégral et inaltérable intégré à la base de données.
- **Saisie rapide & Scan :** Interface optimisée pour la lecture de QR codes à la douchette et intégration de lots d'équipements (Bulk Insert) sans conflits d'accès concurrents.
- **Catalogue national standardisé :** Gestion des gabarits selon une charte de nommage stricte et un constructeur dynamique de caractéristiques (stockées en JSONB).
- **Outillage administratif :** Génération native de planches de QR codes prêtes à l'impression et création de Procès-Verbaux de mise au rebut (PDF) générés côté client.
- **Impression d'étiquettes Zebra :** Impression directe d'étiquettes ZPL sur imprimantes Zebra via un microservice dédié, accessible depuis l'interface web.
- **mobiTrace-SCAN (Application Satellite) :** Progressive Web App (PWA) pour les agents sur le terrain, permettant de scanner le matériel en totale autonomie, même hors réseau (caves, archives).

---

## Architecture et stack technologique

Le projet repose sur une philosophie minimaliste, sans serveur applicatif intermédiaire (pas de Node.js ni de Python côté métier), maximisant la résilience et minimisant la surface d'attaque. L'intelligence métier est déportée au plus près de la donnée.

| Composant | Technologie | Rôle |
|---|---|---|
| Système d'exploitation | Debian 13 (Trixie) | Socle de déploiement |
| Base de données | PostgreSQL 17 | Logique métier (Triggers), sécurité (RBAC/RLS), hachage Bcrypt (`pgcrypto`) |
| API REST | PostgREST | Exposition sécurisée du schéma (JWT), pagination HTTP Range |
| Serveur web / Proxy | Nginx | Terminaison SSL, reverse proxy HTTP/2, rate limiting |
| Sécurité systémique | Fail2Ban | Anti-bruteforce sur `/api/rpc/login` (5 tentatives / 10 min → ban 1h) |
| Front-end | Vanilla JS + HTML5 | SPA, DSFR v1.14.3, exports CSV/PDF 100% côté client |
| Module impression | Python/Flask + CUPS | Microservice ZPL pour imprimantes Zebra, port 5050 (Gunicorn) |
| Sauvegardes | NFS + Cron + Postfix | Dumps PostgreSQL externalisés, surveillance par email |

---

## Paquets Debian

Le projet est distribué sous forme de **5 paquets Debian indépendants**, à installer selon les besoins de l'infrastructure.

### `trace-server` — Paquet principal (obligatoire)

**Dépendances :** `postgresql`, `postgresql-contrib`, `nginx`, `openssl`, `sudo`, `fail2ban`

Paquet tout-en-un qui déploie et configure automatiquement l'intégralité de l'application :

- Initialisation de la base PostgreSQL (`parc_mobilier`) avec schéma complet, référentiels CSV et triggers
- Génération des secrets (mot de passe BDD, JWT) à l'installation via `/dev/urandom`
- Configuration de PostgREST (`/etc/trace-api.conf`, service `trace-api.service`)
- Génération d'un certificat SSL auto-signé et configuration Nginx
- Mise en place de Fail2Ban (filtre sur les erreurs 401/429 de l'endpoint login)
- Tâches Cron : sauvegarde quotidienne vers `/mnt/savetrace` (02h00 et 13h00) et purge des logs Nginx

```bash
sudo apt install ./trace-server_1.0.0_all.deb
```

A l'issue de l'installation, les identifiants du compte administrateur initial sont affichés dans le terminal.

---

### `trace-backup-server` — Serveur NFS de sauvegarde

**Dépendances :** `nfs-kernel-server`, `debconf`

A installer sur une **machine distincte** qui servira de cible pour l'externalisation des dumps PostgreSQL.

- Crée et exporte le répertoire `/var/nfs/backupTRACE` via NFS
- Restreint l'accès au partage à l'IP du serveur TRACE (saisie interactive via debconf)
- Droits restrictifs (`chmod 700`, propriétaire `nobody:nogroup`)

```bash
sudo apt install ./trace-backup-server_1.0.0_all.deb
```

---

### `trace-backup-client` — Client NFS sur le serveur TRACE

**Dépendances :** `nfs-common`, `debconf`

A installer sur le **serveur TRACE** après `trace-backup-server`. Configure le montage automatique du partage NFS distant.

- Ajoute une entrée dans `/etc/fstab` avec montage automatique systemd (`x-systemd.automount`, idle-timeout 10 min)
- Point de montage : `/mnt/savetrace` (cible des scripts de sauvegarde Cron)
- Chemin NFS configurable via debconf (défaut : `192.168.1.40:/var/nfs/backupTRACE`)

```bash
sudo apt install ./trace-backup-client_1.0.0_all.deb
```

---

### `trace-zebra-printer` — Module d'impression Zebra

**Dépendances :** `trace-server`, `cups`, `python3-flask`, `python3-gunicorn`, `gunicorn`, `debconf`

Module optionnel pour l'impression directe d'étiquettes ZPL sur imprimantes Zebra réseau.

- Déploie un microservice Python/Flask dans `/opt/mobitrace-print/print_api.py`, servi par Gunicorn (2 workers, port 5050)
- Configure CUPS avec une imprimante `Zebra_Trace` en mode RAW (port 9100, IP configurable via debconf)
- Injecte les routes Nginx suivantes, protégées par authentification JWT (cookie `trace_token`) :

| Route | Méthode | Rôle |
|---|---|---|
| `/imprimer-zpl` | POST | Envoie un payload ZPL brut à l'imprimante |
| `/imprimante/status` | GET | Retourne l'état CUPS et la file d'attente |
| `/imprimante/action` | POST | Pause, reprise, annulation d'un job ou de la file |
| `/imprimante/config` | POST | Modifie dynamiquement l'IP de l'imprimante |

- Service systemd `mobitrace-print.service` (démarrage automatique, redémarrage sur erreur)
- Règle sudoers `/etc/sudoers.d/mobitrace-print` : `www-data` peut piloter CUPS sans mot de passe

```bash
sudo apt install ./trace-zebra-printer_1.0.0_all.deb
```

---

### `trace-backup-server-survey` — Sonde de surveillance des sauvegardes

**Dépendances :** `trace-backup-server`, `mailutils`, `postfix`, `debconf`

A installer sur le **serveur NFS** (`trace-backup-server`). Surveille la bonne réception des sauvegardes et envoie un rapport quotidien par email.

- Cron quotidien à **08h00** exécutant `/usr/local/bin/mobitrace_backup_survey.sh`
- Vérifie la présence des fichiers `trace_backup_YYYY-MM-DD*` de la veille dans `/var/nfs/backupTRACE`
- Trois niveaux de rapport :

| Situation | Objet du mail |
|---|---|
| 2 sauvegardes ou plus | `[OK] Rapport de sauvegarde mobiTrace` |
| 1 seule sauvegarde | `[AVERTISSEMENT] Sauvegarde mobiTrace incomplète` |
| Aucune sauvegarde | `[ALERTE CRITIQUE] Echec des sauvegardes mobiTrace` |

- Destinataires et relais SMTP configurables via debconf (défaut : `equipe.support@dgfip.finances.gouv.fr`)

```bash
sudo apt install ./trace-backup-server-survey_1.0.0_all.deb
```

---

## Déploiement complet recommandé

L'ordre d'installation pour une infrastructure complète avec sauvegarde externalisée et impression Zebra :

```
Machine NFS (dédiée)          Machine TRACE (serveur principal)
─────────────────────         ────────────────────────────────────────
1. trace-backup-server   →    2. trace-server
                              3. trace-backup-client
                              4. trace-zebra-printer  (optionnel)
5. trace-backup-server-survey (optionnel)
```

---

## Gestion des sauvegardes

Les dumps sont produits automatiquement par `trace-server` deux fois par jour :

| Heure | Script | Cible |
|---|---|---|
| 02h00 | `/usr/local/bin/trace_backup.sh` | `/mnt/savetrace` |
| 13h00 | `/usr/local/bin/trace_backup.sh` | `/mnt/savetrace` |

**Restauration interactive :**
```bash
sudo /usr/local/bin/trace_restore.sh
```

---

## Utilitaires front-end (`utils/`)

Le dossier `utils/` embarqué dans `trace-server` fournit des outils HTML autonomes accessibles depuis l'interface :

| Fichier | Rôle |
|---|---|
| `zebra-codebar-generator.html` | Générateur de codes-barres ZPL pour imprimantes Zebra |
| `zebra-codebar-generator-finetune.html` | Version affinée du générateur (réglages avancés) |
| `JsBarcode.all.min.js` | Bibliothèque de génération de codes-barres (embarquée) |
| `jspdf.umd.min.js` | Bibliothèque de génération PDF côté client (embarquée) |
| `archives/` | Versions archivées des anciens générateurs (QR codes, étiquettes) |

---

## Politique de sécurité et BOM

mobiTrace maintient un "Bill of Materials" (BOM) strict pour sa veille de sécurité. La surface d'attaque est minimisée par l'absence de framework applicatif côté serveur.

- **XSS :** désinfection systématique des saisies via `escapeHTML()` dans `app.js`
- **Authentification :** stateless par JWT (généré à l'installation, stocké dans cookie `HttpOnly`)
- **Bruteforce :** Fail2Ban surveille les codes 401/429 sur `POST /api/rpc/login` (5 tentatives → ban 1h)
- **Rate limiting :** zone Nginx `login_limit` (3 req/s, réponse 429)
- **SSL :** certificat auto-signé généré à l'installation (à remplacer par un certificat institutionnel en production)

---

## Développement et contribution

Le projet ne requiert aucune étape de build complexe (pas de Webpack ni de Vite). L'application front-end est une SPA monolithique (`app.js`, ~2500 lignes, version 2.1).

Le schéma PostgreSQL source se trouve dans `build/trace-server/usr/share/trace/schema.sql`.

Ce projet s'inscrit dans une démarche "Public Money, Public Code". Le code source est rendu public et auditable, publié sous licence **Creative Commons (CC BY-NC-SA)**. L'objectif est d'offrir ce bien commun numérique à toute structure publique souhaitant moderniser sa gestion d'inventaire.
