/**
 * TRACE - Application Front-End (Vanilla JS)
 * Architecture Modulaire MVC-Lite
 * Version: 2.1 (Intégration totale + Corrections filtres)
 */

// ============================================================================
// 1. CONFIGURATION & ÉTAT GLOBAL (STATE)
// ============================================================================
const CONFIG = {
    API_URL: '/api',
    ITEMS_PER_PAGE: 50
};

const State = {
    jwt: sessionStorage.getItem('trace_jwt') || null,
    user: null,
    appConfig: {
        administration: "DIRECTION GÉNÉRALE DES FINANCES PUBLIQUES",
        direction: "DIRECTION RÉGIONALE DES FINANCES PUBLIQUES DE PARIS"
    },
    
    // Référentiels mis en cache
    referentiels: { gabarits: [], structures: [], lieux: [] },
    maps: { g: new Map(), s: new Map(), l: new Map() },
    
    // États paginés et filtrés par module
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

    initUser() {
        if (!this.jwt) return false;
        try {
            const base64Url = this.jwt.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
            
            if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("Expiré");
            this.user = payload;
            return true;
        } catch (e) {
            this.jwt = null;
            sessionStorage.removeItem('trace_jwt');
            return false;
        }
    }
};

// ============================================================================
// 2. COUCHE ACCÈS AUX DONNÉES (API)
// ============================================================================
const API = {
    getHeaders(customHeaders = {}) {
        if (!State.initUser()) {
            AuthCtrl.logout("Votre session a expiré.");
            throw new Error("Session invalide");
        }
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${State.jwt}`,
            'Prefer': 'return=representation',
            ...customHeaders
        };
    },

    async fetch(endpoint, options = {}) {
        const res = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
        if (res.status === 401) {
            AuthCtrl.logout("Accès non autorisé ou session expirée.");
            throw new Error("Non autorisé");
        }
        return res;
    },

    async loadConfig() {
        try {
            const res = await fetch('./config.ini?nocache=' + new Date().getTime());
            if (res.ok) {
                const text = await res.text();
                text.split(/\r?\n/).forEach(line => {
                    if (line.includes('=') && !line.startsWith(';') && !line.startsWith('[')) {
                        const parts = line.split('=');
                        const key = parts[0].trim();
                        const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
                        if (key === 'nom_administration') State.appConfig.administration = value;
                        if (key === 'nom_direction') State.appConfig.direction = value;
                    }
                });
            }
        } catch (e) { console.warn("config.ini ignoré, valeurs par défaut appliquées."); }
    },

    async loadReferentiels() {
        const [gRes, sRes, lRes] = await Promise.all([
            this.fetch('/gabarits?select=id,reference_catalogue,categorie,nom_descriptif,caracteristiques', { headers: this.getHeaders() }),
            this.fetch('/structures', { headers: this.getHeaders() }),
            this.fetch('/lieux', { headers: this.getHeaders() })
        ]);

        State.referentiels.gabarits = await gRes.json();
        State.referentiels.structures = await sRes.json();
        State.referentiels.lieux = await lRes.json();

        State.maps.g.clear(); State.referentiels.gabarits.forEach(g => State.maps.g.set(g.id, g));
        State.maps.s.clear(); State.referentiels.structures.forEach(s => State.maps.s.set(s.code_sages, s));
        State.maps.l.clear(); State.referentiels.lieux.forEach(l => State.maps.l.set(l.id, l));
        const dl = document.getElementById('datalist-gabarits');
        if (dl) dl.innerHTML = State.referentiels.gabarits.map(g => `<option value="${g.reference_catalogue} - ${g.nom_descriptif}" data-id="${g.id}">`).join('');
    }
};

// ============================================================================
// 3. COUCHE UTILITAIRE UI (RENDU & SÉCURITÉ)
// ============================================================================
const UI = {
    escape(str) {
        if (str === null || str === undefined) return "";
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    showAlert(titre, message, type) {
        const c = document.getElementById('alert-container');
        c.innerHTML = `<div class="fr-alert fr-alert--${type} fr-mb-2w"><h3 class="fr-alert__title">${this.escape(titre)}</h3><p>${this.escape(message)}</p></div>`;
        setTimeout(() => c.innerHTML = '', 5000);
    },

    showView(viewId, parentId) {
        document.querySelectorAll(`#${parentId} .sub-view`).forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

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

    formatJsonToText(obj) {
        if (!obj || Object.keys(obj).length === 0) return '';
        return Object.entries(obj).map(([k, v]) => `<span style="color:var(--text-action-high-blue-france)">"${this.escape(k)}"</span>: "${this.escape(v)}"`).join(',<br>');
    },

    updateSortUI(prefix, sortBy, isAsc) {
        document.querySelectorAll(`[id^="icon-sort-${prefix}"]`).forEach(icon => {
            icon.style.opacity = '0';
            icon.className = 'sort-icon fr-icon-arrow-down-s-line';
        });
        const activeIcon = document.getElementById(`icon-sort-${prefix === 'mob' ? sortBy : prefix + '-' + sortBy}`);
        if (activeIcon) {
            activeIcon.style.opacity = '1';
            activeIcon.className = isAsc ? "sort-icon fr-icon-arrow-up-s-line" : "sort-icon fr-icon-arrow-down-s-line";
        }
    }
};

// ============================================================================
// 4. CONTRÔLEURS DE DOMAINE
// ============================================================================

// --- AUTHENTIFICATION ---
const AuthCtrl = {
    async login(e) {
        e.preventDefault();
        try {
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            
            const res = await fetch(`${CONFIG.API_URL}/rpc/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            if (!res.ok) throw new Error("Identifiants incorrects ou serveur injoignable");
            const data = await res.json();
            
            State.jwt = data.token;
            sessionStorage.setItem('trace_jwt', data.token);
            App.start(); 
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    logout(msg) {
        State.jwt = null;
        State.user = null;
        sessionStorage.removeItem('trace_jwt');
        if (msg) alert(msg);
        location.reload();
    }
};

// --- GESTION DU MOBILIER ---
const MobilierCtrl = {
    searchTimeout: null,
    
    getGabaritId(inputId) {
        const val = document.getElementById(inputId).value;
        const safeVal = val.replace(/"/g, '\\"'); // Sécurité contre les guillemets dans les noms
        const opt = document.querySelector(`#datalist-gabarits option[value="${safeVal}"]`);
        return opt ? parseInt(opt.dataset.id) : null;
    },

    async init() {
        UI.fillSelect('filter-gabarit', State.referentiels.gabarits, 'id', 'nom_descriptif', { disablePlaceholder: false, placeholder: 'Tous les modèles' });
        UI.fillSelect('filter-ua', State.referentiels.structures, 'code_sages', 'libelle', { disablePlaceholder: false, placeholder: 'Toutes les affectations' });
        UI.fillSelect('filter-lieu', State.referentiels.lieux, 'id', 'nom', { disablePlaceholder: false, placeholder: 'Tous les lieux' });
        await this.updateFacets();
        await this.loadData();
    },

    toggleSort(columnName) {
        if (State.mobilier.sortBy === columnName) {
            State.mobilier.sortAsc = !State.mobilier.sortAsc;
        } else {
            State.mobilier.sortBy = columnName;
            State.mobilier.sortAsc = true;
        }
        this.loadData();
    },

    changePage(direction) {
        const totalPages = Math.ceil(State.mobilier.total / CONFIG.ITEMS_PER_PAGE);
        const newPage = State.mobilier.page + direction;
        if (newPage >= 1 && newPage <= totalPages) {
            State.mobilier.page = newPage;
            this.loadData();
        }
    },

    async updateFacets() {
        const { lieu, ua, gabarit } = State.mobilier.filters;
        
        // Préparation du payload (remplace les chaînes vides par null pour SQL)
        const payload = {
            p_lieu_id: lieu ? parseInt(lieu) : null,
            p_code_sages: ua ? ua : null,
            p_gabarit_id: gabarit ? parseInt(gabarit) : null
        };

        try {
            const res = await API.fetch('/rpc/get_filtres_disponibles', {
                method: 'POST',
                headers: API.getHeaders(),
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) throw new Error("Erreur lors de la récupération des facettes");
            const facettes = await res.json();

            // On repeuple les listes déroulantes avec les données filtrées par le serveur,
            // tout en conservant la sélection actuelle si elle existe.
            UI.fillSelect('filter-gabarit', facettes.gabarits, 'id', 'nom_descriptif', { placeholder: 'Tous les modèles', selected: gabarit, disablePlaceholder: false });
            UI.fillSelect('filter-ua', facettes.structures, 'code_sages', 'libelle', { placeholder: 'Toutes les affectations', selected: ua, disablePlaceholder: false });
            UI.fillSelect('filter-lieu', facettes.lieux, 'id', 'nom', { placeholder: 'Tous les lieux', selected: lieu, disablePlaceholder: false });

        } catch (e) {
            console.error("Facettes inaccessibles :", e);
        }
    },

    // MODIFICATION : On met à jour les facettes à chaque changement de filtre
    updateFilter(key, value) {
        State.mobilier.filters[key] = value.trim();
        State.mobilier.page = 1;
        
        // Si c'est un filtre structurel (lieu, ua, gabarit), on recalcule les facettes
        if (['lieu', 'ua', 'gabarit'].includes(key)) {
            this.updateFacets();
        }

        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => this.loadData(), 300);
    },


    resetFilters() {
        
        clearTimeout(this.searchTimeout);

        
        const champs = ['search-input', 'filter-gabarit', 'filter-ua', 'filter-lieu', 'filter-statut'];
        champs.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = ''; // Ne vide que si l'élément existe bien
        });

        
        State.mobilier.filters = { query: '', gabarit: '', ua: '', lieu: '', statut: '' };
        State.mobilier.page = 1;
        
        this.updateFacets();
        this.loadData();
    },

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
            // 1. On nettoie la saisie pour éviter les plantages PostgREST
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');

            // 2. On découpe la recherche en mots séparés
            const motsCles = safeQuery.trim().split(/\s+/);

            // 3. On crée une condition "OR" (fouiller toutes les colonnes) pour CHAQUE mot
            const conditionsMots = motsCles.map(mot => 
                `or(id_metier.ilike.*${mot}*,remarques.ilike.*${mot}*,gabarit_nom.ilike.*${mot}*,structure_libelle.ilike.*${mot}*,lieu_nom.ilike.*${mot}*,gabarit_json_txt.ilike.*${mot}*)`
            );

            // 4. On exige que TOUS les mots tapés soient trouvés (condition "AND")
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
            if (contentRange) State.mobilier.total = parseInt(contentRange.split('/')[1]);
            
            this.renderTable();
        } catch (e) { UI.showAlert("Erreur", "La recherche a échoué.", "error"); }
    },

    renderTable() {
        const tbody = document.getElementById('table-mobilier-body');
        tbody.innerHTML = ''; 

        State.mobilier.data.forEach(mob => {
            const gab = State.maps.g.get(mob.gabarit_id) || { nom_descriptif: 'Inconnu' };
            const lieu = State.maps.l.get(mob.lieu_id) || { nom: 'Inconnu' };
            const ua = State.maps.s.get(mob.code_sages) || { libelle: 'Inconnu' };

            const jsonText = UI.formatJsonToText(gab.caracteristiques);
            const jsonHtml = jsonText ? `<br><span class="fr-text--xs" style="color: var(--text-mention-grey); font-family: monospace;">{<br>${jsonText}<br>}</span>` : '';

            const badges = { 'en_service': 'new', 'dispo_reemploi': 'success', 'en_maintenance': 'warning', 'au_rebut': 'error' };
            const badgeClass = badges[mob.statut] || 'info';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="uuid-badge" style="cursor:copy" title="Copier" data-uuid="${UI.escape(mob.id_metier)}">${UI.escape(mob.id_metier)}</span></td>
                <td><span class="fr-text--bold">${UI.escape(gab.nom_descriptif)}</span>${jsonHtml}</td>
                <td class="fr-text--sm">${UI.escape(ua.libelle)}<br><span class="fr-text--light">${UI.escape(lieu.nom)}</span></td>
                <td><p class="fr-badge fr-badge--${badgeClass} fr-badge--sm fr-mb-0">${UI.escape(mob.statut)}</p></td>
                <td><button class="fr-btn fr-btn--secondary fr-btn--sm btn-edit">Fiche</button></td>
            `;
            
            tr.querySelector('.uuid-badge').addEventListener('click', (e) => navigator.clipboard.writeText(e.target.dataset.uuid));
            tr.querySelector('.btn-edit').addEventListener('click', () => this.openEditForm(mob.uuid));
            tbody.appendChild(tr);
        });

        UI.updateSortUI('mob', State.mobilier.sortBy, State.mobilier.sortAsc);
        const totalPages = Math.ceil(State.mobilier.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('results-count').innerText = `${State.mobilier.total} équipement(s)`;
        document.getElementById('page-info').innerText = `Page ${State.mobilier.page} sur ${totalPages}`;
        document.getElementById('btn-prev').disabled = (State.mobilier.page === 1);
        document.getElementById('btn-next').disabled = (State.mobilier.page >= totalPages);
    },

    openCreateForm() {
        document.getElementById('form-mob-create').reset();
        document.getElementById('new-mob-id').value = "Auto-généré";
        UI.fillSelect('new-mob-ua', State.referentiels.structures, 'code_sages', 'libelle');
        UI.fillSelect('new-mob-lieu', State.referentiels.lieux, 'id', 'nom');
        UI.showView('view-mobilier-create', 'panel-mobilier');
    },

    openEditForm(uuid) {
        const mob = State.mobilier.data.find(m => m.uuid === uuid);
        if (!mob) return;
        document.getElementById('edit-mob-uuid').value = mob.uuid;
        document.getElementById('edit-mob-id').value = mob.id_metier;
        const gab = State.maps.g.get(mob.gabarit_id);
        document.getElementById('edit-mob-gabarit-input').value = gab ? `${gab.reference_catalogue} - ${gab.nom_descriptif}` : "";
        UI.fillSelect('edit-mob-ua', State.referentiels.structures, 'code_sages', 'libelle', { selected: mob.code_sages });
        UI.fillSelect('edit-mob-lieu', State.referentiels.lieux, 'id', 'nom', { selected: mob.lieu_id });
        document.getElementById('edit-mob-statut').value = mob.statut;
        document.getElementById('edit-mob-remarques').value = mob.remarques || '';
        UI.showView('view-mobilier-detail', 'panel-mobilier');
        this.handleEditUaChange();
    },

    async handleCreate(e) {
        e.preventDefault();
        const gabarit_id = this.getGabaritId('new-mob-gabarit-input');
        if (!gabarit_id) { UI.showAlert("Erreur", "Veuillez sélectionner un modèle valide dans la liste.", "error"); return; }
        const payload = {
            gabarit_id: gabarit_id,
            code_sages: document.getElementById('new-mob-ua').value,
            lieu_id: parseInt(document.getElementById('new-mob-lieu').value),
            statut: document.getElementById('new-mob-statut').value,
            remarques: document.getElementById('new-mob-remarques').value
        };
        const quantite = parseInt(document.getElementById('new-mob-quantite').value) || 1;

        if (quantite > 100 && !confirm(`Créer ${quantite} équipements identiques ?`)) return;

        try {
            const payloads = Array(quantite).fill(payload);
            const res = await API.fetch(`/mobiliers`, { method: 'POST', headers: API.getHeaders(), body: JSON.stringify(payloads) });
            if (!res.ok) throw new Error("Erreur création.");
            
            UI.showAlert("Succès", `${quantite} équipement(s) créé(s).`, "success");
            await this.loadData();
            UI.showView('view-mobilier-list', 'panel-mobilier');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

    async handleEdit(e) {
        e.preventDefault();
        const uuid = document.getElementById('edit-mob-uuid').value;
        const idMetier = document.getElementById('edit-mob-id').value;
        if (!/^MOB-\d{6}$/.test(idMetier)) { UI.showAlert("Erreur", "ID métier mal formé.", "error"); return; }
        
        const gabarit_id = this.getGabaritId('edit-mob-gabarit-input');
        if (!gabarit_id) { UI.showAlert("Erreur", "Veuillez sélectionner un modèle valide dans la liste.", "error"); return; }

        const payload = {
            gabarit_id: gabarit_id,
            code_sages: document.getElementById('edit-mob-ua').value,
            lieu_id: parseInt(document.getElementById('edit-mob-lieu').value),
            statut: document.getElementById('edit-mob-statut').value,
            remarques: document.getElementById('edit-mob-remarques').value
        };

        try {
            const res = await API.fetch(`/mobiliers?uuid=eq.${uuid}`, { method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Erreur mise à jour.");
            UI.showAlert("Succès", "Équipement mis à jour.", "success");
            await this.loadData();
            UI.showView('view-mobilier-list', 'panel-mobilier');
        } catch (err) { UI.showAlert("Erreur", err.message, "error"); }
    },

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

    async exportCSV() {
        let params = new URLSearchParams();
        if (State.mobilier.filters.gabarit) params.append('gabarit_id', `eq.${State.mobilier.filters.gabarit}`);
        if (State.mobilier.filters.ua) params.append('code_sages', `eq.${State.mobilier.filters.ua}`);
        if (State.mobilier.filters.lieu) params.append('lieu_id', `eq.${State.mobilier.filters.lieu}`);
        if (State.mobilier.filters.statut) params.append('statut', `eq.${State.mobilier.filters.statut}`);
        if (State.mobilier.filters.query) {
            params.append('or', `(id_metier.ilike.*${State.mobilier.filters.query}*,remarques.ilike.*${State.mobilier.filters.query}*)`);
        }
        params.append('order', `${State.mobilier.sortBy}.${State.mobilier.sortAsc ? 'asc' : 'desc'}`);

        try {
            UI.showAlert("Export", "Récupération des données...", "info");
            const res = await API.fetch(`/mobiliers?${params.toString()}`, { headers: API.getHeaders() });
            if (!res.ok) throw new Error("Erreur récupération données.");
            const allData = await res.json();
            if (allData.length === 0) { UI.showAlert("Export", "Aucune donnée.", "warning"); return; }

            const headers = ["ID Métier", "Modèle", "Catégorie", "Affectation", "Lieu", "Statut", "Remarques"];
            const rows = allData.map(mob => {
                const gab = State.maps.g.get(mob.gabarit_id) || {};
                const ua = State.maps.s.get(mob.code_sages) || {};
                const lieu = State.maps.l.get(mob.lieu_id) || {};
                return [
                    mob.id_metier, gab.nom_descriptif || 'Inconnu', gab.categorie || 'Autre',
                    ua.libelle || mob.code_sages, lieu.nom || 'Inconnu', mob.statut,
                    (mob.remarques || '').replace(/(\r\n|\n|\r|;)/gm, " ")
                ];
            });

            let csvContent = "\ufeff" + headers.join(";") + "\n";
            rows.forEach(row => { csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n"; });

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

    // --- DOUCHETTE ---
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
        if (event.key !== 'Enter') return;
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

        input.value = ''; input.focus();

        try {
            const searchRes = await API.fetch(`/mobiliers?id_metier=eq.${idMetier}`, { headers: API.getHeaders() });
            const results = await searchRes.json();

            if (results.length === 0) {
                logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${UI.escape(idMetier)}</span> Introuvable</li>`);
                return;
            }

            const updateRes = await API.fetch(`/mobiliers?uuid=eq.${results[0].uuid}`, {
                method: 'PATCH', headers: API.getHeaders(), body: JSON.stringify(payload)
            });

            if (!updateRes.ok) throw new Error("Erreur serveur");
            const uaLabel = State.maps.s.get(payload.code_sages)?.libelle || payload.code_sages;
            logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--success">${UI.escape(idMetier)}</span> Affecté vers ${UI.escape(uaLabel)}</li>`);
            this.loadData(); // Refresh background list
        } catch (err) {
            logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${UI.escape(idMetier)}</span> Échec réseau</li>`);
        }
    },

    // --- IMPORT MASSIF ---
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
            const ids = [...new Set(e.target.result.split(/\r?\n/).map(id => id.trim().toUpperCase()).filter(id => /^MOB-\d{6}$/.test(id)))];
            if (ids.length === 0) { UI.showAlert("Erreur", "Aucun ID valide.", "error"); return; }

            try {
                UI.showAlert("Import", `Traitement de ${ids.length} équipements...`, "info");
                const CHUNK_SIZE = 100;
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
    // MOTEUR DE TRI INTELLIGENT (Facettes Optgroup)
    // ========================================================================
    
    // 1. Logique Service (UA) -> Lieu
    handleUaChange(prefix) {
        const uaCode = document.getElementById(`${prefix}-ua`).value;
        const ua = State.maps.s.get(uaCode);
        const lieuSelectId = `${prefix}-lieu`;
        
        UI.fillSelect(lieuSelectId, State.referentiels.lieux, 'id', 'nom', {
            // Pré-sélectionne le lieu par défaut du service
            selected: ua ? ua.lieu_id : null,
            // Prédicat : Le lieu évalué est-il le lieu par défaut de ce service ?
            isPrimary: (lieu) => ua && lieu.id === ua.lieu_id,
            primaryGroupLabel: "📍 Lieu par défaut du service",
            secondaryGroupLabel: "🏢 Autres sites possibles"
        });
    },

    // 2. Logique Lieu -> Service (UA)
    handleLieuChange(prefix) {
        const lieuIdStr = document.getElementById(`${prefix}-lieu`).value;
        const lieuId = lieuIdStr ? parseInt(lieuIdStr) : null;
        const uaSelectId = `${prefix}-ua`;
        const currentUaCode = document.getElementById(uaSelectId).value;

        UI.fillSelect(uaSelectId, State.referentiels.structures, 'code_sages', 'libelle', {
            // Conserve la sélection actuelle si elle existe
            selected: currentUaCode,
            // Prédicat : Le service évalué est-il hébergé dans ce lieu ?
            isPrimary: (ua) => lieuId !== null && ua.lieu_id === lieuId,
            primaryGroupLabel: "🎯 Services hébergés sur ce site",
            secondaryGroupLabel: "📁 Autres services"
        });
    },
    
    handleCreateUaChange() { this.handleUaChange('new-mob'); },
    handleCreateLieuChange() { this.handleLieuChange('new-mob'); },

    handleEditUaChange() { this.handleUaChange('edit-mob'); },
    handleEditLieuChange() { this.handleLieuChange('edit-mob'); },

    handleScanUaChange() { this.handleUaChange('scan-target'); },
    handleScanLieuChange() { this.handleLieuChange('scan-target'); },

    handleImportUaChange() { this.handleUaChange('import-target'); },
    handleImportLieuChange() { this.handleLieuChange('import-target'); },
    
};

// --- CATALOGUE NATIONAL ---
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
        if (newPage >= 1 && newPage <= totalPages) {
            State.gabarit.page = newPage;
            this.loadData();
        }
    },

    async loadData() {
        const { page, sortBy, sortAsc, filters } = State.gabarit;
        const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE - 1;

        let params = new URLSearchParams();
        if (filters.categorie) params.append('categorie', `eq.${filters.categorie}`);
        
        if (filters.query) {
            // 1. On nettoie la chaîne pour la rendre lisible par PostgREST
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');

            // 2. On découpe la recherche en mots séparés (en ignorant les espaces multiples)
            const motsCles = safeQuery.trim().split(/\s+/);
            
            // 3. On construit un tableau de conditions "or" pour CHAQUE mot-clé
            const conditionsMots = motsCles.map(mot => 
                `or(reference_catalogue.ilike.*${mot}*,nom_descriptif.ilike.*${mot}*,caracteristiques_txt.ilike.*${mot}*)`
            );

            // 4. On demande à l'API que TOUTES les conditions (ET) soient remplies
            // PostgREST utilise des virgules pour le "ET" implicite entre plusieurs conditions
            params.append('and', `(${conditionsMots.join(',')})`);
        }

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
            tr.innerHTML = `
                <td class="fr-text--bold">${UI.escape(gab.reference_catalogue)}</td>
                <td><p class="fr-badge fr-badge--info fr-badge--sm fr-mb-0">${UI.escape(gab.categorie)}</p></td>
                <td>${UI.escape(gab.nom_descriptif)}</td>
                <td class="fr-text--xs" style="font-family: monospace;">{<br>${UI.formatJsonToText(gab.caracteristiques)}<br>}</td>
                <td><button class="fr-btn fr-btn--secondary fr-btn--sm btn-edit-gab">Éditer</button></td>
            `;
            tr.querySelector('.btn-edit-gab').addEventListener('click', () => this.openEditForm(gab.id));
            tbody.appendChild(tr);
        });
        
        UI.updateSortUI('gab', State.gabarit.sortBy, State.gabarit.sortAsc);
        
        // Mise à jour de l'interface de pagination
        const totalPages = Math.ceil(State.gabarit.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('gab-results-count').innerText = `${State.gabarit.total} modèle(s)`;
        document.getElementById('gab-page-info').innerText = `Page ${State.gabarit.page} sur ${totalPages}`;
        document.getElementById('btn-gab-prev').disabled = (State.gabarit.page === 1);
        document.getElementById('btn-gab-next').disabled = (State.gabarit.page >= totalPages);
    },

    addJsonRow(key = "", val = "") {
        const row = document.createElement('div');
        row.className = 'json-builder-row';
        row.innerHTML = `<div class="fr-input-group"><label class="fr-label">Attribut</label><input class="fr-input json-key" type="text" placeholder="couleur" value="${UI.escape(key)}"></div><div class="fr-input-group"><label class="fr-label">Valeur</label><input class="fr-input json-val" type="text" placeholder="noir" value="${UI.escape(val)}"></div><button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-icon-delete-line btn-del-row"></button>`;
        row.querySelector('.btn-del-row').addEventListener('click', () => row.remove());
        document.getElementById('json-builder').appendChild(row);
    },

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
        document.querySelectorAll('.json-builder-row').forEach(row => {
            const key = row.querySelector('.json-key').value.trim();
            const val = row.querySelector('.json-val').value.trim();
            if (key && val !== "") {
                const safeKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_').toLowerCase();
                caracs[safeKey] = (val.toLowerCase() === 'null') ? null : (val.toLowerCase() === 'true' ? true : (val.toLowerCase() === 'false' ? false : val));
            }
        });

        const rawNom = document.getElementById('edit-gab-nom').value.trim();
        const payload = {
            reference_catalogue: ref, categorie: document.getElementById('edit-gab-cat').value,
            nom_descriptif: rawNom.charAt(0).toUpperCase() + rawNom.slice(1), caracteristiques: caracs
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
    }
};

// --- ADMINISTRATION ---
const AdminCtrl = {
    async init() {
        if (State.user.role !== 'administrateur') return;
        await this.loadUsers();
        this.renderUA();
        this.renderLieux();
    },

    // Utilisateurs
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
        const pwd = prompt(`Veuillez définir un mot de passe initial pour ${email} :`);
        
        if (!pwd) return;

        try {
            const res = await API.fetch(`/rpc/creer_utilisateur`, { 
                method: 'POST', 
                headers: API.getHeaders(), 
                body: JSON.stringify({ _email: email, _password: pwd, _role: role }) 
            });
            
            // NOUVEAU : On lit et on affiche l'erreur exacte de la base de données
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const serverMsg = errorData.message || errorData.details || "Erreur serveur HTTP " + res.status;
                throw new Error(serverMsg);
            }
            
            UI.showAlert("Succès", "Compte créé.", "success");
            this.loadUsers();
            UI.showView('view-users-list', 'panel-admin');
        } catch (err) { 
            UI.showAlert("Erreur API/SQL", err.message, "error"); 
        }
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
        const nouveauMdp = prompt(`Nouveau mot de passe pour ${email} :`);
        if (!nouveauMdp) return;
        try {
            await API.fetch(`/rpc/reinitialiser_mdp`, { method: 'POST', headers: API.getHeaders(), body: JSON.stringify({ _email: email, _new_password: nouveauMdp }) });
            UI.showAlert("Succès", "Mot de passe mis à jour.", "success");
        } catch (err) { UI.showAlert("Erreur", "Réinitialisation impossible.", "error"); }
    },

    // UA & Lieux
    renderUA() {
        const tbody = document.getElementById('table-ua-body');
        tbody.innerHTML = '';
        State.referentiels.structures.forEach(ua => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="fr-text--bold">${UI.escape(ua.code_sages)}</td><td>${UI.escape(ua.libelle)}</td><td><button class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line btn-edit-ua"></button></td>`;
            
            // NOUVEAU : On branche le bouton d'édition
            tr.querySelector('.btn-edit-ua').addEventListener('click', () => this.openEditUa(ua.code_sages));
            tbody.appendChild(tr);
        });
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
            
            await API.loadReferentiels(); // Met à jour le cache global
            this.renderUA();
            MobilierCtrl.init(); // Rafraîchit les filtres
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
            MobilierCtrl.init(); // Rafraîchit les filtres globaux
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
        State.referentiels.lieux.forEach(l => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="fr-text--bold">${UI.escape(l.nom)}</td><td><button class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line btn-edit-lieu"></button></td>`;
            
            // NOUVEAU : On branche le bouton d'édition
            tr.querySelector('.btn-edit-lieu').addEventListener('click', () => this.openEditLieu(l.id));
            tbody.appendChild(tr);
        });
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
            
            await API.loadReferentiels(); // Met à jour le cache global
            this.renderLieux();
            MobilierCtrl.init(); // Rafraîchit les filtres
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


    // Audit
// Audit
    auditSearchTimeout: null,
    auditPollingTimer: null,
    latestKnownAuditId: null,
    
    async checkNewAuditEvents() {
        const auditView = document.getElementById('view-audit-list');
        
        // Sécurité : On stoppe tout si la vue n'est pas active, si on n'est pas sur la page 1, 
        // si une recherche est en cours, ou si l'onglet du navigateur est en arrière-plan.
        if (!auditView || !auditView.classList.contains('active') || State.admin.audit.page !== 1 || State.admin.audit.filters.query !== '' || document.hidden) {
            return;
        }

        try {
            // Requête ultra-légère : on demande uniquement l'ID le plus élevé (le plus récent)
            const res = await API.fetch('/audit_logs?select=id&order=id.desc&limit=1', { headers: API.getHeaders() });
            if (res.ok) {
                const data = await res.json();
                if (data.length > 0) {
                    const serverLatestId = data[0].id;
                    // S'il y a un décalage entre notre ID et celui du serveur, on affiche l'alerte
                    if (this.latestKnownAuditId && serverLatestId > this.latestKnownAuditId) {
                        document.getElementById('audit-new-events-banner').style.display = 'block';
                    }
                }
            }
        } catch (e) {
            // Échec silencieux, on ne pollue pas la console de l'utilisateur
        }
    },

    startAuditPolling() {
        this.stopAuditPolling();
        document.getElementById('audit-new-events-banner').style.display = 'none';
        // Lance la vérification silencieuse toutes les 15 secondes
        this.auditPollingTimer = setInterval(() => this.checkNewAuditEvents(), 15000);
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

    async loadAudit() {
        const { page, filters } = State.admin.audit;
        const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
        const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE - 1;

        let params = new URLSearchParams();
        params.append('order', 'date_action.desc');

        // Moteur de recherche multicritère (Agent, Action, Cible, Détails)
        if (filters.query) {
            const safeQuery = filters.query.replace(/["(),:{}\t]/g, ' ');
            const motsCles = safeQuery.trim().split(/\s+/);
            const conditionsMots = motsCles.map(mot => 
                `or(utilisateur.ilike.*${mot}*,action.ilike.*${mot}*,id_metier.ilike.*${mot}*,details.ilike.*${mot}*)`
            );
            params.append('and', `(${conditionsMots.join(',')})`);
        }

        try {
            // Requête paginée avec récupération du nombre total d'éléments
            const res = await API.fetch(`/audit_logs?${params.toString()}`, { 
                headers: API.getHeaders({ 'Range': `${startIndex}-${endIndex}`, 'Prefer': 'count=exact' }) 
            });
            if (!res.ok) throw new Error("Erreur réseau");
            
            State.admin.audit.data = await res.json();
            const contentRange = res.headers.get('Content-Range');
            if (contentRange) State.admin.audit.total = parseInt(contentRange.split('/')[1]);
            // Si on charge la page 1 et qu'il y a des données, on mémorise l'ID du premier log
            if (State.admin.audit.page === 1 && State.admin.audit.data.length > 0) {
                this.latestKnownAuditId = State.admin.audit.data[0].id;
            }
            // On s'assure de cacher le bandeau puisqu'on vient de recharger les données fraîches
            const banner = document.getElementById('audit-new-events-banner');
            if (banner) banner.style.display = 'none';
            
            this.renderAudit();
            UI.showView('view-audit-list', 'panel-admin');
        } catch (e) { UI.showAlert("Erreur", "Accès refusé au journal.", "error"); }
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

        // Mise à jour de l'interface de pagination
        const totalPages = Math.ceil(State.admin.audit.total / CONFIG.ITEMS_PER_PAGE) || 1;
        document.getElementById('audit-results-count').innerText = `${State.admin.audit.total} événement(s) enregistré(s)`;
        
        const pageInfo = document.getElementById('audit-page-info');
        if(pageInfo) pageInfo.innerText = `Page ${State.admin.audit.page} sur ${totalPages}`;
        
        const btnPrev = document.getElementById('btn-audit-prev');
        const btnNext = document.getElementById('btn-audit-next');
        if(btnPrev) btnPrev.disabled = (State.admin.audit.page === 1);
        if(btnNext) btnNext.disabled = (State.admin.audit.page >= totalPages);
    },
    
    // Mise au rebut (Massive + PDF)
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

                // 1. Récupération des données intégrales pour le PV
                for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                    const chunk = ids.slice(i, i + CHUNK_SIZE);
                    const res = await API.fetch(`/vue_mobiliers_recherche?id_metier=in.(${chunk.join(',')})`, { headers: API.getHeaders() });
                    if (res.ok) itemsToRebut = itemsToRebut.concat(await res.json());
                }

                if (itemsToRebut.length === 0) { UI.showAlert("Erreur", "Aucun équipement trouvé en base.", "error"); return; }
                const validIds = itemsToRebut.map(item => item.id_metier);

                // 2. Suppression physique par lots
                for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
                    const chunk = validIds.slice(i, i + CHUNK_SIZE);
                    await API.fetch(`/mobiliers?id_metier=in.(${chunk.join(',')})`, { method: 'DELETE', headers: API.getHeaders() });
                }

                // 3. Génération PDF
                this.generateRebutPDF(itemsToRebut);
                UI.showAlert("Succès", `${validIds.length} supprimés. PV généré.`, "success");
                MobilierCtrl.loadData();
            } catch (err) { UI.showAlert("Erreur critique", err.message, "error"); }
        };
        reader.readAsText(fileInput.files[0]);
    },

    async generateRebutPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const dateToday = new Date().toLocaleDateString('fr-FR');
        const filenameDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

        try {
            const img = new Image();
            img.src = 'dsfr-v1.14.3/dist/favicon/apple-touch-icon.png';
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            doc.addImage(canvas.toDataURL('image/png'), 'PNG', 20, 15, 14, 14);
        } catch (e) { console.warn("Logo absent."); }

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

        const tableBody = data.map(item => [item.id_metier, item.gabarit_nom, item.structure_libelle, item.lieu_nom, (item.remarques || '').substring(0, 50)]);
        doc.autoTable({
            startY: 90, head: [['ID Métier', 'Modèle', 'Service Affectation', 'Lieu', 'Observations']], body: tableBody,
            theme: 'grid', headStyles: { fillColor: [0, 0, 145], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 8, font: 'helvetica' }, alternateRowStyles: { fillColor: [246, 246, 246] }
        });

        const finalY = doc.lastAutoTable.finalY + 20;
        doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Cachet du service et signature :", 100, finalY);
        doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); doc.rect(100, finalY + 5, 90, 35);

        doc.save(`PVSORTIETRACE_${filenameDate}.pdf`);
    }
};

// ============================================================================
// 5. BOOTSTRAP DE L'APPLICATION
// ============================================================================
const App = {
    eventsBound: false,

    async start() {
        // 2. AJOUT DE LA CONDITION ICI :
        if (!this.eventsBound) {
            this.bindEvents();
            this.eventsBound = true;
        }
        
        await API.loadConfig();

        if (!State.initUser()) {
            document.getElementById('view-login').classList.add('active');
            document.getElementById('view-app').classList.remove('active');
            return; 
        }

        document.getElementById('view-login').classList.remove('active');
        document.getElementById('view-app').classList.add('active');
        document.getElementById('logout-btn-container').style.display = 'block';

        if (State.user.role === 'administrateur') {
            document.getElementById('tab-admin').style.display = 'block';
        }

        try {
            await API.loadReferentiels();
            await MobilierCtrl.init();
            GabaritCtrl.init();
            if (State.user.role === 'administrateur') await AdminCtrl.init();
        } catch (e) { UI.showAlert("Critique", "Erreur réseau d'initialisation.", "error"); }
    },

    bindEvents() {
        // Auth
        const loginForm = document.getElementById('form-login');
        if (loginForm) {
            loginForm.replaceWith(loginForm.cloneNode(true));
            document.getElementById('form-login').addEventListener('submit', (e) => AuthCtrl.login(e));
        }
        document.getElementById('btn-logout')?.addEventListener('click', () => AuthCtrl.logout());

        // Mobilier: Navigation & Filtres
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
        
        // Mobilier: Vues
        document.querySelectorAll('.btn-back-to-list').forEach(btn => btn.addEventListener('click', () => UI.showView('view-mobilier-list', 'panel-mobilier')));
        document.getElementById('btn-nav-create-mob')?.addEventListener('click', () => MobilierCtrl.openCreateForm());
        document.getElementById('btn-nav-scan')?.addEventListener('click', () => MobilierCtrl.openScan());
        document.getElementById('btn-nav-import')?.addEventListener('click', () => MobilierCtrl.openImport());

        // Mobilier: Actions
        document.getElementById('form-mob-create')?.addEventListener('submit', (e) => MobilierCtrl.handleCreate(e));
        document.getElementById('form-mob-edit')?.addEventListener('submit', (e) => MobilierCtrl.handleEdit(e));
        document.getElementById('btn-delete-mob')?.addEventListener('click', () => MobilierCtrl.handleDelete());
        
        document.getElementById('new-mob-ua')?.addEventListener('change', () => MobilierCtrl.handleCreateUaChange());
        document.getElementById('edit-mob-ua')?.addEventListener('change', () => MobilierCtrl.handleEditUaChange());
        document.getElementById('scan-target-ua')?.addEventListener('change', () => MobilierCtrl.handleScanUaChange());
        document.getElementById('import-target-ua')?.addEventListener('change', () => MobilierCtrl.handleImportUaChange());
        
        document.getElementById('scanner-input')?.addEventListener('keypress', (e) => MobilierCtrl.processScan(e));
        document.getElementById('btn-exec-import')?.addEventListener('click', () => MobilierCtrl.processImport());

        // Gabarits
        document.getElementById('search-gab-input')?.addEventListener('input', (e) => GabaritCtrl.updateFilter('query', e.target.value));
        document.getElementById('filter-gab-cat')?.addEventListener('change', (e) => GabaritCtrl.updateFilter('categorie', e.target.value));
        document.getElementById('btn-reset-gab-filters')?.addEventListener('click', () => GabaritCtrl.resetFilters());
        document.getElementById('btn-gab-prev')?.addEventListener('click', () => GabaritCtrl.changePage(-1));
        document.getElementById('btn-gab-next')?.addEventListener('click', () => GabaritCtrl.changePage(1));
        document.querySelectorAll('#table-gabarits-body').forEach(el => {
            el.closest('table').querySelectorAll('th.sortable-header').forEach(th => {
                th.addEventListener('click', () => GabaritCtrl.toggleSort(th.dataset.sort));
            });
        });
        
        document.querySelectorAll('.btn-back-to-gab-list').forEach(btn => btn.addEventListener('click', () => UI.showView('view-gabarits-list', 'panel-gabarits')));
        document.getElementById('btn-nav-create-gab')?.addEventListener('click', () => GabaritCtrl.openCreateForm());
        document.getElementById('edit-gab-cat')?.addEventListener('change', () => GabaritCtrl.suggestNextReference());
        document.getElementById('btn-add-json-row')?.addEventListener('click', () => GabaritCtrl.addJsonRow());
        document.getElementById('form-gab-edit')?.addEventListener('submit', (e) => GabaritCtrl.handleSave(e));
        document.getElementById('btn-delete-gab')?.addEventListener('click', () => GabaritCtrl.handleDelete());

        // Admin
        document.getElementById('nav-admin-users')?.addEventListener('click', () => UI.showView('view-users-list', 'panel-admin'));
        document.getElementById('nav-admin-ua')?.addEventListener('click', () => UI.showView('view-ua-list', 'panel-admin'));
        document.getElementById('nav-admin-lieux')?.addEventListener('click', () => UI.showView('view-lieux-list', 'panel-admin'));
        document.getElementById('nav-admin-rebut')?.addEventListener('click', () => UI.showView('view-admin-rebut', 'panel-admin'));
        
        document.getElementById('nav-admin-audit')?.addEventListener('click', () => {
            State.admin.audit.page = 1; // Force le retour à la page 1
            AdminCtrl.loadAudit();
            AdminCtrl.startAuditPolling(); // Démarre le radar
        });
        
        
        document.getElementById('btn-refresh-audit')?.addEventListener('click', () => {
            State.admin.audit.page = 1;
            AdminCtrl.loadAudit();
        });

        
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                AdminCtrl.checkNewAuditEvents();
            }
        });
        
        
        document.getElementById('search-audit-input')?.addEventListener('input', (e) => AdminCtrl.updateAuditFilter(e.target.value));
        document.getElementById('btn-audit-prev')?.addEventListener('click', () => AdminCtrl.changeAuditPage(-1));
        document.getElementById('btn-audit-next')?.addEventListener('click', () => AdminCtrl.changeAuditPage(1));
        document.getElementById('btn-exec-rebut')?.addEventListener('click', () => AdminCtrl.processRebut());
        // Admin: Vues de création et soumissions
        document.getElementById('btn-nav-create-user')?.addEventListener('click', () => AdminCtrl.openCreateUser());
        document.querySelectorAll('.btn-back-to-users').forEach(btn => btn.addEventListener('click', () => UI.showView('view-users-list', 'panel-admin')));
        document.getElementById('form-user-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateUser(e));

        document.getElementById('btn-nav-create-ua')?.addEventListener('click', () => AdminCtrl.openCreateUa());
        document.querySelectorAll('.btn-back-to-ua').forEach(btn => btn.addEventListener('click', () => UI.showView('view-ua-list', 'panel-admin')));
        document.getElementById('form-ua-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateUa(e));

        document.getElementById('btn-nav-create-lieu')?.addEventListener('click', () => AdminCtrl.openCreateLieu());
        document.querySelectorAll('.btn-back-to-lieux').forEach(btn => btn.addEventListener('click', () => UI.showView('view-lieux-list', 'panel-admin')));
        document.getElementById('form-lieu-create')?.addEventListener('submit', (e) => AdminCtrl.handleCreateLieu(e));
        
        // NOUVEAU : Édition/Suppression UA
        document.getElementById('form-ua-edit')?.addEventListener('submit', (e) => AdminCtrl.handleEditUa(e));
        document.getElementById('btn-delete-ua')?.addEventListener('click', () => AdminCtrl.deleteUa());

        // NOUVEAU : Édition/Suppression Lieux
        document.getElementById('form-lieu-edit')?.addEventListener('submit', (e) => AdminCtrl.handleEditLieu(e));
        document.getElementById('btn-delete-lieu')?.addEventListener('click', () => AdminCtrl.deleteLieu());
        
        // --- NOUVEAU : Écouteurs pour les Lieux ---
        document.getElementById('new-mob-lieu')?.addEventListener('change', () => MobilierCtrl.handleCreateLieuChange());
        document.getElementById('edit-mob-lieu')?.addEventListener('change', () => MobilierCtrl.handleEditLieuChange());
        document.getElementById('scan-target-lieu')?.addEventListener('change', () => MobilierCtrl.handleScanLieuChange());
        document.getElementById('import-target-lieu')?.addEventListener('change', () => MobilierCtrl.handleImportLieuChange());
        
      
        
    }
};

document.addEventListener('DOMContentLoaded', () => App.start()); 
