# mobiTrace 📦 (Traçabilité, Réemploi et Affectation Circulaire des Équipements)

**mobiTrace** est une application souveraine développée initialement par et pour la Direction Générale des Finances Publiques (DGFiP). Elle a pour vocation de moderniser, fluidifier et sécuriser la gestion du parc mobilier de l'administration, de son intégration au catalogue jusqu'à sa réaffectation ou sa mise au rebut.

Dans une démarche d'écoresponsabilité et d'économie circulaire , mobiTrace simplifie le suivi physique des équipements à l'aide de QR Codes et d'une application satellite nomade fonctionnant hors-ligne.

## 🎯 Fonctionnalités Principales

* 
**Inventaire & Traçabilité :** Consultation rapide via indexation vectorielle (Trigram GIN) et journal d'audit intégral et inaltérable intégré à la base de données.


* 
**Saisie Rapide & Scan :** Interface optimisée pour la lecture de QR codes à la douchette et intégration de lots d'équipements (Bulk Insert) sans conflits d'accès concurrents.


* 
**Catalogue National Standardisé :** Gestion des gabarits selon une charte de nommage stricte et un constructeur dynamique de caractéristiques (stockées en JSONB).


* 
**Outillage Administratif :** Génération native de planches de QR codes prêtes à l'impression et création de Procès-Verbaux de mise au rebut (PDF) générés côté client.


* 
**mobiTrace-SCAN (Application Satellite) :** Progressive Web App (PWA) conçue pour les agents sur le terrain, permettant de scanner le matériel en totale autonomie, même dans les zones sans réseau (caves, archives).



## 🏗️ Architecture et Stack Technologique

Le projet s'appuie sur une philosophie minimaliste, sans serveur applicatif intermédiaire (pas de Node.js ni de Python), maximisant la résilience et minimisant la surface d'attaque. L'intelligence métier est déportée au plus près de la donnée.

* 
**Système d'Exploitation :** Debian 13 (Trixie).


* 
**Base de Données (Cœur du système) :** PostgreSQL 17. Gère la logique métier (Triggers SQL), la sécurité (RBAC/RLS) et le hachage des mots de passe (Bcrypt via `pgcrypto`).


* 
**API REST :** PostgREST. Expose instantanément le schéma de base de données de manière sécurisée (JWT) et performante (Pagination HTTP Range).


* **Serveur Web / Proxy :** Nginx. Assure la terminaison SSL, le Reverse Proxy HTTP/2 et la protection active.


* 
**Sécurité Systémique :** Fail2Ban pour la limitation de requêtes et tâches Cron automatisées pour les purges de logs et les sauvegardes.


* 
**Front-end (Client) :** Vanilla JS et HTML5 natifs. Intègre le Système de Design de l'État (DSFR v1.14.3). La génération d'exports (CSV, PDF) se fait 100% en local côté navigateur.



## 🚀 Installation et Déploiement (SysAdmin)

Le déploiement est entièrement automatisé pour garantir un système "Clé en main".

### Via paquet Debian (Recommandé)

```bash
sudo apt update
sudo apt install ./trace-server_1.0.0_all.deb

```

*Le script de post-installation (`postinst`) se chargera de générer les secrets, d'initialiser PostgreSQL, de configurer Nginx/Fail2Ban et de créer le compte administrateur initial.* 

### Gestion des Sauvegardes

La sécurité des données est assurée par un système de dump automatisé :

* 
**Sauvegarde :** Exécutée quotidiennement vers `/mnt/savetrace` via le script `/usr/local/bin/trace_backup.sh`.


* 
**Restauration :** Outil interactif disponible via `sudo /usr/local/bin/trace_restore.sh`.



## 👨‍💻 Développement et Contribution

Pour le développement local, il est recommandé de se familiariser avec l'architecture Front-end. Actuellement constituée d'une architecture SPA monolithique (`app.js`), une réflexion est en cours pour migrer vers une structure modulaire en ES Modules natifs pour faciliter la maintenance collaborative.

Le projet ne requiert aucune étape de build complexe (Webpack/Vite inutile).

## 🛡️ Politique de Sécurité et BOM

mobiTrace maintient un "Bill of Materials" (BOM) strict pour sa veille de sécurité. L'application limite sa surface d'attaque en s'appuyant sur des composants stables. Les failles XSS sont mitigées via la désinfection systématique des saisies (fonction `escapeHTML()`) et l'authentification est totalement `stateless`.

## 📜 Licence et Mutualisation

Ce projet s'inscrit dans une démarche "Public Money, Public Code". Le code source est rendu public et auditable, publié sous licence **Creative Commons (CC BY-NC-SA)**. L'objectif est d'offrir ce bien commun numérique à toute structure publique souhaitant moderniser sa gestion d'inventaire.

