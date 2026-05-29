/**
 * ============================================================================
 * APPLICATION FRONT-END mobiTrace (app.js) - EXPLICATION POUR NON-INFORMATICIENS
 * ============================================================================
 * Ce fichier est le "cerveau" de la page web. C'est lui qui fait le lien entre 
 * ce que l'utilisateur voit à l'écran (les boutons, les listes) et la grande 
 * base de données (l'entrepôt) qui stocke l'information.
 */

// ============================================================================
// 1. CONFIGURATION & ÉTAT GLOBAL (STATE) : La Mémoire à Court Terme
// ============================================================================
/*
 * L'Objectif (Le Pourquoi) : 
 * Pour éviter de redemander à la base de données toutes les 2 secondes "Quelle 
 * est la liste des bâtiments ?" ou "Sur quelle page l'utilisateur est-il ?", 
 * l'application garde ces informations courantes dans une mémoire rapide.
 */

// (L'Action) Les réglages de base : où se trouve le guichet de données, et combien de lignes par page.
const CONFIG = {
    API_URL: '/api',
    ITEMS_PER_PAGE: 50
};

// (L'Action) Le "Carnet de notes" de l'application (Le State).
const State = {
    user: null, // Qui est connecté ? (vide au départ)
    appConfig: {
        administration: "", // Le nom du ministère
        direction: ""       // Le nom de la direction
    },
    
    // Les catalogues mémorisés (mis en cache) pour un accès ultra-rapide sans ralentir le serveur.
    referentiels: { gabarits: [], structures: [], lieux: [] },
    // Des raccourcis de recherche (des "cartes") pour trouver un meuble instantanément via son ID.
    maps: { g: new Map(), s: new Map(), l: new Map() },
    
    // Les carnets de bord de chaque écran (page actuelle, colonne de tri, filtres actifs).
    // Si je change d'onglet et que je reviens, l'ordinateur se souvient de ma recherche.
    mobilier: {
        data: [], total: 0, page: 1, sortBy: 'id_metier', sortAsc: true,
        filters: { query: '', gabarit: '', ua: '', lieu: '', statut: '' }
    },
    gabarit: {
        data: [], total: 0, page: 1, sortBy: 'reference_catalogue', sortAsc: true,
        filters: { query: '', categorie: '' }
    },
    admin: {
        users: [], usersPage: 1, usersSortBy: 'email', usersSortAsc: true,
        ua: [], uaPage: 1, uaSortBy: 'code_sages', uaSortAsc: true,
        lieux: [], lieuxPage: 1, lieuxSortBy: 'nom', lieuxSortAsc: true,
        audit: { data: [], total: 0, page: 1, filters: { query: '' } }
    },

    /*
     * LA VÉRIFICATION DU BADGE DE SÉCURITÉ
     * Comment : L'application frappe au guichet pour demander : "Mon badge (le cookie) est-il toujours valide ?"
     * Résultat : Si oui, elle note le nom et le rôle de l'agent. Si non, elle renvoie 'false'.
     */
    async fetchUser() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/rpc/me`, {
                method: 'POST', // On force une méthode POST sécurisée
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (!res.ok) return false;
            
            const data = await res.json();
            if (!data) return false; // Le serveur répond null = Pas de badge valide
            
            this.user = data; // On enregistre les données de l'utilisateur
            return true;
        } catch (e) {
            return false;
        }
    }
};

// ============================================================================
// 2. COUCHE ACCÈS AUX DONNÉES (API) : Le Guichetier de l'Entrepôt
// ============================================================================
/*
 * L'Objectif (Le Pourquoi) : 
 * L'écran web n'a pas le droit d'aller fouiller directement dans la base de 
 * données. Il doit passer par un intermédiaire officiel et sécurisé (l'API).
 */
const API = {
    // (Comment) Prépare l'enveloppe officielle pour chaque requête, et vérifie qu'on est bien connecté.
    getHeaders(customHeaders = {}) {
        if (!State.user) {
            AuthCtrl.logout("Votre session a expiré.");
            throw new Error("Session invalide");
        }
        return {
            'Content-Type': 'application/json',
            'Prefer': 'return=representation', // Demande à la base de renvoyer l'objet créé en confirmation
            ...customHeaders
        };
    },

    // (Comment) Envoie la demande au guichet. Si le guichetier répond 401 (Accès Interdit), on déconnecte l'agent.
    async fetch(endpoint, options = {}) {
        const res = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
        if (res.status === 401) {
            AuthCtrl.logout("Accès non autorisé ou session expirée.");
            throw new Error("Non autorisé");
        }
        return res;
    },

    // (Comment) Va lire le petit classeur des paramètres pour récupérer les en-têtes officiels de l'État.
    async loadConfig() {
        try {
            const res = await fetch(`${CONFIG.API_URL}/parametres`);
            if (res.ok) {
                const data = await res.json();
                data.forEach(item => {
                    if (item.cle === 'nom_administration') State.appConfig.administration = item.valeur;
                    if (item.cle === 'nom_direction') State.appConfig.direction = item.valeur;
                });
            }
        } catch (e) { 
            // Si la base est injoignable, on met des noms par défaut pour ne pas bloquer l'écran.
            console.warn("Base injoignable, valeurs par défaut appliquées."); 
            State.appConfig.administration = "RÉPUBLIQUE FRANÇAISE";
            State.appConfig.direction = "Direction non définie";
        }
    },
    
    // (Comment) Télécharge une copie intégrale des catalogues (Lieux, Services, Modèles) au démarrage.
    async loadReferentiels() {
        // Demande les 3 catalogues en même temps pour aller plus vite (Promise.all)
        const [gRes, sRes, lRes] = await Promise.all([
            this.fetch('/gabarits?select=id,reference_catalogue,categorie,nom_descriptif,caracteristiques,photo_base64', { headers: this.getHeaders() }),
            this.fetch('/structures', { headers: this.getHeaders() }),
            this.fetch('/lieux', { headers: this.getHeaders() })
        ]);

        State.referentiels.gabarits = await gRes.json();
        State.referentiels.structures = await sRes.json();
        State.referentiels.lieux = await lRes.json();

        // Range ces catalogues dans les "raccourcis de recherche" (Map) pour pouvoir y accéder à la vitesse de l'éclair plus tard.
        State.maps.g.clear(); State.referentiels.gabarits.forEach(g => State.maps.g.set(g.id, g));
        State.maps.s.clear(); State.referentiels.structures.forEach(s => State.maps.s.set(s.code_sages, s));
        State.maps.l.clear(); State.referentiels.lieux.forEach(l => State.maps.l.set(l.id, l));
        
        // Remplit la barre de recherche intelligente des modèles.
        const dl = document.getElementById('datalist-gabarits');
        if (dl) dl.innerHTML = State.referentiels.gabarits.map(g => `<option value="${g.reference_catalogue} - ${UI.escape(g.nom_descriptif)}" data-id="${g.id}">`).join('');
    }
};

// ============================================================================
// 3. COUCHE UTILITAIRE UI (RENDU & SÉCURITÉ) : Le Décorateur d'Intérieur
// ============================================================================
const UI = {
    // L'AGENT DE DÉSINFECTION (Sécurité anti-piratage)
    // Objectif : Si un pirate tape du code malveillant dans un texte, on le transforme en simple texte inoffensif.
    escape(str) {
        if (str === null || str === undefined) return "";
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Affiche une bannière colorée (verte, rouge, bleue) en haut de l'écran pendant 5 secondes.
    showAlert(titre, message, type) {
        const c = document.getElementById('alert-container');
        c.innerHTML = `<div class="fr-alert fr-alert--${type} fr-mb-2w"><h3 class="fr-alert__title">${this.escape(titre)}</h3><p>${this.escape(message)}</p></div>`;
        setTimeout(() => c.innerHTML = '', 5000);
    },

    // Cache tous les écrans et n'affiche que celui demandé (l'effet de navigation).
    showView(viewId, parentId) {
        document.querySelectorAll(`#${parentId} .sub-view`).forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Remonte tout en haut de la page
    },

    /*
     * LE CONSTRUCTEUR DE LISTES DÉROULANTES (Select)
     * Objectif : Remplir les menus déroulants. Si on lui donne une règle `isPrimary`,
     * il crée des sous-groupes (ex: "Service de ce bâtiment" vs "Autres services") 
     * pour faciliter la vie de l'utilisateur.
     */
    fillSelect(selectId, dataArray, valueKey, labelKey, options = {}) {
        const select = document.getElementById(selectId);
        if (!select) return;
        const selected = options.selected || null;
        const placeholder = options.placeholder || "Sélectionnez...";
        
        let html = `<option value="" ${!selected ? 'selected' : ''} ${options.disablePlaceholder !== false ? 'disabled hidden' : ''}>${placeholder}</option>`;
        if (typeof options.isPrimary === 'function') {
            const primaryItems = dataArray.filter(options.isPrimary);
            const secondaryItems = dataArray.filter(item => !options.isPrimary(item));

            if (primaryItems.length > 0) {
                html += `<optgroup label="${options.primaryGroupLabel || 'Sélection recommandée'}">`;
                html += primaryItems.map(item => `<option value="${item[valueKey]}" ${item[valueKey] == selected ? 'selected' : ''}>${this.escape(item[labelKey])}</option>`).join('');
                html += `</optgroup>`;
            }

            if (secondaryItems.length > 0) {
                html += `<optgroup label="${options.secondaryGroupLabel || 'Autres options'}">`;
                html += secondaryItems.map(item => `<option value="${item[valueKey]}" ${item[valueKey] == selected ? 'selected' : ''}>${this.escape(item[labelKey])}</option>`).join('');
                html += `</optgroup>`;
            }
        } else {
            // Rendu classique sans groupes
            html += dataArray.map(item => `<option value="${item[valueKey]}" ${item[valueKey] == selected ? 'selected' : ''}>${this.escape(item[labelKey])}</option>`).join('');
        }
        select.innerHTML = html;
    },

    // Transforme le code informatique compliqué (JSON) en petites lignes de texte bien propres à l'écran.
    formatJsonToText(obj) {
        if (!obj || Object.keys(obj).length === 0) return '';
        return Object.entries(obj).map(([k, v]) => `<span style="color:var(--text-action-high-blue-france)">"${this.escape(k)}"</span>: "${this.escape(v)}"`).join(',<br>');
    },

    // Allume ou éteint les petites flèches de tri (haut/bas) en haut des colonnes des tableaux.
    updateSortUI(prefix, sortBy, isAsc) {
        document.querySelectorAll(`[id^="icon-sort-${prefix}"]`).forEach(icon => {
            icon.style.opacity = '0'; // Cache toutes les flèches
            icon.className = 'sort-icon fr-icon-arrow-down-s-line';
        });
        const activeIcon = document.getElementById(`icon-sort-${prefix === 'mob' ? sortBy : prefix + '-' + sortBy}`);
        if (activeIcon) {
            activeIcon.style.opacity = '1'; // Affiche la flèche active
            activeIcon.className = isAsc ? "sort-icon fr-icon-arrow-up-s-line" : "sort-icon fr-icon-arrow-down-s-line";
        }
    },

    /*
     * LE COMPRESSEUR DE PHOTOS
     * Objectif : Empêcher un agent d'engorger la base de données en chargeant une 
     * photo de 10 Mo. L'ordinateur redimensionne l'image en petit carré léger (15-40 ko).
     */
    async generateThumbnailBase64(file) {
        return new Promise((resolve, reject) => {
            if (file.size > 5 * 1024 * 1024) return reject(new Error("L'image dépasse la taille maximale de 5 Mo."));
            
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 300; // Taille max de la miniature
                    let width = img.width, height = img.height;

                    if (width > MAX_SIZE || height > MAX_SIZE) {
                        const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
                        width *= ratio; height *= ratio;
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // On compresse en JPEG à 80% de qualité
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
                img.onerror = () => reject(new Error("Fichier image corrompu."));
            };
            reader.onerror = () => reject(new Error("Erreur de lecture du fichier."));
        });
    }
};

// ============================================================================
// 4. CONTRÔLEURS DE DOMAINE : Les Chefs de Service
// ============================================================================

// ----------------------------------------------------------------------------
// AuthCtrl : Le Chef de la Sécurité (Connexion / Déconnexion)
// ----------------------------------------------------------------------------
const AuthCtrl = {
    // Prend l'email et le mot de passe, et les confie au guichetier.
    async login(e) {
        e.preventDefault(); // Empêche la page de se recharger brusquement
        try {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const res = await fetch(`${CONFIG.API_URL}/rpc/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!res.ok) throw new Error("Identifiants incorrects ou serveur injoignable");
            location.reload(); // Si c'est bon, on recharge la page pour ouvrir l'application
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    // Demande la destruction du badge de sécurité
    async logout(msg) {
        try { await fetch(`${CONFIG.API_URL}/rpc/logout`, { method: 'POST' }); } 
        catch(e) { console.warn("Échec de la déconnexion côté serveur"); }

        State.user = null; // Nettoyage de la mémoire
        if (msg) alert(msg);
        location.reload(); // Redirige vers la page d'accueil
    }
};

// ----------------------------------------------------------------------------
// MobilierCtrl : Le Gestionnaire de l'Inventaire (Le cœur du métier)
// ----------------------------------------------------------------------------
const MobilierCtrl = {
    searchTimeout: null, // Un petit minuteur (pour éviter de chercher à chaque lettre tapée au clavier)
    
    // Fonction utilitaire pour lire l'ID d'un modèle choisi
    getGabaritId(selectId) {
        const selectElement = document.getElementById(selectId);
        return selectElement && selectElement.value ? parseInt(selectElement.value, 10) : null;
    },

    // Démarrage du tableau de bord : Remplit les filtres et lance la première recherche
    async init() {
        UI.fillSelect('filter-gabarit', State.referentiels.gabarits, 'id', 'nom_descriptif', { disablePlaceholder: false, placeholder: 'Tous les modèles' });
        UI.fillSelect('filter-ua', State.referentiels.structures, 'code_sages', 'libelle', { disablePlaceholder: false, placeholder: 'Toutes les affectations' });
        UI.fillSelect('filter-lieu', State.referentiels.lieux, 'id', 'nom', { disablePlaceholder: false, placeholder: 'Tous les lieux' });
        await this.updateFacets();
        await this.loadData();
    },

    // Inverser le tri d'une colonne (A-Z ou Z-A)
    toggleSort(columnName) {
        if (State.mobilier.sortBy === columnName) { State.mobilier.sortAsc = !State.mobilier.sortAsc; } 
        else { State.mobilier.sortBy = columnName; State.mobilier.sortAsc = true; }
        this.loadData();
    },

    // Naviguer de page en page (Suivant / Précédent)
    changePage(direction) {
        const totalPages = Math.ceil(State.mobilier.total / CONFIG.ITEMS_PER_PAGE);
        const newPage = State.mobilier.page + direction;
        if (newPage >= 1 && newPage <= totalPages) { State.mobilier.page = newPage; this.loadData(); }
    },

    /*
     * LE FILTRE EN CASCADE (Facettes)
     * Objectif : Si je choisis "Bâtiment A", l'ordinateur ne me propose plus 
     * dans les autres menus que les services présents dans le "Bâtiment A".
     */
    async updateFacets() {
        const { lieu, ua, gabarit } = State.mobilier.filters;
        const payload = {
            p_lieu_id: lieu ? parseInt(lieu) : null,
            p_code_sages: ua ? ua : null,
            p_gabarit_id: gabarit ? parseInt(gabarit) : null
        };

        try {
            const res = await API.fetch('/rpc/get_filtres_disponibles', { method: 'POST', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur facettes");
            const facettes = await res.json();

            // Repeuple les menus avec les réponses filtrées du serveur
            UI.fillSelect('filter-gabarit', facettes.gabarits, 'id', 'nom_descriptif', { placeholder: 'Tous les modèles', selected: gabarit, disablePlaceholder: false });
            UI.fillSelect('filter-ua', facettes.structures, 'code_sages', 'libelle', { placeholder: 'Toutes les affectations', selected: ua, disablePlaceholder: false });
            UI.fillSelect('filter-lieu', facettes.lieux, 'id', 'nom', { placeholder: 'Tous les lieux', selected: lieu, disablePlaceholder: false });
        } catch (e) { console.error("Facettes inaccessibles :", e); }
    },

    // Déclenché à chaque fois que l'utilisateur modifie un filtre
    updateFilter(key, value) {
        State.mobilier.filters[key] = value.trim();
        State.mobilier.page = 1; // Retour à la page 1
        
        // Si on a touché à un menu déroulant, on recalcule la cascade
        if (['lieu', 'ua', 'gabarit'].includes(key)) this.updateFacets();

        // Déclenche la recherche avec un léger décalage (pour ne pas figer l'écran)
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadData(), 300);
    },

    // Le bouton "Vider les filtres" (La gomme)
    resetFilters() {
        clearTimeout(this.searchTimeout);
        const champs = ['search-input', 'filter-gabarit', 'filter-ua', 'filter-lieu', 'filter-statut'];
        champs.forEach(id => { const element = document.getElementById(id); if (element) element.value = ''; });

        State.mobilier.filters = { query: '', gabarit: '', ua: '', lieu: '', statut: '' };
        State.mobilier.page = 1;
        this.updateFacets();
        this.loadData();
    },

    /*
     * LE MOTEUR DE RECHERCHE INTELLIGENT
     * Objectif : Rassembler tous les filtres actifs et les envoyer au serveur.
     * Magie intégrée : Si on tape plusieurs mots, le système cherche chaque mot partout.
     */
    async loadData() {
        const { page, sortBy, sortAsc, filters } = State.mobilier;
        const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE - 1;

        let params = new URLSearchParams();
        if (filters.gabarit) params.append('gabarit_id', `eq.${filters.gabarit}`);
        if (filters.ua) params.append('code_sages', `eq.${filters.ua}`);
        if (filters.lieu) params.append('lieu_id', `eq.${filters.lieu}`);
        if (filters.statut) params.append('statut', `eq.${filters.statut}`);

        if (filters.query) {
            // Nettoyage de la saisie (retire les caractères qui pourraient casser le code SQL)
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);

            // Création d'une équation : cherche dans l'ID OU dans la remarque OU dans le nom...
            const conditionsMots = motsCles.map(mot => 
                `or(id_metier.ilike.*${mot}*,remarques.ilike.*${mot}*,gabarit_nom.ilike.*${mot}*,structure_libelle.ilike.*${mot}*,lieu_nom.ilike.*${mot}*,gabarit_json_txt.ilike.*${mot}*)`
            );
            params.append('and', `(${conditionsMots.join(',')})`);
        }
        params.append('order', `${sortBy}.${sortAsc ? 'asc' : 'desc'}`);

        try {
            const res = await API.fetch(`/vue_mobiliers_recherche?${params.toString()}`, {
                headers: API.getHeaders({ 'Range': `${startIndex}-${endIndex}`, 'Prefer': 'count=exact' })
            });
            if (!res.ok) throw new Error("Erreur de recherche");
            
            State.mobilier.data = await res.json();
            const contentRange = res.headers.get('Content-Range');
            if (contentRange) State.mobilier.total = parseInt(contentRange.split('/')[1]); // Récupère le nombre total
            
            this.renderTable(); // Dessine le tableau à l'écran
        } catch (e) { UI.showAlert("Erreur", "La recherche a échoué.", "error"); }
    },

    // Le Dessinateur : Prend les données reçues et construit les lignes HTML du tableau
    renderTable() {
        const tbody = document.getElementById('table-mobilier-body');
        tbody.innerHTML = ''; 

        State.mobilier.data.forEach(mob => {
            const gab = State.maps.g.get(mob.gabarit_id) || { nom_descriptif: 'Inconnu' };
            const lieu = State.maps.l.get(mob.lieu_id) || { nom: 'Inconnu' };
            const ua = State.maps.s.get(mob.code_sages) || { libelle: 'Inconnu' };

            const jsonText = UI.formatJsonToText(gab.caracteristiques);
            const jsonHtml = jsonText ? `<br><span class="fr-text--xs" style="color: var(--text-mention-grey); font-family: monospace;">{<br>${jsonText}<br>}</span>` : '';

            // Attribution d'une couleur (badge) en fonction du statut
            const badges = { 'en_service': 'new', 'dispo_reemploi': 'success', 'en_maintenance': 'warning', 'au_rebut': 'error' };
            const badgeClass = badges[mob.statut] || 'info';

            const tr = document.createElement('tr');
            
            // Masque le bouton Éditer si c'est un simple profil Lecteur
            const actionButton = State.user.role === 'lecteur' 
                ? '<td><span class="fr-badge fr-badge--sm fr-badge--info fr-icon-lock-line"> Protégé</span></td>'
                : '<td><button class="fr-btn fr-btn--secondary fr-btn--sm btn-edit">Fiche</button></td>';

            tr.innerHTML = `
                <td><span class="uuid-badge" style="cursor:copy" title="Copier" data-uuid="${UI.escape(mob.id_metier)}">${UI.escape(mob.id_metier)}</span></td>
                <td><span class="fr-text--bold">${UI.escape(gab.nom_descriptif)}</span>${jsonHtml}</td>
                <td class="fr-text--sm">${UI.escape(ua.libelle)}<br><span class="fr-text--light">${UI.escape(lieu.nom)}</span></td>
                <td><p class="fr-badge fr-badge--${badgeClass} fr-badge--sm fr-mb-0">${UI.escape(mob.statut)}</p></td>
                ${actionButton}
            `;
            
            // Au clic sur le numéro, on le copie dans le presse-papier (CTRL+C)
            tr.querySelector('.uuid-badge').addEventListener('click', (e) => navigator.clipboard.writeText(e.target.dataset.uuid));
            tr.querySelector('.btn-edit')?.addEventListener('click', () => this.openEditForm(mob.uuid));
            tbody.appendChild(tr);
        });

        UI.updateSortUI('mob', State.mobilier.sortBy, State.mobilier.sortAsc);
        const totalPages = Math.ceil(State.mobilier.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('results-count').innerText = `${State.mobilier.total} équipement(s)`;
        document.getElementById('page-info').innerText = `Page ${State.mobilier.page} sur ${totalPages}`;
        document.getElementById('btn-prev').disabled = (State.mobilier.page === 1);
        document.getElementById('btn-next').disabled = (State.mobilier.page >= totalPages);
    },

    // Ouvre l'écran de création d'un meuble neuf
    openCreateForm() {
        document.getElementById('form-mob-create').reset();
        document.getElementById('new-mob-id').value = "Auto-généré"; // L'ID sera créé par le numéroteur de la base
        
        const gabaritsOptions = State.referentiels.gabarits.map(g => ({
            id: g.id, labelComplet: `${g.reference_catalogue} - ${g.nom_descriptif}`
        }));
        
        UI.fillSelect('new-mob-gabarit-select', gabaritsOptions, 'id', 'labelComplet');
        UI.fillSelect('new-mob-ua', State.referentiels.structures, 'code_sages', 'libelle');
        UI.fillSelect('new-mob-lieu', State.referentiels.lieux, 'id', 'nom');
        UI.showView('view-mobilier-create', 'panel-mobilier');
    },

    // Ouvre la fiche d'un meuble existant
    openEditForm(uuid) {
        const mob = State.mobilier.data.find(m => m.uuid === uuid);
        if (!mob) return;
        document.getElementById('edit-mob-uuid').value = mob.uuid;
        document.getElementById('edit-mob-id').value = mob.id_metier;
        
        const gabaritsOptions = State.referentiels.gabarits.map(g => ({ id: g.id, labelComplet: `${g.reference_catalogue} - ${g.nom_descriptif}` }));
        UI.fillSelect('edit-mob-gabarit-select', gabaritsOptions, 'id', 'labelComplet', { selected: mob.gabarit_id });
        
        // SÉCURITÉ UX : Si l'agent n'est pas "administrateur", on lui interdit de changer le modèle du meuble.
        const selectGabarit = document.getElementById('edit-mob-gabarit-select');
        if (State.user.role !== 'administrateur') {
            selectGabarit.disabled = true;
            selectGabarit.title = "Seul un administrateur peut modifier le modèle d'un équipement existant.";
        } else {
            selectGabarit.disabled = false;
            selectGabarit.title = "";
        }
        
        UI.fillSelect('edit-mob-ua', State.referentiels.structures, 'code_sages', 'libelle', { selected: mob.code_sages });
        UI.fillSelect('edit-mob-lieu', State.referentiels.lieux, 'id', 'nom', { selected: mob.lieu_id });
        document.getElementById('edit-mob-statut').value = mob.statut;
        document.getElementById('edit-mob-remarques').value = mob.remarques || '';
        UI.showView('view-mobilier-detail', 'panel-mobilier');
        this.handleEditUaChange(); // Met à jour le menu des lieux
    },

    // Envoi des données du NOUVEAU meuble
    async handleCreate(e) {
        e.preventDefault();
        
        // Bloque le bouton de sauvegarde pour éviter que l'agent ne clique 5 fois dessus
        const submitBtn = document.querySelector('#form-mob-create button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Création en cours..."; }

        const gabarit_id = this.getGabaritId('new-mob-gabarit-select');
        if (!gabarit_id) { 
            UI.showAlert("Erreur", "Veuillez sélectionner un modèle valide dans la liste.", "error"); 
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Enregistrer le lot"; }
            return; 
        }

        const payload = {
            gabarit_id: gabarit_id,
            code_sages: document.getElementById('new-mob-ua').value,
            lieu_id: parseInt(document.getElementById('new-mob-lieu').value),
            statut: document.getElementById('new-mob-statut').value,
            remarques: document.getElementById('new-mob-remarques').value
        };
        const quantite = parseInt(document.getElementById('new-mob-quantite').value) || 1;

        if (quantite > 100 && !confirm(`Créer ${quantite} équipements identiques ?`)) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Enregistrer le lot"; }
            return;
        }

        try {
            // Création d'un lot (tableau) d'objets identiques
            const payloads = Array(quantite).fill(payload);
            const res = await API.fetch(`/mobiliers`, { method: 'POST', headers: API.getHeaders(), body: JSON.stringify(payloads) });
            
            if (!res.ok) throw new Error("Erreur lors de la création.");
            
            const data = await res.json();
            const idsCrees = data.map(m => m.id_metier).sort(); // Récupère les vrais ID générés
            
            let messageDetail = "";
            if (idsCrees.length === 1) messageDetail = ` Numéro affecté : ${idsCrees[0]}.`;
            else if (idsCrees.length > 1) messageDetail = ` Série affectée : de ${idsCrees[0]} à ${idsCrees[idsCrees.length - 1]}.`;

            UI.showAlert("Succès", `${quantite} équipement(s) créé(s).${messageDetail}`, "success");
            
            await this.loadData(); // Rafraîchit l'écran
            UI.showView('view-mobilier-list', 'panel-mobilier');
        } catch (err) { 
            UI.showAlert("Erreur", err.message, "error"); 
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Enregistrer le lot"; }
        }
    },
    
    // Envoi des données MODIFIÉES d'un meuble existant
    async handleEdit(e) {
        e.preventDefault();
        
        const submitBtn = document.querySelector('#form-mob-edit button[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerText = "Sauvegarde en cours..."; }

        const uuid = document.getElementById('edit-mob-uuid').value;
        const idMetier = document.getElementById('edit-mob-id').value;
        if (!/^MOB-\d{6}$/.test(idMetier)) { 
            UI.showAlert("Erreur", "ID métier mal formé.", "error"); 
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Sauvegarder"; }
            return; 
        }
        
        const gabarit_id = this.getGabaritId('edit-mob-gabarit-select');
        if (!gabarit_id) { 
            UI.showAlert("Erreur", "Veuillez sélectionner un modèle valide dans la liste.", "error"); 
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Sauvegarder"; }
            return; 
        }

        const payload = {
            gabarit_id: gabarit_id,
            code_sages: document.getElementById('edit-mob-ua').value,
            lieu_id: parseInt(document.getElementById('edit-mob-lieu').value),
            statut: document.getElementById('edit-mob-statut').value,
            remarques: document.getElementById('edit-mob-remarques').value
        };

        try {
            // PATCH = Je mets à jour uniquement les lignes modifiées
            const res = await API.fetch(`/mobiliers?uuid=eq.${uuid}`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur mise à jour.");
            UI.showAlert("Succès", "Équipement mis à jour.", "success");
            await this.loadData();
            UI.showView('view-mobilier-list', 'panel-mobilier');
        } catch (err) { 
            UI.showAlert("Erreur", err.message, "error"); 
        } finally {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerText = "Sauvegarder"; }
        }
    },
    
    // Demande la suppression d'un meuble
    async handleDelete() {
        const uuid = document.getElementById('edit-mob-uuid').value;
        if (!confirm("Supprimer définitivement cet équipement ?")) return;
        try {
            const res = await API.fetch(`/mobiliers?uuid=eq.${uuid}`, { method: 'DELETE', headers: API.getHeaders() });
            if (!res.ok) throw new Error("Échec de la suppression");
            UI.showAlert("Succès", "Équipement supprimé", "success");
            await this.loadData();
            UI.showView('view-mobilier-list', 'panel-mobilier');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    // Outil de création du fichier Excel (.csv) pour les gestionnaires
    async exportCSV() {
        let params = new URLSearchParams();
        // On remet tous les filtres actifs dans l'adresse
        if (State.mobilier.filters.gabarit) params.append('gabarit_id', `eq.${State.mobilier.filters.gabarit}`);
        if (State.mobilier.filters.ua) params.append('code_sages', `eq.${State.mobilier.filters.ua}`);
        if (State.mobilier.filters.lieu) params.append('lieu_id', `eq.${State.mobilier.filters.lieu}`);
        if (State.mobilier.filters.statut) params.append('statut', `eq.${State.mobilier.filters.statut}`);
        if (State.mobilier.filters.query) {
            const safeQuery = State.mobilier.filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => `or(id_metier.ilike.*${mot}*,remarques.ilike.*${mot}*,gabarit_nom.ilike.*${mot}*,structure_libelle.ilike.*${mot}*,lieu_nom.ilike.*${mot}*,gabarit_json_txt.ilike.*${mot}*)`);
            params.append('and', `(${conditionsMots.join(',')})`);
        }
        params.append('order', `${State.mobilier.sortBy}.${State.mobilier.sortAsc ? 'asc' : 'desc'}`);

        try {
            UI.showAlert("Export", "Récupération des données...", "info");
            // On demande TOUTE la liste sans pagination
            const res = await API.fetch(`/vue_mobiliers_recherche?${params.toString()}`, { headers: API.getHeaders() });
            if (!res.ok) throw new Error("Erreur récupération données.");
            const allData = await res.json();
            if (allData.length === 0) { UI.showAlert("Export", "Aucune donnée.", "warning"); return; }

            const headers = ["ID Métier", "Modèle", "Catégorie", "Affectation", "Lieu", "Statut", "Remarques"];
            // Fabrique les lignes du fichier Excel
            const rows = allData.map(mob => {
                const gab = State.maps.g.get(mob.gabarit_id) || {};
                const ua = State.maps.s.get(mob.code_sages) || {};
                const lieu = State.maps.l.get(mob.lieu_id) || {};
                return [
                    mob.id_metier, gab.nom_descriptif || 'Inconnu', gab.categorie || 'Autre',
                    ua.libelle || mob.code_sages, lieu.nom || 'Inconnu', mob.statut,
                    (mob.remarques || '').replace(/(\r\n|\n|\r|;)/gm, " ") // Supprime les sauts de ligne qui cassent Excel
                ];
            });

            let csvContent = "\ufeff" + headers.join(";") + "\n";
            rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n"; });

            // Simule un téléchargement de fichier
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `TRACE_Export_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            UI.showAlert("Succès", "Export terminé.", "success");
        } catch (err) { UI.showAlert("Erreur Export", err.message, "error"); }
    },

    // --- LE MODULE DOUCHETTE (Réaffectation à la volée) ---
    // Objectif : Permettre à un agent de flasher le code barre d'un meuble pour l'affecter instantanément à la salle choisie.
    openScan() {
        UI.fillSelect('scan-target-ua', State.referentiels.structures, 'code_sages', 'libelle');
        UI.fillSelect('scan-target-lieu', State.referentiels.lieux, 'id', 'nom');
        document.getElementById('scanner-input').value = '';
        document.getElementById('scan-log').innerHTML = '';
        UI.showView('view-mobilier-scanner', 'panel-mobilier');
        setTimeout(() => document.getElementById('scanner-input').focus(), 100);
        this.handleScanUaChange();
    },

    async processScan(event) {
        if (event.key !== 'Enter') return; // Ne réagit que si la douchette envoie la touche "Entrée"
        event.preventDefault();
        
        const input = document.getElementById('scanner-input');
        const logArea = document.getElementById('scan-log');
        const idMetier = input.value.trim().toUpperCase();
        
        if (idMetier === '') return;

        if (!/^MOB-\d{6}$/.test(idMetier)) {
            UI.showAlert("Format", "Format attendu: MOB-000000", "warning");
            input.value = ''; return;
        }

        const payload = {
            code_sages: document.getElementById('scan-target-ua').value,
            lieu_id: parseInt(document.getElementById('scan-target-lieu').value),
            statut: document.getElementById('scan-target-statut').value
        };

        if (!payload.code_sages || !payload.lieu_id || !payload.statut) {
            UI.showAlert("Erreur", "Veuillez définir la destination cible.", "error"); return;
        }

        input.value = ''; input.focus(); // On vide le champ pour le scan suivant

        try {
            // 1. Cherche si le meuble existe
            const searchRes = await API.fetch(`/mobiliers?id_metier=eq.${idMetier}`, { headers: API.getHeaders() });
            const results = await searchRes.json();

            if (results.length === 0) {
                logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${UI.escape(idMetier)}</span> Introuvable</li>`);
                return;
            }

            // 2. Modifie l'adresse du meuble (PATCH)
            const updateRes = await API.fetch(`/mobiliers?uuid=eq.${results[0].uuid}`, {
                method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload)
            });

            if (!updateRes.ok) throw new Error("Erreur serveur");
            const uaLabel = State.maps.s.get(payload.code_sages)?.libelle || payload.code_sages;
            logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--success">${UI.escape(idMetier)}</span> Affecté vers ${UI.escape(uaLabel)}</li>`);
            this.loadData(); 
        } catch (err) {
            logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${UI.escape(idMetier)}</span> Échec réseau</li>`);
        }
    },

    // --- LE MODULE IMPORT MASSIF (Le camion de déménagement) ---
    // Objectif : Lire un fichier texte contenant 500 numéros, et dire à l'ordinateur "Mets les tous dans cette pièce".
    openImport() {
        UI.fillSelect('import-target-ua', State.referentiels.structures, 'code_sages', 'libelle');
        UI.fillSelect('import-target-lieu', State.referentiels.lieux, 'id', 'nom');
        document.getElementById('file-upload').value = '';
        UI.showView('view-mobilier-import', 'panel-mobilier');
        this.handleImportUaChange();
    },

    processImport() {
        const fileInput = document.getElementById('file-upload');
        if (!fileInput.files[0]) { UI.showAlert("Attention", "Sélectionnez un fichier .txt", "warning"); return; }

        const payload = {
            code_sages: document.getElementById('import-target-ua').value,
            lieu_id: parseInt(document.getElementById('import-target-lieu').value),
            statut: document.getElementById('import-target-statut').value
        };

        if (!payload.code_sages || !payload.lieu_id) { UI.showAlert("Erreur", "Destination incomplète.", "error"); return; }

        const reader = new FileReader();
        reader.onload = async (e) => {
            // Extrait tous les numéros "MOB-XXXXXX" du texte et retire les doublons
            const ids = [...new Set(e.target.result.split(/\r?\n/).map(id => id.trim().toUpperCase()).filter(id => /^MOB-\d{6}$/.test(id)))];
            if (ids.length === 0) { UI.showAlert("Erreur", "Aucun ID valide.", "error"); return; }

            try {
                UI.showAlert("Import", `Traitement de ${ids.length} équipements...`, "info");
                const CHUNK_SIZE = 100; // On envoie les demandes par colis de 100 pour ne pas saturer l'API
                let successCount = 0;

                for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + CHUNK_SIZE);
                    const res = await API.fetch(`/mobiliers?id_metier=in.(${chunk.join(',')})`, {
                        method: 'PATCH', headers: API.getHeaders({ 'Prefer': 'return=representation' }), body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error("Erreur lot.");
                    const data = await res.json();
                    successCount += data.length;
                }
                
                if (successCount === ids.length) UI.showAlert("Succès total", `${successCount} réaffectés.`, "success");
                else UI.showAlert("Succès partiel", `${successCount} réaffectés sur ${ids.length} (Certains étaient inconnus).`, "warning");
                
                this.loadData();
            } catch (err) { UI.showAlert("Erreur Import", err.message, "error"); }
        };
        reader.readAsText(fileInput.files[0]);
    },
    
    // ========================================================================
    // LOGIQUE DE SÉLECTION INTELLIGENTE (La Cascade Service <-> Lieu)
    // ========================================================================
    
    // Si je choisis un Service, l'ordinateur présélectionne le Bâtiment de ce service.
    handleUaChange(prefix) {
        const uaCode = document.getElementById(`${prefix}-ua`).value;
        const ua = State.maps.s.get(uaCode);
        const lieuSelectId = `${prefix}-lieu`;
        
        UI.fillSelect(lieuSelectId, State.referentiels.lieux, 'id', 'nom', {
            selected: ua ? ua.lieu_id : null,
            isPrimary: (lieu) => ua && lieu.id === ua.lieu_id,
            primaryGroupLabel: "📍 Lieu par défaut du service",
            secondaryGroupLabel: "🏢 Autres sites possibles"
        });
    },

    // Si je choisis un Bâtiment, l'ordinateur met en premier choix les Services présents dans ce Bâtiment.
    handleLieuChange(prefix) {
        const lieuIdStr = document.getElementById(`${prefix}-lieu`).value;
        const lieuId = lieuIdStr ? parseInt(lieuIdStr) : null;
        const uaSelectId = `${prefix}-ua`;
        const currentUaCode = document.getElementById(uaSelectId).value;

        UI.fillSelect(uaSelectId, State.referentiels.structures, 'code_sages', 'libelle', {
            selected: currentUaCode,
            isPrimary: (ua) => lieuId !== null && ua.lieu_id === lieuId,
            primaryGroupLabel: "🎯 Services hébergés sur ce site",
            secondaryGroupLabel: "📁 Autres services"
        });
    },
    
    // Des raccourcis pour brancher cette mécanique "en cascade" sur chaque écran (Création, Scan, Import, Édition)
    handleCreateUaChange() { this.handleUaChange('new-mob'); },
    handleCreateLieuChange() { this.handleLieuChange('new-mob'); },
    handleEditUaChange() { this.handleUaChange('edit-mob'); },
    handleEditLieuChange() { this.handleLieuChange('edit-mob'); },
    handleScanUaChange() { this.handleUaChange('scan-target'); },
    handleScanLieuChange() { this.handleLieuChange('scan-target'); },
    handleImportUaChange() { this.handleUaChange('import-target'); },
    handleImportLieuChange() { this.handleLieuChange('import-target'); },
};

// ----------------------------------------------------------------------------
// GabaritCtrl : Le Conservateur du Catalogue National
// ----------------------------------------------------------------------------
/*
 * L'Action (Le Comment) : 
 * Ce contrôleur fait exactement la même chose que "MobilierCtrl", mais pour 
 * gérer les fiches d'identité des modèles (les Gabarits).
 */
const GabaritCtrl = {
    searchTimeout: null,

    init() { this.loadData(); },

    updateFilter(key, value) {
        State.gabarit.filters[key] = value.trim();
        State.gabarit.page = 1;
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadData(), 300);
    },

    resetFilters() {
        clearTimeout(this.searchTimeout);
        document.getElementById('search-gab-input').value = '';
        document.getElementById('filter-gab-cat').value = '';
        State.gabarit.filters = { query: '', categorie: '' };
        State.gabarit.page = 1;
        this.loadData();
    },

    toggleSort(columnName) {
        if (State.gabarit.sortBy === columnName) State.gabarit.sortAsc = !State.gabarit.sortAsc;
        else { State.gabarit.sortBy = columnName; State.gabarit.sortAsc = true; }
        this.loadData();
    },

    changePage(direction) {
        const totalPages = Math.ceil(State.gabarit.total / CONFIG.ITEMS_PER_PAGE);
        const newPage = State.gabarit.page + direction;
        if (newPage >= 1 && newPage <= totalPages) { State.gabarit.page = newPage; this.loadData(); }
    },

    async loadData() {
        const { page, sortBy, sortAsc, filters } = State.gabarit;
        const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE - 1;

        let params = new URLSearchParams();
        if (filters.categorie) params.append('categorie', `eq.${filters.categorie}`);
        
        if (filters.query) {
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => `or(reference_catalogue.ilike.*${mot}*,nom_descriptif.ilike.*${mot}*,caracteristiques_txt.ilike.*${mot}*)`);
            params.append('and', `(${conditionsMots.join(',')})`);
        }
        params.append('order', `${sortBy}.${sortAsc ? 'asc' : 'desc'}`);

        try {
            const res = await API.fetch(`/gabarits?${params.toString()}`, {
                headers: API.getHeaders({ 'Range': `${startIndex}-${endIndex}`, 'Prefer': 'count=exact' })
            });
            if (!res.ok) throw new Error("Erreur de recherche");
            
            State.gabarit.data = await res.json();
            const contentRange = res.headers.get('Content-Range');
            if (contentRange) State.gabarit.total = parseInt(contentRange.split('/')[1]);
            
            this.renderTable();
        } catch (e) { UI.showAlert("Erreur", "Le chargement du catalogue a échoué.", "error"); }
    },

    renderTable() {
        const tbody = document.getElementById('table-gabarits-body');
        tbody.innerHTML = '';
        
        State.gabarit.data.forEach(gab => {
            const tr = document.createElement('tr');
            
            const actionButtonGab = State.user.role === 'lecteur'
                ? '<td><span class="fr-badge fr-badge--sm fr-badge--info fr-icon-lock-line"> Protégé</span></td>'
                : '<td><button class="fr-btn fr-btn--secondary fr-btn--sm btn-edit-gab">Éditer</button></td>';
            // Affiche la miniature de la photo ou un logo générique si vide
            const photoHtml = gab.photo_base64 
                ? `<img src="${gab.photo_base64}" alt="Photo" style="width: 300px; height: 300px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-default-grey);">` 
                : `<span class="fr-icon-image-line" style="color: var(--text-mention-grey); font-size: 1.5rem;" aria-hidden="true"></span>`;
                
            tr.innerHTML = `
                <td class="fr-text--bold">${UI.escape(gab.reference_catalogue)}</td>
                <td><p class="fr-badge fr-badge--info fr-badge--sm fr-mb-0">${UI.escape(gab.categorie)}</p></td>
                <td style="text-align: center;">${photoHtml}</td>
                <td>${UI.escape(gab.nom_descriptif)}</td>
                <td class="fr-text--xs" style="font-family: monospace;">{<br>${UI.formatJsonToText(gab.caracteristiques)}<br>}</td>
                ${actionButtonGab}
            `;
            tr.querySelector('.btn-edit-gab')?.addEventListener('click', () => this.openEditForm(gab.id));
            tbody.appendChild(tr);
        });
        
        UI.updateSortUI('gab', State.gabarit.sortBy, State.gabarit.sortAsc);
        
        const totalPages = Math.ceil(State.gabarit.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('gab-results-count').innerText = `${State.gabarit.total} modèle(s)`;
        document.getElementById('gab-page-info').innerText = `Page ${State.gabarit.page} sur ${totalPages}`;
        document.getElementById('btn-gab-prev').disabled = (State.gabarit.page === 1);
        document.getElementById('btn-gab-next').disabled = (State.gabarit.page >= totalPages);
    },

    // LA MACHINE À FORMULAIRES SUR MESURE
    // Ajoute visuellement des champs "Titre : Valeur" pour que l'agent renseigne les données techniques du meuble.
    addJsonRow(key = "", val = "") {
        const row = document.createElement('div');
        row.className = 'json-builder-row';
        row.innerHTML = `<div class="fr-input-group"><label class="fr-label">Attribut</label><input class="fr-input json-key" type="text" placeholder="couleur" value="${UI.escape(key)}"></div><div class="fr-input-group"><label class="fr-label">Valeur</label><input class="fr-input json-val" type="text" placeholder="noir" value="${UI.escape(val)}"></div><button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-icon-delete-line btn-del-row"></button>`;
        row.querySelector('.btn-del-row').addEventListener('click', () => row.remove());
        document.getElementById('json-builder').appendChild(row);
    },

    // L'ASSISTANT NUMÉROTEUR (Si je choisis "Bureau", il propose "BUR-005")
    suggestNextReference() {
        const isEdit = document.getElementById('edit-gab-id').value !== "";
        if (isEdit) return;

        const catValue = document.getElementById('edit-gab-cat').value;
        const refInput = document.getElementById('edit-gab-ref');
        if (!catValue) return;

        let prefix = "AUT";
        if (catValue === 'Bureau') prefix = "BUR";
        if (catValue === 'Assise') prefix = "ASS";
        if (catValue === 'Rangement') prefix = "RAN";

        let maxNum = 0;
        State.referentiels.gabarits.forEach(g => {
            if (g.reference_catalogue && g.reference_catalogue.startsWith(prefix + '-')) {
                const num = parseInt(g.reference_catalogue.split('-')[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        });
        refInput.value = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
    },

    openCreateForm() {
        document.getElementById('form-gab-edit').reset();
        document.getElementById('edit-gab-id').value = "";
        document.getElementById('json-builder').innerHTML = "";
        document.getElementById('edit-gab-photo').value = "";
        document.getElementById('edit-gab-photo-base64').value = "";
        document.getElementById('edit-gab-photo-preview-container').style.display = "none";
        // Ajoute des champs obligatoires par défaut
        this.addJsonRow("reference_marche", "null");
        this.addJsonRow("reference_ugap", "null");
        this.addJsonRow("annee_acquisition", new Date().getFullYear().toString());
        document.getElementById('gab-form-title').innerText = "Créer un Modèle";
        document.getElementById('btn-delete-gab').style.display = 'none';
        UI.showView('view-gabarits-form', 'panel-gabarits');
    },

    openEditForm(id) {
        const gab = State.maps.g.get(id);
        if (!gab) return;
        
        document.getElementById('edit-gab-id').value = gab.id;
        document.getElementById('edit-gab-ref').value = gab.reference_catalogue;
        document.getElementById('edit-gab-cat').value = gab.categorie;
        document.getElementById('edit-gab-nom').value = gab.nom_descriptif;
        document.getElementById('edit-gab-photo').value = ""; 
        const photoBase64 = gab.photo_base64 || "";
        document.getElementById('edit-gab-photo-base64').value = photoBase64;
        if (photoBase64) {
            document.getElementById('edit-gab-photo-preview').src = photoBase64;
            document.getElementById('edit-gab-photo-preview-container').style.display = "flex";
        } else {
            document.getElementById('edit-gab-photo-preview-container').style.display = "none";
        }
        document.getElementById('json-builder').innerHTML = '';
        let caracs = gab.caracteristiques || {};
        this.addJsonRow('reference_marche', caracs.hasOwnProperty('reference_marche') ? caracs.reference_marche : "null");
        this.addJsonRow('reference_ugap', caracs.hasOwnProperty('reference_ugap') ? caracs.reference_ugap : "null");
        this.addJsonRow('annee_acquisition', caracs.hasOwnProperty('annee_acquisition') ? caracs.annee_acquisition : new Date().getFullYear().toString());
        
        const obligations = ['reference_marche', 'reference_ugap', 'annee_acquisition'];
        Object.entries(caracs).forEach(([k, v]) => { if (!obligations.includes(k)) this.addJsonRow(k, v === null ? "null" : v); });

        document.getElementById('gab-form-title').innerText = "Modifier le Modèle";
        document.getElementById('btn-delete-gab').style.display = 'inline-flex';
        UI.showView('view-gabarits-form', 'panel-gabarits');
    },

    async handleSave(e) {
        e.preventDefault();
        const ref = document.getElementById('edit-gab-ref').value.trim().toUpperCase();
        if (!/^[A-Z]{3}-\d{3}$/.test(ref)) { UI.showAlert("Format", "Référence invalide (ex: BUR-001).", "error"); return; }

        const id = document.getElementById('edit-gab-id').value;
        const caracs = {};
        
        // On ramasse toutes les boîtes de texte pour construire le fichier technique (JSON)
        document.querySelectorAll('.json-builder-row').forEach(row => {
            const key = row.querySelector('.json-key').value.trim();
            const val = row.querySelector('.json-val').value.trim();
            if (key && val !== "") {
                const safeKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').toLowerCase(); // Nettoie les accents
                caracs[safeKey] = (val.toLowerCase() === 'null') ? null : (val.toLowerCase() === 'true' ? true : (val.toLowerCase() === 'false' ? false : val));
            }
        });

        const rawNom = document.getElementById('edit-gab-nom').value.trim();
        const payload = {
            reference_catalogue: ref, categorie: document.getElementById('edit-gab-cat').value,
            nom_descriptif: rawNom.charAt(0).toUpperCase() + rawNom.slice(1), caracteristiques: caracs,
            photo_base64: document.getElementById('edit-gab-photo-base64').value || null 
        };

        try {
            const url = id ? `/gabarits?id=eq.${id}` : `/gabarits`;
            const method = id ? 'PATCH' : 'POST';
            await API.fetch(url, { method, headers: API.getHeaders(), body: JSON.stringify(payload) });
            UI.showAlert("Succès", "Modèle sauvegardé", "success");
            await API.loadReferentiels();
            await this.loadData();
            UI.showView('view-gabarits-list', 'panel-gabarits');
        } catch (err) { UI.showAlert("Erreur", "Référence déjà existante ou erreur serveur.", "error"); }
    },

    async handleDelete() {
        const id = document.getElementById('edit-gab-id').value;
        if (!confirm("Voulez-vous supprimer ce modèle ?")) return;
        try {
            const res = await API.fetch(`/gabarits?id=eq.${id}`, { method: 'DELETE', headers: API.getHeaders() });
            if (!res.ok) throw new Error("Ce modèle est utilisé par des équipements.");
            UI.showAlert("Succès", "Modèle retiré", "success");
            await API.loadReferentiels();
            await this.loadData();
            UI.showView('view-gabarits-list', 'panel-gabarits');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    async exportCSV() {
        let params = new URLSearchParams();
        if (State.gabarit.filters.categorie) params.append('categorie', `eq.${State.gabarit.filters.categorie}`);
        if (State.gabarit.filters.query) {
            const safeQuery = State.gabarit.filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => `or(reference_catalogue.ilike.*${mot}*,nom_descriptif.ilike.*${mot}*,caracteristiques_txt.ilike.*${mot}*)`);
            params.append('and', `(${conditionsMots.join(',')})`);
        }
        params.append('order', `${State.gabarit.sortBy}.${State.gabarit.sortAsc ? 'asc' : 'desc'}`);

        try {
            UI.showAlert("Export", "Récupération des données...", "info");
            const res = await API.fetch(`/gabarits?${params.toString()}`, { headers: API.getHeaders() });
            if (!res.ok) throw new Error("Erreur récupération données.");
            const allData = await res.json();
            if (allData.length === 0) { UI.showAlert("Export", "Aucune donnée.", "warning"); return; }

            // Vérifie si l'administrateur a demandé à exporter les photos cryptées
            const includePhoto = document.getElementById('checkbox-export-photo')?.checked;

            const headers = ["Référence", "Catégorie", "Désignation", "Caractéristiques JSON"];
            if (includePhoto) headers.push("Photo (Base64)");

            const rows = allData.map(gab => {
                const row = [ gab.reference_catalogue, gab.categorie, gab.nom_descriptif, JSON.stringify(gab.caracteristiques || {}).replace(/"/g, '""') ];
                if (includePhoto) row.push(gab.photo_base64 ? gab.photo_base64 : "");
                return row;
            });

            let csvContent = "\ufeff" + headers.join(";") + "\n";
            rows.forEach(row => { csvContent += row.map(cell => `"${String(cell)}"`).join(";") + "\n"; });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `TRACE_Gabarits_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            UI.showAlert("Succès", "Export terminé.", "success");
        } catch (err) { UI.showAlert("Erreur Export", err.message, "error"); }
    }
};

// ----------------------------------------------------------------------------
// AdminCtrl : Le Directeur des Ressources Humaines et Techniques
// ----------------------------------------------------------------------------
/*
 * L'Action (Le Comment) : 
 * Ce contrôleur géant, réservé au profil "administrateur", regroupe la création 
 * des comptes agents, la lecture du registre de sécurité infalsifiable (Audit), 
 * et la mise au rebut (la destruction définitive d'un lot de meubles avec PV PDF).
 */

// L'OUVREUR DE PORTE SÉCURISÉE (Modale DSFR)
// Pour éviter de voir un vieux panneau jaune moche (prompt), cette machine 
// fait apparaître une belle fenêtre officielle pour demander un mot de passe.
const PasswordModalCtrl = {
    requestPassword(titre, description) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('modal-password');
            const form = document.getElementById('form-modal-password');
            const input = document.getElementById('modal-password-input');
            const titleEl = document.getElementById('modal-password-title-text');
            const descEl = document.getElementById('modal-password-desc');

            titleEl.textContent = titre;
            descEl.textContent = description;
            input.value = ''; // On vide le champ par sécurité

            const cleanup = () => {
                form.removeEventListener('submit', onSubmit);
                modalElement.removeEventListener('dsfr.conceal', onCancel);
            };

            const onSubmit = (e) => {
                e.preventDefault();
                const pwd = input.value;
                cleanup();
                dsfr(modalElement).modal.conceal();  // Ferme la fenêtre proprement
                resolve(pwd); // Envoie le mot de passe capturé
            };

            const onCancel = () => { cleanup(); resolve(null); }; // Si annulé, renvoie 'null'

            form.addEventListener('submit', onSubmit);
            modalElement.addEventListener('dsfr.conceal', onCancel, { once: true });
            dsfr(modalElement).modal.disclose(); // Ouvre la fenêtre
            setTimeout(() => input.focus(), 100);
        });
    }
};

const AdminCtrl = {
    async init() {
        if (State.user.role !== 'administrateur') return;
        State.admin.uaFilters = { query: '', lieu: '' };
        State.admin.lieuxFilters = { query: '' };
        await this.loadUsers();
        UI.fillSelect('filter-ua-lieu', State.referentiels.lieux, 'id', 'nom', { disablePlaceholder: false, placeholder: 'Tous les lieux' });
        this.renderUA();
        this.renderLieux();
    },

    // --- LE BUREAU DU DRH (Utilisateurs) ---
    async loadUsers() {
        try {
            const res = await API.fetch('/utilisateurs', { headers: API.getHeaders() });
            State.admin.users = await res.json();
            this.renderUsers();
        } catch (e) { console.error(e); }
    },

    renderUsers() {
        const tbody = document.getElementById('table-users-body');
        tbody.innerHTML = '';
        State.admin.users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fr-text--bold">${UI.escape(u.email)}</td>
                <td><span class="fr-badge fr-badge--${u.role === 'administrateur' ? 'error' : 'info'}">${UI.escape(u.role)}</span></td>
                <td>
                    <button class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-lock-unlock-line fr-mr-1w btn-reset-pwd" title="Réinitialiser"></button>
                    <button class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-delete-line btn-del-user" style="color:var(--text-default-error);"></button>
                </td>
            `;
            tr.querySelector('.btn-reset-pwd').addEventListener('click', () => this.resetUserPwd(u.email));
            tr.querySelector('.btn-del-user').addEventListener('click', () => this.deleteUser(u.email));
            tbody.appendChild(tr);
        });
    },

    openCreateUser() {
        document.getElementById('form-user-create').reset();
        UI.showView('view-users-form', 'panel-admin');
    },

    async handleCreateUser(e) {
        e.preventDefault();
        const email = document.getElementById('new-user-email').value.trim();
        const role = document.getElementById('new-user-role').value;
        
        // Demande de saisir un mot de passe via l'outil sécurisé (Modale)
        const pwd = await PasswordModalCtrl.requestPassword("Nouveau compte", `Veuillez définir un mot de passe initial pour l'agent ${email} :`);
        if (!pwd) return; 

        try {
            const res = await API.fetch(`/rpc/creer_utilisateur`, { 
                method: 'POST', headers: API.getHeaders(), body: JSON.stringify({ _email: email, _password: pwd, _role: role }) 
            });
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.details || "Erreur serveur HTTP " + res.status);
            }
            
            UI.showAlert("Succès", "Compte créé.", "success");
            this.loadUsers();
            UI.showView('view-users-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur API/SQL", err.message, "error"); }
    },
    
    async deleteUser(email) {
        if (!confirm(`Révoquer l'accès pour ${email} ?`)) return;
        try {
            await API.fetch(`/utilisateurs?email=eq.${email}`, { method: 'DELETE', headers: API.getHeaders() });
            UI.showAlert("Succès", "Compte supprimé.", "success");
            this.loadUsers();
        } catch (err) { UI.showAlert("Erreur", "Suppression impossible.", "error"); }
    },

    async resetUserPwd(email) {
        const nouveauMdp = await PasswordModalCtrl.requestPassword("Réinitialisation", `Veuillez saisir le nouveau mot de passe pour ${email} :`);
        if (!nouveauMdp) return; 

        try {
            await API.fetch(`/rpc/reinitialiser_mdp`, { 
                method: 'POST', headers: API.getHeaders(), body: JSON.stringify({ _email: email, _new_password: nouveauMdp }) 
            });
            UI.showAlert("Succès", "Mot de passe mis à jour.", "success");
        } catch (err) { UI.showAlert("Erreur", "Réinitialisation impossible.", "error"); }
    },
    
    // --- LE SECRÉTARIAT GÉNÉRAL (Services et Bâtiments) ---
    exportUaCSV() {
        if (State.referentiels.structures.length === 0) { UI.showAlert("Export", "Aucune donnée.", "warning"); return; }
        const headers = ["Code SAGES", "Libellé", "Lieu de rattachement (ID)", "Nom du Lieu"];
        const rows = State.referentiels.structures.map(ua => {
            const lieu = State.maps.l.get(ua.lieu_id) || {};
            return [ua.code_sages, ua.libelle, ua.lieu_id, lieu.nom || 'Inconnu'];
        });

        let csvContent = "\ufeff" + headers.join(";") + "\n";
        rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n"; });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `TRACE_Services_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },

    exportLieuxCSV() {
        if (State.referentiels.lieux.length === 0) { UI.showAlert("Export", "Aucune donnée.", "warning"); return; }
        const headers = ["ID Technique", "Nom du site / bâtiment"];
        const rows = State.referentiels.lieux.map(lieu => [lieu.id, lieu.nom]);

        let csvContent = "\ufeff" + headers.join(";") + "\n";
        rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n"; });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `TRACE_Lieux_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },
    
    updateUaFilter(key, value) {
        if (!State.admin.uaFilters) State.admin.uaFilters = { query: '', lieu: '' };
        State.admin.uaFilters[key] = value.trim();
        this.renderUA();
    },

    resetUaFilters() {
        State.admin.uaFilters = { query: '', lieu: '' };
        document.getElementById('search-ua-input').value = '';
        document.getElementById('filter-ua-lieu').value = '';
        this.renderUA();
    },

    toggleUaSort(columnName) {
        if (State.admin.uaSortBy === columnName) { State.admin.uaSortAsc = !State.admin.uaSortAsc; } 
        else { State.admin.uaSortBy = columnName; State.admin.uaSortAsc = true; }
        this.renderUA();
    },
    
    renderUA() {
        const tbody = document.getElementById('table-ua-body');
        tbody.innerHTML = '';

        let filteredData = State.referentiels.structures.filter(ua => {
            const filters = State.admin.uaFilters || { query: '', lieu: '' };
            if (filters.lieu && String(ua.lieu_id) !== filters.lieu) return false;
            if (filters.query) {
                const q = filters.query.toLowerCase();
                const matchCode = ua.code_sages.toLowerCase().includes(q);
                const matchLibelle = ua.libelle.toLowerCase().includes(q);
                if (!matchCode && !matchLibelle) return false;
            }
            return true;
        });

        const sortBy = State.admin.uaSortBy || 'code_sages';
        const sortAsc = State.admin.uaSortAsc !== false;
        
        filteredData.sort((a, b) => {
            let valA = (a[sortBy] || '').toString().toLowerCase();
            let valB = (b[sortBy] || '').toString().toLowerCase();
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

        filteredData.forEach(ua => {
            const lieu = State.maps.l.get(ua.lieu_id) || { nom: 'Non défini' };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fr-text--bold">${UI.escape(ua.code_sages)}</td>
                <td>${UI.escape(ua.libelle)}</td>
                <td class="fr-text--sm">${UI.escape(lieu.nom)}</td>
                <td><button class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line btn-edit-ua"></button></td>
            `;
            tr.querySelector('.btn-edit-ua').addEventListener('click', () => this.openEditUa(ua.code_sages));
            tbody.appendChild(tr);
        });

        UI.updateSortUI('ua', sortBy, sortAsc);
        const countSpan = document.getElementById('ua-results-count');
        if (countSpan) countSpan.innerText = `${filteredData.length} service(s) trouvé(s)`;
    },
    
    openCreateUa() {
        document.getElementById('form-ua-create').reset();
        UI.fillSelect('new-ua-lieu', State.referentiels.lieux, 'id', 'nom');
        UI.showView('view-ua-form', 'panel-admin');
    },

    async handleCreateUa(e) {
        e.preventDefault();
        const payload = {
            code_sages: document.getElementById('new-ua-code').value.trim().toUpperCase(),
            libelle: document.getElementById('new-ua-libelle').value.trim(),
            lieu_id: parseInt(document.getElementById('new-ua-lieu').value)
        };
        try {
            const res = await API.fetch(`/structures`, { method: 'POST', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur de création (Code SAGES existant ?)");
            UI.showAlert("Succès", "Service ajouté.", "success");
            
            await API.loadReferentiels();
            this.renderUA();
            MobilierCtrl.init(); // On prévient l'inventaire que le catalogue des services a changé
            UI.showView('view-ua-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    openEditUa(codeSages) {
        const ua = State.maps.s.get(codeSages);
        if (!ua) return;
        
        UI.fillSelect('edit-ua-lieu', State.referentiels.lieux, 'id', 'nom', { selected: ua.lieu_id });
        document.getElementById('edit-ua-code').value = ua.code_sages;
        document.getElementById('edit-ua-libelle').value = ua.libelle;
        UI.showView('view-ua-edit', 'panel-admin');
    },

    async handleEditUa(e) {
        e.preventDefault();
        const code = document.getElementById('edit-ua-code').value;
        const payload = {
            libelle: document.getElementById('edit-ua-libelle').value.trim(),
            lieu_id: parseInt(document.getElementById('edit-ua-lieu').value)
        };

        try {
            const res = await API.fetch(`/structures?code_sages=eq.${code}`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur lors de la mise à jour.");
            UI.showAlert("Succès", "Service mis à jour.", "success");
            
            await API.loadReferentiels();
            this.renderUA();
            MobilierCtrl.init();
            UI.showView('view-ua-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    async deleteUa() {
        const code = document.getElementById('edit-ua-code').value;
        if (!confirm(`Supprimer définitivement le service ${code} ?`)) return;
        try {
            const res = await API.fetch(`/structures?code_sages=eq.${code}`, { method: 'DELETE', headers: API.getHeaders() });
            if (!res.ok) throw new Error("Impossible : ce service est utilisé par des équipements.");
            UI.showAlert("Succès", "Service supprimé.", "success");
            await API.loadReferentiels();
            this.renderUA();
            UI.showView('view-ua-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur SQL", err.message, "error"); }
    },


    renderLieux() {
        const tbody = document.getElementById('table-lieux-body');
        tbody.innerHTML = '';

        let filteredData = State.referentiels.lieux.filter(l => {
            const filters = State.admin.lieuxFilters || { query: '' };
            if (filters.query) {
                const q = filters.query.toLowerCase();
                return l.nom.toLowerCase().includes(q);
            }
            return true;
        });

        const sortBy = State.admin.lieuxSortBy || 'nom';
        const sortAsc = State.admin.lieuxSortAsc !== false;

        filteredData.sort((a, b) => {
            let valA = (a[sortBy] || '').toString().toLowerCase();
            let valB = (b[sortBy] || '').toString().toLowerCase();
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

        filteredData.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="fr-text--bold">${UI.escape(l.nom)}</td>
                <td><button class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line btn-edit-lieu"></button></td>
            `;
            tr.querySelector('.btn-edit-lieu').addEventListener('click', () => this.openEditLieu(l.id));
            tbody.appendChild(tr);
        });

        UI.updateSortUI('lieux', sortBy, sortAsc);
        const countSpan = document.getElementById('lieux-results-count');
        if (countSpan) countSpan.innerText = `${filteredData.length} lieu(x) trouvé(s)`;
    },
    
    updateLieuxFilter(value) {
        if (!State.admin.lieuxFilters) State.admin.lieuxFilters = { query: '' };
        State.admin.lieuxFilters.query = value.trim();
        this.renderLieux();
    },

    resetLieuxFilters() {
        State.admin.lieuxFilters = { query: '' };
        document.getElementById('search-lieux-input').value = '';
        this.renderLieux();
    },

    toggleLieuxSort(columnName) {
        if (State.admin.lieuxSortBy === columnName) { State.admin.lieuxSortAsc = !State.admin.lieuxSortAsc; } 
        else { State.admin.lieuxSortBy = columnName; State.admin.lieuxSortAsc = true; }
        this.renderLieux();
    },

    openCreateLieu() {
        document.getElementById('form-lieu-create').reset();
        UI.showView('view-lieux-form', 'panel-admin');
    },

    async handleCreateLieu(e) {
        e.preventDefault();
        const payload = { nom: document.getElementById('new-lieu-nom').value.trim() };
        try {
            const res = await API.fetch(`/lieux`, { method: 'POST', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur de création.");
            UI.showAlert("Succès", "Nouveau lieu enregistré.", "success");
            
            await API.loadReferentiels();
            this.renderLieux();
            MobilierCtrl.init();
            UI.showView('view-lieux-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    openEditLieu(id) {
        const lieu = State.maps.l.get(id);
        if (!lieu) return;
        
        document.getElementById('edit-lieu-id').value = lieu.id;
        document.getElementById('edit-lieu-nom').value = lieu.nom;
        UI.showView('view-lieux-edit', 'panel-admin');
    },

    async handleEditLieu(e) {
        e.preventDefault();
        const id = document.getElementById('edit-lieu-id').value;
        const payload = { nom: document.getElementById('edit-lieu-nom').value.trim() };

        try {
            const res = await API.fetch(`/lieux?id=eq.${id}`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur de mise à jour.");
            UI.showAlert("Succès", "Lieu mis à jour.", "success");
            
            await API.loadReferentiels();
            this.renderLieux();
            MobilierCtrl.init();
            UI.showView('view-lieux-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    async deleteLieu() {
        const id = document.getElementById('edit-lieu-id').value;
        if (!confirm(`Supprimer définitivement ce lieu ?`)) return;
        try {
            const res = await API.fetch(`/lieux?id=eq.${id}`, { method: 'DELETE', headers: API.getHeaders() });
            if (!res.ok) throw new Error("Impossible : ce lieu est rattaché à des équipements ou des services.");
            UI.showAlert("Succès", "Lieu supprimé.", "success");
            await API.loadReferentiels();
            this.renderLieux();
            UI.showView('view-lieux-list', 'panel-admin');
        } catch (err) { UI.showAlert("Erreur SQL", err.message, "error"); }
    },


    // --- LE REGISTRE DE SÉCURITÉ (Audit Logs) ---
    auditSearchTimeout: null,
    auditPollingTimer: null,
    latestKnownAuditId: null, // Mémorise le dernier événement qu'on a vu
    
    /*
     * LE RADAR D'AUDIT
     * Objectif : Prévenir l'administrateur, sans recharger la page, si de 
     * nouvelles lignes ont été écrites dans le cahier de sécurité (si un agent a fait une action).
     * Comment : Il demande discrètement à l'entrepôt toutes les 15 secondes le dernier ID d'audit.
     */
    async checkNewAuditEvents() {
        const auditView = document.getElementById('view-audit-list');
        
        // Si l'écran d'audit est fermé, ou qu'on n'est pas sur la page 1, on ne lance pas le radar.
        if (!auditView || !auditView.classList.contains('active') || State.admin.audit.page !== 1 || State.admin.audit.filters.query !== '' || document.hidden) {
            return;
        }

        try {
            const res = await API.fetch('/audit_logs?select=id&order=id.desc&limit=1', { headers: API.getHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    const serverLatestId = data[0].id;
                    // S'il y a un décalage entre ce qu'on a affiché et la base, on affiche un ruban d'alerte.
                    if (this.latestKnownAuditId && serverLatestId > this.latestKnownAuditId) {
                        document.getElementById('audit-new-events-banner').style.display = 'block';
                    }
                }
            }
        } catch (e) { } // Échec silencieux
    },

    startAuditPolling() {
        this.stopAuditPolling();
        document.getElementById('audit-new-events-banner').style.display = 'none';
        this.auditPollingTimer = setInterval(() => this.checkNewAuditEvents(), 15000); // 15 secondes
    },

    stopAuditPolling() {
        if (this.auditPollingTimer) clearInterval(this.auditPollingTimer);
    },

    updateAuditFilter(value) {
        State.admin.audit.filters.query = value;
        State.admin.audit.page = 1;
        clearTimeout(this.auditSearchTimeout);
        this.auditSearchTimeout = setTimeout(() => this.loadAudit(), 300);
    },

    changeAuditPage(direction) {
        const totalPages = Math.ceil(State.admin.audit.total / CONFIG.ITEMS_PER_PAGE);
        const newPage = State.admin.audit.page + direction;
        if (newPage >= 1 && newPage <= totalPages) {
            State.admin.audit.page = newPage;
            this.loadAudit();
        }
    },

    // Charge les lignes de sécurité
    async loadAudit() {
        const { page, filters } = State.admin.audit;
        const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE - 1;

        let params = new URLSearchParams();
        params.append('order', 'date_action.desc');

        if (filters.query) {
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => `or(utilisateur.ilike.*${mot}*,action.ilike.*${mot}*,id_metier.ilike.*${mot}*,details.ilike.*${mot}*)`);
            params.append('and', `(${conditionsMots.join(',')})`);
        }

        try {
            const res = await API.fetch(`/audit_logs?${params.toString()}`, { 
                headers: API.getHeaders({ 'Range': `${startIndex}-${endIndex}`, 'Prefer': 'count=exact' }) 
            });
            if (!res.ok) throw new Error("Erreur réseau");
            
            State.admin.audit.data = await res.json();
            const contentRange = res.headers.get('Content-Range');
            if (contentRange) State.admin.audit.total = parseInt(contentRange.split('/')[1]);
            
            // On mémorise le numéro de la toute première ligne de sécurité pour que notre "Radar" fonctionne
            if (State.admin.audit.page === 1 && State.admin.audit.data.length > 0) {
                this.latestKnownAuditId = State.admin.audit.data[0].id;
            }
            
            const banner = document.getElementById('audit-new-events-banner');
            if (banner) banner.style.display = 'none';
            
            this.renderAudit();
            UI.showView('view-audit-list', 'panel-admin');
        } catch (e) { UI.showAlert("Erreur", "Accès refusé au journal.", "error"); }
    },

    // --- LE MODULE BLANCHISSERIE (Recyclage de numéros) ---
    // Objectif : Si un agent s'est trompé en flashant 100 chaises, on peut effacer 
    // leurs données et les remettre "vierges" au lieu de les supprimer définitivement.
    openRecyclage() {
        UI.fillSelect('recyclage-gabarit', State.referentiels.gabarits, 'id', 'nom_descriptif');
        UI.fillSelect('recyclage-ua', State.referentiels.structures, 'code_sages', 'libelle');
        UI.fillSelect('recyclage-lieu', State.referentiels.lieux, 'id', 'nom');
        document.getElementById('recyclage-file-upload').value = '';
        UI.showView('view-admin-recyclage', 'panel-admin');
    },

    async processRecyclage(e) {
        e.preventDefault();
        const fileInput = document.getElementById('recyclage-file-upload');
        if (!fileInput.files[0]) { UI.showAlert("Attention", "Sélectionnez un fichier .txt", "warning"); return; }
        if (!confirm("Confirmer le recyclage de ces identifiants vers le gabarit tampon ?")) return;

        const payload = {
            gabarit_id: parseInt(document.getElementById('recyclage-gabarit').value),
            statut: document.getElementById('recyclage-statut').value,
            remarques: document.getElementById('recyclage-remarques').value
        };
        
        const uaVal = document.getElementById('recyclage-ua').value;
        const lieuVal = document.getElementById('recyclage-lieu').value;
        if (uaVal) payload.code_sages = uaVal;
        if (lieuVal) payload.lieu_id = parseInt(lieuVal);

        const btn = document.getElementById('btn-exec-recyclage');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span class="fr-icon-refresh-line fr-btn--icon-left" aria-hidden="true"></span> Recyclage en cours...';

        const reader = new FileReader();
        reader.onload = async (ev) => {
            const ids = ev.target.result.split(/\r?\n/).map(id => id.trim().toUpperCase()).filter(id => /^MOB-\d{6}$/.test(id));
            if (ids.length === 0) { 
                UI.showAlert("Erreur", "Aucun identifiant valide trouvé dans le fichier.", "error"); 
                btn.disabled = false; btn.innerHTML = originalText;
                return; 
            }

            try {
                UI.showAlert("Traitement", `Recyclage de ${ids.length} identifiants...`, "info");
                const CHUNK_SIZE = 100;
                let successCount = 0;

                // Le script écrase les lignes 100 par 100
                for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + CHUNK_SIZE);
                    const res = await API.fetch(`/mobiliers?id_metier=in.(${chunk.join(',')})`, {
                        method: 'PATCH', headers: API.getHeaders({ 'Prefer': 'return=representation' }), body: JSON.stringify(payload)
                    });
                    if (!res.ok) throw new Error("Erreur lors du traitement d'un lot d'identifiants.");
                    const data = await res.json();
                    successCount += data.length;
                }

                UI.showAlert("Succès total", `${successCount} identifiants réinitialisés et recyclés.`, "success");
                MobilierCtrl.loadData();
                document.getElementById('form-admin-recyclage').reset();
            } catch (err) {
                UI.showAlert("Erreur", err.message, "error");
            } finally {
                btn.disabled = false; btn.innerHTML = originalText;
            }
        };
        reader.readAsText(fileInput.files[0]);
    },

    renderAudit() {
        const tbody = document.getElementById('table-audit-body');
        tbody.innerHTML = '';
        State.admin.audit.data.forEach(log => {
            const tr = document.createElement('tr');
            const badge = log.action === 'CRÉATION' ? 'success' : (log.action === 'SUPPRESSION' ? 'error' : 'info');
            tr.innerHTML = `
                <td class="fr-text--sm">${new Date(log.date_action).toLocaleString('fr-FR')}</td>
                <td class="fr-text--sm fr-text--bold">${UI.escape(log.utilisateur)}</td>
                <td><span class="fr-badge fr-badge--${badge} fr-badge--sm">${UI.escape(log.action)}</span></td>
                <td class="fr-text--sm" style="font-family: monospace;">${UI.escape(log.id_metier)}</td>
                <td class="fr-text--xs">${UI.escape(log.details)}</td>
            `;
            tbody.appendChild(tr);
        });

        const totalPages = Math.ceil(State.admin.audit.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('audit-results-count').innerText = `${State.admin.audit.total} événement(s) enregistré(s)`;
        
        const pageInfo = document.getElementById('audit-page-info');
        if(pageInfo) pageInfo.innerText = `Page ${State.admin.audit.page} sur ${totalPages}`;
        
        const btnPrev = document.getElementById('btn-audit-prev');
        const btnNext = document.getElementById('btn-audit-next');
        if(btnPrev) btnPrev.disabled = (State.admin.audit.page === 1);
        if(btnNext) btnNext.disabled = (State.admin.audit.page >= totalPages);
    },


    async exportAuditCSV() {
        let params = new URLSearchParams();
        params.append('order', 'date_action.desc');

        if (State.admin.audit.filters.query) {
            const safeQuery = State.admin.audit.filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => `or(utilisateur.ilike.*${mot}*,action.ilike.*${mot}*,id_metier.ilike.*${mot}*,details.ilike.*${mot}*)`);
            params.append('and', `(${conditionsMots.join(',')})`);
        }

        try {
            UI.showAlert("Export", "Extraction de l'historique d'audit...", "info");
            
            const res = await API.fetch(`/audit_logs?${params.toString()}`, { headers: API.getHeaders() });
            if (!res.ok) throw new Error("Erreur lors de la récupération des données d'audit.");
            
            const allData = await res.json();
            if (allData.length === 0) { UI.showAlert("Export", "Aucun événement à exporter.", "warning"); return; }

            const headers = ["ID", "Date de l'action", "Agent", "Type d'Action", "Cible (ID Métier)", "Détails"];
            const rows = allData.map(log => [
                log.id, new Date(log.date_action).toLocaleString('fr-FR'), log.utilisateur, log.action, log.id_metier || '',
                (log.details || '').replace(/(\r\n|\n|\r|;)/gm, " ") 
            ]);

            let csvContent = "\ufeff" + headers.join(";") + "\n";
            rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n"; });

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `TRACE_Audit_Historique_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(url);
            
            UI.showAlert("Succès", "Export de l'audit terminé.", "success");
        } catch (err) { UI.showAlert("Erreur Export", err.message, "error"); }
    },

    
    // --- LE MODULE MISE AU REBUT (La Déchiqueteuse) ---
    // Objectif : Quand des meubles vont à la benne, on les supprime définitivement.
    // L'ordinateur fabrique alors un Procès-Verbal certifié en PDF (Pour la comptabilité).
    processRebut() {
        const fileInput = document.getElementById('rebut-file-upload');
        if (!fileInput.files[0]) { UI.showAlert("Attention", "Sélectionnez un fichier .txt", "warning"); return; }
        if (!confirm("ATTENTION : Cette action est irréversible. Générer le PV et supprimer ?")) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            const ids = e.target.result.split(/\r?\n/).map(id => id.trim().toUpperCase()).filter(id => /^MOB-\d{6}$/.test(id));
            if (ids.length === 0) { UI.showAlert("Erreur", "Aucun identifiant valide.", "error"); return; }

            try {
                UI.showAlert("Traitement", `Analyse et suppression de ${ids.length} équipements...`, "info");
                const CHUNK_SIZE = 100;
                let itemsToRebut = [];

                // 1. Récupère TOUTES les informations des meubles pour pouvoir écrire le PV avant de les détruire.
                for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + CHUNK_SIZE);
                    const res = await API.fetch(`/vue_mobiliers_recherche?id_metier=in.(${chunk.join(',')})`, { headers: API.getHeaders() });
                    if (res.ok) itemsToRebut = itemsToRebut.concat(await res.json());
                }

                if (itemsToRebut.length === 0) { UI.showAlert("Erreur", "Aucun équipement trouvé en base.", "error"); return; }
                const validIds = itemsToRebut.map(item => item.id_metier);

                // 2. Le passage au broyeur (Suppression SQL définitive)
                for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
                    const chunk = validIds.slice(i, i + CHUNK_SIZE);
                    await API.fetch(`/mobiliers?id_metier=in.(${chunk.join(',')})`, { method: 'DELETE', headers: API.getHeaders() });
                }

                // 3. Demande à l'imprimante (la fonction en dessous) de fabriquer le fichier PDF officiel.
                this.generateRebutPDF(itemsToRebut);
                UI.showAlert("Succès", `${validIds.length} supprimés. PV généré.`, "success");
                MobilierCtrl.loadData();
            } catch (err) { UI.showAlert("Erreur critique", err.message, "error"); }
        };
        reader.readAsText(fileInput.files[0]);
    },

    // LA MACHINE À PDF
    // Utilise un outil externe (jsPDF) pour dessiner une page A4 avec logo Marianne, entêtes et tableau récapitulatif.
    async generateRebutPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const dateToday = new Date().toLocaleDateString('fr-FR');
        const filenameDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

        // Tentative d'insertion du logo (La Marianne)
        try {
            const img = new Image();
            img.src = 'dsfr-v1.14.3/dist/favicon/apple-touch-icon.png';
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 15, 14, 14);
        } catch (e) { console.warn("Logo absent."); }

        // Écriture des en-têtes officiels récupérés depuis la base (ex: MINISTÈRE DE L'ÉCONOMIE)
        doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("RÉPUBLIQUE\nFRANÇAISE", 38, 20);
        doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.text("Liberté\nÉgalité\nFraternité", 38, 31);
        
        doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(State.appConfig.administration.toUpperCase(), 75, 20, { maxWidth: 120 });
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(State.appConfig.direction, 75, 28, { maxWidth: 120 });
        
        doc.setDrawColor(0, 0, 145); doc.setLineWidth(0.5); doc.line(20, 45, 190, 45);

        doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 0, 145);
        doc.text("ANNEXE PROCÈS-VERBAL CESSION", 105, 56, { align: 'center' });

        doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text(`Référence document : TRACE-REBUT-${filenameDate}`, 20, 70);
        doc.text(`Date d'édition : ${dateToday}`, 20, 76);
        doc.text(`Équipements traités : ${data.length} unité(s)`, 20, 82);

        // Fabrique le grand tableau des meubles détruits
        const tableBody = data.map(item => [item.id_metier, item.gabarit_nom, item.structure_libelle, item.lieu_nom, (item.remarques || '').substring(0, 50)]);
        doc.autoTable({
            startY: 90, head: [['ID Métier', 'Modèle', 'Service Affectation', 'Lieu', 'Observations']], body: tableBody,
            theme: 'grid', headStyles: { fillColor: [0, 0, 145], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, font: 'helvetica' }, alternateRowStyles: { fillColor: [246, 246, 246] }
        });

        // La case pour la signature au bas de la page
        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Cachet du service et signature :", 100, finalY);
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); doc.rect(100, finalY + 5, 90, 35);

        // Téléchargement du fichier
        doc.save(`PVSORTIETRACE_${filenameDate}.pdf`);
    },
    
    // --- L'ATELIER DE DÉCORATION (Configuration de l'État Civil de l'application) ---
    openEditConfig() {
        document.getElementById('edit-config-admin').value = State.appConfig.administration;
        document.getElementById('edit-config-direction').value = State.appConfig.direction;
        UI.showView('view-admin-config', 'panel-admin');
    },

    async handleSaveConfig(e) {
        e.preventDefault();
        const newAdmin = document.getElementById('edit-config-admin').value.trim();
        const newDir = document.getElementById('edit-config-direction').value.trim();

        try {
            await Promise.all([
                API.fetch(`/parametres?cle=eq.nom_administration`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify({ valeur: newAdmin }) }),
                API.fetch(`/parametres?cle=eq.nom_direction`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify({ valeur: newDir }) })
            ]);
            
            State.appConfig.administration = newAdmin;
            State.appConfig.direction = newDir;
            UI.showAlert("Succès", "En-têtes des PV mis à jour.", "success");
        } catch (err) { UI.showAlert("Erreur", "Impossible de sauvegarder la configuration.", "error"); }
    },
};

// ============================================================================
// 5. BOOTSTRAP DE L'APPLICATION : Le Tableau Électrique (Mise sous tension)
// ============================================================================
/*
 * L'Objectif (Le Pourquoi) : 
 * Quand la page web a fini de charger, il faut réveiller tout le monde, brancher 
 * les boutons physiques aux bonnes actions logicielles, et vérifier les rôles.
 */
const App = {
    eventsBound: false,

    async start() {
        // (Comment) 1. On branche tous les fils électriques (les boutons cliquables de l'interface)
        if (!this.eventsBound) {
            this.bindEvents();
            this.eventsBound = true;
        }
        
        // (Comment) 2. On lit le panneau officiel de configuration de l'État
        await API.loadConfig();

        // (Comment) 3. Contrôle d'accès au guichet principal
        const estConnecte = await State.fetchUser();

        // L'agent n'a pas de badge valide -> On cache l'appli et on affiche la connexion
        if (!estConnecte) {
            document.getElementById('view-login').classList.add('active');
            document.getElementById('view-app').classList.remove('active');
            return; 
        }

        // L'agent a un badge valide -> On affiche l'application et on active la déconnexion
        document.getElementById('view-login').classList.remove('active');
        document.getElementById('view-app').classList.add('active');
        document.getElementById('logout-btn-container').style.display = 'block';
        
        /*
         * LE CLOISONNEMENT VISUEL (Sécurité UX)
         * Bien que l'entrepôt interdise formellement les opérations illégales, 
         * on modifie l'affichage pour ne pas induire l'agent en erreur.
         */
        if (State.user.role === 'administrateur') {
            document.getElementById('tab-admin').style.display = 'block'; // Ouvre le panneau DRH
            document.getElementById('btn-delete-mob').style.display = 'inline-flex';
        } else if (State.user.role === 'lecteur') {
            // Un lecteur (consultant) ne verra aucun bouton pour créer, scanner ou importer
            const actionsToHide = ['btn-nav-create-mob', 'btn-nav-scan', 'btn-nav-import', 'btn-nav-create-gab'];
            actionsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        // (Comment) 4. Lancement officiel de tous les chefs de service.
        try {
            await API.loadReferentiels(); // Télécharge les catalogues
            await MobilierCtrl.init();    // Active l'inventaire
            GabaritCtrl.init();           // Active le catalogue
            if (State.user.role === 'administrateur') await AdminCtrl.init(); // Active l'administration si autorisé
        } catch (e) { UI.showAlert("Critique", "Erreur réseau d'initialisation.", "error"); }
    },

    /*
     * LE POSTE D'AIGUILLAGE
     * Cette grande fonction écoute tout ce qui se passe sur la page web.
     * C'est ici que l'ordinateur se dit : "Si je clique sur ce bouton précis, lance cette machine précise."
     */
    bindEvents() {
        // --- AUTHENTIFICATION ---
        const loginForm = document.getElementById('form-login');
        if (loginForm) {
            loginForm.replaceWith(loginForm.cloneNode(true));
            document.getElementById('form-login').addEventListener('submit', (e) => AuthCtrl.login(e));
        }
        document.getElementById('btn-logout')?.addEventListener('click', () => AuthCtrl.logout());

        // --- INVENTAIRE MOBILIER ---
        // (Comment) Les "oreilles" sur les barres de recherche et listes déroulantes
        document.getElementById('btn-reset-filters')?.addEventListener('click', () => MobilierCtrl.resetFilters());
        document.getElementById('search-input')?.addEventListener('input', (e) => MobilierCtrl.updateFilter('query', e.target.value));
        document.getElementById('filter-gabarit')?.addEventListener('change', (e) => MobilierCtrl.updateFilter('gabarit', e.target.value));
        document.getElementById('filter-ua')?.addEventListener('change', (e) => MobilierCtrl.updateFilter('ua', e.target.value));
        document.getElementById('filter-lieu')?.addEventListener('change', (e) => MobilierCtrl.updateFilter('lieu', e.target.value));
        document.getElementById('filter-statut')?.addEventListener('change', (e) => MobilierCtrl.updateFilter('statut', e.target.value));
        
        document.querySelectorAll('#table-mobilier-body').forEach(el => el.closest('table').querySelectorAll('th.sortable-header').forEach(th => th.addEventListener('click', () => MobilierCtrl.toggleSort(th.dataset.sort))));
        document.getElementById('btn-prev')?.addEventListener('click', () => MobilierCtrl.changePage(-1));
        document.getElementById('btn-next')?.addEventListener('click', () => MobilierCtrl.changePage(1));
        document.getElementById('btn-export-csv')?.addEventListener('click', () => MobilierCtrl.exportCSV());
        
        document.querySelectorAll('.btn-back-to-list').forEach(btn => btn.addEventListener('click', () => UI.showView('view-mobilier-list', 'panel-mobilier')));
        document.getElementById('btn-nav-create-mob')?.addEventListener('click', () => MobilierCtrl.openCreateForm());
        document.getElementById('btn-nav-scan')?.addEventListener('click', () => MobilierCtrl.openScan());
        document.getElementById('btn-nav-import')?.addEventListener('click', () => MobilierCtrl.openImport());

        document.getElementById('form-mob-create')?.addEventListener('submit', (e) => MobilierCtrl.handleCreate(e));
        document.getElementById('form-mob-edit')?.addEventListener('submit', (e) => MobilierCtrl.handleEdit(e));
        document.getElementById('btn-delete-mob')?.addEventListener('click', () => MobilierCtrl.handleDelete());
        
        document.getElementById('new-mob-ua')?.addEventListener('change', () => MobilierCtrl.handleCreateUaChange());
        document.getElementById('edit-mob-ua')?.addEventListener('change', () => MobilierCtrl.handleEditUaChange());
        document.getElementById('scan-target-ua')?.addEventListener('change', () => MobilierCtrl.handleScanUaChange());
        document.getElementById('import-target-ua')?.addEventListener('change', () => MobilierCtrl.handleImportUaChange());
        
        // (Comment) Capte la touche Entrée tapée par une douchette physique code-barre
        document.getElementById('scanner-input')?.addEventListener('keypress', (e) => MobilierCtrl.processScan(e));
        document.getElementById('btn-exec-import')?.addEventListener('click', () => MobilierCtrl.processImport());

        document.getElementById('nav-admin-recyclage')?.addEventListener('click', () => AdminCtrl.openRecyclage());
        document.getElementById('form-admin-recyclage')?.addEventListener('submit', (e) => AdminCtrl.processRecyclage(e));
        
        document.getElementById('recyclage-ua')?.addEventListener('change', () => MobilierCtrl.handleUaChange('recyclage'));
        document.getElementById('recyclage-lieu')?.addEventListener('change', () => MobilierCtrl.handleLieuChange('recyclage'));


        // --- CATALOGUE NATIONAL (Gabarits) ---
        document.getElementById('search-gab-input')?.addEventListener('input', (e) => GabaritCtrl.updateFilter('query', e.target.value));
        document.getElementById('filter-gab-cat')?.addEventListener('change', (e) => GabaritCtrl.updateFilter('categorie', e.target.value));
        document.getElementById('btn-reset-gab-filters')?.addEventListener('click', () => GabaritCtrl.resetFilters());
        document.getElementById('btn-gab-prev')?.addEventListener('click', () => GabaritCtrl.changePage(-1));
        document.getElementById('btn-gab-next')?.addEventListener('click', () => GabaritCtrl.changePage(1));
        document.querySelectorAll('#table-gabarits-body').forEach(el => { el.closest('table').querySelectorAll('th.sortable-header').forEach(th => { th.addEventListener('click', () => GabaritCtrl.toggleSort(th.dataset.sort)); }); });
        
        document.querySelectorAll('.btn-back-to-gab-list').forEach(btn => btn.addEventListener('click', () => UI.showView('view-gabarits-list', 'panel-gabarits')));
        document.getElementById('btn-nav-create-gab')?.addEventListener('click', () => GabaritCtrl.openCreateForm());
        document.getElementById('edit-gab-cat')?.addEventListener('change', () => GabaritCtrl.suggestNextReference());
        document.getElementById('btn-add-json-row')?.addEventListener('click', () => GabaritCtrl.addJsonRow());
        document.getElementById('form-gab-edit')?.addEventListener('submit', (e) => GabaritCtrl.handleSave(e));
        document.getElementById('btn-delete-gab')?.addEventListener('click', () => GabaritCtrl.handleDelete());

        // Branchement du mécanisme de la Photo du modèle
        document.getElementById('edit-gab-photo')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const base64 = await UI.generateThumbnailBase64(file); // Compresse la photo
                document.getElementById('edit-gab-photo-base64').value = base64; // Sauvegarde la version texte invisible
                document.getElementById('edit-gab-photo-preview').src = base64; // Affiche la petite image
                document.getElementById('edit-gab-photo-preview-container').style.display = "flex";
            } catch (err) {
                UI.showAlert("Erreur", err.message, "error");
                e.target.value = ""; 
            }
        });

        document.getElementById('btn-remove-photo')?.addEventListener('click', () => {
            document.getElementById('edit-gab-photo').value = "";
            document.getElementById('edit-gab-photo-base64').value = "";
            document.getElementById('edit-gab-photo-preview-container').style.display = "none";
        });


        // --- ADMINISTRATION ---
        document.getElementById('nav-admin-users')?.addEventListener('click', () => UI.showView('view-users-list', 'panel-admin'));
        document.getElementById('nav-admin-ua')?.addEventListener('click', () => UI.showView('view-ua-list', 'panel-admin'));
        document.getElementById('nav-admin-lieux')?.addEventListener('click', () => UI.showView('view-lieux-list', 'panel-admin'));
        document.getElementById('nav-admin-rebut')?.addEventListener('click', () => UI.showView('view-admin-rebut', 'panel-admin'));
        
        document.getElementById('nav-admin-audit')?.addEventListener('click', () => {
            State.admin.audit.page = 1; 
            AdminCtrl.loadAudit();
            AdminCtrl.startAuditPolling(); // Lance le radar silencieux (Surveillance Audit)
        });
        
        document.getElementById('btn-refresh-audit')?.addEventListener('click', () => { State.admin.audit.page = 1; AdminCtrl.loadAudit(); });
        document.getElementById('btn-export-audit-csv')?.addEventListener('click', () => AdminCtrl.exportAuditCSV());

        // Arrête ou relance le radar de sécurité si on change d'onglet sur le navigateur
        document.addEventListener('visibilitychange', () => { if (!document.hidden) { AdminCtrl.checkNewAuditEvents(); } });
        
        document.getElementById('search-audit-input')?.addEventListener('input', (e) => AdminCtrl.updateAuditFilter(e.target.value));
        document.getElementById('btn-audit-prev')?.addEventListener('click', () => AdminCtrl.changeAuditPage(-1));
        document.getElementById('btn-audit-next')?.addEventListener('click', () => AdminCtrl.changeAuditPage(1));
        document.getElementById('btn-exec-rebut')?.addEventListener('click', () => AdminCtrl.processRebut());
        
        // Formulaires Administrateur
        document.getElementById('btn-nav-create-user')?.addEventListener('click', () => AdminCtrl.openCreateUser());
        document.querySelectorAll('.btn-back-to-users').forEach(btn => btn.addEventListener('click', () => UI.showView('view-users-list', 'panel-admin')));
        document.getElementById('form-user-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateUser(e));

        document.getElementById('btn-nav-create-ua')?.addEventListener('click', () => AdminCtrl.openCreateUa());
        document.querySelectorAll('.btn-back-to-ua').forEach(btn => btn.addEventListener('click', () => UI.showView('view-ua-list', 'panel-admin')));
        document.getElementById('form-ua-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateUa(e));

        document.getElementById('btn-nav-create-lieu')?.addEventListener('click', () => AdminCtrl.openCreateLieu());
        document.querySelectorAll('.btn-back-to-lieux').forEach(btn => btn.addEventListener('click', () => UI.showView('view-lieux-list', 'panel-admin')));
        document.getElementById('form-lieu-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateLieu(e));
        
        document.getElementById('form-ua-edit')?.addEventListener('submit', (e) => AdminCtrl.handleEditUa(e));
        document.getElementById('btn-delete-ua')?.addEventListener('click', () => AdminCtrl.deleteUa());
        
        document.getElementById('search-ua-input')?.addEventListener('input', (e) => AdminCtrl.updateUaFilter('query', e.target.value));
        document.getElementById('filter-ua-lieu')?.addEventListener('change', (e) => AdminCtrl.updateUaFilter('lieu', e.target.value));
        document.getElementById('btn-reset-ua-filters')?.addEventListener('click', () => AdminCtrl.resetUaFilters());
        
        document.querySelectorAll('#table-ua-body').forEach(el => { el.closest('table').querySelectorAll('th.sortable-header').forEach(th => { th.addEventListener('click', () => AdminCtrl.toggleUaSort(th.dataset.sort)); }); });

        document.getElementById('form-lieu-edit')?.addEventListener('submit', (e) => AdminCtrl.handleEditLieu(e));
        document.getElementById('btn-delete-lieu')?.addEventListener('click', () => AdminCtrl.deleteLieu());
        document.getElementById('search-lieux-input')?.addEventListener('input', (e) => AdminCtrl.updateLieuxFilter(e.target.value));
        document.getElementById('btn-reset-lieux-filters')?.addEventListener('click', () => AdminCtrl.resetLieuxFilters());
        
        document.querySelectorAll('#table-lieux-body').forEach(el => { el.closest('table').querySelectorAll('th.sortable-header').forEach(th => { th.addEventListener('click', () => AdminCtrl.toggleLieuxSort(th.dataset.sort)); }); });
        
        document.getElementById('new-mob-lieu')?.addEventListener('change', () => MobilierCtrl.handleCreateLieuChange());
        document.getElementById('edit-mob-lieu')?.addEventListener('change', () => MobilierCtrl.handleEditLieuChange());
        document.getElementById('scan-target-lieu')?.addEventListener('change', () => MobilierCtrl.handleScanLieuChange());
        document.getElementById('import-target-lieu')?.addEventListener('change', () => MobilierCtrl.handleImportLieuChange());
        
        document.getElementById('nav-admin-config')?.addEventListener('click', () => AdminCtrl.openEditConfig());
        document.getElementById('form-admin-config')?.addEventListener('submit', (e) => AdminCtrl.handleSaveConfig(e));
        
        document.getElementById('btn-export-gab-csv')?.addEventListener('click', () => GabaritCtrl.exportCSV());
        document.getElementById('btn-export-ua-csv')?.addEventListener('click', () => AdminCtrl.exportUaCSV());
        document.getElementById('btn-export-lieux-csv')?.addEventListener('click', () => AdminCtrl.exportLieuxCSV());     
    }
};

// "Dès que le navigateur internet a fini de lire cette page, demande à la machine de se mettre en marche."
document.addEventListener('DOMContentLoaded', () => App.start());