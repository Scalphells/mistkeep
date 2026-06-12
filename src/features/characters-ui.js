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
  loadCharPrivate,
  updateCharPrivate,
  subscribeCharPrivate,
} from './characters.js';
import { parseStatblockActions } from '../lib/statblock.js';
import {
  CLASSES,
  RACES,
  BACKGROUNDS,
  classByLabel as classByLabel5e,
  raceByLabel as raceByLabel5e,
  backgroundByLabel as backgroundByLabel5e,
  subclassByLabel as subclassByLabel5e,
  deriveClassPatch,
  deriveRacePatch,
  deriveBackgroundPatch,
  deriveSubclassPatch,
  classStartingEquipment,
  suggestHpMax,
  applyRaceMods,
  mergeFeatsBlock,
  isSrdMarker,
  srdManagedLines,
  totalLevel,
  profBonusForLevel,
  combinedCasterLevel,
  multiclassSpellSlots,
  hitDiceSummary,
  deriveProficiencies,
} from '../lib/srd5e.js';
import { getSystem } from '../lib/systems/index.js';
import { activeCampaign } from '../lib/campaigns.js';

/* ── Contenu SRD du système actif ──────────────────────────────
 * Un système d'identité « srd5e » peut embarquer SON contenu (sys.srd :
 * espèces/races, classes, historiques, sous-classes — cf. dnd5e2024.js) ; à
 * défaut, repli sur le SRD 5.1 (D&D 5e 2014) de srd5e.js. Les fonctions
 * derive* acceptent les entrées en paramètre : la machinerie (gabarits ⚙,
 * emplacements, PV suggérés) est partagée entre les deux éditions. Les
 * wrappers gardent les NOMS historiques pour que tous les appels existants
 * deviennent conscients du système sans changement. */

function srdContent() {
  return getSystem(activeCampaign()?.system).srd || null;
}

function classByLabel(label) {
  const c = srdContent();
  return c ? c.classes.find((x) => x.label === label) || null : classByLabel5e(label);
}

function raceByLabel(label) {
  const c = srdContent();
  return c ? c.races.find((x) => x.label === label) || null : raceByLabel5e(label);
}

function backgroundByLabel(label) {
  const c = srdContent();
  return c ? c.backgrounds.find((x) => x.label === label) || null : backgroundByLabel5e(label);
}

function subclassByLabel(label) {
  const c = srdContent();
  if (!c) return subclassByLabel5e(label);
  const e = label && c.subclasses ? c.subclasses[label] : null;
  return e ? { label, ...e } : null;
}

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
  await loadCharPrivate();
  const unsubRealtime = subscribeCharacters();
  const unsubPrivate = subscribeCharPrivate();
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
    unsubPrivate();
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
  const sig = cur ? `${JSON.stringify(cur)}|${store.get().charPrivate?.[cur.id] ?? ''}` : '';
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
  feats: 'Aptitudes', equip: 'Équipement', notes: 'Notes', story: 'Histoire partagée', resources: 'Ressources', features: 'Capacités',
  spd: 'Vitesse', darkvision: 'Vision', size: 'Taille',
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

/* ── Application d'un gabarit SRD (classe / race) ─────────────────────────
 * Aperçu + confirmation : calcule les champs dérivés du choix, montre un diff,
 * propose un sélecteur de compétences (classe) ou de caractéristiques au choix
 * (race), puis applique TOUT en un seul updateCharacter (évite la course du
 * debounce). Rien n'est écrit sans validation.
 */

/** Lignes du bloc « aptitudes » géré (aptitudes/traits + maîtrises, langues, sorts). */
function srdFeatLines(data) {
  return srdManagedLines(data);
}

/** Synthèse courte d'un jeu d'emplacements de sorts (« Niv.1 ×2 · Niv.2 ×3 »). */
function slotsSumm(slots) {
  if (!slots || !Object.keys(slots).length) return '∅';
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((lv) => `Niv.${lv} ×${slots[lv].m}`)
    .join(' · ');
}

async function openDeriveModal(id, mode) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!cur || !canEdit(cur)) return;
  const data = cur.data || {};
  const classEntry = classByLabel(data.cls);
  const raceEntry = raceByLabel(data.race);
  const bgEntry = backgroundByLabel(data.bg);
  const subEntry = subclassByLabel(data.sub);
  if (mode === 'class' && !classEntry) return;
  if (mode === 'race' && !raceEntry) return;
  if (mode === 'bg' && !bgEntry) return;
  if (mode === 'sub' && !subEntry) return;

  let skillCfg = null; // {count, list, mode} (sélecteur de compétences)
  let abilityCfg = null; // {count, amount, from} (mode race, bonus flexibles)

  const abLabel = (k) => ABILITIES.find((a) => a.key === k)?.label || k;
  const skLabel = (k) => SKILLS[k]?.label || k;
  const showVal = (key, v) => {
    if (key === 'saves' && Array.isArray(v)) return v.map(abLabel).join(', ') || '∅';
    if (key === 'profs' && Array.isArray(v)) return v.map(skLabel).join(', ') || '∅';
    if (key === 'sc') return v ? abLabel(v) : 'aucune';
    return valSumm(v);
  };

  // Lignes cochables de l'aperçu. kind 'field' → patch[key] = to ;
  // kind 'ability' → contribue au delta racial (appliqué via applyRaceMods).
  const rows = [];
  let rid = 0;
  const addField = (key, to, disp) => {
    const from = data[key];
    if (JSON.stringify(from) === JSON.stringify(to)) return;
    rows.push({
      id: `r${rid++}`, kind: 'field', key, to, label: fieldLabel(key),
      fromDisp: disp ? disp.from : showVal(key, from),
      toDisp: disp ? disp.to : showVal(key, to),
    });
  };

  let headTitle = '';
  if (mode === 'class') {
    headTitle = classEntry.label;
    const dc = deriveClassPatch(data, classEntry);
    addField('hdSize', dc.patch.hdSize);
    addField('hdMax', dc.patch.hdMax);
    addField('hd', dc.patch.hd);
    addField('saves', dc.patch.saves);
    // N'efface PAS la carac. d'incantation pour une classe non-lanceuse
    // (préserve les sous-classes lanceuses, ex. Voie de l'Ombre).
    if (dc.patch.sc) addField('sc', dc.patch.sc);
    const raceHp = raceByLabel(data.race)?.hpPerLevel || 0; // ex. Robustesse naine
    addField('hpMax', suggestHpMax({ ...data, hdSize: dc.patch.hdSize }, raceHp));
    // Emplacements de sorts selon classe + niveau (préserve les « utilisés »).
    if (dc.spellSlots) {
      const cur = data.slots || {};
      const merged = {};
      for (const [lv, sl] of Object.entries(dc.spellSlots)) {
        merged[lv] = { m: sl.m, u: Math.min(Number(cur[lv]?.u) || 0, sl.m) };
      }
      addField('slots', merged, { from: slotsSumm(data.slots), to: slotsSumm(merged) });
    }
    skillCfg = { count: dc.skillOptions.count, list: dc.skillOptions.list, mode: 'class' };
  } else if (mode === 'bg') {
    headTitle = bgEntry.label;
    const db = deriveBackgroundPatch(data, bgEntry);
    // Maîtrises d'historique : additif, on n'affiche que les AJOUTS.
    const added = db.skills.filter((k) => !(data.profs || []).includes(k));
    if (added.length) {
      const to = [...new Set([...(data.profs || []), ...db.skills])];
      addField('profs', to, { from: '', to: `+ ${added.map(skLabel).join(', ')}` });
    }
  } else if (mode === 'sub') {
    // Sous-classe : seul le bloc d'aptitudes change (ajouté plus bas, selon le niveau).
    headTitle = subEntry.label;
  } else {
    headTitle = raceEntry.label;
    const dr = deriveRacePatch(data, raceEntry);
    // Vitesse : ne pas réduire si l'actuelle est déjà supérieure (bonus de classe).
    if (!((Number(data.spd) || 0) > dr.patch.spd)) addField('spd', dr.patch.spd);
    addField('darkvision', dr.patch.darkvision);
    addField('size', dr.patch.size);
    // Bonus de caractéristiques déterministes — une ligne cochable par carac.
    const det = applyRaceMods(data, dr.abilityDelta);
    for (const [k, v] of Object.entries(det.scores)) {
      rows.push({
        id: `r${rid++}`, kind: 'ability', key: k, to: v, delta: dr.abilityDelta[k],
        label: fieldLabel(k), fromDisp: showVal(k, data[k]), toDisp: showVal(k, v),
      });
    }
    abilityCfg = dr.abilityChoose;
    if (dr.skillChoose) {
      const from = dr.skillChoose.from === 'all' ? Object.keys(SKILLS) : dr.skillChoose.from;
      skillCfg = { count: dr.skillChoose.count, list: from, mode: 'race' };
    }
    if (dr.hpPerLevel && Number(data.hdSize)) addField('hpMax', suggestHpMax(data, dr.hpPerLevel));
  }

  // Bloc d'aptitudes (features de classe + traits de race + historique).
  const featLines = srdFeatLines(data);
  const newFeats = mergeFeatsBlock(data.feats, featLines);
  if (newFeats !== (data.feats || '')) {
    addField('feats', newFeats, { from: '…', to: `${featLines.length} ligne(s) SRD` });
  }

  // Compétences raciales fixes (ajoutées d'office) — utiles pour le mode classe aussi.
  const racialFixed = raceEntry ? raceEntry.fixedSkills || [] : [];

  // Sélecteur de compétences de classe (hors compétences raciales fixes).
  let pickList = [];
  let preChecked = new Set();
  if (skillCfg) {
    pickList = skillCfg.list.filter((k) => !racialFixed.includes(k));
    // En mode classe, on pré-coche les maîtrises déjà présentes (ré-application
    // non destructive) ; en mode race (choix libre), on laisse vide.
    if (skillCfg.mode === 'class') {
      preChecked = new Set((data.profs || []).filter((k) => pickList.includes(k)).slice(0, skillCfg.count));
    }
  }

  const rowsHtml = rows
    .map(
      (r) => `<label class="diff-row pickable">
        <input type="checkbox" data-apply="${r.id}" checked />
        <span class="diff-k">${escapeHtml(r.label)}</span>
        <span class="diff-old">${escapeHtml(r.fromDisp)}</span>
        <span class="diff-arrow">→</span>
        <span class="diff-new">${escapeHtml(r.toDisp)}</span>
      </label>`
    )
    .join('');

  const skillHtml = skillCfg
    ? `<div class="derive-pick">
         <div class="derive-pick-h">${skillCfg.mode === 'race' ? 'Compétences raciales' : 'Compétences de classe'} — choisis-en <b>${skillCfg.count}</b> <span class="derive-count">(0 / ${skillCfg.count})</span></div>
         ${racialFixed.length ? `<div class="derive-fixed">Raciales (incluses) : ${racialFixed.map((k) => escapeHtml(SKILLS[k]?.label || k)).join(', ')}</div>` : ''}
         <div class="derive-grid">
           ${pickList
             .map(
               (k) => `<label class="derive-opt"><input type="checkbox" data-skillpick value="${k}" ${preChecked.has(k) ? 'checked' : ''}/> ${escapeHtml(SKILLS[k]?.label || k)}</label>`
             )
             .join('')}
         </div>
       </div>`
    : '';

  const abilityHtml = abilityCfg
    ? `<div class="derive-pick">
         <div class="derive-pick-h">Bonus de caractéristique au choix — +${abilityCfg.amount} sur <b>${abilityCfg.count}</b> <span class="derive-count">(0 / ${abilityCfg.count})</span></div>
         <div class="derive-grid">
           ${abilityCfg.from
             .map(
               (k) => `<label class="derive-opt"><input type="checkbox" data-abilpick value="${k}"/> ${escapeHtml(ABILITIES.find((a) => a.key === k)?.label || k)}</label>`
             )
             .join('')}
         </div>
       </div>`
    : '';

  const nothing = !rows.length && !skillCfg && !abilityCfg;

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card diff-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">Appliquer « ${escapeHtml(headTitle)} » ?</h3>
      <p class="modal-msg">${nothing ? 'Cette fiche est déjà à jour pour ce choix.' : 'Décoche ce que tu ne veux pas appliquer :'}</p>
      <div class="diff-list">${rowsHtml || '<div class="dock-empty">—</div>'}</div>
      ${skillHtml}
      ${abilityHtml}
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">Annuler</button>
        <button class="modal-btn modal-ok">Appliquer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);

  const okBtn = ov.querySelector('.modal-ok');
  const skillBoxes = [...ov.querySelectorAll('[data-skillpick]')];
  const abilBoxes = [...ov.querySelectorAll('[data-abilpick]')];

  const refresh = () => {
    let ok = true;
    if (skillCfg) {
      const checked = skillBoxes.filter((b) => b.checked);
      const n = checked.length;
      ov.querySelectorAll('.derive-pick')[0].querySelector('.derive-count').textContent = `(${n} / ${skillCfg.count})`;
      skillBoxes.forEach((b) => {
        b.disabled = !b.checked && n >= skillCfg.count;
      });
      if (n !== skillCfg.count) ok = false;
    }
    if (abilityCfg) {
      const checked = abilBoxes.filter((b) => b.checked);
      const n = checked.length;
      // Le compteur des caractéristiques est le dernier .derive-count.
      const counters = ov.querySelectorAll('.derive-count');
      counters[counters.length - 1].textContent = `(${n} / ${abilityCfg.count})`;
      abilBoxes.forEach((b) => {
        b.disabled = !b.checked && n >= abilityCfg.count;
      });
      if (n !== abilityCfg.count) ok = false;
    }
    okBtn.disabled = !ok;
  };
  skillBoxes.forEach((b) => b.addEventListener('change', refresh));
  abilBoxes.forEach((b) => b.addEventListener('change', refresh));
  refresh();

  const close = () => ov.remove();
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });

  okBtn.addEventListener('click', () => {
    const patch = {};
    const appliedDelta = {}; // bonus de carac. raciaux effectivement appliqués

    // Lignes cochées uniquement.
    for (const r of rows) {
      const box = ov.querySelector(`[data-apply="${r.id}"]`);
      if (box && !box.checked) continue;
      if (r.kind === 'ability') appliedDelta[r.key] = r.delta;
      else patch[r.key] = r.to;
    }

    if (skillCfg && skillCfg.mode === 'class') {
      // Remplace la portion « compétences de classe » par les choix, conserve le reste.
      const chosen = skillBoxes.filter((b) => b.checked).map((b) => b.value);
      const keep = (data.profs || []).filter((k) => !skillCfg.list.includes(k));
      patch.profs = [...new Set([...keep, ...chosen, ...racialFixed])];
    } else if (skillCfg && skillCfg.mode === 'race') {
      // Choix raciaux : additif (ne retire jamais une maîtrise existante).
      const chosen = skillBoxes.filter((b) => b.checked).map((b) => b.value);
      patch.profs = [...new Set([...(patch.profs || data.profs || []), ...chosen, ...racialFixed])];
    } else if (racialFixed.length) {
      const baseP = patch.profs || data.profs || []; // préserve les profs déjà calculées (ex. historique)
      patch.profs = [...new Set([...baseP, ...racialFixed])];
    }

    if (mode === 'race') {
      if (abilityCfg) {
        for (const b of abilBoxes.filter((x) => x.checked)) {
          appliedDelta[b.value] = (Number(appliedDelta[b.value]) || 0) + abilityCfg.amount;
        }
      }
      const det = applyRaceMods(data, appliedDelta);
      Object.assign(patch, det.scores);
      patch._raceMods = det._raceMods;
    }

    close();
    if (Object.keys(patch).length) updateCharacter(id, patch);
    showToast(`✨ Gabarit « ${headTitle} » appliqué.`, { type: 'success', timeout: 2600 });
  });
}

/**
 * Bloc « Multiclassage » : classes secondaires (en plus de la classe principale).
 * Affiche une synthèse (niveau total, maîtrise, dés de vie, niveau de lanceur
 * combiné) et, en édition, un éditeur de classes secondaires + bouton Appliquer.
 */
function multiclassSection(d, ed) {
  const mc = d.mc || [];
  if (!ed && !mc.length) return ''; // rien à montrer au joueur sans multiclasse
  const total = totalLevel(d);
  const prof = profBonusForLevel(total);
  const hd = hitDiceSummary(d) || '—';
  const ccl = combinedCasterLevel(d);
  const summary = `Niveau total <b>${total}</b> · Maîtrise <b>+${prof}</b> · Dés de vie <b>${escapeHtml(hd)}</b>${ccl > 0 ? ` · Lanceur combiné <b>${ccl}</b>` : ''}`;
  const rows = mc
    .map((e, i) => {
      if (!ed) {
        return `<div class="mc-line">${escapeHtml(e.cls || '—')}${e.sub ? ` (${escapeHtml(e.sub)})` : ''} · niv.${num(e.lvl) || 1}</div>`;
      }
      const subs = (CLASSES.find((c) => c.label === e.cls)?.subclasses) || [];
      return `<div class="mc-edit">
        <select class="sf" data-mc-i="${i}" data-mc-k="cls">
          <option value="">— Classe —</option>
          ${CLASSES.map((c) => `<option value="${escapeHtml(c.label)}" ${c.label === e.cls ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
        </select>
        <select class="sf" data-mc-i="${i}" data-mc-k="sub">
          <option value="">— Sous-classe —</option>
          ${subs.map((s) => `<option value="${escapeHtml(s)}" ${s === e.sub ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
        <input type="number" class="sf-num mc-lvl" min="1" max="20" value="${num(e.lvl) || 1}" data-mc-i="${i}" data-mc-k="lvl"/>
        <button class="mini-del" data-mc-del="${i}">×</button>
      </div>`;
    })
    .join('');
  return `<details class="sheet-block mc-block" ${mc.length ? 'open' : ''}>
    <summary>🔀 Multiclassage</summary>
    <div class="mc-summary">${summary}</div>
    <div class="mc-list">${rows || '<div class="char-empty">Aucune classe secondaire.</div>'}</div>
    ${ed ? `<div class="mc-actions"><button class="mini-add" data-mc-add>+ Classe secondaire</button> <button class="rest-btn" data-mc-apply title="Recalcule maîtrise, emplacements de sorts combinés et aptitudes">⚙ Appliquer</button></div>
       <div class="feats-hint">La classe principale (ci-dessus) reste le pilier (sauvegardes, dé de vie principal). « Appliquer » recalcule la maîtrise selon le niveau total et combine les emplacements de sorts.</div>` : ''}
  </details>`;
}

/** Applique le multiclassage : bonus de maîtrise (niveau total), emplacements combinés, aptitudes. */
async function openMulticlassApply(id) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!cur || !canEdit(cur)) return;
  const d = cur.data || {};
  const total = totalLevel(d);
  const prof = profBonusForLevel(total);
  const slots = multiclassSpellSlots(d);
  const feats = mergeFeatsBlock(d.feats, srdFeatLines(d));
  const bits = [`Niveau total ${total} → maîtrise +${prof}`];
  if (slots) bits.push(`Emplacements combinés : ${slotsSumm(slots)}`);
  bits.push('Aptitudes des classes secondaires ajoutées');
  if (!(await modalConfirm(bits.join(' · '), { title: '🔀 Appliquer le multiclassage', okLabel: 'Appliquer' }))) return;
  const patch = { prof };
  if (slots) {
    const cur0 = d.slots || {};
    const s = {};
    for (const [lv, sl] of Object.entries(slots)) s[lv] = { m: sl.m, u: Math.min(Number(cur0[lv]?.u) || 0, sl.m) };
    patch.slots = s;
  }
  if (feats !== (d.feats || '')) patch.feats = feats;
  updateCharacter(id, patch);
  showToast('🔀 Multiclassage appliqué.', { type: 'success', timeout: 2600 });
}

/**
 * Encart en lecture seule « Maîtrises, langues & sorts », calculé en direct
 * depuis la classe / race / historique (toujours à jour, sans application).
 */
function profileSummarySection(d) {
  const p = deriveProficiencies(d);
  const tools = p.tools.join(' ; ');
  const langs = p.languages.join(' ; ');
  const sorts = p.casterClass && p.spellLine
    ? `${p.cantrips ? `${p.cantrips} sort(s) mineur(s) · ` : ''}${p.spellLine}`
    : '';
  if (!p.armor && !p.weapons && !tools && !langs && !sorts) return '';
  const row = (label, val) =>
    val ? `<div class="ps-row"><span class="ps-k">${label}</span><span class="ps-v">${escapeHtml(val)}</span></div>` : '';
  return `<section class="sheet-block">
      <h3>Maîtrises, langues & sorts</h3>
      ${row('Armures', p.armor)}
      ${row('Armes', p.weapons)}
      ${row('Outils', tools)}
      ${row('Langues', langs)}
      ${row('Sorts', sorts)}
      <div class="feats-hint">Déduit de la classe, la race et l'historique. Le détail est aussi inséré dans « Capacités &amp; traits ».</div>
    </section>`;
}

/** Libellé court d'un objet d'inventaire (avec quantité). */
function itemLabel(it) {
  return Number(it.qty) > 1 ? `${it.nm} ×${it.qty}` : it.nm;
}

/**
 * Équipement de départ : kit de classe (avec choix (a)/(b)) + objets et or de
 * l'historique. Action additive, déclenchée explicitement (bouton). Un drapeau
 * `_startKit` évite l'ajout en double par mégarde.
 */
function openStartingEquipment(id) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!cur || !canEdit(cur)) return;
  const data = cur.data || {};
  const classEntry = classByLabel(data.cls);
  const bgEntry = backgroundByLabel(data.bg);
  const groups = classStartingEquipment(classEntry || data.cls);
  const bgKit = bgEntry ? deriveBackgroundPatch(data, bgEntry) : null;

  if (!groups.length && !bgKit) {
    modalAlert('Choisis d’abord une classe ou un historique SRD pour proposer un équipement de départ.', { title: 'Équipement de départ' });
    return;
  }

  let gi = 0;
  const groupsHtml = groups
    .map((g) => {
      if (g.fixed) return `<div class="eq-group eq-fixed">${g.fixed.map((it) => escapeHtml(itemLabel(it))).join(' · ')}</div>`;
      const idx = gi++;
      return `<div class="eq-group">${g.choose
        .map((opt, oi) => `<label class="derive-opt"><input type="radio" name="eq-${idx}" value="${oi}" ${oi === 0 ? 'checked' : ''}/> ${escapeHtml(opt.label)}</label>`)
        .join('')}</div>`;
    })
    .join('');

  const bgHtml = bgKit
    ? `<div class="derive-pick">
         <div class="derive-pick-h">Historique — ${escapeHtml(bgEntry.label)}</div>
         <div class="eq-fixed">${bgKit.equipment.map((it) => escapeHtml(itemLabel(it))).join(' · ')}${bgKit.gold ? ` · <b>${bgKit.gold} po</b>` : ''}</div>
       </div>`
    : '';

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card diff-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">🎒 Équipement de départ</h3>
      ${data._startKit ? '<p class="modal-msg" style="color:var(--yellow)">⚠ Un équipement de départ a déjà été ajouté à cette fiche.</p>' : '<p class="modal-msg">Choisis tes options, puis ajoute le tout à l’inventaire :</p>'}
      ${classEntry ? `<div class="derive-pick"><div class="derive-pick-h">Classe — ${escapeHtml(classEntry.label)}</div>${groupsHtml}</div>` : ''}
      ${bgHtml}
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">Annuler</button>
        <button class="modal-btn modal-ok">Ajouter à l'inventaire</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });

  ov.querySelector('.modal-ok').addEventListener('click', () => {
    const items = [];
    let ci = 0;
    for (const g of groups) {
      if (g.fixed) {
        items.push(...g.fixed);
        continue;
      }
      const sel = ov.querySelector(`input[name="eq-${ci}"]:checked`);
      ci++;
      const opt = g.choose[Number(sel?.value) || 0];
      if (opt) items.push(...opt.items);
    }
    if (bgKit) items.push(...bgKit.equipment);

    // Fusionne dans l'inventaire (regroupe les quantités par nom).
    const inv = [...(data.inv || [])];
    for (const it of items) {
      const ix = inv.findIndex((x) => x.nm === it.nm);
      if (ix >= 0) inv[ix] = { ...inv[ix], qty: (Number(inv[ix].qty) || 0) + (Number(it.qty) || 1) };
      else inv.push({ nm: it.nm, qty: it.qty || 1, wt: '', note: 'Départ' });
    }
    const patch = { inv, _startKit: true };
    if (bgKit?.gold) {
      const coins = { ...(data.coins || {}) };
      coins.po = (Number(coins.po) || 0) + bgKit.gold;
      patch.coins = coins;
    }
    close();
    updateCharacter(id, patch);
    showToast(`🎒 Équipement de départ ajouté (${items.length} objet(s)${bgKit?.gold ? `, ${bgKit.gold} po` : ''}).`, { type: 'success', timeout: 3000 });
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
  renderedSig = c ? `${JSON.stringify(c)}|${store.get().charPrivate?.[c.id] ?? ''}` : '';

  if (!c) {
    el.innerHTML = `<div class="char-empty">Sélectionne un personnage.</div>`;
    return;
  }

  const d = c.data || {};
  // Une campagne = un système : le descripteur vient de la campagne active,
  // avec repli sur celui posé sur la fiche (créations antérieures), puis 5e.
  const sys = getSystem(activeCampaign()?.system || d.system);
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

  // Le descripteur déclare les sections de SA fiche (cf. systems/dnd5e2014.js).
  const sheet = sys.sheet || { tabs: Object.keys(TAB_DEFS), rail: ['hp', 'hitdice', 'stats', 'extras', 'saves'], identity: 'srd5e' };
  if (!sheet.tabs.includes(sheetTab)) sheetTab = sheet.tabs[0];
  const TABS = sheet.tabs.map((id) => ({ id, label: TAB_DEFS[id] || id }));
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
        ${sheet.rail.map((id) => railBlock(id, sys, d, ed, ro)).join('')}
        ${ownerRow}
      </aside>

      <main class="sheet-main">
        <nav class="sheet-tabs">
          ${TABS.map((t) => `<button class="sheet-tab ${t.id === sheetTab ? 'active' : ''}" data-pane="${t.id}">${t.label}</button>`).join('')}
        </nav>
        <div class="sheet-panes">
          ${TABS.map((t) => `<section class="tab-pane ${t.id === sheetTab ? 'active' : ''}" data-pane="${t.id}">${paneContent(t.id, sys, sheet, c, d, ed, ro)}</section>`).join('')}
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

/* ── Moteur de sections ───────────────────────────────────────
 * La fiche est assemblée depuis le schéma du descripteur de système
 * (sys.sheet : tabs / rail / identity — cf. systems/dnd5e2014.js). Un système
 * non-5e déclare le sous-ensemble qui a du sens pour lui ; les gestionnaires
 * d'événements (bindSheet) sont tolérants aux sections absentes. */

const TAB_DEFS = {
  stats: '📊 Caractéristiques',
  combat: '⚔ Combat',
  spells: '✨ Sorts',
  feats: '🎴 Aptitudes',
  inv: '🎒 Inventaire',
  story: '📖 Histoire',
  notes: '📝 Notes',
};

/** Un bloc du rail gauche, par identifiant de section. */
function railBlock(id, sys, d, ed, ro) {
  switch (id) {
    case 'hp':
      return hpRailBlock(d, ed, ro);
    case 'hitdice':
      return `<div class="hd-block">
          <span class="hd-title">Dés de vie</span>
          <span class="hd-line">
            <input type="number" class="hd-cur" value="${num(d.hd ?? (d.hdMax ?? (Number(d.lvl) || 1)))}" data-d="hd" ${ro}/>
            <span>/</span>
            <input type="number" class="hd-max" value="${num(d.hdMax ?? (Number(d.lvl) || 1))}" data-d="hdMax" ${ro}/>
            <span class="hd-d">d</span>
            <input type="number" class="hd-size" value="${num(d.hdSize ?? 8)}" data-d="hdSize" min="4" max="12" step="2" ${ro}/>
          </span>
          ${ed ? `<button class="rest-btn hd-spend" data-hd-spend title="Dépenser un dé de vie (1dN + mod. CON)">🎲 Dépenser</button>` : ''}
        </div>`;
    case 'stats':
      return `<div class="rail-stats">
          ${stat('CA', 'ac', d.ac, ro)}
          ${stat('Init.', 'initB', d.initB, ro, '', true)}
          ${stat('Vitesse', 'spd', d.spd, ro, 'm')}
          ${stat('Vision', 'darkvision', d.darkvision, ro, 'm')}
          ${sizeStat(d.size, ro)}
          ${stat('Maîtrise', 'prof', d.prof, ro, '', true)}
        </div>`;
    case 'extras':
      return `<div class="rail-extras">
          <button class="insp-btn ${d.insp ? 'on' : ''}" data-insp ${ro} title="Inspiration héroïque">✨ Inspiration</button>
          <div class="passive-pp" title="Perception passive (10 + bonus de Perception)">👁 Perception passive <b>${10 + skillBonus(d, 'perception')}</b></div>
          <div class="exh-block">
            <span class="exh-lbl">Épuisement</span>
            <div class="exh-dots">${[1, 2, 3, 4, 5, 6].map((i) => `<button class="exh-dot ${(Number(d.exh) || 0) >= i ? 'on' : ''}" data-exh="${i}" ${ro} title="Niveau ${i}"></button>`).join('')}</div>
          </div>
        </div>`;
    case 'saves':
      return `<section class="sheet-block rail-block">
          <h3>Jets de sauvegarde</h3>
          ${sys.abilities.map((a) => saveRow(a, d, ed, sys)).join('')}
        </section>`;
  }
  return '';
}

function hpRailBlock(d, ed, ro) {
  const max = Number(d.hpMax) || 0;
  const cur = Math.max(0, Number(d.hp) || 0);
  const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const col = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--yellow)' : 'var(--red)';
  const fill = `linear-gradient(90deg, color-mix(in srgb, ${col} 72%, #000), ${col})`;
  const deathSaves = () => {
    const ds = d.ds || { s: 0, f: 0 };
    const status = ds.s >= 3 ? ' · Stabilisé' : ds.f >= 3 ? ' · Mort 💀' : '';
    const dot = (field, i, on) => `<button class="ds-dot ${on ? 'on ' + field : ''}" data-ds="${field}" data-i="${i}" ${ro}></button>`;
    return `<div class="death-saves">
        <div class="ds-label">Jets de mort${status}</div>
        <div class="ds-row"><span>Réussites</span>${[1, 2, 3].map((i) => dot('s', i, ds.s >= i)).join('')}</div>
        <div class="ds-row"><span>Échecs</span>${[1, 2, 3].map((i) => dot('f', i, ds.f >= i)).join('')}</div>
      </div>`;
  };
  return `<div class="combat-hp rail-hp">
      <div class="hp-label">Points de vie</div>
      <div class="hp-row">
        ${ed ? `<button class="hp-btn" data-hp="-1">−</button>` : ''}
        <input type="number" class="hp-cur" value="${num(d.hp)}" data-d="hp" ${ro}/>
        <span class="hp-sep">/</span>
        <input type="number" class="hp-max" value="${num(d.hpMax)}" data-d="hpMax" ${ro}/>
        ${ed ? `<button class="hp-btn" data-hp="1">+</button>` : ''}
      </div>
      <div class="hpbar"><span style="width:${pct}%; background:${fill}"></span></div>
      <div class="hp-tmp">PV temp <input type="number" value="${num(d.hpTmp)}" data-d="hpTmp" ${ro}/></div>
      ${Number(d.hp) === 0 ? deathSaves() : ''}
      ${
        ed
          ? `<div class="rest-row">
               <button class="rest-btn" data-rest="short" title="Repos court : récupère les ressources « repos court »">🔥 Repos court</button>
               <button class="rest-btn" data-rest="long" title="Repos long : PV au max, emplacements restaurés, ½ dés de vie">🛌 Repos long</button>
             </div>`
          : ''
      }
    </div>`;
}

/** Bloc d'identité : sélecteurs SRD 5e, ou champs libres (systèmes custom). */
function identityBlock(sheet, d, ed, ro) {
  if (sheet.identity !== 'srd5e') {
    return `<div class="sheet-id-grid">
        <input class="sf" value="${escapeHtml(d.cls || '')}" data-d="cls" placeholder="Classe / Archétype" ${ro}/>
        <input class="sf" value="${escapeHtml(d.race || '')}" data-d="race" placeholder="Peuple / Origine" ${ro}/>
        <input class="sf" value="${escapeHtml(d.bg || '')}" data-d="bg" placeholder="Historique" ${ro}/>
        <span class="sf-num">Niv.<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
        <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="Alignement" ${ro}/>
        <span class="sf-num">XP<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
        <button class="sf-levelup" data-export title="Exporter cette fiche en JSON (sauvegarde / transfert)">💾 JSON</button>
      </div>`;
  }
  const srd = srdContent(); // listes du système actif (2024…), sinon SRD 5.1
  return `<div class="sheet-id-grid">
      ${idSelect('race', srd?.racesLabel || 'Race', srd?.races || RACES, d.race, ro, ed)}
      ${idSelect('cls', 'Classe', srd?.classes || CLASSES, d.cls, ro, ed)}
      ${subSelect(d, ro, ed)}
      <span class="sf-num">Niv.<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
      ${idSelect('bg', 'Historique', srd?.backgrounds || BACKGROUNDS, d.bg, ro, ed)}
      <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="Alignement" ${ro}/>
      <span class="sf-num">XP<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
      ${ed ? `<button class="sf-levelup" data-levelup title="Monter d'un niveau (maîtrise + dé de vie)">⬆ Niveau</button>` : ''}
      <button class="sf-levelup" data-export title="Exporter cette fiche en JSON (sauvegarde / transfert)">💾 JSON</button>
    </div>
    ${multiclassSection(d, ed)}`;
}

/** Contenu d'un onglet du panneau principal, par identifiant de section. */
function paneContent(id, sys, sheet, c, d, ed, ro) {
  switch (id) {
    case 'stats':
      return `${identityBlock(sheet, d, ed, ro)}
        <section class="sheet-abilities">
          ${sys.abilities.map((a) => abilityBox(a, d, ro, sys)).join('')}
        </section>
        <section class="sheet-block">
          <h3>Compétences</h3>
          ${Object.keys(sys.skills).map((k) => skillRow(k, d, ed)).join('')}
        </section>
        ${sheet.identity === 'srd5e' ? profileSummarySection(d) : ''}`;
    case 'combat':
      return `<section class="sheet-block">
          <h3>Attaques ${ed ? `<button class="mini-add" data-add="atk">+</button>` : ''}</h3>
          <div class="atk-table">${(d.atks || []).map((a, i) => atkRow(a, i, ed)).join('') || '<div class="char-empty">—</div>'}</div>
        </section>
        ${resourcesSection(d, ed)}`;
    case 'spells':
      return spellsSection(d, ed) || '<div class="char-empty">Aucun sort.</div>';
    case 'feats':
      return featuresSection(d, ed);
    case 'inv':
      return inventorySection(d, ed, ro);
    case 'story':
      return storySection(c, d, ed, ro);
    case 'notes':
      return `${featsBlock(d.feats, ed)}
        ${textBlock('Notes', 'notes', d.notes, ro)}`;
  }
  return '';
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

/**
 * Menu déroulant classe/race piloté par le SRD. Préserve une valeur hors-SRD
 * (ajoutée comme option « (perso) ») et propose un bouton ⚙ pour ré-appliquer
 * le gabarit sans changer la sélection.
 */
function idSelect(kind, label, entries, value, ro, ed) {
  const cur = String(value || '');
  const inList = entries.some((e) => e.label === cur);
  const opts = [`<option value="">— ${label} —</option>`]
    .concat(
      entries.map(
        (e) => `<option value="${escapeHtml(e.label)}" ${e.label === cur ? 'selected' : ''}>${escapeHtml(e.label)}</option>`
      )
    );
  if (cur && !inList) opts.push(`<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} (perso)</option>`);
  const known = kind === 'cls' ? classByLabel(cur) : kind === 'race' ? raceByLabel(cur) : backgroundByLabel(cur);
  return `<span class="sf-derive">
      <select class="sf" data-derive="${kind}" ${ro}>${opts.join('')}</select>
      ${ed && known ? `<button class="sf-cog" data-derive-open="${kind}" title="Appliquer le gabarit ${escapeHtml(label.toLowerCase())} (sauvegardes, vitesse, vision…)">⚙</button>` : ''}
    </span>`;
}

/** Menu de sous-classe dépendant de la classe sélectionnée (valeur custom préservée). */
function subSelect(d, ro, ed) {
  const cls = classByLabel(d.cls);
  const cur = String(d.sub || '');
  const subs = cls ? cls.subclasses : [];
  const inList = subs.includes(cur);
  const opts = ['<option value="">— Sous-classe —</option>']
    .concat(subs.map((s) => `<option value="${escapeHtml(s)}" ${s === cur ? 'selected' : ''}>${escapeHtml(s)}</option>`));
  if (cur && !inList) opts.push(`<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} (perso)</option>`);
  const known = subclassByLabel(cur);
  return `<span class="sf-derive">
      <select class="sf" data-derive="sub" ${ro}>${opts.join('')}</select>
      ${ed && known ? `<button class="sf-cog" data-derive-open="sub" title="Appliquer les aptitudes de sous-classe débloquées par le niveau">⚙</button>` : ''}
    </span>`;
}

/** Contrôle « Taille » (chaîne P/M/G) pour le rail — distinct de stat() (numérique). */
function sizeStat(val, ro) {
  const v = val || 'M';
  const opts = [['P', 'P'], ['M', 'M'], ['G', 'G']];
  return `
    <div class="combat-stat">
      <div class="cs-label">Taille</div>
      <div class="cs-val">
        <select class="cs-size" data-d="size" ${ro}>
          ${opts.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
    </div>`;
}

function abilityBox(a, d, ro, sys) {
  const mod = sys.abilityMod(d[a.key]);
  return `
    <div class="ability-box">
      <div class="ab-label">${a.label}</div>
      <div class="ab-mod rollable" data-roll="ability" data-key="${a.key}" title="Lancer un test de ${a.label}">${sys.fmtMod(mod)}</div>
      <input type="number" class="ab-score" value="${num(d[a.key])}" data-d="${a.key}" ${ro}/>
    </div>`;
}

function saveRow(a, d, ed, sys) {
  const has = (d.saves || []).includes(a.key);
  return `
    <label class="prof-row">
      <input type="checkbox" data-save="${a.key}" ${has ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="save" data-key="${a.key}" title="Jet de sauvegarde de ${a.label}">${sys.fmtMod(sys.saveBonus(d, a.key))}</span>
      <span class="prof-name">${a.label}</span>
    </label>`;
}

function skillRow(k, d, ed) {
  const sys = getSystem(activeCampaign()?.system || d.system);
  const sk = sys.skills[k];
  if (!sk) return '';
  const prof = (d.profs || []).includes(k);
  const exp = (d.exp || []).includes(k);
  const ab = sys.abilities.find((a) => a.key === sk.ability)?.label || '';
  return `
    <label class="prof-row">
      <input type="checkbox" data-skill="${k}" ${prof ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="skill" data-key="${k}" title="Test de ${sk.label}">${sys.fmtMod(sys.skillBonus(d, k))}</span>
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
    if (isSrdMarker(raw)) continue; // marqueurs du bloc SRD géré : invisibles dans l'accordéon
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
      <h3>Inventaire ${ed ? `<button class="mini-add" data-add="inv">+</button> <button class="mini-add" data-startkit title="Ajouter l'équipement de départ (classe + historique)">🎒 Départ</button>` : ''}
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

/**
 * Onglet « Histoire » : une partie partagée (stockée dans data.story, lisible
 * par tout le groupe) et une partie secrète (table character_private, visible
 * uniquement par le joueur propriétaire et le MJ).
 */
function storySection(c, d, ed, ro) {
  const priv = store.get().charPrivate?.[c.id] ?? '';
  const shared = `
    <section class="sheet-block">
      <h3>📖 Histoire partagée <span class="story-tag story-tag-shared">Visible par tout le groupe</span></h3>
      <textarea class="sheet-text" data-d="story" ${ro} rows="8" placeholder="Le passé de ${escapeHtml(c.name)}, connu de tous…">${escapeHtml(d.story || '')}</textarea>
    </section>`;
  // La partie secrète n'est rendue que pour le propriétaire et le MJ. Les autres
  // joueurs ne la voient pas (et la RLS les empêche de toute façon de la lire).
  const secret = ed
    ? `
    <section class="sheet-block">
      <h3>🔒 Histoire secrète <span class="story-tag story-tag-private">Visible par le joueur et le MJ uniquement</span></h3>
      <textarea class="sheet-text" data-priv ${ro} rows="8" placeholder="Secrets, objectifs cachés, liens connus de toi seul et du MJ…">${escapeHtml(priv)}</textarea>
    </section>`
    : '';
  return shared + secret;
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

  // Histoire secrète (table character_private, hors data.*)
  const privInput = el.querySelector('[data-priv]');
  privInput?.addEventListener('input', () => updateCharPrivate(id, privInput.value));

  // Classe / race / sous-classe : menus déroulants pilotés par le SRD.
  // On persiste le libellé tout de suite, puis on ouvre l'aperçu d'application
  // si le choix correspond à une entrée connue.
  el.querySelectorAll('[data-derive]').forEach((sel) =>
    sel.addEventListener('change', () => {
      const kind = sel.dataset.derive; // 'cls' | 'race' | 'sub'
      const val = sel.value;
      updateCharacter(id, { [kind]: val });
      if (kind === 'cls' && classByLabel(val)) openDeriveModal(id, 'class');
      else if (kind === 'race' && raceByLabel(val)) openDeriveModal(id, 'race');
      else if (kind === 'bg' && backgroundByLabel(val)) openDeriveModal(id, 'bg');
      else if (kind === 'sub' && subclassByLabel(val)) openDeriveModal(id, 'sub');
    })
  );
  const DERIVE_MODE = { cls: 'class', race: 'race', bg: 'bg', sub: 'sub' };
  el.querySelectorAll('[data-derive-open]').forEach((b) =>
    b.addEventListener('click', () => openDeriveModal(id, DERIVE_MODE[b.dataset.deriveOpen] || 'class'))
  );
  el.querySelector('[data-startkit]')?.addEventListener('click', () => openStartingEquipment(id));

  // Multiclassage : édition des classes secondaires (data.mc) + application.
  el.querySelectorAll('[data-mc-i]').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.mcI);
      const k = input.dataset.mcK;
      const c = store.get().characters.find((x) => x.id === id);
      const mc = [...(c.data.mc || [])];
      mc[i] = { ...mc[i], [k]: k === 'lvl' ? toNum(input.value) : input.value };
      if (k === 'cls') mc[i].sub = ''; // réinitialise la sous-classe au changement de classe
      updateCharacter(id, { mc });
    })
  );
  el.querySelectorAll('[data-mc-del]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = store.get().characters.find((x) => x.id === id);
      const mc = (c.data.mc || []).filter((_, idx) => idx !== Number(b.dataset.mcDel));
      updateCharacter(id, { mc });
    })
  );
  el.querySelector('[data-mc-add]')?.addEventListener('click', () => {
    const c = store.get().characters.find((x) => x.id === id);
    updateCharacter(id, { mc: [...(c.data.mc || []), { cls: '', sub: '', lvl: 1 }] });
  });
  el.querySelector('[data-mc-apply]')?.addEventListener('click', () => openMulticlassApply(id));

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
    if (!(await modalConfirm(`Passer ${cur.name} au niveau ${newLvl} ? (maîtrise, dé de vie, aptitudes de sous-classe et emplacements de sorts mis à jour ; pense à ajuster les PV max)`, { title: '⬆ Montée de niveau', okLabel: `Niveau ${newLvl}` }))) return;
    const prof = 2 + Math.floor((newLvl - 1) / 4);
    const hdMax = newLvl;
    const hd = Math.min(hdMax, (Number(dd.hd ?? (Number(dd.lvl) || 1)) || 0) + 1);
    const patch = { lvl: newLvl, prof, hdMax, hd };
    // Débloque les aptitudes de sous-classe du nouveau niveau dans le bloc géré.
    const feats = mergeFeatsBlock(dd.feats, srdFeatLines({ ...dd, lvl: newLvl }));
    if (feats !== (dd.feats || '')) patch.feats = feats;
    // Met à jour les emplacements de sorts (lanceurs), en préservant les utilisés.
    const dc = classByLabel(dd.cls) ? deriveClassPatch({ ...dd, lvl: newLvl }, dd.cls) : null;
    if (dc?.spellSlots) {
      const cur0 = dd.slots || {};
      const slots = {};
      for (const [lv, sl] of Object.entries(dc.spellSlots)) {
        slots[lv] = { m: sl.m, u: Math.min(Number(cur0[lv]?.u) || 0, sl.m) };
      }
      patch.slots = slots;
    }
    updateCharacter(id, patch);
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
      // Les bonus viennent du descripteur du système de la campagne (cf. systems/).
      const sys = getSystem(activeCampaign()?.system || dd.system);
      // Maj = avantage, Ctrl/Cmd = désavantage.
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      if (t === 'ability') {
        const lbl = sys.abilities.find((a) => a.key === k)?.label || k;
        sendD20Check(sys.abilityMod(dd[k]), `${who} — Test de ${lbl}`, { mode });
      } else if (t === 'save') {
        const lbl = sys.abilities.find((a) => a.key === k)?.label || k;
        sendD20Check(sys.saveBonus(dd, k), `${who} — Sauvegarde de ${lbl}`, { mode });
      } else if (t === 'skill') {
        sendD20Check(sys.skillBonus(dd, k), `${who} — ${sys.skills[k]?.label || k}`, { mode });
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
