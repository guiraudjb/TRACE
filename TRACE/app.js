// CONFIGURATION
const API_URL = '/api';

let state = {
    mobiliers: [], gabarits: [], structures: [], lieux: [], utilisateurs: [],
    maps: { g: new Map(), s: new Map(), l: new Map() },
    query: '', filterGabarit: '', filterUa: '', filterStatut: '',
    sortBy: 'id_metier', sortAsc: true, currentPage: 1, itemsPerPage: 50, filteredData: []
};

function getHeaders() { 
    return { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${sessionStorage.getItem('trace_jwt')}`, 
        'Prefer': 'return=representation' 
    }; 
}

// ============================================================================
// AUTHENTIFICATION & SÉCURITÉ
// ============================================================================
async function authentifier(e) {
    e.preventDefault();
    try {
        const res = await fetch(`${API_URL}/rpc/login`, {
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
    return true;
}

// ============================================================================
// CHARGEMENT DONNÉES ET VUES GLOBALES
// ============================================================================
async function loadData() {
    try {
        const [gRes, sRes, lRes, mRes] = await Promise.all([
            fetch(`${API_URL}/gabarits`, { headers: getHeaders() }),
            fetch(`${API_URL}/structures`, { headers: getHeaders() }),
            fetch(`${API_URL}/lieux`, { headers: getHeaders() }),
            fetch(`${API_URL}/mobiliers`, { headers: getHeaders() })
        ]);
        
        if (!mRes.ok) throw new Error("Session expirée.");

        state.gabarits = await gRes.json(); state.structures = await sRes.json();
        state.lieux = await lRes.json(); state.mobiliers = await mRes.json();

        state.maps.g.clear(); state.gabarits.forEach(g => state.maps.g.set(g.id, g));
        state.maps.s.clear(); state.structures.forEach(s => state.maps.s.set(s.code_sages, s));
        state.maps.l.clear(); state.lieux.forEach(l => state.maps.l.set(l.id, l));

        populateSelectWithData('filter-gabarit', state.gabarits, 'id', 'nom_descriptif', 'Tous les modèles');
        populateSelectWithData('filter-ua', state.structures, 'code_sages', 'libelle', 'Toutes les affectations');

        renderGabarits();
        applyFiltersAndSort();
    } catch (e) { 
        showAlert("Sécurité", e.message, "error"); 
        deconnecter(); 
    }
}

function populateSelectWithData(selectId, dataArray, valueKey, labelKey, firstOptionText) {
    const select = document.getElementById(selectId);
    select.innerHTML = `<option value="" selected>${firstOptionText}</option>`;
    dataArray.forEach(item => { select.innerHTML += `<option value="${item[valueKey]}">${item[labelKey]}</option>`; });
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

// ============================================================================
// MOTEUR DE RECHERCHE, TRI ET FILTRES (MOBILIER)
// ============================================================================
function updateFilters(filterName, value) { 
    state[filterName] = value.toLowerCase().trim(); 
    state.currentPage = 1; 
    applyFiltersAndSort(); 
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

function applyFiltersAndSort() {
    const queryTerms = state.query ? state.query.replace(/\s*:\s*/g, ':').split(/\s+/) : [];

    state.filteredData = state.mobiliers.filter(mob => {
        if (state.filterGabarit && mob.gabarit_id.toString() !== state.filterGabarit) return false;
        if (state.filterUa && mob.code_sages.toLowerCase() !== state.filterUa) return false;
        if (state.filterStatut && mob.statut.toLowerCase() !== state.filterStatut) return false;

        if (queryTerms.length > 0) {
            const gab = state.maps.g.get(mob.gabarit_id);
            const lieu = state.maps.l.get(mob.lieu_id);
            const ua = state.maps.s.get(mob.code_sages);

            let jsonSearchStr = '';
            if (gab && gab.caracteristiques) {
                jsonSearchStr = Object.entries(gab.caracteristiques).map(([k, v]) => `${k}:${v} ${k} ${v}`).join(' ');
            }

            const searchStr = `${mob.id_metier} ${gab?.nom_descriptif} ${gab?.reference_catalogue} ${lieu?.nom} ${ua?.libelle} ${mob.remarques || ''} ${jsonSearchStr}`.toLowerCase();
            for (const term of queryTerms) { if (!searchStr.includes(term)) return false; }
        }
        return true;
    });

    state.filteredData.sort((a, b) => {
        let valA, valB;
        switch(state.sortBy) {
            case 'id_metier': valA = a.id_metier; valB = b.id_metier; break;
            case 'statut': valA = a.statut; valB = b.statut; break;
            case 'gabarit': valA = (state.maps.g.get(a.gabarit_id)?.nom_descriptif || '').toLowerCase(); valB = (state.maps.g.get(b.gabarit_id)?.nom_descriptif || '').toLowerCase(); break;
            case 'code_sages': valA = (state.maps.s.get(a.code_sages)?.libelle || '').toLowerCase(); valB = (state.maps.s.get(b.code_sages)?.libelle || '').toLowerCase(); break;
        }
        if (valA < valB) return state.sortAsc ? -1 : 1; 
        if (valA > valB) return state.sortAsc ? 1 : -1; 
        return 0;
    });

    renderMobilierPage(); 
    updateSortUI();
}

function formatJsonToText(obj) {
    if(!obj || Object.keys(obj).length === 0) return '';
    return Object.entries(obj).map(([k,v]) => `${k}: ${v}`).join(' • ');
}

function renderMobilierPage() {
    const tbody = document.getElementById('table-mobilier-body'); tbody.innerHTML = '';
    const totalItems = state.filteredData.length; 
    const totalPages = Math.ceil(totalItems / state.itemsPerPage) || 1;
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const paginatedItems = state.filteredData.slice(startIndex, startIndex + state.itemsPerPage);

    paginatedItems.forEach(mob => {
        const gab = state.maps.g.get(mob.gabarit_id) || { nom_descriptif: 'Inconnu' };
        const lieu = state.maps.l.get(mob.lieu_id) || { nom: 'Inconnu' };
        const ua = state.maps.s.get(mob.code_sages) || { libelle: 'Inconnu' };

        let badge = `<p class="fr-badge fr-badge--new fr-badge--sm fr-mb-0">En service</p>`;
        if(mob.statut === 'dispo_reemploi') badge = `<p class="fr-badge fr-badge--success fr-badge--sm fr-mb-0">Réemploi</p>`;
        if(mob.statut === 'en_maintenance') badge = `<p class="fr-badge fr-badge--warning fr-badge--sm fr-mb-0">Maintenance</p>`;
        if(mob.statut === 'au_rebut') badge = `<p class="fr-badge fr-badge--error fr-badge--sm fr-mb-0">Au Rebut</p>`;

        tbody.innerHTML += `<tr>
            <td>
                <div class="fr-checkbox-group fr-checkbox-group--sm">
                    <input type="checkbox" class="row-checkbox" value="${mob.uuid}" id="check-${mob.uuid}">
                    <label class="fr-label" for="check-${mob.uuid}"></label>
                </div>
            </td>
            <td><span class="uuid-badge" title="Copier ID" onclick="navigator.clipboard.writeText('${mob.id_metier}')">${mob.id_metier}</span></td>
            <td><span class="fr-text--bold">${gab.nom_descriptif}</span><br><span class="fr-text--xs" style="color:var(--text-mention-grey);">${formatJsonToText(gab.caracteristiques)}</span></td>
            <td class="fr-text--sm">${ua.libelle}<br><span class="fr-text--light">${lieu.nom}</span></td>
            <td>${badge}</td>
            <td><button onclick="editMobilier('${mob.uuid}')" class="fr-btn fr-btn--secondary fr-btn--sm">Fiche</button></td>
        </tr>`;
    });
    
    document.getElementById('select-all').checked = false;
    document.getElementById('results-count').innerText = `${totalItems} équipement(s) trouvé(s)`;
    document.getElementById('page-info').innerText = `Page ${state.currentPage} sur ${totalPages}`;
    document.getElementById('btn-prev').disabled = (state.currentPage === 1); 
    document.getElementById('btn-next').disabled = (state.currentPage === totalPages);
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
    const totalPages = Math.ceil(state.filteredData.length / state.itemsPerPage); 
    state.currentPage += direction; 
    if(state.currentPage < 1) state.currentPage = 1; 
    if(state.currentPage > totalPages) state.currentPage = totalPages; 
    renderMobilierPage(); 
}

// ============================================================================
// CRUD MOBILIER (AVEC BULK INSERT)
// ============================================================================
function calculateNextMobId() {
    let max = 0;
    state.mobiliers.forEach(m => {
        if(m.id_metier && m.id_metier.startsWith('MOB-')) {
            const num = parseInt(m.id_metier.replace('MOB-', ''), 10);
            if(!isNaN(num) && num > max) max = num;
        }
    });
    return 'MOB-' + String(max + 1).padStart(6, '0');
}

function fillSelectOptions(selectId, dataArray, valueKey, labelKey, selectedValue = null) {
    const select = document.getElementById(selectId); 
    select.innerHTML = '<option value="" disabled selected hidden>Sélectionnez...</option>';
    dataArray.forEach(item => { 
        const isSelected = item[valueKey] == selectedValue ? 'selected' : ''; 
        select.innerHTML += `<option value="${item[valueKey]}" ${isSelected}>${item[labelKey]}</option>`; 
    });
}

function openCreateMobilier() {
    document.getElementById('new-mob-id').value = calculateNextMobId();
    document.getElementById('new-mob-quantite').value = 1; // Réinitialise la quantité
    fillSelectOptions('new-mob-gabarit', state.gabarits, 'id', 'nom_descriptif');
    fillSelectOptions('new-mob-ua', state.structures, 'code_sages', 'libelle');
    fillSelectOptions('new-mob-lieu', state.lieux, 'id', 'nom');
    document.getElementById('new-mob-statut').value = 'en_service'; 
    document.getElementById('new-mob-remarques').value = '';
    showSubView('view-mobilier-create', 'panel-mobilier');
}

function editMobilier(uuid) {
    const mob = state.mobiliers.find(m => m.uuid === uuid); if(!mob) return;
    const gab = state.maps.g.get(mob.gabarit_id);
    
    document.getElementById('edit-mob-uuid').value = mob.uuid;
    document.getElementById('edit-mob-id').value = mob.id_metier;
    fillSelectOptions('edit-mob-gabarit', state.gabarits, 'id', 'nom_descriptif', mob.gabarit_id);
    fillSelectOptions('edit-mob-ua', state.structures, 'code_sages', 'libelle', mob.code_sages);
    fillSelectOptions('edit-mob-lieu', state.lieux, 'id', 'nom', mob.lieu_id);
    document.getElementById('edit-mob-statut').value = mob.statut;
    document.getElementById('edit-mob-remarques').value = mob.remarques || '';
    
    document.getElementById('qrcode-container').innerHTML = '';
    new QRCode(document.getElementById('qrcode-container'), { text: mob.id_metier, width: 90, height: 90, correctLevel : QRCode.CorrectLevel.H });
    document.getElementById('qr-label').innerText = mob.id_metier;
    document.getElementById('qr-desc').innerText = gab ? gab.nom_descriptif : 'Mobilier';
    document.querySelectorAll('.print-only').forEach(el => el.style.display = 'block');
    
    showSubView('view-mobilier-detail', 'panel-mobilier');
}

async function saveMobilier(e, mode) {
    e.preventDefault();
    const prefix = mode === 'CREATE' ? 'new' : 'edit';
    const uuid = mode === 'EDIT' ? document.getElementById('edit-mob-uuid').value : null;
    
    // On récupère les valeurs communes
    const gabarit_id = parseInt(document.getElementById(`${prefix}-mob-gabarit`).value);
    const code_sages = document.getElementById(`${prefix}-mob-ua`).value;
    const lieu_id = parseInt(document.getElementById(`${prefix}-mob-lieu`).value);
    const statut = document.getElementById(`${prefix}-mob-statut`).value;
    const remarques = document.getElementById(`${prefix}-mob-remarques`).value;

    try {
        if (mode === 'CREATE') {
            const quantite = parseInt(document.getElementById('new-mob-quantite').value) || 1;
            const payloads = [];

            let maxId = 0;
            state.mobiliers.forEach(m => {
                if(m.id_metier && m.id_metier.startsWith('MOB-')) {
                    const num = parseInt(m.id_metier.replace('MOB-', ''), 10);
                    if(!isNaN(num) && num > maxId) maxId = num;
                }
            });

            for (let i = 0; i < quantite; i++) {
                maxId++;
                payloads.push({
                    id_metier: 'MOB-' + String(maxId).padStart(6, '0'),
                    gabarit_id: gabarit_id,
                    code_sages: code_sages,
                    lieu_id: lieu_id,
                    statut: statut,
                    remarques: remarques
                });
            }

            const res = await fetch(`${API_URL}/mobiliers`, { 
                method: 'POST', 
                headers: getHeaders(), 
                body: JSON.stringify(payloads) 
            });
            
            if(!res.ok) throw new Error("Erreur serveur lors de la création par lot.");
            showAlert("Succès", `${quantite} équipement(s) créé(s) avec succès.`, "success");

        } else {
            const payload = {
                id_metier: document.getElementById('edit-mob-id').value,
                gabarit_id: gabarit_id,
                code_sages: code_sages,
                lieu_id: lieu_id,
                statut: statut,
                remarques: remarques
            };
            const res = await fetch(`${API_URL}/mobiliers?uuid=eq.${uuid}`, { 
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
        const res = await fetch(`${API_URL}/mobiliers?uuid=eq.${uuid}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) throw new Error("Échec de la suppression");
        showAlert("Succès", "Équipement supprimé du registre", "success");
        await loadData();
        showSubView('view-mobilier-list', 'panel-mobilier');
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

// ============================================================================
// IMPRESSION PAR LOT
// ============================================================================
function toggleSelectAll() {
    const isChecked = document.getElementById('select-all').checked;
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = isChecked);
}

function printSelected() {
    const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
    if (checkedBoxes.length === 0) {
        showAlert("Attention", "Veuillez sélectionner au moins un équipement à imprimer.", "warning");
        return;
    }

    const batchArea = document.getElementById('batch-print-area');
    batchArea.innerHTML = ''; 

    checkedBoxes.forEach(box => {
        const mob = state.mobiliers.find(m => m.uuid === box.value);
        if (!mob) return;
        
        const gab = state.maps.g.get(mob.gabarit_id);

        const labelDiv = document.createElement('div');
        labelDiv.className = 'batch-label';
        
        labelDiv.innerHTML = `
            <div class="batch-qr" id="qr-batch-${mob.id_metier}"></div>
            <p>${mob.id_metier}</p>
            <p>${gab ? gab.nom_descriptif : 'Mobilier'}</p>
            <p>DGFIP - TRACE</p>
        `;
        
        batchArea.appendChild(labelDiv);

        new QRCode(document.getElementById(`qr-batch-${mob.id_metier}`), { 
            text: mob.id_metier, 
            width: 90, 
            height: 90, 
            correctLevel : QRCode.CorrectLevel.H 
        });
    });

    document.body.classList.add('mode-batch-print');
    
    setTimeout(() => {
        window.print();
        document.body.classList.remove('mode-batch-print');
    }, 500);
}

// ============================================================================
// RÉAFFECTATION PAR SCAN (DOUCHETTE)
// ============================================================================
function openScanner() {
    fillSelectOptions('scan-target-ua', state.structures, 'code_sages', 'libelle');
    fillSelectOptions('scan-target-lieu', state.lieux, 'id', 'nom');
    document.getElementById('scan-target-statut').value = 'en_service';
    document.getElementById('scanner-input').value = '';
    document.getElementById('scan-log').innerHTML = '';
    showSubView('view-mobilier-scanner', 'panel-mobilier');
    
    // On met le focus automatiquement pour que la douchette puisse écrire direct
    setTimeout(() => document.getElementById('scanner-input').focus(), 100);
}

async function processScan(event) {
    // Une douchette classique simule la touche "Entrée" après avoir lu le code
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const input = document.getElementById('scanner-input');
    const idMetier = input.value.trim().toUpperCase();
    input.value = ''; // Réinitialise l'input pour être prêt pour le prochain scan
    input.focus();

    if (!idMetier) return;

    const logArea = document.getElementById('scan-log');
    const ua = document.getElementById('scan-target-ua').value;
    const lieu = parseInt(document.getElementById('scan-target-lieu').value);
    const statut = document.getElementById('scan-target-statut').value;

    if (!ua || !lieu || !statut) {
        logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">Erreur</span> Cible incomplète.</li>`);
        return;
    }

    // On cherche l'équipement dans le state local
    const mob = state.mobiliers.find(m => m.id_metier === idMetier);
    
    if (!mob) {
        logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${idMetier}</span> Introuvable.</li>`);
        return;
    }

    try {
        const payload = { code_sages: ua, lieu_id: lieu, statut: statut };
        const res = await fetch(`${API_URL}/mobiliers?uuid=eq.${mob.uuid}`, { 
            method: 'PATCH', 
            headers: getHeaders(), 
            body: JSON.stringify(payload) 
        });

        if (!res.ok) throw new Error("Erreur serveur");

        // Mise à jour de l'état local pour ne pas avoir à tout recharger
        mob.code_sages = ua;
        mob.lieu_id = lieu;
        mob.statut = statut;

        const uaLabel = state.maps.s.get(ua)?.libelle || ua;
        logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--success">${idMetier}</span> → ${uaLabel}</li>`);
        
        // On rafraîchit la vue tabulaire en arrière-plan
        applyFiltersAndSort();

    } catch (err) {
        logArea.insertAdjacentHTML('afterbegin', `<li class="fr-mb-1v"><span class="fr-badge fr-badge--error">${idMetier}</span> Échec MAJ.</li>`);
    }
}


// ============================================================================
// CRUD GABARITS (CATALOGUE)
// ============================================================================
function renderGabarits() {
    const tbody = document.getElementById('table-gabarits-body'); tbody.innerHTML = '';
    [...state.gabarits].reverse().forEach(gab => {
        const formattedJson = Object.entries(gab.caracteristiques || {}).map(([k, v]) => `<span style="color:var(--text-action-high-blue-france)">"${k}"</span>: "${v}"`).join(',<br>');
        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${gab.reference_catalogue}</td>
            <td><p class="fr-badge fr-badge--info fr-badge--sm fr-mb-0">${gab.categorie}</p></td>
            <td>${gab.nom_descriptif}</td>
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
        await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(payload) });
        showAlert("Succès", "Modèle sauvegardé dans le catalogue", "success");
        await loadData();
        showSubView('view-gabarits-list', 'panel-gabarits');
    } catch (err) { showAlert("Erreur", "Impossible de sauvegarder", "error"); }
}

async function deleteGabarit() {
    const id = document.getElementById('edit-gab-id').value;
    if(!confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?")) return;
    
    try {
        const res = await fetch(`${API_URL}/gabarits?id=eq.${id}`, { method: 'DELETE', headers: getHeaders() });
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
        const res = await fetch(`${API_URL}/utilisateurs`, { headers: getHeaders() });
        if (!res.ok) throw new Error("Accès refusé ou table introuvable.");
        state.utilisateurs = await res.json();
        renderUsers();
    } catch (e) { console.error("Erreur admin:", e); }
}

function renderUsers() {
    const tbody = document.getElementById('table-users-body');
    tbody.innerHTML = '';
    state.utilisateurs.forEach(user => {
        const badgeRole = user.role === 'administrateur' 
            ? `<span class="fr-badge fr-badge--error">Administrateur</span>` 
            : `<span class="fr-badge fr-badge--info">Agent</span>`;
            
        tbody.innerHTML += `<tr>
            <td class="fr-text--bold">${user.email}</td>
            <td>${badgeRole}</td>
            <td>
                <button onclick="resetUserPassword('${user.email}')" class="fr-btn fr-btn--secondary fr-btn--sm fr-icon-lock-unlock-line fr-mr-1w" title="Réinitialiser le mot de passe"></button>
                <button onclick="deleteUser('${user.email}')" class="fr-btn fr-btn--tertiary-no-outline fr-btn--sm fr-icon-delete-line" style="color: var(--text-default-error);" title="Supprimer le compte"></button>
            </td>
        </tr>`;
    });
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
        const res = await fetch(`${API_URL}/rpc/creer_utilisateur`, { 
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
        const res = await fetch(`${API_URL}/utilisateurs?email=eq.${email}`, { method: 'DELETE', headers: getHeaders() });
        if(!res.ok) throw new Error("Échec de la suppression.");
        showAlert("Succès", "Le compte a été supprimé.", "success");
        await loadUsers();
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

async function resetUserPassword(email) {
    const nouveauMdp = prompt(`Entrez le nouveau mot de passe pour ${email} :`);
    if (!nouveauMdp) return; 

    try {
        const res = await fetch(`${API_URL}/rpc/reinitialiser_mdp`, { 
            method: 'POST', headers: getHeaders(), body: JSON.stringify({ _email: email, _new_password: nouveauMdp }) 
        });
        if(!res.ok) throw new Error("Échec de la réinitialisation.");
        showAlert("Succès", `Mot de passe mis à jour pour ${email}.`, "success");
    } catch (err) { showAlert("Erreur", err.message, "error"); }
}

// ============================================================================
// INIT
// ============================================================================
document.addEventListener('DOMContentLoaded', () => { 
    if (sessionStorage.getItem('trace_jwt')) { 
        document.getElementById('view-login').classList.remove('active'); 
        document.getElementById('view-app').classList.add('active'); 
        document.getElementById('logout-btn-container').style.display = 'block';
        
        loadData().then(() => verifierDroitsAdmin()); 
    } 
});
