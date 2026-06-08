import { store } from '../state.js';
import { escapeHtml, debounce } from '../lib/utils.js';
import { backend } from '../lib/backend.js';
import { modalConfirm, modalPrompt, modalAlert } from '../lib/modal.js';
import { sendRoll, sendD20Check } from './dice.js';
import { portraitUrl, uploadPortrait } from './characters.js';
import { longRestHitDiceRegain } from '../lib/rules.js';
import { openPartyLoot } from './partyloot-ui.js';
import { openQuests } from './quests-ui.js';
import { logCombat } from './initiative.js';
import { openActionCard } from '../lib/actioncard.js';
import { postCard } from '../lib/chatpost.js';
import { renderMarkdown } from '../lib/markdown.js';
import { showToast } from '../lib/toast.js';

/** Description effective d'un sort : note rapide saisie, sinon texte du compendium
 *  (lien entryId prioritaire, sinon rapprochement par nom). */
function effSpellDesc(s) {
  if (s.desc && s.desc.trim()) return s.desc;
  const list = store.get().compendium || [];
  const norm = (x) => String(x || '').normalize('NFC').trim().toLowerCase().replace(/\s*\([^)]*\)\s*$/, '');
  let e = s.entryId ? list.find((x) => x.id === s.entryId) : null;
  if (!e) e = list.find((x) => x.kind === 'spell' && norm(x.name) === norm(s.nm));
  return e?.data?.desc || '';
}
import {
  ABILITIES,
  SKILLS,
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  canEdit,
  loadCharacters,
  updateCharacter,
  createCharacter,
  importCharacter,
  renameCharacter,
  replaceCharacterData,
  classResources,
  resolveNotation,
  deleteCharacter,
  assignOwner,
  subscribeCharacters,
} from './characters.js';
import { parseStatblockActions } from '../lib/statblock.js';

/**
 * UI des fiches de personnage : liste à gauche, fiche détaillée à droite.
 * Édition optimiste ; les champs ne sont ré-rendus depuis le store que si
 * l'utilisateur n'est pas en train de saisir (préserve le focus clavier).
 */

let renderedCharId = null;
let renderedSig = ''; // signature du perso rendu (évite les rebuilds inutiles)
let sheetTab = 'stats'; // onglet actif de la fiche (style Foundry)
const nameSavers = new Map();

function sheetInitials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
}

export async function mountCharacters(container) {
  container.innerHTML = `
    <div class="char-wrap">
      <aside class="char-list" id="char-list"></aside>
      <main class="char-sheet" id="char-sheet"></main>
    </div>
  `;

  await loadCharacters();
  const unsubRealtime = subscribeCharacters();
  const unsubStore = store.subscribe(onStoreChange);
  renderList();
  renderSheet(true);

  // Glisser une entrée du compendium (sort/objet) sur la fiche active.
  const DND_ENTRY = 'application/x-vaultmj-entry';
  const sheet = container.querySelector('#char-sheet');
  sheet?.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types?.includes(DND_ENTRY)) {
      e.preventDefault();
      sheet.classList.add('drop-hover');
    }
  });
  sheet?.addEventListener('dragleave', (e) => {
    if (e.target === sheet) sheet.classList.remove('drop-hover');
  });
  sheet?.addEventListener('drop', async (e) => {
    sheet.classList.remove('drop-hover');
    const raw = e.dataTransfer?.getData(DND_ENTRY);
    if (!raw) return;
    e.preventDefault();
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return;
    }
    const cid = store.get().activeChar;
    const c = store.get().characters.find((x) => x.id === cid);
    if (!c) {
      showToast('Ouvre d’abord une fiche.', { timeout: 2000 });
      return;
    }
    const entry = store.get().compendium.find((x) => x.id === p.id) || p;
    if (p.kind === 'spell') {
      const lvl = entry.data?.level ?? 0;
      // On lie au compendium (entryId) sans copier le markdown dans le champ rapide
      // (il s'afficherait mal sur une ligne) ; la carte d'action montre le texte
      // formaté. Dédoublonnage par nom.
      const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
      const cur = [...(c.data.spells || [])];
      const idx = cur.findIndex((s) => norm(s.nm) === norm(entry.name));
      if (idx >= 0) cur[idx] = { ...cur[idx], lvl, entryId: entry.id };
      else cur.push({ nm: entry.name, lvl, entryId: entry.id });
      updateCharacter(cid, { spells: cur });
      showToast(idx >= 0 ? `✨ ${entry.name} déjà présent — lien mis à jour` : `✨ ${entry.name} → ${c.name}`, { timeout: 1800 });
    } else if (p.kind === 'item') {
      const note = String(entry.data?.desc || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
      updateCharacter(cid, { inv: [...(c.data.inv || []), { nm: entry.name, qty: 1, wt: '', note }] });
      showToast(`🎒 ${entry.name} → ${c.name}`, { timeout: 1800 });
    } else {
      showToast('Seuls les sorts et objets s’ajoutent à une fiche.', { timeout: 2200 });
    }
  });

  return () => {
    unsubStore();
    unsubRealtime();
    renderedCharId = null;
    _charImport?.remove();
    _charImport = null;
  };
}

function onStoreChange() {
  renderList();
  const sheet = document.getElementById('char-sheet');
  if (!sheet) return;
  const { activeChar, characters } = store.get();
  const switching = activeChar !== renderedCharId;
  if (switching) {
    renderSheet(true);
    return;
  }
  // Ne reconstruire la fiche QUE si les données du perso affiché ont changé.
  // Les événements temps réel des autres modules (chat, carte, notifications…)
  // ne doivent pas reconstruire la fiche — sinon ils « volent » les clics.
  const cur = characters.find((c) => c.id === activeChar);
  const sig = cur ? JSON.stringify(cur) : '';
  if (sig === renderedSig) return;
  // …et jamais pendant une saisie texte active (pour ne pas perdre le curseur).
  const ae = document.activeElement;
  const typing =
    sheet.contains(ae) &&
    (ae.tagName === 'TEXTAREA' || (ae.tagName === 'INPUT' && ae.type !== 'checkbox'));
  if (!typing) renderSheet(false);
}

/* ── Liste ────────────────────────────────────────────────── */

function renderList() {
  const el = document.getElementById('char-list');
  if (!el) return;
  const { characters, activeChar, isDM, user } = store.get();

  const items = characters
    .map((c) => {
      const d = c.data || {};
      const mine = c.owner_id === user?.id;
      const hpPct = d.hpMax ? Math.max(0, Math.min(100, (d.hp / d.hpMax) * 100)) : 0;
      return `
        <button class="char-card ${c.id === activeChar ? 'active' : ''}" data-char="${c.id}">
          <div class="char-card-top">
            <strong>${escapeHtml(c.name)}</strong>
            ${mine ? '<span class="char-mine">★</span>' : ''}
          </div>
          <div class="char-card-sub">${escapeHtml(d.cls || '')} ${d.lvl ? `niv.${d.lvl}` : ''}</div>
          <div class="char-hpbar"><span style="width:${hpPct}%"></span></div>
          <div class="char-card-hp">${d.hp ?? '?'} / ${d.hpMax ?? '?'} PV</div>
        </button>`;
    })
    .join('');

  el.innerHTML =
    // Outils de table partagés : visibles par tous (lecture seule côté joueurs).
    `<div class="char-tools">
       <button class="btn char-tool" id="char-loot" title="Trésor de groupe">🪙 Trésor</button>
       <button class="btn char-tool" id="char-quests" title="Journal de quêtes">📜 Quêtes</button>
     </div>` +
    (isDM
      ? `<button class="link char-new" id="char-new" style="text-align:left;margin:0 0 4px">+ Nouveau personnage</button>
         <button class="link char-new" id="char-import" style="text-align:left;margin:0 0 4px">📋 Importer (coller)</button>
         <label class="link char-new" id="char-import-json" style="text-align:left;margin:0 0 8px;display:block">📂 Importer (JSON)<input type="file" accept="application/json,.json" hidden></label>`
      : '') + (items || `<div class="char-empty">Aucune fiche.</div>`);

  el.querySelector('#char-loot')?.addEventListener('click', () => openPartyLoot());
  el.querySelector('#char-quests')?.addEventListener('click', () => openQuests());

  el.querySelector('#char-new')?.addEventListener('click', async () => {
    const name = await modalPrompt('Nom du personnage :', { title: 'Nouveau personnage', placeholder: 'Ex. Aélor' });
    if (name && name.trim()) await createCharacter(name.trim());
  });
  el.querySelector('#char-import')?.addEventListener('click', openCharImport);
  el.querySelector('#char-import-json input')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) importCharFromJson(f);
    e.target.value = '';
  });
  el.querySelectorAll('[data-char]').forEach((b) =>
    b.addEventListener('click', () => store.set({ activeChar: b.dataset.char }))
  );
}

/* ── Import « coller-analyser » d'une fiche (texte/PDF/papier) ── */

/** Analyse un texte de fiche libre → patch de données (best effort). */
function parseSheet(text) {
  const t = String(text || '');
  const data = {};
  const num = (re) => {
    const m = t.match(re);
    return m ? Number(m[1]) : null;
  };
  const str = (re) => {
    const m = t.match(re);
    return m ? m[1].trim() : null;
  };
  // Caractéristiques : mot-clé suivi (à courte distance) d'un score à 1-2 chiffres.
  const abil = [
    ['str', /(?:force|strength|\bfor\b|\bstr\b)\D{0,4}(\d{1,2})/i],
    ['dex', /(?:dext[ée]rit[ée]|dexterity|\bdex\b)\D{0,4}(\d{1,2})/i],
    ['con', /(?:constitution|\bcon\b)\D{0,4}(\d{1,2})/i],
    ['int', /(?:intelligence|\bint\b)\D{0,4}(\d{1,2})/i],
    ['wis', /(?:sagesse|wisdom|\bsag\b|\bwis\b)\D{0,4}(\d{1,2})/i],
    ['cha', /(?:charisme|charisma|\bcha\b)\D{0,4}(\d{1,2})/i],
  ];
  for (const [k, re] of abil) {
    const v = num(re);
    if (v != null && v >= 1 && v <= 30) data[k] = v;
  }
  const ac = num(/(?:classe d['’]armure|armor class|\bCA\b|\bAC\b)\D{0,4}(\d{1,2})/i);
  if (ac != null) data.ac = ac;
  const hp = num(/(?:points? de vie|hit points|\bPV\b|\bHP\b)\D{0,5}(\d{1,3})/i);
  if (hp != null) {
    data.hp = hp;
    data.hpMax = hp;
  }
  const spd = num(/(?:vitesse|speed|déplacement)\D{0,4}(\d{1,3})/i);
  if (spd != null) data.spd = spd > 20 ? Math.round(spd * 0.3048) : spd; // 30 ft → 9 m
  const lvl = num(/(?:niveau|level|\bniv\.?\b)\D{0,4}(\d{1,2})/i);
  if (lvl != null && lvl >= 1 && lvl <= 20) data.lvl = lvl;
  const prof = num(/(?:bonus de ma[îi]trise|proficiency bonus)\D{0,4}\+?(\d)/i);
  if (prof != null) data.prof = prof;
  const cls = str(/(?:classe|class)\s*[:\-–]\s*([A-Za-zÀ-ÿ'’ ]{2,30})/i);
  if (cls) data.cls = cls;
  const race = str(/(?:race|esp[èe]ce)\s*[:\-–]\s*([A-Za-zÀ-ÿ'’ ]{2,30})/i);
  if (race) data.race = race;
  const bg = str(/(?:historique|background)\s*[:\-–]\s*([A-Za-zÀ-ÿ'’ ]{2,30})/i);
  if (bg) data.bg = bg;
  // Attaques : réutilise le parseur de statbloc (lignes « +X … XdY … »).
  const atks = parseStatblockActions(t).map((a) => ({ nm: a.nm, bon: a.bon != null ? a.bon : '', dmg: a.dmg || '', typ: a.typ || '', prop: '' }));
  if (atks.length) data.atks = atks;
  return data;
}

let _charImport = null;
function openCharImport() {
  if (!store.get().isDM) return;
  if (_charImport) _charImport.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:460px;max-width:94vw">
      <h3 class="modal-title">📋 Importer une fiche (coller)</h3>
      <p class="modal-msg">Colle le texte d'une fiche (PDF, Word, D&D Beyond, papier scanné…). L'app détecte le nom, les caractéristiques, la CA, les PV, la vitesse, le niveau, la classe et les attaques. Tu pourras tout corriger ensuite.</p>
      <input class="modal-input" id="ci-name" placeholder="Nom (laisser vide = détection auto)">
      <textarea class="atk-in" id="ci-text" style="width:100%;min-height:200px;margin-top:8px;font-family:ui-monospace,monospace;font-size:12px" placeholder="Colle ici le contenu de la fiche…"></textarea>
      <div class="ci-preview" id="ci-preview"></div>
      <div class="modal-actions">
        <button class="modal-btn ci-cancel">Annuler</button>
        <button class="modal-btn modal-ok ci-ok">Analyser &amp; créer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _charImport = ov;
  const close = () => {
    ov.remove();
    _charImport = null;
  };
  const ta = ov.querySelector('#ci-text');
  const prev = ov.querySelector('#ci-preview');
  const refresh = () => {
    const d = parseSheet(ta.value);
    const bits = [];
    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach((k) => d[k] != null && bits.push(`${k.toUpperCase()} ${d[k]}`));
    const extra = [
      d.ac != null ? `CA ${d.ac}` : '',
      d.hpMax != null ? `PV ${d.hpMax}` : '',
      d.lvl != null ? `niv. ${d.lvl}` : '',
      d.cls ? d.cls : '',
      d.atks?.length ? `${d.atks.length} attaque(s)` : '',
    ].filter(Boolean);
    prev.innerHTML = ta.value.trim()
      ? `<div class="ci-detected">Détecté : ${escapeHtml([...bits, ...extra].join(' · ')) || '<rien — vérifie le format>'}</div>`
      : '';
  };
  ta.addEventListener('input', refresh);
  ov.querySelector('.ci-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.ci-ok').addEventListener('click', async () => {
    const text = ta.value;
    const data = parseSheet(text);
    let name = ov.querySelector('#ci-name').value.trim();
    if (!name) {
      const m = text.match(/(?:nom|name)\s*[:\-–]\s*(.+)/i);
      name = (m ? m[1] : text.split('\n').map((l) => l.trim()).find(Boolean) || '').trim().slice(0, 40);
    }
    if (!name) name = 'Personnage importé';
    close();
    const id = await importCharacter(name, data);
    if (id) showToast(`📋 « ${name} » importé — vérifie et complète la fiche.`, { timeout: 3000 });
  });
}

/* ── Export / import JSON d'une fiche ── */
function exportCharacterJson(c) {
  // L'`id` permet un ré-import qui retrouve précisément la même fiche.
  const payload = { type: 'vaultmj-character', v: 1, id: c.id, name: c.name, data: c.data || {} };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${String(c.name || 'fiche').replace(/[^\w\-]+/g, '_')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ── Diff de ré-import (confirmation avant mise à jour) ── */
const FIELD_LABELS = {
  cls: 'Classe', sub: 'Sous-classe', lvl: 'Niveau', race: 'Race', bg: 'Historique', align: 'Alignement',
  hp: 'PV', hpMax: 'PV max', hpTmp: 'PV temp', ac: 'CA', spd: 'Vitesse', initB: 'Init', prof: 'Maîtrise', insp: 'Inspiration',
  str: 'FOR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'SAG', cha: 'CHA',
  saves: 'Sauvegardes', profs: 'Compétences', exp: 'Expertises', atks: 'Attaques', spells: 'Sorts', slots: 'Emplacements',
  feats: 'Aptitudes', equip: 'Équipement', notes: 'Notes', resources: 'Ressources', features: 'Capacités',
  hd: 'Dés de vie', hdMax: 'Dés de vie max', xp: 'XP', portrait: 'Portrait', sc: 'Carac. d’incantation', ds: 'Jets de mort',
};
const fieldLabel = (k) => FIELD_LABELS[k] || k;

function valSumm(v) {
  if (v === undefined || v === null) return '∅';
  if (Array.isArray(v)) return `${v.length} élément(s)`;
  if (typeof v === 'object') return `${Object.keys(v).length} champ(s)`;
  const s = String(v);
  if (s === '') return '∅';
  return s.length > 36 ? `${s.slice(0, 36)}…` : s;
}

function diffData(oldData, newData) {
  const keys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
  const changes = [];
  for (const k of keys) {
    if (JSON.stringify(oldData?.[k]) !== JSON.stringify(newData?.[k])) {
      changes.push({ k, a: oldData?.[k], b: newData?.[k] });
    }
  }
  return changes.sort((x, y) => fieldLabel(x.k).localeCompare(fieldLabel(y.k), 'fr'));
}

/** Modale de confirmation montrant les changements ; résout true/false. */
function confirmImportDiff({ name, oldName, oldData, newData }) {
  return new Promise((resolve) => {
    const changes = diffData(oldData, newData);
    const nameChanged = name && oldName && name !== oldName;
    const rowsHtml = changes
      .map(
        (c) => `<div class="diff-row">
          <span class="diff-k">${escapeHtml(fieldLabel(c.k))}</span>
          <span class="diff-old">${escapeHtml(valSumm(c.a))}</span>
          <span class="diff-arrow">→</span>
          <span class="diff-new">${escapeHtml(valSumm(c.b))}</span>
        </div>`
      )
      .join('');
    const nothing = !changes.length && !nameChanged;
    const ov = document.createElement('div');
    ov.className = 'modal-overlay show';
    ov.innerHTML = `
      <div class="modal-card diff-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">Mettre à jour « ${escapeHtml(oldName || name)} » ?</h3>
        <p class="modal-msg">${nothing ? 'Aucune différence détectée avec la fiche existante.' : 'Voici ce qui va changer sur la fiche existante :'}</p>
        <div class="diff-list">
          ${nameChanged ? `<div class="diff-row"><span class="diff-k">Nom</span><span class="diff-old">${escapeHtml(oldName)}</span><span class="diff-arrow">→</span><span class="diff-new">${escapeHtml(name)}</span></div>` : ''}
          ${rowsHtml || (nameChanged ? '' : '<div class="dock-empty">—</div>')}
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel">Annuler</button>
          <button class="modal-btn modal-ok"${nothing ? ' disabled' : ''}>Mettre à jour</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const done = (v) => {
      ov.remove();
      resolve(v);
    };
    ov.querySelector('.modal-cancel').addEventListener('click', () => done(false));
    ov.querySelector('.modal-ok').addEventListener('click', () => done(true));
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) done(false);
    });
  });
}

async function importCharFromJson(file) {
  try {
    const obj = JSON.parse(await file.text());
    const name = String(obj.name || 'Fiche importée').slice(0, 40);
    const data = obj.data && typeof obj.data === 'object' ? obj.data : typeof obj === 'object' ? obj : {};
    const chars = store.get().characters;

    // Retrouve la fiche existante : par id (export récent), sinon par nom.
    // Normalisation NFC : « é » peut être encodé de deux façons selon l'éditeur,
    // sinon la comparaison de noms accentués échoue et crée un doublon.
    const normName = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
    const wanted = normName(name);
    let existing = obj.id ? chars.find((c) => c.id === obj.id) : null;
    if (!existing) existing = chars.find((c) => normName(c.name) === wanted);

    if (existing) {
      const ok = await confirmImportDiff({ name, oldName: existing.name, oldData: existing.data || {}, newData: data });
      if (!ok) return;
      if (name !== existing.name) await renameCharacter(existing.id, name);
      replaceCharacterData(existing.id, data); // remplacement complet (gère aussi les suppressions)
      store.set({ activeChar: existing.id });
      showToast(`📂 « ${name} » mis à jour depuis JSON.`, { timeout: 2800 });
      return;
    }

    // Aucune fiche correspondante : proposer la création.
    if (await modalConfirm(`Aucune fiche « ${name} » ne correspond. Créer une nouvelle fiche ?`, { title: 'Import JSON', okLabel: 'Créer' })) {
      const id = await importCharacter(name, data);
      if (id) showToast(`📂 « ${name} » créé depuis JSON.`, { timeout: 2600 });
    }
  } catch (e) {
    await modalAlert('JSON invalide : ' + e.message, { title: 'Import JSON' });
  }
}

/* ── Fiche ────────────────────────────────────────────────── */

function renderSheet(scrollTop = false) {
  const el = document.getElementById('char-sheet');
  if (!el) return;
  const prevScroll = el.scrollTop;
  const { characters, activeChar } = store.get();
  const c = characters.find((x) => x.id === activeChar);
  renderedCharId = activeChar;
  renderedSig = c ? JSON.stringify(c) : '';

  if (!c) {
    el.innerHTML = `<div class="char-empty">Sélectionne un personnage.</div>`;
    return;
  }

  const d = c.data || {};
  const ed = canEdit(c);
  const ro = ed ? '' : 'readonly disabled';

  const { isDM, players } = store.get();
  const ownerRow = isDM
    ? `<div class="sheet-owner">
         <label>Joueur :</label>
         <select class="sf" data-owner>
           <option value="">— Non attribuée —</option>
           ${players
             .map(
               (p) =>
                 `<option value="${p.id}" ${p.id === c.owner_id ? 'selected' : ''}>${escapeHtml(p.display_name || p.email)}</option>`
             )
             .join('')}
         </select>
         <button class="mini-del sheet-del" data-delchar="${c.id}" title="Supprimer la fiche">Supprimer</button>
       </div>`
    : '';

  const TABS = [
    { id: 'stats', label: '📊 Caractéristiques' },
    { id: 'combat', label: '⚔ Combat' },
    { id: 'spells', label: '✨ Sorts' },
    { id: 'feats', label: '🎴 Aptitudes' },
    { id: 'inv', label: '🎒 Inventaire' },
    { id: 'notes', label: '📝 Notes' },
  ];
  const subline = `${escapeHtml(d.cls || 'Classe')}${d.sub ? ` (${escapeHtml(d.sub)})` : ''} · Niv. ${num(d.lvl) || 1}`;

  el.innerHTML = `
    <div class="sheet5e">
      <aside class="sheet-rail">
        <label class="rail-portrait ${isDM ? 'editable' : ''}" ${isDM ? 'title="Changer le portrait"' : ''}>
          ${portraitUrl(d.portrait) ? `<img src="${portraitUrl(d.portrait)}" alt="">` : sheetInitials(c.name)}
          ${isDM ? `<input type="file" id="portrait-file" accept="image/*" hidden>` : ''}
        </label>
        <input class="sheet-name" value="${escapeHtml(c.name)}" data-field="__name" ${ro} />
        <div class="rail-sub">${subline}</div>

        <div class="combat-hp rail-hp">
          <div class="hp-label">Points de vie</div>
          <div class="hp-row">
            ${ed ? `<button class="hp-btn" data-hp="-1">−</button>` : ''}
            <input type="number" class="hp-cur" value="${num(d.hp)}" data-d="hp" ${ro}/>
            <span class="hp-sep">/</span>
            <input type="number" class="hp-max" value="${num(d.hpMax)}" data-d="hpMax" ${ro}/>
            ${ed ? `<button class="hp-btn" data-hp="1">+</button>` : ''}
          </div>
          ${(() => {
            const max = Number(d.hpMax) || 0;
            const cur = Math.max(0, Number(d.hp) || 0);
            const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
            const col = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--yellow)' : 'var(--red)';
            const fill = `linear-gradient(90deg, color-mix(in srgb, ${col} 72%, #000), ${col})`;
            return `<div class="hpbar"><span style="width:${pct}%; background:${fill}"></span></div>`;
          })()}
          <div class="hp-tmp">PV temp <input type="number" value="${num(d.hpTmp)}" data-d="hpTmp" ${ro}/></div>
          ${
            Number(d.hp) === 0
              ? (() => {
                  const ds = d.ds || { s: 0, f: 0 };
                  const status = ds.s >= 3 ? ' · Stabilisé' : ds.f >= 3 ? ' · Mort 💀' : '';
                  const dot = (field, i, on) => `<button class="ds-dot ${on ? 'on ' + field : ''}" data-ds="${field}" data-i="${i}" ${ro}></button>`;
                  return `<div class="death-saves">
                    <div class="ds-label">Jets de mort${status}</div>
                    <div class="ds-row"><span>Réussites</span>${[1, 2, 3].map((i) => dot('s', i, ds.s >= i)).join('')}</div>
                    <div class="ds-row"><span>Échecs</span>${[1, 2, 3].map((i) => dot('f', i, ds.f >= i)).join('')}</div>
                  </div>`;
                })()
              : ''
          }
          ${
            ed
              ? `<div class="rest-row">
                   <button class="rest-btn" data-rest="short" title="Repos court : récupère les ressources « repos court »">🔥 Repos court</button>
                   <button class="rest-btn" data-rest="long" title="Repos long : PV au max, emplacements restaurés, ½ dés de vie">🛌 Repos long</button>
                 </div>`
              : ''
          }
        </div>

        <div class="hd-block">
          <span class="hd-title">Dés de vie</span>
          <span class="hd-line">
            <input type="number" class="hd-cur" value="${num(d.hd ?? (d.hdMax ?? (Number(d.lvl) || 1)))}" data-d="hd" ${ro}/>
            <span>/</span>
            <input type="number" class="hd-max" value="${num(d.hdMax ?? (Number(d.lvl) || 1))}" data-d="hdMax" ${ro}/>
            <span class="hd-d">d</span>
            <input type="number" class="hd-size" value="${num(d.hdSize ?? 8)}" data-d="hdSize" min="4" max="12" step="2" ${ro}/>
          </span>
          ${ed ? `<button class="rest-btn hd-spend" data-hd-spend title="Dépenser un dé de vie (1dN + mod. CON)">🎲 Dépenser</button>` : ''}
        </div>

        <div class="rail-stats">
          ${stat('CA', 'ac', d.ac, ro)}
          ${stat('Init.', 'initB', d.initB, ro, '', true)}
          ${stat('Vitesse', 'spd', d.spd, ro, 'm')}
          ${stat('Maîtrise', 'prof', d.prof, ro, '', true)}
        </div>

        <div class="rail-extras">
          <button class="insp-btn ${d.insp ? 'on' : ''}" data-insp ${ro} title="Inspiration héroïque">✨ Inspiration</button>
          <div class="passive-pp" title="Perception passive (10 + bonus de Perception)">👁 Perception passive <b>${10 + skillBonus(d, 'perception')}</b></div>
          <div class="exh-block">
            <span class="exh-lbl">Épuisement</span>
            <div class="exh-dots">${[1, 2, 3, 4, 5, 6].map((i) => `<button class="exh-dot ${(Number(d.exh) || 0) >= i ? 'on' : ''}" data-exh="${i}" ${ro} title="Niveau ${i}"></button>`).join('')}</div>
          </div>
        </div>

        <section class="sheet-block rail-block">
          <h3>Jets de sauvegarde</h3>
          ${ABILITIES.map((a) => saveRow(a, d, ed)).join('')}
        </section>
        ${ownerRow}
      </aside>

      <main class="sheet-main">
        <nav class="sheet-tabs">
          ${TABS.map((t) => `<button class="sheet-tab ${t.id === sheetTab ? 'active' : ''}" data-pane="${t.id}">${t.label}</button>`).join('')}
        </nav>
        <div class="sheet-panes">
          <section class="tab-pane ${sheetTab === 'stats' ? 'active' : ''}" data-pane="stats">
            <div class="sheet-id-grid">
              <input class="sf" value="${escapeHtml(d.race || '')}" data-d="race" placeholder="Race" ${ro}/>
              <input class="sf" value="${escapeHtml(d.cls || '')}" data-d="cls" placeholder="Classe" ${ro}/>
              <input class="sf" value="${escapeHtml(d.sub || '')}" data-d="sub" placeholder="Sous-classe" ${ro}/>
              <span class="sf-num">Niv.<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
              <input class="sf" value="${escapeHtml(d.bg || '')}" data-d="bg" placeholder="Historique" ${ro}/>
              <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="Alignement" ${ro}/>
              <span class="sf-num">XP<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
              ${ed ? `<button class="sf-levelup" data-levelup title="Monter d'un niveau (maîtrise + dé de vie)">⬆ Niveau</button>` : ''}
              <button class="sf-levelup" data-export title="Exporter cette fiche en JSON (sauvegarde / transfert)">💾 JSON</button>
            </div>
            <section class="sheet-abilities">
              ${ABILITIES.map((a) => abilityBox(a, d, ro)).join('')}
            </section>
            <section class="sheet-block">
              <h3>Compétences</h3>
              ${Object.keys(SKILLS).map((k) => skillRow(k, d, ed)).join('')}
            </section>
          </section>

          <section class="tab-pane ${sheetTab === 'combat' ? 'active' : ''}" data-pane="combat">
            <section class="sheet-block">
              <h3>Attaques ${ed ? `<button class="mini-add" data-add="atk">+</button>` : ''}</h3>
              <div class="atk-table">${(d.atks || []).map((a, i) => atkRow(a, i, ed)).join('') || '<div class="char-empty">—</div>'}</div>
            </section>
            ${resourcesSection(d, ed)}
          </section>

          <section class="tab-pane ${sheetTab === 'spells' ? 'active' : ''}" data-pane="spells">
            ${spellsSection(d, ed) || '<div class="char-empty">Aucun sort.</div>'}
          </section>

          <section class="tab-pane ${sheetTab === 'feats' ? 'active' : ''}" data-pane="feats">
            ${featuresSection(d, ed)}
          </section>

          <section class="tab-pane ${sheetTab === 'inv' ? 'active' : ''}" data-pane="inv">
            ${inventorySection(d, ed, ro)}
          </section>

          <section class="tab-pane ${sheetTab === 'notes' ? 'active' : ''}" data-pane="notes">
            ${featsBlock(d.feats, ed)}
            ${textBlock('Notes', 'notes', d.notes, ro)}
          </section>
        </div>
      </main>
    </div>
  `;

  el.querySelector('#portrait-file')?.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      await uploadPortrait(c.id, f);
    } catch (ex) {
      await modalAlert('Import du portrait impossible : ' + ex.message, { title: 'Portrait' });
    }
    e.target.value = '';
  });

  // Onglets (façon Foundry) : bascule locale sans re-render complet.
  el.querySelectorAll('.sheet-tab').forEach((b) =>
    b.addEventListener('click', () => {
      sheetTab = b.dataset.pane;
      el.querySelectorAll('.sheet-tab').forEach((x) => x.classList.toggle('active', x === b));
      el.querySelectorAll('.tab-pane').forEach((p) => p.classList.toggle('active', p.dataset.pane === sheetTab));
    })
  );

  bindSheet(el, c.id, ed);
  el.scrollTop = scrollTop ? 0 : prevScroll;
}

/* ── Fragments ────────────────────────────────────────────── */

function num(v) {
  return v === null || v === undefined ? '' : v;
}

function stat(label, key, val, ro, suffix = '', signed = false) {
  const display = signed && val !== '' ? fmtMod(Number(val) || 0) : '';
  return `
    <div class="combat-stat">
      <div class="cs-label">${label}</div>
      <div class="cs-val">
        <input type="number" value="${num(val)}" data-d="${key}" ${ro}/>
        ${suffix ? `<span class="cs-suffix">${suffix}</span>` : ''}
      </div>
      ${display ? `<div class="cs-hint">${display}</div>` : ''}
    </div>`;
}

function abilityBox(a, d, ro) {
  const mod = abilityMod(d[a.key]);
  return `
    <div class="ability-box">
      <div class="ab-label">${a.label}</div>
      <div class="ab-mod rollable" data-roll="ability" data-key="${a.key}" title="Lancer un test de ${a.label}">${fmtMod(mod)}</div>
      <input type="number" class="ab-score" value="${num(d[a.key])}" data-d="${a.key}" ${ro}/>
    </div>`;
}

function saveRow(a, d, ed) {
  const has = (d.saves || []).includes(a.key);
  return `
    <label class="prof-row">
      <input type="checkbox" data-save="${a.key}" ${has ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="save" data-key="${a.key}" title="Jet de sauvegarde de ${a.label}">${fmtMod(saveBonus(d, a.key))}</span>
      <span class="prof-name">${a.label}</span>
    </label>`;
}

function skillRow(k, d, ed) {
  const sk = SKILLS[k];
  const prof = (d.profs || []).includes(k);
  const exp = (d.exp || []).includes(k);
  const ab = ABILITIES.find((a) => a.key === sk.ability)?.label || '';
  return `
    <label class="prof-row">
      <input type="checkbox" data-skill="${k}" ${prof ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="skill" data-key="${k}" title="Test de ${sk.label}">${fmtMod(skillBonus(d, k))}</span>
      <span class="prof-name">${sk.label} <em>(${ab})</em></span>
      ${ed ? `<button class="exp-toggle ${exp ? 'on' : ''}" data-exp="${k}" title="Expertise">E</button>` : exp ? '<span class="exp-badge">E</span>' : ''}
    </label>`;
}

function atkRow(a, i, ed) {
  if (!ed) {
    return `<div class="atk-line clickable" data-cardatk="${i}" title="Ouvrir la carte d'action (attaque / dégâts / critique)">
      <strong>${escapeHtml(a.nm || '')}</strong>
      <span>${escapeHtml(a.bon || '')}</span>
      <span>${escapeHtml(a.dmg || '')} ${escapeHtml(a.typ || '')}</span>
      <em>${escapeHtml(a.prop || '')}</em>
    </div>`;
  }
  return `<div class="atk-line edit">
    <button class="atk-card-btn" data-cardatk="${i}" title="Carte d'action">🎴</button>
    <input value="${escapeHtml(a.nm || '')}" data-atk="${i}" data-k="nm" placeholder="Nom"/>
    <input value="${escapeHtml(a.bon || '')}" data-atk="${i}" data-k="bon" placeholder="+X" style="width:48px"/>
    <input value="${escapeHtml(a.dmg || '')}" data-atk="${i}" data-k="dmg" placeholder="1d8+2" style="width:70px"/>
    <input value="${escapeHtml(a.typ || '')}" data-atk="${i}" data-k="typ" placeholder="type" style="width:80px"/>
    <input value="${escapeHtml(a.prop || '')}" data-atk="${i}" data-k="prop" placeholder="propriétés"/>
    <button class="mini-del" data-delatk="${i}">×</button>
  </div>`;
}

/** Aptitudes de classe / dons : liste cliquable (carte d'aptitude). */
function featuresSection(d, ed) {
  const list = d.features || [];
  const rows = list
    .map((f, i) => {
      if (!ed) {
        return `<div class="feat-line clickable" data-cardfeat="${i}" title="Voir l'aptitude (description + jets cliquables)">
          <strong>${escapeHtml(f.nm || '')}</strong>${f.lvl ? `<span class="feat-lvl">niv.${escapeHtml(String(f.lvl))}</span>` : ''}
          <span class="feat-snip">${escapeHtml((f.desc || '').replace(/[#*_>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90))}</span>
        </div>`;
      }
      return `<div class="feat-edit">
        <div class="feat-edit-top">
          <button class="atk-card-btn" data-cardfeat="${i}" title="Carte d'aptitude">🎴</button>
          <input value="${escapeHtml(f.nm || '')}" data-feat="${i}" data-k="nm" placeholder="Nom de l'aptitude"/>
          <input value="${escapeHtml(f.lvl || '')}" data-feat="${i}" data-k="lvl" placeholder="Niv" style="width:48px"/>
          <button class="mini-del" data-delfeat="${i}">×</button>
        </div>
        <textarea class="spell-desc-in" data-feat="${i}" data-k="desc" rows="2" placeholder="Description (Markdown ; [[1d6]] devient cliquable)">${escapeHtml(f.desc || '')}</textarea>
      </div>`;
    })
    .join('');
  return `<section class="sheet-block">
    <h3>Aptitudes &amp; dons ${ed ? `<button class="mini-add" data-add="feat">+</button>` : ''}</h3>
    <div class="feat-table">${rows || '<div class="char-empty">—</div>'}</div>
  </section>`;
}

function spellsSection(d, ed) {
  const spells = d.spells || [];
  const byLevel = {};
  for (const s of spells) (byLevel[s.lvl] ??= []).push(s);
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b);

  const hasSlots = Object.values(d.slots || {}).some((s) => (s?.m || 0) > 0);

  const lvlOptions = (sel) =>
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
      .map(
        (n) =>
          `<option value="${n}" ${n === Number(sel) ? 'selected' : ''}>${n === 0 ? 'Mineur' : `Niv.${n}`}</option>`
      )
      .join('');

  const groups = levels
    .map((lv) => {
      const rows = byLevel[lv]
        .map((s) => {
          const idx = spells.indexOf(s);
          if (ed) {
            return `<div class="spell-edit">
                 <div class="spell-edit-top">
                   <button class="spell-cast" data-cardspell="${idx}" title="Carte d'action (attaque / dégâts / critique / DD)">🎴</button>
                   <button class="spell-cast" data-cast="${idx}" title="Lancer le sort (consomme un emplacement)">🪄</button>
                   <input value="${escapeHtml(s.nm)}" data-spell="${idx}" data-k="nm" placeholder="Nom du sort"/>
                   <select class="spell-lvl-sel" data-spell="${idx}" data-k="lvl">${lvlOptions(s.lvl)}</select>
                   <button class="mini-del" data-delspell="${idx}">×</button>
                 </div>
                 <input class="spell-desc-in" value="${escapeHtml(s.desc || '')}" data-spell="${idx}" data-k="desc" placeholder="Description rapide (optionnel)"/>
                 <div class="spell-cast-fields">
                   <input value="${escapeHtml(s.atk || '')}" data-spell="${idx}" data-k="atk" placeholder="Att. +X"/>
                   <input value="${escapeHtml(s.dmg || '')}" data-spell="${idx}" data-k="dmg" placeholder="Dégâts (3d6)"/>
                   <input value="${escapeHtml(s.dc || '')}" data-spell="${idx}" data-k="dc" placeholder="DD"/>
                   <input value="${escapeHtml(s.heal || '')}" data-spell="${idx}" data-k="heal" placeholder="Soin (1d8+MOD)" title="MOD = mod. d'incantation ; PROF = maîtrise ; FOR/DEX/… = mod. de carac."/>
                   <input value="${escapeHtml(s.cond || '')}" data-spell="${idx}" data-k="cond" placeholder="État (Empoisonné)"/>
                 </div>
               </div>`;
          }
          const desc = effSpellDesc(s);
          const hasDesc = !!(desc && desc.trim());
          const tags = [s.atk ? `att. ${s.atk}` : '', s.dmg ? escapeHtml(s.dmg) : '', s.dc ? `DD ${escapeHtml(String(s.dc))}` : '']
            .filter(Boolean)
            .map((x) => `<span class="spell-tag">${escapeHtml(x)}</span>`)
            .join('');
          return `<div class="accordion-item ${hasDesc ? 'has-detail' : ''}" ${hasDesc ? `data-accordion` : ''}>
                 <div class="accordion-head">
                   <span class="accordion-title">${escapeHtml(s.nm)}</span>
                   ${tags}
                   ${hasDesc ? '<span class="accordion-caret">▸</span>' : ''}
                 </div>
                 ${hasDesc ? `<div class="accordion-body md">${renderMarkdown(desc)}</div>` : ''}
               </div>`;
        })
        .join('');
      return `<div class="spell-group"><div class="spell-lv">${lv === 0 ? 'Sorts mineurs' : `Niveau ${lv}`}</div>${rows}</div>`;
    })
    .join('');

  if (!spells.length && !hasSlots && !ed) return '';
  return `
    <section class="sheet-block">
      <h3>Sorts ${ed ? `<button class="mini-add" data-add="spell">+</button>` : ''}</h3>
      ${slotsBlock(d, ed)}
      ${groups || (spells.length ? '' : '<div class="char-empty">Aucun sort.</div>')}
    </section>`;
}

/** Emplacements de sorts : pips cliquables (usage) + éditeur de max (repliable). */
function slotsBlock(d, ed) {
  const lvls = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pipRows = lvls
    .filter((lv) => (d.slots?.[lv]?.m || 0) > 0)
    .map((lv) => {
      const m = d.slots[lv].m;
      const u = Math.min(d.slots[lv].u || 0, m);
      const pips = Array.from({ length: m }, (_, i) =>
        `<button class="slot-pip ${i < u ? 'used' : ''}" ${ed ? '' : 'disabled'} data-slot="${lv}" data-i="${i + 1}" title="${i < u ? 'Récupérer' : 'Utiliser'}"></button>`
      ).join('');
      return `<div class="slot-row"><span class="slot-lv">Niv ${lv}</span><span class="slot-pips">${pips}</span><span class="slot-count">${m - u}/${m}</span></div>`;
    })
    .join('');
  const editor = ed
    ? `<details class="slots-cfg"><summary>Configurer les emplacements</summary>
         <div class="slots-maxgrid">${lvls
           .map((lv) => `<label>N${lv}<input type="number" min="0" max="9" value="${d.slots?.[lv]?.m || 0}" data-slotmax="${lv}"></label>`)
           .join('')}</div>
       </details>`
    : '';
  if (!pipRows && !editor) return '';
  return `<div class="slots-block">${pipRows}${editor}</div>`;
}

/** Ressources de classe (ki, rage, inspiration…) : pips + reset au repos. */
function resourcesSection(d, ed) {
  const res = d.resources || [];
  if (!res.length && !ed) return '';
  const RESET = { short: 'repos court', long: 'repos long', none: '—' };
  const rows = res
    .map((r, i) => {
      const max = Math.max(0, Number(r.max) || 0);
      const used = Math.min(Number(r.used) || 0, max);
      const pips = Array.from({ length: max }, (_, k) =>
        `<button class="slot-pip ${k < used ? 'used' : ''}" data-res="${i}" data-i="${k + 1}" title="${k < used ? 'Récupérer' : 'Utiliser'}"></button>`
      ).join('');
      if (ed) {
        return `<div class="res-edit">
            <input value="${escapeHtml(r.name || '')}" data-resk="${i}" data-k="name" placeholder="Ressource (ki, rage…)"/>
            <input type="number" min="0" max="30" value="${max}" data-resk="${i}" data-k="max" title="Max"/>
            <select data-resk="${i}" data-k="reset" title="Récupération">
              <option value="short" ${r.reset === 'short' ? 'selected' : ''}>Repos court</option>
              <option value="long" ${r.reset === 'long' || !r.reset ? 'selected' : ''}>Repos long</option>
              <option value="none" ${r.reset === 'none' ? 'selected' : ''}>Aucun</option>
            </select>
            <button class="mini-del" data-delres="${i}">×</button>
          </div>`;
      }
      return `<div class="slot-row"><span class="slot-lv res-name">${escapeHtml(r.name || 'Ressource')}</span><span class="slot-pips">${pips}</span><span class="slot-count">${max - used}/${max} <em>${RESET[r.reset] || RESET.long}</em></span></div>`;
    })
    .join('');
  return `<section class="sheet-block">
      <h3>Ressources ${ed ? `<button class="mini-add" data-add="res">+</button> <button class="mini-add" data-init-res title="Ajouter la ressource de classe (ki, rage…) selon la classe et le niveau">⚙ Classe</button>` : ''}</h3>
      <div class="slots-block">${rows || '<div class="char-empty">Aucune ressource.</div>'}</div>
    </section>`;
}

/* ── Capacités & traits ───────────────────────────────────── */

/**
 * Découpe le texte des traits en items {title, body}.
 * Règle : une ligne NON indentée commençant un nouvel item ; le séparateur
 * « — » ou « : » sépare titre et début de description. Les lignes indentées
 * (ou la suite) sont ajoutées au corps de l'item courant.
 */
function parseFeats(text) {
  const lines = String(text || '').split('\n');
  const items = [];
  let cur = null;
  for (const raw of lines) {
    if (!raw.trim()) {
      if (cur) cur.body += '\n';
      continue;
    }
    const indented = /^\s/.test(raw);
    if (!indented) {
      if (cur) items.push(cur);
      const m = raw.match(/^(.*?)(?:\s*[—:]\s*)(.*)$/);
      if (m) cur = { title: m[1].trim(), body: m[2].trim() };
      else cur = { title: raw.trim(), body: '' };
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + raw.trim();
    } else {
      cur = { title: raw.trim(), body: '' };
    }
  }
  if (cur) items.push(cur);
  return items.filter((i) => i.title);
}

function featsBlock(text, ed) {
  const items = parseFeats(text);
  const accordion = items.length
    ? `<div class="accordion">${items
        .map((it) => {
          const hasBody = !!it.body.trim();
          return `<div class="accordion-item ${hasBody ? 'has-detail' : ''}" ${hasBody ? 'data-accordion' : ''}>
        <div class="accordion-head">
          <span class="accordion-title">${escapeHtml(it.title)}</span>
          ${hasBody ? '<span class="accordion-caret">▸</span>' : ''}
        </div>
        ${hasBody ? `<div class="accordion-body">${escapeHtml(it.body)}</div>` : ''}
      </div>`;
        })
        .join('')}</div>`
    : `<div class="char-empty">—</div>`;

  if (ed) {
    return `
      <section class="sheet-block">
        <h3>Capacités & traits</h3>
        ${accordion}
        <details class="feats-editor">
          <summary>Modifier</summary>
          <textarea class="sheet-text" data-d="feats" rows="6">${escapeHtml(text || '')}</textarea>
          <div class="feats-hint">Une capacité par ligne. Format « Nom — description ». Indentez les détails.</div>
        </details>
      </section>`;
  }
  return `
    <section class="sheet-block">
      <h3>Capacités & traits</h3>
      ${accordion}
    </section>`;
}

const COINS = [
  { k: 'pp', label: 'PP', title: 'Platine' },
  { k: 'po', label: 'PO', title: 'Or' },
  { k: 'pe', label: 'PE', title: 'Électrum' },
  { k: 'pa', label: 'PA', title: 'Argent' },
  { k: 'pc', label: 'PC', title: 'Cuivre' },
];

function invRow(it, i, ed) {
  if (!ed) {
    return `<div class="inv-line">
      <span class="inv-q">${num(it.qty) || 1}×</span>
      <strong>${escapeHtml(it.nm || '')}</strong>
      <span class="inv-w">${it.wt ? `${escapeHtml(String(it.wt))} lb` : ''}</span>
      <em>${escapeHtml(it.note || '')}</em>
    </div>`;
  }
  return `<div class="inv-line edit">
    <input value="${escapeHtml(it.nm || '')}" data-inv="${i}" data-k="nm" placeholder="Objet"/>
    <input type="number" value="${escapeHtml(String(it.qty ?? 1))}" data-inv="${i}" data-k="qty" placeholder="Qté" style="width:54px"/>
    <input type="number" step="0.1" value="${escapeHtml(String(it.wt ?? ''))}" data-inv="${i}" data-k="wt" placeholder="lb" style="width:58px"/>
    <input value="${escapeHtml(it.note || '')}" data-inv="${i}" data-k="note" placeholder="note"/>
    <button class="mini-del" data-delinv="${i}">×</button>
  </div>`;
}

function inventorySection(d, ed, ro) {
  const coins = d.coins || {};
  const items = d.inv || [];
  const totalW = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.wt) || 0), 0);
  const cap = (Number(d.str) || 10) * 15;
  const over = totalW > cap;
  return `
    <section class="sheet-block">
      <h3>Monnaie</h3>
      <div class="coins-row">
        ${COINS.map((c) => `<label class="coin" title="${c.title}"><span>${c.label}</span><input type="number" min="0" value="${num(coins[c.k])}" data-coin="${c.k}" ${ro}/></label>`).join('')}
      </div>
    </section>
    <section class="sheet-block">
      <h3>Inventaire ${ed ? `<button class="mini-add" data-add="inv">+</button>` : ''}
        <span class="inv-weight ${over ? 'over' : ''}" title="Capacité de charge = FOR × 15">${totalW.toFixed(1)} / ${cap} lb</span>
      </h3>
      <div class="inv-table">${items.length ? items.map((it, i) => invRow(it, i, ed)).join('') : '<div class="char-empty">—</div>'}</div>
    </section>
    ${textBlock("Notes d'équipement", 'equip', d.equip, ro)}
  `;
}

function textBlock(title, key, val, ro) {
  return `
    <section class="sheet-block">
      <h3>${title}</h3>
      <textarea class="sheet-text" data-d="${key}" ${ro} rows="4">${escapeHtml(val || '')}</textarea>
    </section>`;
}

/* ── Liaison des événements ───────────────────────────────── */

function bindSheet(el, id, ed) {
  // Accordéons (capacités / sorts) — actifs aussi en lecture seule.
  el.querySelectorAll('[data-accordion] .accordion-head').forEach((head) => {
    head.addEventListener('click', () => {
      head.parentElement.classList.toggle('open');
    });
  });

  if (!ed) return;

  // Champs simples (data.*)
  el.querySelectorAll('[data-d]').forEach((input) => {
    input.addEventListener('input', () => {
      const key = input.dataset.d;
      const val = input.type === 'number' ? toNum(input.value) : input.value;
      updateCharacter(id, { [key]: val });
    });
  });

  // Nom du personnage (colonne dédiée, pas dans data)
  const nameInput = el.querySelector('[data-field="__name"]');
  nameInput?.addEventListener('input', async () => {
    const characters = store.get().characters.map((c) =>
      c.id === id ? { ...c, name: nameInput.value } : c
    );
    store.set({ characters });
    updateName(id, nameInput.value);
  });

  // Attribution à un joueur + suppression (MJ)
  el.querySelector('[data-owner]')?.addEventListener('change', (e) => {
    assignOwner(id, e.target.value || null);
  });
  el.querySelector('[data-delchar]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (await modalConfirm(`Supprimer définitivement la fiche « ${cur?.name} » ?`, { title: 'Supprimer la fiche', danger: true, okLabel: 'Supprimer' })) {
      deleteCharacter(id);
    }
  });

  // HP +/-
  el.querySelectorAll('[data-hp]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const delta = Number(b.dataset.hp);
      const hp = Math.max(0, (Number(cur.data.hp) || 0) + delta);
      updateCharacter(id, { hp });
      const field = el.querySelector('[data-d="hp"]');
      if (field) field.value = hp;
    })
  );

  // Montée de niveau : +1 niveau, recalcul de la maîtrise, +1 dé de vie.
  el.querySelector('[data-levelup]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur) return;
    const dd = cur.data;
    const newLvl = (Number(dd.lvl) || 1) + 1;
    if (!(await modalConfirm(`Passer ${cur.name} au niveau ${newLvl} ? (maîtrise et dé de vie mis à jour ; pense à ajuster PV max et emplacements de sorts)`, { title: '⬆ Montée de niveau', okLabel: `Niveau ${newLvl}` }))) return;
    const prof = 2 + Math.floor((newLvl - 1) / 4);
    const hdMax = newLvl;
    const hd = Math.min(hdMax, (Number(dd.hd ?? (Number(dd.lvl) || 1)) || 0) + 1);
    updateCharacter(id, { lvl: newLvl, prof, hdMax, hd });
    showToast(`⬆ ${cur.name} atteint le niveau ${newLvl} ! (maîtrise +${prof})`, { type: 'success', icon: '✨' });
  });

  // Jets de mort : un clic règle le nombre de réussites/échecs.
  el.querySelectorAll('[data-ds]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      if (!cur) return;
      const ds = { ...(cur.data.ds || { s: 0, f: 0 }) };
      const field = b.dataset.ds;
      const i = Number(b.dataset.i);
      ds[field] = ds[field] === i ? i - 1 : i; // re-clic sur le même point = décrémente
      updateCharacter(id, { ds });
    })
  );

  // Inspiration (toggle).
  el.querySelector('[data-insp]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (cur) updateCharacter(id, { insp: !cur.data.insp });
  });
  // Épuisement (0–6, re-clic sur le niveau courant = décrémente).
  el.querySelectorAll('[data-exh]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      if (!cur) return;
      const i = Number(b.dataset.exh);
      const exh = (Number(cur.data.exh) || 0) === i ? i - 1 : i;
      updateCharacter(id, { exh });
    })
  );

  // Repos long (règles 2014) : PV max, slots restaurés, ½ dés de vie regagnés.
  el.querySelector('[data-rest="short"]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur) return;
    const dd = cur.data;
    if (!(await modalConfirm('Repos court : récupère les ressources « repos court ». Continuer ?', { title: '🔥 Repos court', okLabel: 'Repos court' }))) return;
    const resources = (dd.resources || []).map((r) => (r.reset === 'short' ? { ...r, used: 0 } : r));
    updateCharacter(id, { resources });
    showToast('🔥 Repos court : ressources récupérées.', { timeout: 2000 });
    postCard({ kind: 'note', icon: '🔥', title: `${cur.name} prend un repos court`, sub: 'Repos court', lines: ['Ressources « repos court » récupérées'] });
  });

  el.querySelector('[data-rest="long"]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur) return;
    const dd = cur.data;
    if (!(await modalConfirm('Repos long : PV au maximum, PV temporaires remis à 0, emplacements de sorts restaurés, jets de mort réinitialisés, et la moitié des dés de vie regagnés. Continuer ?', { title: '🛌 Repos long', okLabel: 'Repos long' }))) return;
    const slots = {};
    for (const [lv, s] of Object.entries(dd.slots || {})) slots[lv] = { ...s, u: 0 };
    const hdMax = Number(dd.hdMax ?? dd.lvl) || 1;
    const hdNow = Number(dd.hd ?? hdMax) || 0;
    const regain = longRestHitDiceRegain(hdMax);
    const hd = Math.min(hdMax, hdNow + regain);
    // Repos long : récupère TOUTES les ressources (court + long).
    const resources = (dd.resources || []).map((r) => (r.reset === 'none' ? r : { ...r, used: 0 }));
    updateCharacter(id, { hp: Number(dd.hpMax) || dd.hp, hpTmp: 0, slots, ds: { s: 0, f: 0 }, hd, resources });
    postCard({
      kind: 'note',
      icon: '🛌',
      title: `${cur.name} se réveille reposé`,
      sub: 'Repos long',
      lines: ['PV au maximum', 'PV temporaires remis à 0', 'Emplacements de sorts restaurés', 'Jets de mort réinitialisés', `Dés de vie regagnés : +${regain}`],
    });
  });

  // Dépenser un dé de vie : 1dN + mod. CON, soigne, décrémente.
  el.querySelector('[data-hd-spend]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur) return;
    const dd = cur.data;
    const hdMax = Number(dd.hdMax ?? dd.lvl) || 1;
    const hd = Number(dd.hd ?? hdMax) || 0;
    if (hd <= 0) {
      modalAlert('Plus de dés de vie disponibles.', { title: 'Dés de vie' });
      return;
    }
    const size = Number(dd.hdSize) || 8;
    const buf = new Uint32Array(1);
    const max = Math.floor(0xffffffff / size) * size;
    do {
      crypto.getRandomValues(buf);
    } while (buf[0] >= max);
    const die = (buf[0] % size) + 1;
    const conMod = abilityMod(dd.con);
    const gain = Math.max(0, die + conMod);
    const hp = Math.min(Number(dd.hpMax) || Infinity, (Number(dd.hp) || 0) + gain);
    updateCharacter(id, { hp, hd: hd - 1 });
    showToast(`🎲 Dé de vie : 1d${size}(${die})${conMod >= 0 ? '+' : ''}${conMod} = +${gain} PV (${hd - 1}/${hdMax} restants)`, { type: 'success', icon: '🩹' });
  });

  // Jets depuis la fiche : carac / sauvegarde / compétence / attaque → flux des dés.
  const normBon = (b) => {
    const s = String(b || '').trim();
    if (!s) return 0;
    return Number(/^[+-]/.test(s) ? s : `+${s}`) || 0;
  };
  el.querySelectorAll('[data-roll]').forEach((node) =>
    node.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = store.get().characters.find((c) => c.id === id);
      if (!cur) return;
      const dd = cur.data;
      const who = cur.name || 'PJ';
      const t = node.dataset.roll;
      const k = node.dataset.key;
      // Maj = avantage, Ctrl/Cmd = désavantage.
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      if (t === 'ability') {
        const lbl = ABILITIES.find((a) => a.key === k)?.label || k;
        sendD20Check(abilityMod(dd[k]), `${who} — Test de ${lbl}`, { mode });
      } else if (t === 'save') {
        const lbl = ABILITIES.find((a) => a.key === k)?.label || k;
        sendD20Check(saveBonus(dd, k), `${who} — Sauvegarde de ${lbl}`, { mode });
      } else if (t === 'skill') {
        sendD20Check(skillBonus(dd, k), `${who} — ${SKILLS[k]?.label || k}`, { mode });
      } else if (t === 'atk') {
        const a = (dd.atks || [])[Number(node.dataset.i)];
        if (!a) return;
        sendD20Check(normBon(a.bon), `${who} — ${a.nm || 'Attaque'} (attaque)`, { mode });
        if (a.dmg) sendRoll(a.dmg, 'public', `${who} — ${a.nm || 'Attaque'} (dégâts)`);
      }
    })
  );

  // Sauvegardes / compétences (toggle maîtrise)
  el.querySelectorAll('[data-save]').forEach((cb) =>
    cb.addEventListener('change', () => toggleArr(id, 'saves', cb.dataset.save))
  );
  el.querySelectorAll('[data-skill]').forEach((cb) =>
    cb.addEventListener('change', () => toggleArr(id, 'profs', cb.dataset.skill))
  );
  el.querySelectorAll('[data-exp]').forEach((b) =>
    b.addEventListener('click', () => toggleArr(id, 'exp', b.dataset.exp))
  );

  // Attaques
  el.querySelectorAll('[data-atk]').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.atk);
      const cur = store.get().characters.find((c) => c.id === id);
      const atks = [...(cur.data.atks || [])];
      atks[i] = { ...atks[i], [input.dataset.k]: input.value };
      updateCharacter(id, { atks });
    })
  );
  el.querySelectorAll('[data-delatk]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const atks = (cur.data.atks || []).filter((_, idx) => idx !== Number(b.dataset.delatk));
      updateCharacter(id, { atks });
    })
  );

  // Emplacements de sorts : pip = utiliser/récupérer.
  el.querySelectorAll('[data-slot]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const lv = b.dataset.slot;
      const i = Number(b.dataset.i);
      const slots = { ...(cur.data.slots || {}) };
      const s = { ...(slots[lv] || { m: 0, u: 0 }) };
      s.u = (s.u || 0) >= i ? i - 1 : i; // re-clic sur un pip déjà utilisé = libère
      slots[lv] = s;
      updateCharacter(id, { slots });
    })
  );
  // Configuration du nombre max d'emplacements par niveau.
  el.querySelectorAll('[data-slotmax]').forEach((input) =>
    input.addEventListener('change', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const lv = input.dataset.slotmax;
      const m = Math.max(0, Math.min(9, Number(input.value) || 0));
      const slots = { ...(cur.data.slots || {}) };
      if (m === 0) delete slots[lv];
      else slots[lv] = { m, u: Math.min(slots[lv]?.u || 0, m) };
      updateCharacter(id, { slots });
    })
  );

  // Ressources de classe : pip = utiliser/récupérer.
  el.querySelectorAll('[data-res]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const ri = Number(b.dataset.res);
      const i = Number(b.dataset.i);
      const resources = (cur.data.resources || []).map((r, idx) =>
        idx === ri ? { ...r, used: (r.used || 0) >= i ? i - 1 : i } : r
      );
      updateCharacter(id, { resources });
    })
  );
  el.querySelectorAll('[data-resk]').forEach((input) =>
    input.addEventListener('input', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const ri = Number(input.dataset.resk);
      const k = input.dataset.k;
      const v = k === 'max' ? Math.max(0, Number(input.value) || 0) : input.value;
      const resources = (cur.data.resources || []).map((r, idx) => (idx === ri ? { ...r, [k]: v } : r));
      updateCharacter(id, { resources });
    })
  );
  el.querySelectorAll('[data-delres]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const resources = (cur.data.resources || []).filter((_, idx) => idx !== Number(b.dataset.delres));
      updateCharacter(id, { resources });
    })
  );
  el.querySelector('[data-add="res"]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const resources = [...(cur.data.resources || []), { name: '', max: 1, used: 0, reset: 'long' }];
    updateCharacter(id, { resources });
  });
  el.querySelector('[data-init-res]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const proposed = classResources(cur.data);
    if (!proposed.length) {
      await modalAlert(`Aucune ressource type pour la classe « ${cur.data.cls || '—'} ». Ajoute-la à la main avec +.`, { title: 'Ressources de classe' });
      return;
    }
    const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
    const resources = [...(cur.data.resources || [])];
    const added = [];
    for (const p of proposed) {
      const ri = resources.findIndex((r) => norm(r.name) === norm(p.name));
      if (ri >= 0) resources[ri] = { ...resources[ri], max: p.max, reset: p.reset };
      else {
        resources.push(p);
        added.push(p.name);
      }
    }
    updateCharacter(id, { resources });
    showToast(`⚙ ${proposed.map((p) => `${p.name} ${p.max}`).join(', ')} (${cur.data.cls})`, { timeout: 3000 });
  });

  // Sorts
  el.querySelectorAll('[data-spell]').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.spell);
      const cur = store.get().characters.find((c) => c.id === id);
      const spells = [...(cur.data.spells || [])];
      const k = input.dataset.k;
      spells[i] = { ...spells[i], [k]: k === 'lvl' ? toNum(input.value) : input.value };
      updateCharacter(id, { spells });
    })
  );
  el.querySelectorAll('[data-delspell]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const spells = (cur.data.spells || []).filter((_, idx) => idx !== Number(b.dataset.delspell));
      updateCharacter(id, { spells });
    })
  );
  // Lancer un sort : consomme un emplacement du bon niveau + jets auto.
  el.querySelectorAll('[data-cast]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const cur = store.get().characters.find((c) => c.id === id);
      if (!cur) return;
      const s = (cur.data.spells || [])[Number(b.dataset.cast)];
      if (!s) return;
      const who = cur.name || 'PJ';
      const lv = Number(s.lvl) || 0;

      // Coût en ressource écrit dans le nom, ex. « Ténèbres (2 ki) » : on décompte
      // la ressource correspondante (ki, rage…) au lieu d'un emplacement de sort.
      let usedResource = false;
      const costM = String(s.nm || '').match(/\((\d+)\s*([\p{L}' ]+?)\)\s*$/u);
      if (costM) {
        const cost = Number(costM[1]);
        const rname = costM[2].normalize('NFC').trim().toLowerCase();
        const resources = [...(cur.data.resources || [])];
        const ri = resources.findIndex((r) => String(r.name || '').normalize('NFC').trim().toLowerCase() === rname);
        if (ri >= 0) {
          const r = { ...resources[ri] };
          const remaining = (r.max || 0) - (r.used || 0);
          if (cost > remaining) {
            const ok = await modalConfirm(`Pas assez de ${r.name} (${remaining}/${r.max}). Lancer quand même ?`, { title: 'Ressource', okLabel: 'Lancer' });
            if (!ok) return;
          } else {
            r.used = (r.used || 0) + cost;
            resources[ri] = r;
            updateCharacter(id, { resources });
          }
          usedResource = true;
        }
      }

      if (!usedResource && lv > 0) {
        const slots = { ...(cur.data.slots || {}) };
        const slot = { ...(slots[lv] || { m: 0, u: 0 }) };
        if ((slot.u || 0) >= (slot.m || 0)) {
          const ok = await modalConfirm(`Aucun emplacement de niveau ${lv} disponible. Lancer quand même ?`, { title: 'Sorts', okLabel: 'Lancer' });
          if (!ok) return;
        } else {
          slot.u = (slot.u || 0) + 1;
          slots[lv] = slot;
          updateCharacter(id, { slots });
        }
      }
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      if (s.atk) sendD20Check(normBon(resolveNotation(s.atk, cur.data)), `${who} — ${s.nm || 'Sort'} (attaque)`, { mode });
      if (s.dmg) sendRoll(resolveNotation(s.dmg, cur.data), 'public', `${who} — ${s.nm || 'Sort'} (dégâts)`);
      logCombat(`✨ ${who} lance ${s.nm || 'un sort'}${lv ? ` (niv. ${lv})` : ''}${s.dc ? ` — DD ${s.dc}` : ''}.`);
      showToast(`✨ ${s.nm || 'Sort'} lancé`, { timeout: 1800 });
    })
  );
  // Carte d'action : attaques et sorts (description + jets attaque/dégâts/critique/DD).
  el.querySelectorAll('[data-cardatk]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = store.get().characters.find((c) => c.id === id);
      const a = (cur?.data.atks || [])[Number(b.dataset.cardatk)];
      if (a) openActionCard({ charId: id, who: cur.name || 'PJ', kind: 'atk', item: a });
    })
  );
  el.querySelectorAll('[data-cardspell]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = store.get().characters.find((c) => c.id === id);
      const s = (cur?.data.spells || [])[Number(b.dataset.cardspell)];
      if (s) openActionCard({ charId: id, who: cur.name || 'PJ', kind: 'spell', item: s });
    })
  );
  el.querySelectorAll('[data-cardfeat]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const cur = store.get().characters.find((c) => c.id === id);
      const f = (cur?.data.features || [])[Number(b.dataset.cardfeat)];
      if (f) openActionCard({ charId: id, who: cur.name || 'PJ', kind: 'atk', item: { nm: f.nm || 'Aptitude', desc: f.desc || '', noAtk: true } });
    })
  );
  el.querySelectorAll('[data-feat]').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.feat);
      const cur = store.get().characters.find((c) => c.id === id);
      const features = [...(cur.data.features || [])];
      features[i] = { ...features[i], [input.dataset.k]: input.value };
      updateCharacter(id, { features });
    })
  );
  el.querySelectorAll('[data-delfeat]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const features = (cur.data.features || []).filter((_, idx) => idx !== Number(b.dataset.delfeat));
      updateCharacter(id, { features });
    })
  );

  el.querySelector('[data-export]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (cur) exportCharacterJson(cur);
  });

  // Ajouts
  el.querySelector('[data-add="feat"]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const features = [...(cur.data.features || []), { nm: '', lvl: '', desc: '' }];
    updateCharacter(id, { features });
  });
  el.querySelector('[data-add="atk"]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const atks = [...(cur.data.atks || []), { nm: '', bon: '', dmg: '', typ: '', prop: '' }];
    updateCharacter(id, { atks });
  });
  el.querySelector('[data-add="spell"]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const spells = [...(cur.data.spells || []), { nm: '', lvl: 0 }];
    updateCharacter(id, { spells });
  });
  el.querySelector('[data-add="inv"]')?.addEventListener('click', () => {
    const cur = store.get().characters.find((c) => c.id === id);
    const inv = [...(cur.data.inv || []), { nm: '', qty: 1, wt: '', note: '' }];
    updateCharacter(id, { inv });
  });

  // Monnaie
  el.querySelectorAll('[data-coin]').forEach((input) =>
    input.addEventListener('change', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const coins = { ...(cur.data.coins || {}), [input.dataset.coin]: Math.max(0, Number(input.value) || 0) };
      updateCharacter(id, { coins });
    })
  );
  // Inventaire
  el.querySelectorAll('[data-inv]').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.inv);
      const cur = store.get().characters.find((c) => c.id === id);
      const inv = [...(cur.data.inv || [])];
      inv[i] = { ...inv[i], [input.dataset.k]: input.value };
      updateCharacter(id, { inv });
    })
  );
  el.querySelectorAll('[data-delinv]').forEach((b) =>
    b.addEventListener('click', () => {
      const cur = store.get().characters.find((c) => c.id === id);
      const inv = (cur.data.inv || []).filter((_, idx) => idx !== Number(b.dataset.delinv));
      updateCharacter(id, { inv });
    })
  );
}

/* ── Helpers ──────────────────────────────────────────────── */

function toNum(v) {
  if (v === '') return '';
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function toggleArr(id, field, key) {
  const cur = store.get().characters.find((c) => c.id === id);
  const arr = new Set(cur.data[field] || []);
  if (arr.has(key)) arr.delete(key);
  else arr.add(key);
  updateCharacter(id, { [field]: [...arr] });
}

async function updateName(id, name) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!canEdit(cur)) return;
  if (!nameSavers.has(id)) {
    nameSavers.set(
      id,
      debounce(async (charId, value) => {
        await backend.db.from('characters').update({ name: value }).eq('id', charId);
      }, 700)
    );
  }
  nameSavers.get(id)(id, name);
}

// Expose la suppression pour un éventuel bouton MJ (gardé pour usage futur).
export { deleteCharacter };
