// CONFIGURATION
const API_URL = '/api';

let state = {
    totalItems: 0,
    gabarits: [], structures: [], lieux: [], utilisateurs: [],
    maps: { g: new Map(), s: new Map(), l: new Map() },
    query: '', filterGabarit: '', filterUa: '', filterStatut: '',
    sortBy: 'id_metier', sortAsc: true, currentPage: 1, itemsPerPage: 50, filteredData: [],
    gabQuery: '', gabFilterCat: '',
    gabSortBy: 'reference_catalogue', gabSortAsc: true, filteredGabarits: [],
    userSortBy: 'email', userSortAsc: true, userPage: 1,
    uaSortBy: 'code_sages', uaSortAsc: true, uaPage: 1,
    lieuSortBy: 'nom', lieuSortAsc: true, lieuPage: 1,
    auditLogs: [], auditPage: 1,
    config: {
        administration: "ADMINISTRATION NON DÉFINIE",
        direction: "DIRECTION NON DÉFINIE"
    }
};

function getHeaders() { 
    const token = sessionStorage.getItem('trace_jwt');
    if (!token) return null;

    // Décodage et vérification de l'expiration
    const payload = parseJwt(token);
    const now = Math.floor(Date.now() / 1000);
    
    if (payload && payload.exp && payload.exp < now) {
        showAlert("Session expirée", "Votre session a expiré. Redirection...", "error");
        deconnecter();
        return null;
    }

    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`, 
        'Prefer': 'return=representation' 
    }; 
}

async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        deconnecter(); // Force le retour au login si le serveur rejette le JWT
        throw new Error("Accès non autorisé.");
    }
    return res;
}

/**
 * Neutralise les caractères spéciaux pour prévenir les injections XSS.
 * Transforme par exemple "<script>" en "&lt;script&gt;"
 */
function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================================================
// AUTHENTIFICATION & SÉCURITÉ
// ============================================================================
async function authentifier(e) {
    e.preventDefault();
    try {
        const res = await apiFetch(`${API_URL}/rpc/login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
        });
        if (!res.ok) throw new Error("Identifiants incorrects ou serveur injoignable");
        const data = await res.json();
        sessionStorage.setItem('trace_jwt', data.token);
        
        document.getElementById('view-login').classList.remove('active');
        document.getElementById('view-app').classList.add('active');
        document.getElementById('logout-btn-container').style.display = 'block';
        
        await loadData();
        await verifierDroitsAdmin();
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

function deconnecter() { 
    sessionStorage.removeItem('trace_jwt'); 
    location.reload(); 
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) { return null; }
}

async function verifierDroitsAdmin() {
    const token = sessionStorage.getItem('trace_jwt');
    const payload = parseJwt(token);
    
    if (!payload || payload.role !== 'administrateur') {
        document.getElementById('tab-admin').style.display = 'none';
        return false;
    }
    
    document.getElementById('tab-admin').style.display = 'block';
    await loadUsers();
    await loadAuditLogs();
    return true;
}

// ============================================================================
// CHARGEMENT DONNÉES ET VUES GLOBALES
// ============================================================================
async function loadData() {
    try {
        // MODIFICATION : On ne charge que les 3 référentiels, mobiliers a été retiré
        const [gRes, sRes, lRes] = await Promise.all([
            apiFetch(`${API_URL}/gabarits`, { headers: getHeaders() }),
            apiFetch(`${API_URL}/structures`, { headers: getHeaders() }),
            apiFetch(`${API_URL}/lieux`, { headers: getHeaders() })
        ]);
        
        if (!lRes.ok) throw new Error("Session expirée.");

        state.gabarits = await gRes.json(); 
        state.structures = await sRes.json();
        state.lieux = await lRes.json(); 

        state.maps.g.clear(); state.gabarits.forEach(g => state.maps.g.set(g.id, g));
        state.maps.s.clear(); state.structures.forEach(s => state.maps.s.set(s.code_sages, s));
        state.maps.l.clear(); state.lieux.forEach(l => state.maps.l.set(l.id, l));

        fillSelect('filter-gabarit', state.gabarits, 'id', 'nom_descriptif', { placeholder: 'Tous les modèles', disablePlaceholder: false });
        fillSelect('filter-ua', state.structures, 'code_sages', 'libelle', { placeholder: 'Toutes les affectations', disablePlaceholder: false });

        renderGabarits();
        applyGabFiltersAndSort();
        renderStructures();
        renderLieux();
        
        // C'est cette fonction qui ira chercher la 1ère page (50 éléments)
        applyFiltersAndSort();
    } catch (e) { 
        showAlert("Sécurité", e.message, "error"); 
        
    }
}



function showSubView(viewId, parentId) { 
    document.querySelectorAll(`#${parentId} .sub-view`).forEach(v => v.classList.remove('active')); 
    document.getElementById(viewId).classList.add('active'); 
    
    // Remonte automatiquement en haut de la page avec une animation fluide
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAlert(titre, message, type) { 
    const c = document.getElementById('alert-container'); 
    c.innerHTML = `<div class="fr-alert fr-alert--${type} fr-mb-2w"><h3 class="fr-alert__title">${titre}</h3><p>${message}</p></div>`; 
    setTimeout(() => c.innerHTML = '', 5000); 
}

/**
 * Remplit un <select> de manière optimisée (1 seule insertion DOM).
 */
function fillSelect(selectId, dataArray, valueKey, labelKey, options = {}) {
    const select = document.getElementById(selectId);
    if (!select) return;

    // Valeurs par défaut
    const selected = options.selected || null;
    const placeholder = options.placeholder || "Sélectionnez...";
    const disablePlaceholder = options.disablePlaceholder !== undefined ? options.disablePlaceholder : true;

    // Construction du HTML en mémoire (très rapide)
    let html = `<option value="" ${!selected ? 'selected' : ''} ${disablePlaceholder ? 'disabled hidden' : ''}>${placeholder}</option>`;
    
    html += dataArray.map(item => {
        const isSelected = item[valueKey] == selected ? 'selected' : '';
        return `<option value="${item[valueKey]}" ${isSelected}>${item[labelKey]}</option>`;
    }).join('');

    // Une seule modification du DOM
    select.innerHTML = html;
}

// ============================================================================
// MOTEUR DE RECHERCHE, TRI ET FILTRES (MOBILIER)
// ============================================================================
let searchTimeout;
function updateFilters(filterName, value) { 
    state[filterName] = value.trim(); 
    state.currentPage = 1; 
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        applyFiltersAndSort();
    }, 300); // Attend 300ms de silence avant d'interroger le serveur
}

function resetFilters() { 
    document.getElementById('search-input').value = ''; 
    document.getElementById('filter-gabarit').value = ''; 
    document.getElementById('filter-ua').value = ''; 
    document.getElementById('filter-statut').value = ''; 
    state.query = ''; state.filterGabarit = ''; state.filterUa = ''; state.filterStatut = ''; state.currentPage = 1; 
    applyFiltersAndSort(); 
}

function toggleSort(columnName) { 
    if (state.sortBy === columnName) { state.sortAsc = !state.sortAsc; } 
    else { state.sortBy = columnName; state.sortAsc = true; } 
    applyFiltersAndSort(); 
}

async function applyFiltersAndSort() {
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage - 1;

    let params = new URLSearchParams();
    
    // FILTRES
    if (state.filterGabarit) params.append('gabarit_id', `eq.${state.filterGabarit}`);
    if (state.filterUa) params.append('code_sages', `eq.${state.filterUa}`);
    if (state.filterStatut) params.append('statut', `eq.${state.filterStatut}`);

    // RECHERCHE GLOBALE ÉTENDUE
    if (state.query) {
        // On cherche désormais dans : ID, Remarques, Nom Modèle, Libellé Service, Nom Lieu et le JSON !
        params.append('or', `(` +
            `id_metier.ilike.*${state.query}*,` +
            `remarques.ilike.*${state.query}*,` +
            `gabarit_nom.ilike.*${state.query}*,` +
            `structure_libelle.ilike.*${state.query}*,` +
            `lieu_nom.ilike.*${state.query}*,` +
            `gabarit_json_txt.ilike.*${state.query}*` +
        `)`);
    }

    const orderDir = state.sortAsc ? 'asc' : 'desc';
    params.append('order', `${state.sortBy}.${orderDir}`);

    try {
        // MODIFICATION : On interroge la VUE au lieu de la TABLE
        const res = await apiFetch(`${API_URL}/vue_mobiliers_recherche?${params.toString()}`, {
            headers: {
                ...getHeaders(),
                'Range': `${startIndex}-${endIndex}`,
                'Prefer': 'count=exact'
            }
        });

        if (!res.ok) throw new Error("Erreur de recherche");

        state.filteredData = await res.json();
        const contentRange = res.headers.get('Content-Range'); 
        if (contentRange) state.totalItems = parseInt(contentRange.split('/')[1]);

        renderMobilierPage();
        updateSortUI(); 
    } catch (e) {
        showAlert("Erreur", "La recherche a échoué.", "error");
    }
}

function formatJsonToText(obj) {
    if(!obj || Object.keys(obj).length === 0) return '';
    return Object.entries(obj)
        .map(([k, v]) => `${escapeHTML(k)}: ${escapeHTML(v)}`) // Échappement des clés et des valeurs
        .join(' • ');
}

function renderMobilierPage() {
    const tbody = document.getElementById('table-mobilier-body'); tbody.innerHTML = '';
    const totalItems = state.filteredData.length; 
	const totalPages = Math.ceil(state.totalItems / state.itemsPerPage) || 1;    const startIndex = (state.currentPage - 1) * state.itemsPerPage;

state.filteredData.forEach(mob => {
        const gab = state.maps.g.get(mob.gabarit_id) || { nom_descriptif: 'Inconnu' };
        const lieu = state.maps.l.get(mob.lieu_id) || { nom: 'Inconnu' };
        const ua = state.maps.s.get(mob.code_sages) || { libelle: 'Inconnu' };

        // --- SÉCURISATION XSS ---
        const safeNom = escapeHTML(gab.nom_descriptif);
        const safeUa = escapeHTML(ua.libelle);
        const safeLieu = escapeHTML(lieu.nom);
        const safeId = escapeHTML(mob.id_metier);
        // ----------------------------------

        // NOUVEAU : Récupération et formatage des attributs JSON
        const jsonText = formatJsonToText(gab.caracteristiques);
        const jsonHtml = jsonText ? `<br><span class="fr-text--xs" style="color: var(--text-mention-grey);">${jsonText}</span>` : '';

        let badge = `<p class="fr-badge fr-badge--new fr-badge--sm fr-mb-0">En service</p>`;
        if(mob.statut === 'dispo_reemploi') badge = `<p class="fr-badge fr-badge--success fr-badge--sm fr-mb-0">Réemploi</p>`;
        if(mob.statut === 'en_maintenance') badge = `<p class="fr-badge fr-badge--warning fr-badge--sm fr-mb-0">Maintenance</p>`;
        if(mob.statut === 'au_rebut') badge = `<p class="fr-badge fr-badge--error fr-badge--sm fr-mb-0">Au Rebut</p>`;

        // MODIFICATION : Ajout de ${jsonHtml} juste après le nom du modèle
        tbody.innerHTML += `<tr>
            <td><span class="uuid-badge" title="Copier ID" onclick="navigator.clipboard.writeText('${safeId}')">${safeId}</span></td>
            <td><span class="fr-text--bold">${safeNom}</span>${jsonHtml}</td>
            <td class="fr-text--sm">${safeUa}<br><span class="fr-text--light">${safeLieu}</span></td>
            <td>${badge}</td>
            <td><button onclick="editMobilier('${mob.uuid}')" class="fr-btn fr-btn--secondary fr-btn--sm">Fiche</button></td>
        </tr>`;
    });
    
    document.getElementById('results-count').innerText = `${state.totalItems} équipement(s) au total`;
    document.getElementById('page-info').innerText = `Page ${state.currentPage} sur ${totalPages}`;
    document.getElementById('btn-prev').disabled = (state.currentPage === 1); 
    document.getElementById('btn-next').disabled = (state.currentPage >= totalPages);
}

function updateSortUI() { 
    document.querySelectorAll('.sort-icon').forEach(icon => icon.style.opacity = '0'); 
    const activeIcon = document.getElementById(`icon-sort-${state.sortBy}`); 
    if(activeIcon) { 
        activeIcon.style.opacity = '1'; 
        activeIcon.className = state.sortAsc ? "fr-icon-arrow-up-s-line sort-icon" : "fr-icon-arrow-down-s-line sort-icon"; 
    } 
}

function changePage(direction) { 
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage); 
    const newPage = state.currentPage + direction;
    
    if (newPage >= 1 && newPage <= totalPages) {
        state.currentPage = newPage;
        applyFiltersAndSort(); // On appelle le serveur pour la nouvelle page
    }
}


function changeAdminPage(entity, direction) {
    if (entity === 'user') {
        const totalPages = Math.ceil(state.utilisateurs.length / 50) || 1;
        const newPage = state.userPage + direction;
        if (newPage >= 1 && newPage <= totalPages) { state.userPage = newPage; renderUsers(); }
    } else if (entity === 'ua') {
        const totalPages = Math.ceil(state.structures.length / 50) || 1;
        const newPage = state.uaPage + direction;
        if (newPage >= 1 && newPage <= totalPages) { state.uaPage = newPage; renderStructures(); }
    } else if (entity === 'lieu') {
        const totalPages = Math.ceil(state.lieux.length / 50) || 1;
        const newPage = state.lieuPage + direction;
        if (newPage >= 1 && newPage <= totalPages) { state.lieuPage = newPage; renderLieux(); }
    } else if (entity === 'audit') {
        const totalPages = Math.ceil(state.auditLogs.length / 50) || 1;
        const newPage = state.auditPage + direction;
        if (newPage >= 1 && newPage <= totalPages) { state.auditPage = newPage; renderAuditLogs(); }
    }
}

// ============================================================================
// CRUD MOBILIER (AVEC BULK INSERT)
// ============================================================================

function openCreateMobilier() {
    document.getElementById('new-mob-id').value = "Auto-généré";
    document.getElementById('new-mob-quantite').value = 1; // Réinitialise la quantité
	fillSelect('new-mob-gabarit', state.gabarits, 'id', 'nom_descriptif');
	fillSelect('new-mob-ua', state.structures, 'code_sages', 'libelle');
	fillSelect('new-mob-lieu', state.lieux, 'id', 'nom');
    document.getElementById('new-mob-statut').value = 'en_service'; 
    document.getElementById('new-mob-remarques').value = '';
    showSubView('view-mobilier-create', 'panel-mobilier');
}

function editMobilier(uuid) {
    const mob = state.filteredData.find(m => m.uuid === uuid);
    if(!mob) return;
    
    // Remplissage des champs du formulaire
    document.getElementById('edit-mob-uuid').value = mob.uuid;
    document.getElementById('edit-mob-id').value = mob.id_metier;
    fillSelect('edit-mob-gabarit', state.gabarits, 'id', 'nom_descriptif', { selected: mob.gabarit_id });
	fillSelect('edit-mob-ua', state.structures, 'code_sages', 'libelle', { selected: mob.code_sages });
	fillSelect('edit-mob-lieu', state.lieux, 'id', 'nom', { selected: mob.lieu_id });
    document.getElementById('edit-mob-statut').value = mob.statut;
    document.getElementById('edit-mob-remarques').value = mob.remarques || '';
    
    // Affichage de la vue
    showSubView('view-mobilier-detail', 'panel-mobilier');
}

async function saveMobilier(e, mode) {
    e.preventDefault();
    const prefix = mode === 'CREATE' ? 'new' : 'edit';
    const uuid = mode === 'EDIT' ? document.getElementById('edit-mob-uuid').value : null;
    
    // --- VALIDATION SÉCURITÉ : REGEX ID MÉTIER ---
    // On ne vérifie la regex QUE si on modifie un équipement existant
    if (mode === 'EDIT') {
        const idMetier = document.getElementById('edit-mob-id').value.trim().toUpperCase();
        const idRegex = /^MOB-\d{6}$/;
        if (!idRegex.test(idMetier)) {
            showAlert("Erreur d'identifiant", "L'ID métier est mal formé.", "error");
            return;
        }
    }
    // ---------------------------------------------
    
    // On récupère les valeurs communes
    const gabarit_id = parseInt(document.getElementById(`${prefix}-mob-gabarit`).value);
    const code_sages = document.getElementById(`${prefix}-mob-ua`).value;
    const lieu_id = parseInt(document.getElementById(`${prefix}-mob-lieu`).value);
    const statut = document.getElementById(`${prefix}-mob-statut`).value;
    const remarques = document.getElementById(`${prefix}-mob-remarques`).value;

    try {
        if (mode === 'CREATE') {
            const quantite = parseInt(document.getElementById('new-mob-quantite').value) || 1;
            
            if (quantite > 100) {
                if (!confirm(`Attention, vous êtes sur le point de créer ${quantite} équipements identiques d'un coup. Confirmez-vous cette action ?`)) {
                    return; // Annule la sauvegarde si l'agent clique sur "Annuler"
                }
            }
            
            const payloads = [];

            // On n'envoie PLUS l'id_metier, PostgreSQL s'en charge
            for (let i = 0; i < quantite; i++) {
                payloads.push({
                    gabarit_id: gabarit_id,
                    code_sages: code_sages,
                    lieu_id: lieu_id,
                    statut: statut,
                    remarques: remarques
                });
            }

            const res = await apiFetch(`${API_URL}/mobiliers`, { 
                method: 'POST', 
                headers: getHeaders(), 
                body: JSON.stringify(payloads) 
            });
            
            if(!res.ok) throw new Error("Erreur serveur lors de la création par lot.");
            
            // On récupère les données insérées par le serveur pour lire les vrais IDs
            const createdData = await res.json();
            
            // Affichage dynamique du succès selon la quantité
            if (quantite === 1) {
                showAlert("Succès", `L'équipement ${createdData[0].id_metier} a été créé.`, "success");
            } else {
                const firstId = createdData[0].id_metier;
                const lastId = createdData[createdData.length - 1].id_metier;
                showAlert("Succès", `${quantite} équipements créés (de ${firstId} à ${lastId}).`, "success");
            }

        } else {
            // Mode EDIT
            const payload = {
                id_metier: document.getElementById('edit-mob-id').value,
                gabarit_id: gabarit_id,
                code_sages: code_sages,
                lieu_id: lieu_id,
                statut: statut,
                remarques: remarques
            };
            const res = await apiFetch(`${API_URL}/mobiliers?uuid=eq.${uuid}`, { 
                method: 'PATCH', 
                headers: getHeaders(), 
                body: JSON.stringify(payload) 
            });
            
            if(!res.ok) throw new Error("Erreur serveur lors de la modification.");
            showAlert("Succès", "Équipement mis à jour.", "success");
        }

        await loadData();
        showSubView('view-mobilier-list', 'panel-mobilier');
    } catch (err) { 
        showAlert("Erreur", err.message, "error"); 
    }
}

async function deleteMobilier() {
    const uuid = document.getElementById('edit-mob-uuid').value;
    if(!confirm("Êtes-vous sûr de vouloir supprimer définitivement cet équipement du parc ?")) return;
    
    try {
        const res = await apiFetch(`${API_URL}/mobiliers?uuid=eq.${uuid}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) throw new Error("Échec de la suppression");
        showAlert("Succès", "Équipement supprimé du registre", "success");
        await loadData();
        showSubView('view-mobilier-list', 'panel-mobilier');
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}


// ============================================================================
// RÉAFFECTATION PAR SCAN (DOUCHETTE)
// ============================================================================
function openScanner() {
    fillSelect('scan-target-ua', state.structures, 'code_sages', 'libelle');
	fillSelect('scan-target-lieu', state.lieux, 'id', 'nom');
    document.getElementById('scan-target-statut').value = 'en_service';
    document.getElementById('scanner-input').value = '';
    document.getElementById('scan-log').innerHTML = '';
    showSubView('view-mobilier-scanner', 'panel-mobilier');
    
    // On met le focus automatiquement pour que la douchette puisse écrire direct
    setTimeout(() => document.getElementById('scanner-input').focus(), 100);
}

async function processScan(event) {
    // 1. Interception de la touche Entrée (douchette)
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('scanner-input');
    const logArea = document.getElementById('scan-log');
    const idMetier = input.value.trim().toUpperCase();
    
    // 2. Validation de sécurité (Regex)
    const idRegex = /^MOB-\d{6}$/;
    if (!idRegex.test(idMetier)) {
        showAlert("Format invalide", "L'identifiant doit être au format MOB-000000", "warning");
        input.value = '';
        return;
    }

    // Préparation des données cibles depuis l'interface
    const targetUa = document.getElementById('scan-target-ua').value;
    const targetLieu = parseInt(document.getElementById('scan-target-lieu').value);
    const targetStatut = document.getElementById('scan-target-statut').value;

    if (!targetUa || !targetLieu || !targetStatut) {
        showAlert("Configuration incomplète", "Veuillez définir le service, le lieu et le statut cible avant de scanner.", "error");
        input.value = '';
        return;
    }

    // Nettoyage immédiat de l'input pour le prochain scan
    input.value = '';
    input.focus();

    // 3. Recherche de l'équipement sur le serveur (indispensable pour 1M de lignes)
    try {
        const safeId = escapeHTML(idMetier); // Sécurisation pour l'affichage des logs
        
        // On interroge l'API pour trouver le meuble précis par son ID métier
        const searchRes = await apiFetch(`${API_URL}/mobiliers?id_metier=eq.${idMetier}`, {
            headers: getHeaders()
        });
        
        const results = await searchRes.json();

        if (results.length === 0) {
            logArea.insertAdjacentHTML('afterbegin', `
                <li class="fr-mb-1v">
                    <span class="fr-badge fr-badge--error">${safeId}</span> 
                    <span class="fr-text--xs">Introuvable dans la base</span>
                </li>`);
            return;
        }

        const mob = results[0]; // On récupère l'équipement trouvé

        // 4. Mise à jour de l'affectation (PATCH)
        const payload = { 
            code_sages: targetUa, 
            lieu_id: targetLieu, 
            statut: targetStatut 
        };

        const updateRes = await apiFetch(`${API_URL}/mobiliers?uuid=eq.${mob.uuid}`, { 
            method: 'PATCH', 
            headers: getHeaders(), 
            body: JSON.stringify(payload) 
        });

        if (!updateRes.ok) throw new Error("Erreur lors de la mise à jour serveur");

        // 5. Feedback visuel et rafraîchissement
        const safeUaLabel = escapeHTML(state.maps.s.get(targetUa)?.libelle || targetUa);
        
        logArea.insertAdjacentHTML('afterbegin', `
            <li class="fr-mb-1v">
                <span class="fr-badge fr-badge--success">${safeId}</span> 
                <span class="fr-text--xs">Réaffecté vers ${safeUaLabel}</span>
            </li>`);

        // Optionnel : On rafraîchit la liste principale si le meuble y était visible
        applyFiltersAndSort();

    } catch (err) {
        console.error("Erreur Scan:", err);
        logArea.insertAdjacentHTML('afterbegin', `
            <li class="fr-mb-1v">
                <span class="fr-badge fr-badge--error">${escapeHTML(idMetier)}</span> 
                <span class="fr-text--xs">Échec réseau ou serveur</span>
            </li>`);
    }
}

// ============================================================================
// RÉAFFECTATION PAR SCAN (FICHIER PLAT)
// ============================================================================
// Ouvre l'interface d'import et pré-remplit les sélecteurs
function openImportFile() {
    fillSelect('import-target-ua', state.structures, 'code_sages', 'libelle');
	fillSelect('import-target-lieu', state.lieux, 'id', 'nom');
    document.getElementById('file-upload').value = '';
    document.getElementById('import-log').innerHTML = '';
    document.querySelector('#import-progress p').innerText = "Progression...";
    document.getElementById('import-progress').style.display = 'none';
    showSubView('view-mobilier-import', 'panel-mobilier');
}

async function processFileImport() {
    const fileInput = document.getElementById('file-upload');
    const logArea = document.getElementById('import-log');
    const progressBar = document.querySelector('#import-progress progress');
    const progressText = document.querySelector('#import-progress p');
    const progressDiv = document.getElementById('import-progress');

    if (!fileInput.files[0]) {
        showAlert("Attention", "Veuillez sélectionner un fichier .txt", "warning");
        return;
    }

    const ua = document.getElementById('import-target-ua').value;
    const lieu = parseInt(document.getElementById('import-target-lieu').value);
    const statut = document.getElementById('import-target-statut').value;

    if (!ua || !lieu || !statut) {
        showAlert("Erreur", "Veuillez définir la destination complète (Service, Lieu, Statut).", "error");
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        // Extraction et nettoyage des IDs
        const content = e.target.result;
        const rawIds = content.split(/\r?\n/).map(id => id.trim().toUpperCase());
        
        // On enlève les lignes vides et on supprime les doublons éventuels dans le fichier
        const ids = [...new Set(rawIds.filter(id => id.length > 0))];

        if (ids.length === 0) {
            showAlert("Erreur", "Le fichier est vide ou ne contient que des sauts de ligne.", "error");
            return;
        }

        // --- VALIDATION SÉCURITÉ : Format des IDs ---
        const invalidIds = ids.filter(id => !/^MOB-\d{6}$/.test(id));
        if (invalidIds.length > 0) {
            showAlert("Erreur de format", `Le fichier contient des identifiants invalides (ex: ${escapeHTML(invalidIds[0])}). L'import est annulé.`, "error");
            return;
        }

        logArea.innerHTML = '';
        progressDiv.style.display = 'block';
        progressText.innerText = `Préparation de l'import de ${ids.length} équipements...`;
        progressBar.value = 50;

        // Construction du Bulk Payload (Un tableau avec tous les équipements à mettre à jour)
        const bulkPayload = ids.map(idMetier => ({
            id_metier: idMetier, // Clé d'identification
            code_sages: ua,
            lieu_id: lieu,
            statut: statut
        }));

        try {
            // Requête unique (Bulk Update) vers PostgREST
            // L'astuce est de spécifier ?columns=id_metier pour dire à PostgREST quelle est la clé primaire à utiliser pour la mise à jour
            const res = await apiFetch(`${API_URL}/mobiliers?columns=id_metier`, { 
                method: 'PATCH', 
                headers: {
                    ...getHeaders(),
                    'Prefer': 'return=representation' // Demande à l'API de renvoyer les lignes effectivement modifiées
                },
                body: JSON.stringify(bulkPayload) 
            });

            if (!res.ok) throw new Error("Erreur lors de la mise à jour en masse sur le serveur.");

            // On récupère la liste des équipements qui ont *vraiment* été modifiés
            const updatedItems = await res.json();
            const successCount = updatedItems.length;
            const notFoundCount = ids.length - successCount;

            progressBar.value = 100;
            progressText.innerText = "Import terminé";

            // Affichage du résumé
            if (notFoundCount === 0) {
                 showAlert("Succès total", `Les ${successCount} équipements ont été réaffectés.`, "success");
            } else {
                 showAlert("Succès partiel", `${successCount} réaffectés. ${notFoundCount} identifiants étaient inconnus en base.`, "warning");
                 
                 // On crée un Set des IDs mis à jour pour trouver facilement ceux qui ont échoué
                 const updatedIdsSet = new Set(updatedItems.map(item => item.id_metier));
                 
                 // On affiche ceux qui n'ont pas été trouvés dans le log
                 ids.filter(id => !updatedIdsSet.has(id)).forEach(failedId => {
                     logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${escapeHTML(failedId)}</span> Introuvable en base</li>`);
                 });
            }

            // Rafraîchit l'inventaire principal pour refléter les changements
            applyFiltersAndSort();

        } catch (err) {
            progressBar.value = 0;
            progressText.innerText = "Échec de l'import";
            showAlert("Erreur réseau ou API", err.message, "error");
        }
    };

    reader.readAsText(file);
}



// ============================================================================
// CRUD GABARITS (CATALOGUE)
// ============================================================================

let gabSearchTimeout;
function updateGabFilters(filterName, value) {
    state[filterName] = value.trim();
    clearTimeout(gabSearchTimeout);
    gabSearchTimeout = setTimeout(() => { applyGabFiltersAndSort(); }, 200);
}

function toggleGabSort(columnName) {
    if (state.gabSortBy === columnName) { state.gabSortAsc = !state.gabSortAsc; }
    else { state.gabSortBy = columnName; state.gabSortAsc = true; }
    applyGabFiltersAndSort();
}

function applyGabFiltersAndSort() {
    let result = [...state.gabarits];

    // 1. Filtrage strict (Catégorie)
    if (state.gabFilterCat) {
        result = result.filter(g => g.categorie === state.gabFilterCat);
    }

    // 2. Recherche textuelle globale (Référence, Nom, et Contenu JSON !)
    if (state.gabQuery) {
        const q = state.gabQuery.toLowerCase();
        result = result.filter(g => {
            const ref = (g.reference_catalogue || '').toLowerCase();
            const nom = (g.nom_descriptif || '').toLowerCase();
            // Astuce : On convertit le JSON en texte pour chercher dedans
            const jsonTxt = (g.caracteristiques ? JSON.stringify(g.caracteristiques).toLowerCase() : '');
            return ref.includes(q) || nom.includes(q) || jsonTxt.includes(q);
        });
    }

    // 3. Tri
    result.sort((a, b) => {
        let valA = (a[state.gabSortBy] || '').toString().toLowerCase();
        let valB = (b[state.gabSortBy] || '').toString().toLowerCase();

        if (valA < valB) return state.gabSortAsc ? -1 : 1;
        if (valA > valB) return state.gabSortAsc ? 1 : -1;
        return 0;
    });

    state.filteredGabarits = result;
    renderGabarits();
    
    // Animation des flèches de tri
    document.getElementById('table-gabarits-body').closest('table').querySelectorAll('.sort-icon').forEach(icon => icon.style.opacity = '0');
    const activeIcon = document.getElementById(`icon-sort-gab-${state.gabSortBy}`);
    if(activeIcon) {
        activeIcon.style.opacity = '1';
        activeIcon.className = state.gabSortAsc ? "fr-icon-arrow-up-s-line sort-icon" : "fr-icon-arrow-down-s-line sort-icon";
    }
}

function renderGabarits() {
    const tbody = document.getElementById('table-gabarits-body'); 
    tbody.innerHTML = '';
    
    state.filteredGabarits.forEach(gab => {
        const safeRef = escapeHTML(gab.reference_catalogue);
        const safeCat = escapeHTML(gab.categorie);
        const safeNom = escapeHTML(gab.nom_descriptif);

        const formattedJson = Object.entries(gab.caracteristiques || {})
            .map(([k, v]) => `<span style="color:var(--text-action-high-blue-france)">"${escapeHTML(k)}"</span>: "${escapeHTML(v)}"`)
            .join(',<br>');

        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${safeRef}</td>
            <td><p class="fr-badge fr-badge--info fr-badge--sm fr-mb-0">${safeCat}</p></td>
            <td>${safeNom}</td>
            <td class="fr-text--xs" style="font-family: monospace; padding: 0.5rem; background: var(--background-alt-grey); border-radius: 4px;">{<br>${formattedJson}<br>}</td>
            <td><button onclick="editGabarit(${gab.id})" class="fr-btn fr-btn--secondary fr-btn--sm">Éditer</button></td>
        </tr>`;
    });
}

function addJsonRow(key = "", val = "") {
    const row = document.createElement('div'); row.className = 'json-builder-row';
    row.innerHTML = `<div class="fr-input-group"><label class="fr-label">Attribut</label><input class="fr-input json-key" type="text" placeholder="couleur" value="${key}"></div><div class="fr-input-group"><label class="fr-label">Valeur</label><input class="fr-input json-val" type="text" placeholder="noir" value="${val}"></div><button type="button" class="fr-btn fr-btn--tertiary-no-outline fr-icon-delete-line" onclick="this.parentElement.remove()"></button>`;
    document.getElementById('json-builder').appendChild(row);
}

function openCreateGabarit() {
    document.getElementById('edit-gab-id').value = "";
    document.getElementById('new-gab-ref').value = "";
    document.getElementById('new-gab-cat').value = "";
    document.getElementById('new-gab-nom').value = "";
    document.getElementById('json-builder').innerHTML = "";
    document.getElementById('gab-form-title').innerText = "Créer un nouveau Modèle";
    document.getElementById('btn-delete-gab').style.display = 'none';
    showSubView('view-gabarits-form', 'panel-gabarits');
}

function editGabarit(id) {
    const gab = state.maps.g.get(id); if(!gab) return;
    document.getElementById('edit-gab-id').value = gab.id;
    document.getElementById('new-gab-ref').value = gab.reference_catalogue;
    document.getElementById('new-gab-cat').value = gab.categorie;
    document.getElementById('new-gab-nom').value = gab.nom_descriptif;
    
    const builder = document.getElementById('json-builder');
    builder.innerHTML = '';
    if(gab.caracteristiques) { Object.entries(gab.caracteristiques).forEach(([k, v]) => addJsonRow(k, v)); }
    
    document.getElementById('gab-form-title').innerText = "Modifier le Modèle";
    document.getElementById('btn-delete-gab').style.display = 'inline-flex';
    showSubView('view-gabarits-form', 'panel-gabarits');
}

async function saveGabarit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-gab-id').value;
    const caracteristiques = {};
    document.querySelectorAll('.json-builder-row').forEach(row => { 
        const key = row.querySelector('.json-key').value.trim(); 
        const val = row.querySelector('.json-val').value.trim(); 
        if(key && val) caracteristiques[key.replace(/\s+/g, '_').toLowerCase()] = val; 
    });

    const payload = {
        reference_catalogue: document.getElementById('new-gab-ref').value.trim(),
        categorie: document.getElementById('new-gab-cat').value,
        nom_descriptif: document.getElementById('new-gab-nom').value.trim(),
        caracteristiques: caracteristiques
    };

    try {
        const url = id ? `${API_URL}/gabarits?id=eq.${id}` : `${API_URL}/gabarits`;
        const method = id ? 'PATCH' : 'POST';
        await apiFetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        showAlert("Succès", "Modèle sauvegardé dans le catalogue", "success");
        await loadData();
        showSubView('view-gabarits-list', 'panel-gabarits');
    } catch (err) { showAlert("Erreur", "Impossible de sauvegarder", "error"); }
}

async function deleteGabarit() {
    const id = document.getElementById('edit-gab-id').value;
    if(!confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;
    
    try {
        const res = await apiFetch(`${API_URL}/gabarits?id=eq.${id}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) {
            const err = await res.json().catch(()=>({}));
            if(err.code === '23503') throw new Error("Impossible : Des équipements de l'inventaire utilisent actuellement ce modèle.");
            throw new Error("Échec de la suppression");
        }
        showAlert("Succès", "Modèle retiré du catalogue", "success");
        await loadData();
        showSubView('view-gabarits-list', 'panel-gabarits');
    } catch (err) { showAlert("Action refusée", err.message, "error"); }
}

// ============================================================================
// GESTION DES UTILISATEURS (ADMINISTRATION)
// ============================================================================
async function loadUsers() {
    try {
        const res = await apiFetch(`${API_URL}/utilisateurs`, { headers: getHeaders() });
        if (!res.ok) throw new Error("Accès refusé ou table introuvable.");
        state.utilisateurs = await res.json();
        renderUsers();
    } catch (e) { console.error("Erreur admin:", e); }
}

function toggleUserSort(columnName) {
    if (state.userSortBy === columnName) { state.userSortAsc = !state.userSortAsc; }
    else { state.userSortBy = columnName; state.userSortAsc = true; }
    state.userPage = 1; // Retour à la page 1 lors d'un tri
    renderUsers();
}

function renderUsers() {
    const tbody = document.getElementById('table-users-body');
    tbody.innerHTML = '';

    const sortedUsers = [...state.utilisateurs].sort((a, b) => {
        let valA = (a[state.userSortBy] || '').toLowerCase();
        let valB = (b[state.userSortBy] || '').toLowerCase();
        return state.userSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    // --- LOGIQUE DE PAGINATION ---
    const totalPages = Math.ceil(sortedUsers.length / 50) || 1;
    const startIndex = (state.userPage - 1) * 50;
    const paginatedUsers = sortedUsers.slice(startIndex, startIndex + 50);

    paginatedUsers.forEach(user => {
        const badgeRole = user.role === 'administrateur' 
            ? `<span class="fr-badge fr-badge--error">Administrateur</span>` 
            : `<span class="fr-badge fr-badge--info">Agent</span>`;
            
        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${escapeHTML(user.email)}</td>
            <td>${badgeRole}</td>
            <td>
                <button onclick="resetUserPassword('${user.email}')" class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-lock-unlock-line fr-mr-1w" title="Réinitialiser"></button>
                <button onclick="deleteUser('${user.email}')" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-delete-line" style="color: var(--text-default-error);" title="Supprimer"></button>
            </td>
        </tr>`;
    });
    
    updateAdminSortUI('user', state.userSortBy, state.userSortAsc);
    
    // --- MISE À JOUR DES BOUTONS ---
    document.getElementById('page-info-user').innerText = `Page ${state.userPage} sur ${totalPages}`;
    document.getElementById('btn-prev-user').disabled = (state.userPage === 1);
    document.getElementById('btn-next-user').disabled = (state.userPage >= totalPages);
}


function openCreateUser() {
    document.getElementById('new-user-email').value = '';
    document.getElementById('new-user-role').value = '';
    document.getElementById('new-user-pwd').value = Math.random().toString(36).slice(-8) + "A1!"; 
    showSubView('view-users-form', 'panel-admin');
}

async function saveUser(e) {
    e.preventDefault();
    const payload = {
        _email: document.getElementById('new-user-email').value,
        _password: document.getElementById('new-user-pwd').value,
        _role: document.getElementById('new-user-role').value
    };

    try {
        const res = await apiFetch(`${API_URL}/rpc/creer_utilisateur`, { 
            method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) 
        });
        if (!res.ok) throw new Error("Impossible de créer l'utilisateur (l'email existe peut-être déjà).");
        
        showAlert("Succès", "Utilisateur créé avec succès.", "success");
        await loadUsers();
        showSubView('view-users-list', 'panel-admin');
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}


async function deleteUser(email) {
    if(!confirm(`Êtes-vous sûr de vouloir révoquer l'accès pour ${email} ?`)) return;
    try {
        const res = await apiFetch(`${API_URL}/utilisateurs?email=eq.${email}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) throw new Error("Échec de la suppression.");
        showAlert("Succès", "Le compte a été supprimé.", "success");
        await loadUsers();
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

async function resetUserPassword(email) {
    const nouveauMdp = prompt(`Entrez le nouveau mot de passe pour ${email} :`);
    if (!nouveauMdp) return; 

    try {
        const res = await apiFetch(`${API_URL}/rpc/reinitialiser_mdp`, { 
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ _email: email, _new_password: nouveauMdp }) 
        });
        if(!res.ok) throw new Error("Échec de la réinitialisation.");
        showAlert("Succès", `Mot de passe mis à jour pour ${email}.`, "success");
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}







// ============================================================================
// EXPORTATION CSV
// Génère un fichier compatible Excel (FR) avec les équipements visibles.
// ============================================================================

// ============================================================================
// EXPORTATION CSV (Version optimisée pour la pagination)
// ============================================================================
async function exportToCSV() {
    // 1. Préparation des filtres (identique à applyFiltersAndSort)
    let params = new URLSearchParams();
    if (state.filterGabarit) params.append('gabarit_id', `eq.${state.filterGabarit}`);
    if (state.filterUa) params.append('code_sages', `eq.${state.filterUa}`);
    if (state.filterStatut) params.append('statut', `eq.${state.filterStatut}`);
    
    if (state.query) {
        params.append('or', `(id_metier.ilike.*${state.query}*,remarques.ilike.*${state.query}*)`);
    }

    // On conserve le tri choisi par l'utilisateur
    const orderDir = state.sortAsc ? 'asc' : 'desc';
    params.append('order', `${state.sortBy}.${orderDir}`);

    try {
        showAlert("Export", "Récupération des données intégrales...", "info");

        // 2. Appel API SANS header "Range" pour obtenir TOUS les résultats filtrés
        const res = await apiFetch(`${API_URL}/mobiliers?${params.toString()}`, {
            headers: getHeaders() 
        });

        if (!res.ok) throw new Error("Erreur lors de la récupération des données d'export.");
        
        const allData = await res.json();

        if (allData.length === 0) {
            showAlert("Export impossible", "Aucune donnée ne correspond à vos filtres.", "warning");
            return;
        }

        // 3. Génération du CSV avec les données complètes
        const headers = ["ID Métier", "Modèle", "Catégorie", "Affectation", "Lieu", "Statut", "Remarques"];
        
        const rows = allData.map(mob => {
            const gab = state.maps.g.get(mob.gabarit_id) || {};
            const ua = state.maps.s.get(mob.code_sages) || {};
            const lieu = state.maps.l.get(mob.lieu_id) || {};
            
            return [
                mob.id_metier,
                gab.nom_descriptif || 'Inconnu',
                gab.categorie || 'Autre',
                ua.libelle || mob.code_sages,
                lieu.nom || 'Inconnu',
                mob.statut,
                (mob.remarques || '').replace(/(\r\n|\n|\r|;)/gm, " ") // Nettoyage CSV
            ];
        });

        // Construction du contenu (BOM UTF-8 pour Excel FR)
        let csvContent = "\ufeff" + headers.join(";") + "\n";
        rows.forEach(row => {
            csvContent += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(";") + "\n";
        });

        // 4. Déclenchement du téléchargement
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const date = new Date().toISOString().split('T')[0];

        link.setAttribute("href", url);
        link.setAttribute("download", `TRACE_Export_Complet_${date}.csv`);
        link.click();
        URL.revokeObjectURL(url);
        
        showAlert("Succès", `Export de ${allData.length} lignes terminé.`, "success");

    } catch (err) {
        showAlert("Erreur Export", err.message, "error");
    }
}

// ============================================================================
// GESTION DES RÉFÉRENTIELS (UA ET LIEUX)
// ============================================================================

// --- STRUCTURES (UA) ---
function toggleUASort(columnName) {
    if (state.uaSortBy === columnName) { state.uaSortAsc = !state.uaSortAsc; }
    else { state.uaSortBy = columnName; state.uaSortAsc = true; }
    state.uaPage = 1; 
    renderStructures();
}

function renderStructures() {
    const tbody = document.getElementById('table-ua-body');
    tbody.innerHTML = '';

    const sortedUA = [...state.structures].sort((a, b) => {
        let valA = (a[state.uaSortBy] || '').toLowerCase();
        let valB = (b[state.uaSortBy] || '').toLowerCase();
        return state.uaSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    const totalPages = Math.ceil(sortedUA.length / 50) || 1;
    const startIndex = (state.uaPage - 1) * 50;
    const paginatedUA = sortedUA.slice(startIndex, startIndex + 50);

    paginatedUA.forEach(ua => {
        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${escapeHTML(ua.code_sages)}</td>
            <td>${escapeHTML(ua.libelle)}</td>
            <td><button onclick="openEditUA('${ua.code_sages}')" class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line"></button></td>
        </tr>`;
    });
    
    updateAdminSortUI('ua', state.uaSortBy, state.uaSortAsc);
    document.getElementById('page-info-ua').innerText = `Page ${state.uaPage} sur ${totalPages}`;
    document.getElementById('btn-prev-ua').disabled = (state.uaPage === 1);
    document.getElementById('btn-next-ua').disabled = (state.uaPage >= totalPages);
}


function openEditUA(code) {
    const ua = code ? state.structures.find(s => s.code_sages === code) : { code_sages: '', libelle: '' };
    document.getElementById('ua-is-new').value = code ? "0" : "1";
    document.getElementById('ua-code').value = ua.code_sages;
    document.getElementById('ua-code').readOnly = !!code;
    document.getElementById('ua-libelle').value = ua.libelle;
    document.getElementById('ua-form-title').innerText = code ? "Modifier le Service" : "Nouveau Service";
    document.getElementById('btn-del-ua').style.display = code ? "inline-flex" : "none";
    showSubView('view-ua-form', 'panel-admin');
}

async function saveUA(e) {
    e.preventDefault();
    const isNew = document.getElementById('ua-is-new').value === "1";
    const code = document.getElementById('ua-code').value;
    const payload = { code_sages: code, libelle: document.getElementById('ua-libelle').value };

    try {
        const url = isNew ? `${API_URL}/structures` : `${API_URL}/structures?code_sages=eq.${code}`;
        const method = isNew ? 'POST' : 'PATCH';
        const res = await apiFetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        if(!res.ok) throw new Error("Erreur de sauvegarde");
        showAlert("Succès", "Référentiel UA mis à jour", "success");
        await loadData(); // Recharge tout et rafraîchit les selects
        renderStructures();
        showSubView('view-ua-list', 'panel-admin');
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

async function deleteUA() {
    const code = document.getElementById('ua-code').value;
    if(!confirm("Supprimer ce service ? Cela échouera si des équipements y sont rattachés.")) return;
    try {
        const res = await apiFetch(`${API_URL}/structures?code_sages=eq.${code}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) throw new Error("Impossible de supprimer (UA utilisée)");
        await loadData();
        renderStructures();
        showSubView('view-ua-list', 'panel-admin');
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

// --- LIEUX PHYSIQUES ---

// Affiche la liste des lieux dans le tableau d'administration 
function toggleLieuSort(columnName) {
    if (state.lieuSortBy === columnName) { state.lieuSortAsc = !state.lieuSortAsc; }
    else { state.lieuSortBy = columnName; state.lieuSortAsc = true; }
    state.lieuPage = 1;
    renderLieux();
}

function renderLieux() {
    const tbody = document.getElementById('table-lieux-body');
    tbody.innerHTML = '';

    const sortedLieux = [...state.lieux].sort((a, b) => {
        let valA = (a[state.lieuSortBy] || '').toLowerCase();
        let valB = (b[state.lieuSortBy] || '').toLowerCase();
        return state.lieuSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    const totalPages = Math.ceil(sortedLieux.length / 50) || 1;
    const startIndex = (state.lieuPage - 1) * 50;
    const paginatedLieux = sortedLieux.slice(startIndex, startIndex + 50);

    paginatedLieux.forEach(l => {
        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${escapeHTML(l.nom)}</td>
            <td><button onclick="openEditLieu(${l.id})" class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-edit-line"></button></td>
        </tr>`;
    });
    
    updateAdminSortUI('lieu', state.lieuSortBy, state.lieuSortAsc);
    document.getElementById('page-info-lieu').innerText = `Page ${state.lieuPage} sur ${totalPages}`;
    document.getElementById('btn-prev-lieu').disabled = (state.lieuPage === 1);
    document.getElementById('btn-next-lieu').disabled = (state.lieuPage >= totalPages);
}

function updateAdminSortUI(prefix, sortBy, isAsc) {
    // On nettoie toutes les icônes du tableau concerné
    document.querySelectorAll(`[id^="icon-sort-${prefix}-"]`).forEach(icon => icon.style.opacity = '0');
    
    // On affiche l'icône active
    const activeIcon = document.getElementById(`icon-sort-${prefix}-${sortBy}`);
    if (activeIcon) {
        activeIcon.style.opacity = '1';
        activeIcon.className = isAsc ? "fr-icon-arrow-up-s-line sort-icon" : "fr-icon-arrow-down-s-line sort-icon";
    }
}

// Ouvre le formulaire en mode création (id=null) ou édition 
function openEditLieu(id) {
    const lieu = id ? state.lieux.find(l => l.id === id) : { id: '', nom: '' };
    
    document.getElementById('lieu-id').value = lieu.id;
    document.getElementById('lieu-nom').value = lieu.nom;
    
    document.getElementById('lieu-form-title').innerText = id ? "Modifier le Lieu" : "Nouveau Lieu";
    document.getElementById('btn-del-lieu').style.display = id ? "inline-flex" : "none";
    
    showSubView('view-lieu-form', 'panel-admin');
}

// Enregistre les modifications en base de données
async function saveLieu(e) {
    e.preventDefault();
    const id = document.getElementById('lieu-id').value;
    const payload = { nom: document.getElementById('lieu-nom').value.trim() };

    try {
        const url = id ? `${API_URL}/lieux?id=eq.${id}` : `${API_URL}/lieux`;
        const method = id ? 'PATCH' : 'POST';
        
        const res = await apiFetch(url, { 
            method, 
            headers: getHeaders(), 
            body: JSON.stringify(payload) 
        });
        
        if(!res.ok) throw new Error("Erreur lors de la sauvegarde du lieu.");
        
        showAlert("Succès", "Référentiel des lieux mis à jour.", "success");
        await loadData(); // Recharge le state global et les maps
        renderLieux();
        showSubView('view-lieux-list', 'panel-admin');
    } catch (err) { 
        showAlert("Erreur", err.message, "error"); 
    }
}

// Supprime un lieu si aucun mobilier n'y est rattaché
async function deleteLieu() {
    const id = document.getElementById('lieu-id').value;
    if(!confirm("Supprimer ce lieu ? Cette action est impossible si des équipements y sont localisés.")) return;
    
    try {
        const res = await apiFetch(`${API_URL}/lieux?id=eq.${id}`, { 
            method: 'DELETE', 
            headers: getHeaders() 
        });
        
        if(!res.ok) throw new Error("Impossible de supprimer : ce lieu est actuellement utilisé dans l'inventaire.");
        
        showAlert("Succès", "Lieu retiré du référentiel.", "success");
        await loadData();
        renderLieux();
        showSubView('view-lieux-list', 'panel-admin');
    } catch (err) { 
        showAlert("Action refusée", err.message, "error"); 
    }
}

// ============================================================================
// MISE AU REBUS
// ============================================================================

async function loadAppConfig() {
    try {
        // MODIFICATION : Utilisation de './' et d'un paramètre nocache
        const res = await fetch('./config.ini?nocache=' + new Date().getTime());
        if (res.ok) {
            const text = await res.text();
            const lines = text.split(/\r?\n/);
            lines.forEach(line => {
                if (line.includes('=') && !line.startsWith(';') && !line.startsWith('[')) {
                    const parts = line.split('=');
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
                    
                    if (key === 'nom_administration') state.config.administration = value;
                    if (key === 'nom_direction') state.config.direction = value;
                }
            });
        }
    } catch (e) {
        console.warn("Fichier config.ini introuvable, utilisation des valeurs par défaut.");
    }
}


async function processMassDelete() {
    const fileInput = document.getElementById('rebut-file-upload');
    if (!fileInput.files[0]) {
        showAlert("Attention", "Veuillez sélectionner un fichier .txt", "warning");
        return;
    }

    if (!confirm("ATTENTION : Cette action est irréversible. Les équipements listés seront supprimés et le PV sera généré. Continuer ?")) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
        const content = e.target.result;
        // Extraction et nettoyage des IDs
        const ids = content.split(/\r?\n/).map(id => id.trim().toUpperCase()).filter(id => /^MOB-\d{6}$/.test(id));

        if (ids.length === 0) {
            showAlert("Erreur", "Aucun identifiant valide trouvé dans le fichier.", "error");
            return;
        }

        showAlert("Traitement en cours", `Analyse et suppression de ${ids.length} identifiants...`, "info");

        try {
            // --- LA SOLUTION EST ICI : PARAMÈTRE DE DÉCOUPAGE ---
            const CHUNK_SIZE = 100; 
            let itemsToRebut = [];

            // 1. Récupération des données par lots (Chunks)
            for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                const chunk = ids.slice(i, i + CHUNK_SIZE);
                const idList = `(${chunk.join(',')})`;
                
                const searchRes = await apiFetch(`${API_URL}/vue_mobiliers_recherche?id_metier=in.${idList}`, {
                    headers: getHeaders()
                });
                
                if (searchRes.ok) {
                    const data = await searchRes.json();
                    itemsToRebut = itemsToRebut.concat(data); // On assemble les résultats au fur et à mesure
                }
            }

            if (itemsToRebut.length === 0) {
                showAlert("Erreur", "Aucun des équipements listés n'a été trouvé en base.", "error");
                return;
            }

            // On extrait uniquement les IDs qui existent VRAIMENT en base
            const validIds = itemsToRebut.map(item => item.id_metier);

            // 2. Suppression physique par lots (Chunks)
            for (let i = 0; i < validIds.length; i += CHUNK_SIZE) {
                const chunk = validIds.slice(i, i + CHUNK_SIZE);
                const idList = `(${chunk.join(',')})`;
                
                const deleteRes = await apiFetch(`${API_URL}/mobiliers?id_metier=in.${idList}`, {
                    method: 'DELETE',
                    headers: getHeaders()
                });

                if (!deleteRes.ok) throw new Error("Erreur serveur lors de la suppression d'un lot.");
            }

            // 3. Génération du Procès-verbal PDF avec les données complètes
            if (typeof generateRebutPDF === "function") {
                generateRebutPDF(itemsToRebut);
            }

            showAlert("Succès", `${validIds.length} équipements supprimés définitivement. Le PV a été généré.`, "success");
            await loadData();
            showSubView('view-users-list', 'panel-admin');

        } catch (err) {
            showAlert("Erreur critique", err.message, "error");
        }
    };
    
    reader.readAsText(file);
}

// MODIFICATION : La fonction devient asynchrone (async) pour avoir le temps de charger l'image
async function generateRebutPDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dateToday = new Date().toLocaleDateString('fr-FR');
    const filenameDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // =======================================================
    // EN-TÊTE OFFICIEL TYPE DSFR (AVEC MARIANNE)
    // =======================================================
    
    try {
        // Chargement de l'icône Marianne présente dans votre dossier DSFR
        const img = new Image();
        img.src = 'dsfr-v1.14.3/dist/favicon/apple-touch-icon.png'; 
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        
        // Conversion de l'image pour jsPDF
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL('image/png');
        
        // Impression du logo sur le PDF (X: 20, Y: 15, Largeur: 14, Hauteur: 14)
        doc.addImage(imgData, 'PNG', 20, 15, 14, 14);
    } catch (e) {
        console.warn("Impossible de charger le logo Marianne. L'en-tête sera uniquement textuel.");
    }

    // 1. Textes du Bloc Marque (décalés vers la droite pour laisser la place au logo)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("RÉPUBLIQUE\nFRANÇAISE", 38, 20); // X passe de 20 à 38
    
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.text("Liberté\nÉgalité\nFraternité", 38, 31);

    // 2. Nom de l'Administration et Direction
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(state.config.administration.toUpperCase(), 75, 20, { maxWidth: 120 }); // X passe de 60 à 75
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(state.config.direction, 75, 28, { maxWidth: 120 });

    // 3. Ligne de séparation "Bleu France"
    doc.setDrawColor(0, 0, 145); 
    doc.setLineWidth(0.5);
    doc.line(20, 45, 190, 45);

    // =======================================================
    // CORPS DU DOCUMENT
    // =======================================================

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 145); 
    doc.text("ANNEXE PROCÈS-VERBAL CESSION", 105, 56, { align: 'center' });
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Référence document : TRACE-REBUT-${filenameDate}`, 20, 70);
    doc.text(`Date d'édition : ${dateToday}`, 20, 76);
    doc.text(`Équipements traités : ${data.length} unité(s)`, 20, 82);

    const tableBody = data.map(item => [
        item.id_metier,
        item.gabarit_nom,
        item.structure_libelle,
        item.lieu_nom,
        (item.remarques || '').substring(0, 50) 
    ]);

    doc.autoTable({
        startY: 90,
        head: [['ID Métier', 'Modèle', 'Service Affectation', 'Lieu', 'Observations']],
        body: tableBody,
        theme: 'grid',
        headStyles: { 
            fillColor: [0, 0, 145], 
            textColor: [255, 255, 255],
            fontStyle: 'bold'
        },
        styles: { fontSize: 8, font: 'helvetica' },
        alternateRowStyles: { fillColor: [246, 246, 246] }
    });

    // =======================================================
    // ZONE DE SIGNATURE
    // =======================================================
    const finalY = doc.lastAutoTable.finalY + 20;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Cachet du service et signature de l'autorité compétente :", 100, finalY);
    
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(100, finalY + 5, 90, 35); 

    doc.save(`PVSORTIETRACE_${filenameDate}.pdf`);
}


// ============================================================================
// JOURNAL D'AUDIT (TRAÇABILITÉ)
// ============================================================================
async function loadAuditLogs() {
    try {
        // On récupère les 500 dernières actions, classées de la plus récente à la plus ancienne
        const res = await apiFetch(`${API_URL}/audit_logs?order=date_action.desc&limit=500`, { headers: getHeaders() });
        if (!res.ok) throw new Error("Accès refusé au journal.");
        state.auditLogs = await res.json();
        renderAuditLogs();
    } catch (e) { console.error("Erreur journal d'audit:", e); }
}

function renderAuditLogs() {
    const tbody = document.getElementById('table-audit-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(state.auditLogs.length / 50) || 1;
    const startIndex = (state.auditPage - 1) * 50;
    const paginatedLogs = state.auditLogs.slice(startIndex, startIndex + 50);

    paginatedLogs.forEach(log => {
        const dateObj = new Date(log.date_action);
        const dateStr = dateObj.toLocaleDateString('fr-FR') + ' à ' + dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute:'2-digit' });
        
        let badgeColor = 'info';
        if (log.action === 'CRÉATION') badgeColor = 'success';
        if (log.action === 'SUPPRESSION') badgeColor = 'error';

        tbody.innerHTML += `<tr>
            <td class="fr-text--sm">${dateStr}</td>
            <td class="fr-text--sm fr-text--bold">${escapeHTML(log.utilisateur)}</td>
            <td><span class="fr-badge fr-badge--${badgeColor} fr-badge--sm">${escapeHTML(log.action)}</span></td>
            <td class="fr-text--sm" style="font-family: monospace;">${escapeHTML(log.id_metier)}</td>
            <td class="fr-text--xs">${escapeHTML(log.details)}</td>
        </tr>`;
    });
    
    document.getElementById('page-info-audit').innerText = `Page ${state.auditPage} sur ${totalPages}`;
    document.getElementById('btn-prev-audit').disabled = (state.auditPage === 1);
    document.getElementById('btn-next-audit').disabled = (state.auditPage >= totalPages);
}


// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => { 
    // NOUVEAU : On charge la configuration avant toute chose
    await loadAppConfig();
	 
    if (sessionStorage.getItem('trace_jwt')) { 
        document.getElementById('view-login').classList.remove('active'); 
        document.getElementById('view-app').classList.add('active'); 
        document.getElementById('logout-btn-container').style.display = 'block';
        
        loadData().then(() => verifierDroitsAdmin()); 
    } 
});
