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
import { t } from '../lib/i18n.js';

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

// Les résolveurs SRD sont cross-locale : une fiche d'avant l'i18n stocke un
// libellé FR ; sous une UI EN, l'entrée est tout de même retrouvée par sa clé
// stable (et réciproquement). Le contenu 2024 expose ses propres résolveurs.
function classByLabel(label) {
  const c = srdContent();
  if (!c) return classByLabel5e(label);
  return c.classByLabel ? c.classByLabel(label) : c.classes.find((x) => x.label === label || x.key === label) || null;
}

function raceByLabel(label) {
  const c = srdContent();
  if (!c) return raceByLabel5e(label);
  return c.raceByLabel ? c.raceByLabel(label) : c.races.find((x) => x.label === label || x.key === label) || null;
}

function backgroundByLabel(label) {
  const c = srdContent();
  if (!c) return backgroundByLabel5e(label);
  return c.backgroundByLabel ? c.backgroundByLabel(label) : c.backgrounds.find((x) => x.label === label || x.key === label) || null;
}

function subclassByLabel(label) {
  const c = srdContent();
  if (!c) return subclassByLabel5e(label);
  if (!label || !c.subclasses) return null;
  if (c.subclassByLabel) return c.subclassByLabel(label);
  // c.subclasses : objet indexé par libellé ; data.sub peut être une clé OU un libellé.
  const hit = Object.entries(c.subclasses).find(([lab, s]) => lab === label || s.key === label);
  return hit ? { label: hit[0], ...hit[1] } : null;
}

/**
 * Fiches d'avant l'i18n : l'identité est stockée en LIBELLÉ (FR), ce qui casse
 * la résolution sous une UI EN. On détecte les valeurs qui résolvent vers une
 * entrée SRD dont la CLÉ stable diffère, pour proposer une migration validée.
 * @returns {Array<{field:string,labelKey:string,from:string,to:string,name:string}>}
 */
function srdIdChanges(d, sys) {
  const out = [];
  const ident = sys?.sheet?.identity;
  let map;
  if (ident === 'pf2e' && sys.content) {
    map = [
      ['race', 'sheet.id.ancestry', sys.content.ancestryByLabel],
      ['cls', 'sheet.id.class', sys.content.classByLabel],
      ['bg', 'sheet.id.bg', sys.content.backgroundByLabel],
    ];
  } else if (ident === 'srd5e') {
    map = [
      ['cls', 'sheet.id.class', classByLabel],
      ['race', 'sheet.id.raceLabel', raceByLabel],
      ['bg', 'sheet.id.bg', backgroundByLabel],
      ['sub', 'field.sub', subclassByLabel],
    ];
  } else {
    return out; // système « Libre » : pas d'identité SRD à migrer
  }
  for (const [field, labelKey, fn] of map) {
    const v = d?.[field];
    if (!v || !fn) continue;
    const hit = fn(v);
    if (hit && hit.key && hit.key !== v) out.push({ field, labelKey, from: v, to: hit.key, name: hit.label, entry: hit });
  }
  // Classes secondaires (multiclassage 5e) stockées en libellé.
  if (ident === 'srd5e' && Array.isArray(d?.mc)) {
    d.mc.forEach((e, i) => {
      const ch = e?.cls && classByLabel(e.cls);
      if (ch && ch.key !== e.cls) out.push({ field: `mc.${i}.cls`, labelKey: 'field.cls', from: e.cls, to: ch.key, name: ch.label, entry: ch });
      const sh = e?.sub && subclassByLabel(e.sub);
      if (sh && sh.key !== e.sub) out.push({ field: `mc.${i}.sub`, labelKey: 'field.sub', from: e.sub, to: sh.key, name: sh.label, entry: sh });
    });
  }
  return out;
}

/**
 * Résumé LECTURE SEULE de ce qu'une entrée SRD définit (vitesse, taille, vision,
 * bonus de caracs, DV, sauvegardes, maîtrises, compétences, aptitudes…). Sert
 * d'aperçu à la migration : informatif, ne modifie aucune statistique de la fiche.
 */
function srdEntrySummary(entry, sys) {
  if (!entry) return [];
  const bits = [];
  const ab = (k) => sys?.abilities?.find((a) => a.key === k)?.label || String(k).toUpperCase();
  const sk = (k) => sys?.skills?.[k]?.label || k;
  if (entry.ability && typeof entry.ability === 'object') {
    const a = Object.entries(entry.ability).map(([k, v]) => `${v >= 0 ? '+' : ''}${v} ${ab(k)}`);
    if (a.length) bits.push(`${t('migrate.f.abilities')} ${a.join(', ')}`);
  }
  if (Array.isArray(entry.boosts) && entry.boosts.length) {
    bits.push(`${t('migrate.f.abilities')} ${entry.boosts.map((b) => (b === 'free' ? '★' : ab(b))).join(', ')}`);
  }
  if (entry.speed != null) bits.push(`${t('field.spd')} ${entry.speed} m`);
  if (entry.size) bits.push(`${t('field.size')} ${entry.size}`);
  if (entry.darkvision) bits.push(`${t('field.darkvision')} ${entry.darkvision} m`);
  if (entry.hd) bits.push(`${t('field.hd')} d${entry.hd}`);
  else if (entry.hp != null) bits.push(`${t('field.hp')} +${entry.hp}`);
  if (Array.isArray(entry.saves) && entry.saves.length) bits.push(`${t('field.saves')} ${entry.saves.map(ab).join(', ')}`);
  if (entry.weaponProf) bits.push(`${t('migrate.f.weapons')} ${entry.weaponProf}`);
  if (entry.armorProf && !/^(none|aucune)$/i.test(entry.armorProf)) bits.push(`${t('migrate.f.armor')} ${entry.armorProf}`);
  if (Array.isArray(entry.skills) && entry.skills.length) bits.push(`${t('field.profs')} ${entry.skills.map(sk).join(', ')}`);
  else if (typeof entry.skills === 'number' && entry.skills) bits.push(t('migrate.f.skillsPick', { n: entry.skills }));
  if (entry.skillCount) bits.push(t('migrate.f.skillsPick', { n: entry.skillCount }));
  if (entry.tools) bits.push(`${t('migrate.f.tools')} ${entry.tools}`);
  if (entry.languages) bits.push(`${t('migrate.f.langs')} ${entry.languages}`);
  if (Array.isArray(entry.traits) && entry.traits.length) {
    bits.push(`${t('migrate.f.traits')} ${entry.traits.map((x) => x.name || x).join(', ')}`);
  }
  if (Array.isArray(entry.features) && entry.features.length) {
    const f = entry.features.map((x) => (x.level ? `${x.level}: ${x.name}` : x.name)).filter(Boolean);
    if (f.length) bits.push(`${t('field.feats')} ${f.join(' · ')}`);
  }
  return bits;
}

/** Construit le patch (clés stables) à partir des changements calculés. */
function applySrdIdMigration(d, changes) {
  const patch = {};
  let mc = null;
  for (const ch of changes) {
    if (ch.field.startsWith('mc.')) {
      const [, idx, key] = ch.field.split('.');
      mc = mc || (Array.isArray(d?.mc) ? d.mc.map((x) => ({ ...x })) : []);
      if (mc[idx]) mc[idx][key] = ch.to;
    } else {
      patch[ch.field] = ch.to;
    }
  }
  if (mc) patch.mc = mc;
  return patch;
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
      showToast(t('char.toast.openFirst'), { timeout: 2000 });
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
      showToast(idx >= 0 ? t('char.toast.spellDup', { name: entry.name }) : t('char.toast.spellAdd', { name: entry.name, char: c.name }), { timeout: 1800 });
    } else if (p.kind === 'item') {
      const note = String(entry.data?.desc || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
      updateCharacter(cid, { inv: [...(c.data.inv || []), { nm: entry.name, qty: 1, wt: '', note }] });
      showToast(t('char.toast.itemAdd', { name: entry.name, char: c.name }), { timeout: 1800 });
    } else {
      showToast(t('char.toast.onlySpellItem'), { timeout: 2200 });
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
          <div class="char-card-sub">${escapeHtml(classByLabel(d.cls)?.label || d.cls || '')} ${d.lvl ? `${t('sheet.lvl')}${d.lvl}` : ''}</div>
          <div class="char-hpbar"><span style="width:${hpPct}%"></span></div>
          <div class="char-card-hp">${d.hp ?? '?'} / ${d.hpMax ?? '?'} ${t('combat.add.hp')}</div>
        </button>`;
    })
    .join('');

  el.innerHTML =
    // Outils de table partagés : visibles par tous (lecture seule côté joueurs).
    `<div class="char-tools">
       <button class="btn char-tool" id="char-loot" title="${t('char.loot.title')}">${t('char.loot')}</button>
       <button class="btn char-tool" id="char-quests" title="${t('char.quests.title')}">${t('char.quests')}</button>
     </div>` +
    (isDM
      ? `<button class="link char-new" id="char-new" style="text-align:left;margin:0 0 4px">${t('char.new')}</button>
         <button class="link char-new" id="char-import" style="text-align:left;margin:0 0 4px">${t('char.importPaste')}</button>
         <label class="link char-new" id="char-import-json" style="text-align:left;margin:0 0 8px;display:block">${t('char.importJson')}<input type="file" accept="application/json,.json" hidden></label>`
      : '') + (items || `<div class="char-empty">${t('char.empty')}</div>`);

  el.querySelector('#char-loot')?.addEventListener('click', () => openPartyLoot());
  el.querySelector('#char-quests')?.addEventListener('click', () => openQuests());

  el.querySelector('#char-new')?.addEventListener('click', async () => {
    const name = await modalPrompt(t('char.new.prompt'), { title: t('char.new.title'), placeholder: t('char.new.ph') });
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
      <h3 class="modal-title">${t('ci.title')}</h3>
      <p class="modal-msg">${t('ci.msg')}</p>
      <input class="modal-input" id="ci-name" placeholder="${t('ci.namePh')}">
      <textarea class="atk-in" id="ci-text" style="width:100%;min-height:200px;margin-top:8px;font-family:ui-monospace,monospace;font-size:12px" placeholder="${t('ci.textPh')}"></textarea>
      <div class="ci-preview" id="ci-preview"></div>
      <div class="modal-actions">
        <button class="modal-btn ci-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok ci-ok">${t('ci.ok')}</button>
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
      d.ac != null ? `${t('dock.ac')} ${d.ac}` : '',
      d.hpMax != null ? `${t('combat.add.hp')} ${d.hpMax}` : '',
      d.lvl != null ? `${t('sheet.lvl')} ${d.lvl}` : '',
      d.cls ? d.cls : '',
      d.atks?.length ? t('ci.atksCount', { n: d.atks.length }) : '',
    ].filter(Boolean);
    prev.innerHTML = ta.value.trim()
      ? `<div class="ci-detected">${t('ci.detected')}${escapeHtml([...bits, ...extra].join(' · ')) || t('ci.nothing')}</div>`
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
    if (!name) name = t('char.importedDefault');
    close();
    const id = await importCharacter(name, data);
    if (id) showToast(t('char.toast.imported', { name }), { timeout: 3000 });
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
// Valeurs = clés i18n field.* (résolues à l'affichage par fieldLabel).
const FIELD_LABELS = {
  cls: 'field.cls', sub: 'field.sub', lvl: 'field.lvl', race: 'field.race', bg: 'field.bg', align: 'field.align',
  hp: 'field.hp', hpMax: 'field.hpMax', hpTmp: 'field.hpTmp', ac: 'field.ac', spd: 'field.spd', initB: 'field.initB', prof: 'field.prof', insp: 'field.insp',
  str: 'field.str', dex: 'field.dex', con: 'field.con', int: 'field.int', wis: 'field.wis', cha: 'field.cha',
  saves: 'field.saves', profs: 'field.profs', exp: 'field.exp', atks: 'field.atks', spells: 'field.spells', slots: 'field.slots',
  feats: 'field.feats', equip: 'field.equip', notes: 'field.notes', story: 'field.story', resources: 'field.resources', features: 'field.features',
  darkvision: 'field.darkvision', size: 'field.size',
  hd: 'field.hd', hdMax: 'field.hdMax', xp: 'field.xp', portrait: 'field.portrait', sc: 'field.sc', ds: 'field.ds',
};
const fieldLabel = (k) => (FIELD_LABELS[k] ? t(FIELD_LABELS[k]) : k);

function valSumm(v) {
  if (v === undefined || v === null) return '∅';
  if (Array.isArray(v)) return t('field.nElems', { n: v.length });
  if (typeof v === 'object') return t('field.nFields', { n: Object.keys(v).length });
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
        <h3 class="modal-title">${t('ci.diff.heading', { name: escapeHtml(oldName || name) })}</h3>
        <p class="modal-msg">${nothing ? t('ci.diff.none') : t('ci.diff.intro')}</p>
        <div class="diff-list">
          ${nameChanged ? `<div class="diff-row"><span class="diff-k">${t('field.name')}</span><span class="diff-old">${escapeHtml(oldName)}</span><span class="diff-arrow">→</span><span class="diff-new">${escapeHtml(name)}</span></div>` : ''}
          ${rowsHtml || (nameChanged ? '' : '<div class="dock-empty">—</div>')}
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel">${t('common.cancel')}</button>
          <button class="modal-btn modal-ok"${nothing ? ' disabled' : ''}>${t('ci.diff.update')}</button>
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

/** Application d'un gabarit d'identité pf2e (ascendance / classe / historique).
 *  N'applique que des champs IDEMPOTENTS (taille, vitesse, vision, PV de base,
 *  rangs de Perception/sauvegardes/compétence) + un bloc d'aptitudes géré ; les
 *  boosts d'attribut restent à répartir à la main (cf. bloc Aptitudes). */
async function openPf2eDerive(id, mode) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!cur || !canEdit(cur)) return;
  const d = cur.data || {};
  const content = getSystem(activeCampaign()?.system || d.system).content;
  if (!content) return;
  const patch = {};
  const changes = [];
  if (mode === 'ancestry') {
    const r = content.deriveAncestryPatch(d, content.ancestryByLabel(d.race));
    if (!r) return;
    Object.assign(patch, { size: r.patch.size, spd: r.patch.spd, darkvision: r.patch.darkvision, ancHp: r.ancestryHp });
    changes.push(t('derive.size', { v: r.patch.size }), t('derive.speed', { v: r.patch.spd }));
    if (r.patch.darkvision) changes.push(t('derive.vision', { v: r.patch.darkvision }));
    changes.push(t('derive.ancHp', { v: r.ancestryHp }));
  } else if (mode === 'class') {
    const r = content.deriveClassPatch(d, content.classByLabel(d.cls));
    if (!r) return;
    patch.clsHp = r.classHp;
    patch.ranks = { ...(d.ranks || {}), ...r.ranks };
    changes.push(t('derive.clsHp', { v: r.classHp }), t('derive.profRank'));
  } else {
    const r = content.deriveBackgroundPatch(d, content.backgroundByLabel(d.bg));
    if (!r) return;
    const ranks = { ...(d.ranks || {}) };
    for (const sk of r.trainedSkills) ranks[sk] = Math.max(1, Number(ranks[sk]) || 0);
    patch.ranks = ranks;
    changes.push(t('derive.trained', { skills: r.trainedSkills.join(', ') || '—' }));
  }
  // PV max recalculés à partir des PV d'ascendance + de classe en mémoire.
  const ancHp = patch.ancHp ?? d.ancHp ?? 0;
  const clsHp = patch.clsHp ?? d.clsHp ?? 0;
  patch.hpMax = content.hpMax(ancHp, clsHp, d.lvl, d.con);
  if (!(Number(d.hp) > 0)) patch.hp = patch.hpMax;
  changes.push(t('derive.hpMax', { v: patch.hpMax }));
  // Bloc d'aptitudes géré (recalculé en entier, idempotent via mergeFeatsBlock).
  const lines = content.managedLines({ ...d, ...patch }, content);
  const newFeats = mergeFeatsBlock(d.feats, lines);
  if (newFeats !== (d.feats || '')) patch.feats = newFeats;
  if (!(await modalConfirm(t('derive.pf2e.confirm', { changes: changes.join(' · ') }), { title: t('derive.pf2e.title'), okLabel: t('common.apply') }))) return;
  updateCharacter(id, patch);
  showToast(t('derive.pf2e.done'), { type: 'success', timeout: 2400 });
}

/** Montée de niveau pf2e : recalcule les PV max. La maîtrise inclut déjà le
 *  niveau (cf. descripteur pf2e), donc rien d'autre à appliquer ici. */
async function pf2eLevelUp(id) {
  const cur = store.get().characters.find((c) => c.id === id);
  if (!cur || !canEdit(cur)) return;
  const d = cur.data || {};
  const content = getSystem(activeCampaign()?.system || d.system).content;
  const lvl = Math.max(1, Number(d.lvl) || 1) + 1;
  if (!(await modalConfirm(t('derive.lvlup.confirmPf2e', { name: cur.name, lvl }), { title: t('derive.lvlup.title'), okLabel: t('derive.lvlBtn', { lvl }) }))) return;
  const hpMax = content.hpMax(d.ancHp || 0, d.clsHp || 0, lvl, d.con);
  const delta = Math.max(0, hpMax - (Number(d.hpMax) || 0));
  updateCharacter(id, { lvl, hpMax, hp: Math.max(1, (Number(d.hp) || hpMax) + delta) });
  showToast(t('derive.lvlup.donePf2e', { name: cur.name, lvl, hp: hpMax }), { type: 'success', icon: '✨' });
}

/** Lignes du bloc « aptitudes » géré (aptitudes/traits + maîtrises, langues, sorts).
 *  On passe les lookups du système actif : une fiche 2024 affiche les aptitudes
 *  2024 (et non celles, subtilement différentes, du 5.1). */
function srdFeatLines(data) {
  return srdManagedLines(data, { classByLabel, raceByLabel, backgroundByLabel, subclassByLabel });
}

/** Synthèse courte d'un jeu d'emplacements de sorts (« Niv.1 ×2 · Niv.2 ×3 »). */
function slotsSumm(slots) {
  if (!slots || !Object.keys(slots).length) return '∅';
  return Object.keys(slots)
    .map(Number)
    .sort((a, b) => a - b)
    .map((lv) => `${t('sheet.lvl')}${lv} ×${slots[lv].m}`)
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
         <div class="derive-pick-h">${skillCfg.mode === 'race' ? t('derive.skills.race') : t('derive.skills.class')} ${t('derive.skills.choose')} <b>${skillCfg.count}</b> <span class="derive-count">(0 / ${skillCfg.count})</span></div>
         ${racialFixed.length ? `<div class="derive-fixed">${t('derive.racialIncluded', { skills: racialFixed.map((k) => escapeHtml(SKILLS[k]?.label || k)).join(', ') })}</div>` : ''}
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
         <div class="derive-pick-h">${t('derive.abilityBonus', { amount: abilityCfg.amount })} <b>${abilityCfg.count}</b> <span class="derive-count">(0 / ${abilityCfg.count})</span></div>
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
      <h3 class="modal-title">${t('derive.applyHeading', { title: escapeHtml(headTitle) })}</h3>
      <p class="modal-msg">${nothing ? t('derive.upToDate') : t('derive.uncheck')}</p>
      <div class="diff-list">${rowsHtml || '<div class="dock-empty">—</div>'}</div>
      ${skillHtml}
      ${abilityHtml}
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok">${t('common.apply')}</button>
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
    showToast(t('derive.done', { title: headTitle }), { type: 'success', timeout: 2600 });
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
  const summary = t('mc.summary', { total, prof, hd: escapeHtml(hd) }) + (ccl > 0 ? t('mc.casterCombined', { n: ccl }) : '');
  const rows = mc
    .map((e, i) => {
      if (!ed) {
        const clsLab = classByLabel(e.cls)?.label || e.cls || '—';
        const subLab = e.sub ? (subclassByLabel(e.sub)?.label || e.sub) : '';
        return `<div class="mc-line">${escapeHtml(clsLab)}${subLab ? ` (${escapeHtml(subLab)})` : ''} · ${t('sheet.lvl')}${num(e.lvl) || 1}</div>`;
      }
      const clsHit = classByLabel(e.cls);
      const clsKey = clsHit ? clsHit.key : e.cls; // canonicalise (libellé FR/EN → clé)
      const clsEntry = CLASSES.find((c) => c.key === clsKey) || clsHit;
      const subHit = subclassByLabel(e.sub);
      const subKey = subHit ? subHit.key : e.sub;
      const subOpts = (clsEntry?.subclasses || []).map((s) => { const sc = subclassByLabel(s); return { key: sc ? sc.key : s, label: s }; });
      return `<div class="mc-edit">
        <select class="sf" data-mc-i="${i}" data-mc-k="cls">
          <option value="">${t('mc.classOpt')}</option>
          ${CLASSES.map((c) => `<option value="${escapeHtml(c.key)}" ${c.key === clsKey ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('')}
        </select>
        <select class="sf" data-mc-i="${i}" data-mc-k="sub">
          <option value="">${t('mc.subOpt')}</option>
          ${subOpts.map((o) => `<option value="${escapeHtml(o.key)}" ${o.key === subKey ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
        </select>
        <input type="number" class="sf-num mc-lvl" min="1" max="20" value="${num(e.lvl) || 1}" data-mc-i="${i}" data-mc-k="lvl"/>
        <button class="mini-del" data-mc-del="${i}">×</button>
      </div>`;
    })
    .join('');
  return `<details class="sheet-block mc-block" ${mc.length ? 'open' : ''}>
    <summary>${t('mc.title')}</summary>
    <div class="mc-summary">${summary}</div>
    <div class="mc-list">${rows || `<div class="char-empty">${t('mc.empty')}</div>`}</div>
    ${ed ? `<div class="mc-actions"><button class="mini-add" data-mc-add>${t('mc.addSecondary')}</button> <button class="rest-btn" data-mc-apply title="${t('mc.apply.title')}">${t('mc.apply')}</button></div>
       <div class="feats-hint">${t('mc.hint')}</div>` : ''}
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
  const bits = [t('mc.bitProf', { total, prof })];
  if (slots) bits.push(t('mc.bitSlots', { slots: slotsSumm(slots) }));
  bits.push(t('mc.featsAdded'));
  if (!(await modalConfirm(bits.join(' · '), { title: t('mc.confirmTitle'), okLabel: t('common.apply') }))) return;
  const patch = { prof };
  if (slots) {
    const cur0 = d.slots || {};
    const s = {};
    for (const [lv, sl] of Object.entries(slots)) s[lv] = { m: sl.m, u: Math.min(Number(cur0[lv]?.u) || 0, sl.m) };
    patch.slots = s;
  }
  if (feats !== (d.feats || '')) patch.feats = feats;
  updateCharacter(id, patch);
  showToast(t('mc.done'), { type: 'success', timeout: 2600 });
}

/**
 * Encart en lecture seule « Maîtrises, langues & sorts », calculé en direct
 * depuis la classe / race / historique (toujours à jour, sans application).
 */
function profileSummarySection(d) {
  const p = deriveProficiencies(d, { classByLabel, raceByLabel, backgroundByLabel });
  const tools = p.tools.join(' ; ');
  const langs = p.languages.join(' ; ');
  const sorts = p.casterClass && p.spellLine
    ? `${p.cantrips ? `${t('prof.cantripsN', { n: p.cantrips })} · ` : ''}${p.spellLine}`
    : '';
  if (!p.armor && !p.weapons && !tools && !langs && !sorts) return '';
  const row = (label, val) =>
    val ? `<div class="ps-row"><span class="ps-k">${label}</span><span class="ps-v">${escapeHtml(val)}</span></div>` : '';
  return `<section class="sheet-block">
      <h3>${t('sheet.h.profs')}</h3>
      ${row(t('prof.armor'), p.armor)}
      ${row(t('prof.weapons'), p.weapons)}
      ${row(t('prof.tools'), tools)}
      ${row(t('prof.languages'), langs)}
      ${row(t('prof.spells'), sorts)}
      <div class="feats-hint">${t('prof.hint')}</div>
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
    modalAlert(t('startkit.needClass'), { title: t('startkit.title') });
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
         <div class="derive-pick-h">${t('startkit.bgHead', { label: escapeHtml(bgEntry.label) })}</div>
         <div class="eq-fixed">${bgKit.equipment.map((it) => escapeHtml(itemLabel(it))).join(' · ')}${bgKit.gold ? ` · <b>${bgKit.gold} ${t('startkit.gp')}</b>` : ''}</div>
       </div>`
    : '';

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card diff-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('startkit.heading')}</h3>
      ${data._startKit ? `<p class="modal-msg" style="color:var(--yellow)">${t('startkit.already')}</p>` : `<p class="modal-msg">${t('startkit.choose')}</p>`}
      ${classEntry ? `<div class="derive-pick"><div class="derive-pick-h">${t('startkit.classHead', { label: escapeHtml(classEntry.label) })}</div>${groupsHtml}</div>` : ''}
      ${bgHtml}
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok">${t('startkit.addInv')}</button>
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
      else inv.push({ nm: it.nm, qty: it.qty || 1, wt: '', note: t('startkit.noteDefault') });
    }
    const patch = { inv, _startKit: true };
    if (bgKit?.gold) {
      const coins = { ...(data.coins || {}) };
      coins.po = (Number(coins.po) || 0) + bgKit.gold;
      patch.coins = coins;
    }
    close();
    updateCharacter(id, patch);
    showToast(t('startkit.done', { n: items.length, gold: bgKit?.gold ? `, ${bgKit.gold} ${t('startkit.gp')}` : '' }), { type: 'success', timeout: 3000 });
  });
}

async function importCharFromJson(file) {
  try {
    const obj = JSON.parse(await file.text());
    const name = String(obj.name || t('char.jsonDefault')).slice(0, 40);
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
      showToast(t('char.json.updated', { name }), { timeout: 2800 });
      return;
    }

    // Aucune fiche correspondante : proposer la création.
    if (await modalConfirm(t('char.json.noMatch', { name }), { title: t('char.json.title'), okLabel: t('char.json.create') })) {
      const id = await importCharacter(name, data);
      if (id) showToast(t('char.json.created', { name }), { timeout: 2600 });
    }
  } catch (e) {
    await modalAlert(t('char.json.invalid') + e.message, { title: t('char.json.title') });
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
    el.dataset.skin = '';
    el.innerHTML = `<div class="char-empty">${t('char.empty')}</div>`;
    return;
  }

  const d = c.data || {};
  // Une campagne = un système : le descripteur vient de la campagne active,
  // avec repli sur celui posé sur la fiche (créations antérieures), puis 5e.
  const sys = getSystem(activeCampaign()?.system || d.system);
  el.dataset.skin = sys.id || ''; // thème décoratif de fiche par système (cf. base.css)
  const ed = canEdit(c);
  const ro = ed ? '' : 'readonly disabled';

  const { isDM, players } = store.get();
  const ownerRow = isDM
    ? `<div class="sheet-owner">
         <label>${t('char.owner.label')}</label>
         <select class="sf" data-owner>
           <option value="">${t('char.owner.none')}</option>
           ${players
             .map(
               (p) =>
                 `<option value="${p.id}" ${p.id === c.owner_id ? 'selected' : ''}>${escapeHtml(p.display_name || p.email)}</option>`
             )
             .join('')}
         </select>
         <button class="mini-del sheet-del" data-delchar="${c.id}" title="${t('char.del.title')}">${t('char.delBtn')}</button>
       </div>`
    : '';

  // Le descripteur déclare les sections de SA fiche (cf. systems/dnd5e2014.js).
  const sheet = sys.sheet || { tabs: Object.keys(TAB_DEFS), rail: ['hp', 'hitdice', 'stats', 'extras', 'saves'], identity: 'srd5e' };
  if (!sheet.tabs.includes(sheetTab)) sheetTab = sheet.tabs[0];
  const TABS = sheet.tabs.map((id) => ({ id, label: t(TAB_DEFS[id] || id) }));
  const subline = `${escapeHtml(classByLabel(d.cls)?.label || d.cls || t('field.cls'))}${d.sub ? ` (${escapeHtml(subclassByLabel(d.sub)?.label || d.sub)})` : ''} · ${t('sheet.lvl')} ${num(d.lvl) || 1}`;
  // Bannière de migration : libellés hérités (FR) résolvant vers une entrée SRD.
  const migrate = ed ? srdIdChanges(d, sys) : [];

  el.innerHTML = `
    <div class="sheet-skin-banner" aria-hidden="true">${escapeHtml(sys.label || '')}</div>
    <div class="sheet5e">
      <aside class="sheet-rail">
        <label class="rail-portrait ${isDM ? 'editable' : ''}" ${isDM ? `title="${t('char.portrait.change')}"` : ''}>
          ${portraitUrl(d.portrait) ? `<img src="${portraitUrl(d.portrait)}" alt="">` : sheetInitials(c.name)}
          ${isDM ? `<input type="file" id="portrait-file" accept="image/*" hidden>` : ''}
        </label>
        <input class="sheet-name" value="${escapeHtml(c.name)}" data-field="__name" ${ro} />
        <div class="rail-sub">${subline}</div>
        ${sheet.rail.map((id) => railBlock(id, sys, d, ed, ro)).join('')}
        ${ownerRow}
      </aside>

      <main class="sheet-main">
        ${migrate.length ? `<div class="sheet-migrate-banner">⚠ ${t('sheet.migrate.banner', { n: migrate.length })} <button class="rest-btn" data-migrate-ids>${t('sheet.migrate.btn')}</button></div>` : ''}
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
      await modalAlert(t('char.portrait.err') + ex.message, { title: t('char.portrait.title') });
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

// Valeurs = clés i18n, résolues via t() au rendu (cf. construction de TABS).
const TAB_DEFS = {
  stats: 'sheet.tab.stats',
  combat: 'sheet.tab.combat',
  spells: 'sheet.tab.spells',
  feats: 'sheet.tab.feats',
  inv: 'sheet.tab.inv',
  story: 'sheet.tab.story',
  notes: 'sheet.tab.notes',
};

/** Un bloc du rail gauche, par identifiant de section. */
function railBlock(id, sys, d, ed, ro) {
  switch (id) {
    case 'hp':
      return hpRailBlock(d, ed, ro);
    case 'hitdice':
      return `<div class="hd-block">
          <span class="hd-title">${t('sheet.rail.hitdice')}</span>
          <span class="hd-line">
            <input type="number" class="hd-cur" value="${num(d.hd ?? (d.hdMax ?? (Number(d.lvl) || 1)))}" data-d="hd" ${ro}/>
            <span>/</span>
            <input type="number" class="hd-max" value="${num(d.hdMax ?? (Number(d.lvl) || 1))}" data-d="hdMax" ${ro}/>
            <span class="hd-d">d</span>
            <input type="number" class="hd-size" value="${num(d.hdSize ?? 8)}" data-d="hdSize" min="4" max="12" step="2" ${ro}/>
          </span>
          ${ed ? `<button class="rest-btn hd-spend" data-hd-spend title="${t('sheet.hd.spend.title')}">${t('sheet.hd.spend')}</button>` : ''}
        </div>`;
    case 'stats':
      return `<div class="rail-stats">
          ${stat(t('field.ac'), 'ac', d.ac, ro)}
          ${stat(t('field.initB'), 'initB', d.initB, ro, '', true)}
          ${stat(t('field.spd'), 'spd', d.spd, ro, 'm')}
          ${stat(t('field.darkvision'), 'darkvision', d.darkvision, ro, 'm')}
          ${sizeStat(d.size, ro)}
          ${stat(t('field.prof'), 'prof', d.prof, ro, '', true)}
        </div>`;
    case 'extras':
      return `<div class="rail-extras">
          <button class="insp-btn ${d.insp ? 'on' : ''}" data-insp ${ro} title="${t('sheet.insp.title')}">${t('sheet.insp')}</button>
          <div class="passive-pp" title="${t('sheet.passivePP.title')}">${t('sheet.passivePP')} <b>${10 + skillBonus(d, 'perception')}</b></div>
          <div class="exh-block">
            <span class="exh-lbl">${t('cond.exhaustion')}</span>
            <div class="exh-dots">${[1, 2, 3, 4, 5, 6].map((i) => `<button class="exh-dot ${(Number(d.exh) || 0) >= i ? 'on' : ''}" data-exh="${i}" ${ro} title="${t('sheet.exhLevel', { n: i })}"></button>`).join('')}</div>
          </div>
        </div>`;
    case 'saves':
      // Sauvegardes en LISTE NOMMÉE à rangs (pf2e : Vigueur/Réflexes/Volonté…)
      // si le descripteur en déclare, sinon un jet par caractéristique (5e).
      if (sys.saves && sys.profRanks) {
        return `<section class="sheet-block rail-block">
            <h3>${t('sheet.h.saves')}</h3>
            ${sys.saves
              .map((s) => rankRow(s.key, s.label, sys.abilities.find((a) => a.key === s.ability)?.label || '', 'save', d, ed, sys))
              .join('')}
          </section>`;
      }
      return `<section class="sheet-block rail-block">
          <h3>${t('sheet.h.saves')}</h3>
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
    const status = ds.s >= 3 ? t('sheet.death.stable') : ds.f >= 3 ? t('sheet.death.dead') : '';
    const dot = (field, i, on) => `<button class="ds-dot ${on ? 'on ' + field : ''}" data-ds="${field}" data-i="${i}" ${ro}></button>`;
    return `<div class="death-saves">
        <div class="ds-label">${t('sheet.death.title')}${status}</div>
        <div class="ds-row"><span>${t('sheet.death.success')}</span>${[1, 2, 3].map((i) => dot('s', i, ds.s >= i)).join('')}</div>
        <div class="ds-row"><span>${t('sheet.death.fail')}</span>${[1, 2, 3].map((i) => dot('f', i, ds.f >= i)).join('')}</div>
      </div>`;
  };
  return `<div class="combat-hp rail-hp">
      <div class="hp-label">${t('sheet.hp')}</div>
      <div class="hp-row">
        ${ed ? `<button class="hp-btn" data-hp="-1">−</button>` : ''}
        <input type="number" class="hp-cur" value="${num(d.hp)}" data-d="hp" ${ro}/>
        <span class="hp-sep">/</span>
        <input type="number" class="hp-max" value="${num(d.hpMax)}" data-d="hpMax" ${ro}/>
        ${ed ? `<button class="hp-btn" data-hp="1">+</button>` : ''}
      </div>
      <div class="hpbar"><span style="width:${pct}%; background:${fill}"></span></div>
      <div class="hp-tmp">${t('sheet.hp.tmp')} <input type="number" value="${num(d.hpTmp)}" data-d="hpTmp" ${ro}/></div>
      ${Number(d.hp) === 0 ? deathSaves() : ''}
      ${
        ed
          ? `<div class="rest-row">
               <button class="rest-btn" data-rest="short" title="${t('sheet.rest.short.title')}">${t('sheet.rest.short')}</button>
               <button class="rest-btn" data-rest="long" title="${t('sheet.rest.long.title')}">${t('sheet.rest.long')}</button>
             </div>`
          : ''
      }
    </div>`;
}

/** Bloc d'identité : sélecteurs SRD 5e, ou champs libres (systèmes custom). */
function identityBlock(sheet, d, ed, ro, sys) {
  // Pathfinder 2e : sélecteurs d'ascendance/classe/historique pilotés par le
  // contenu Remaster (pf2e.content), avec application auto (PV, vitesse, rangs).
  // Flux entièrement séparé du 5e (data-pfderive) — aucun risque côté 5e.
  const pcontent = sheet.identity === 'pf2e' ? sys?.content : null;
  if (pcontent) {
    return `<div class="sheet-id-grid">
        ${pf2eSelect('race', pcontent.ancestriesLabel || t('sheet.id.ancestry'), pcontent.ancestries, d.race, ro, ed, pcontent.ancestryByLabel)}
        ${pf2eSelect('cls', t('sheet.id.class'), pcontent.classes, d.cls, ro, ed, pcontent.classByLabel)}
        ${pf2eSelect('bg', t('sheet.id.bg'), pcontent.backgrounds, d.bg, ro, ed, pcontent.backgroundByLabel)}
        <span class="sf-num">${t('sheet.lvl')}<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
        <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="${t('sheet.id.align')}" ${ro}/>
        <span class="sf-num">${t('sheet.xp')}<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
        ${ed ? `<button class="sf-levelup" data-pflevelup title="${t('sheet.levelup.titlePf2e')}">${t('sheet.levelup')}</button>` : ''}
        <button class="sf-levelup" data-export title="${t('sheet.export.title')}">💾 JSON</button>
      </div>`;
  }
  if (sheet.identity !== 'srd5e') {
    return `<div class="sheet-id-grid">
        <input class="sf" value="${escapeHtml(d.cls || '')}" data-d="cls" placeholder="${t('sheet.id.cls')}" ${ro}/>
        <input class="sf" value="${escapeHtml(d.race || '')}" data-d="race" placeholder="${t('sheet.id.race')}" ${ro}/>
        <input class="sf" value="${escapeHtml(d.bg || '')}" data-d="bg" placeholder="${t('sheet.id.bg')}" ${ro}/>
        <span class="sf-num">${t('sheet.lvl')}<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
        <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="${t('sheet.id.align')}" ${ro}/>
        <span class="sf-num">${t('sheet.xp')}<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
        <button class="sf-levelup" data-export title="${t('sheet.export.title')}">💾 JSON</button>
      </div>`;
  }
  const srd = srdContent(); // listes du système actif (2024…), sinon SRD 5.1
  return `<div class="sheet-id-grid">
      ${idSelect('race', srd?.racesLabel || t('sheet.id.raceLabel'), srd?.races || RACES, d.race, ro, ed)}
      ${idSelect('cls', t('sheet.id.class'), srd?.classes || CLASSES, d.cls, ro, ed)}
      ${subSelect(d, ro, ed)}
      <span class="sf-num">${t('sheet.lvl')}<input type="number" value="${num(d.lvl)}" data-d="lvl" ${ro}/></span>
      ${idSelect('bg', t('sheet.id.bg'), srd?.backgrounds || BACKGROUNDS, d.bg, ro, ed)}
      <input class="sf" value="${escapeHtml(d.align || '')}" data-d="align" placeholder="${t('sheet.id.align')}" ${ro}/>
      <span class="sf-num">${t('sheet.xp')}<input type="number" value="${num(d.xp)}" data-d="xp" ${ro}/></span>
      ${ed ? `<button class="sf-levelup" data-levelup title="${t('sheet.levelup.title5e')}">${t('sheet.levelup')}</button>` : ''}
      <button class="sf-levelup" data-export title="${t('sheet.export.title')}">💾 JSON</button>
    </div>
    ${multiclassSection(d, ed)}`;
}

/** Contenu d'un onglet du panneau principal, par identifiant de section. */
function paneContent(id, sys, sheet, c, d, ed, ro) {
  switch (id) {
    case 'stats':
      return `${identityBlock(sheet, d, ed, ro, sys)}
        <section class="sheet-abilities">
          ${sys.abilities.map((a) => abilityBox(a, d, ro, sys)).join('')}
        </section>
        <section class="sheet-block">
          <h3>${t('sheet.h.skills')}</h3>
          ${Object.keys(sys.skills).map((k) => skillRow(k, d, ed)).join('')}
        </section>
        ${sheet.identity === 'srd5e' ? profileSummarySection(d) : ''}`;
    case 'combat':
      return `<section class="sheet-block">
          <h3>${t('sheet.h.attacks')} ${ed ? `<button class="mini-add" data-add="atk">+</button>` : ''}</h3>
          <div class="atk-table">${(d.atks || []).map((a, i) => atkRow(a, i, ed)).join('') || `<div class="char-empty">${t('char.noAtk')}${ed ? t('char.addHint') : ''}</div>`}</div>
        </section>
        ${resourcesSection(d, ed)}`;
    case 'spells':
      return spellsSection(d, ed) || `<div class="char-empty">${t('char.noSpell')}</div>`;
    case 'feats':
      return featuresSection(d, ed);
    case 'inv':
      return inventorySection(d, ed, ro);
    case 'story':
      return storySection(c, d, ed, ro);
    case 'notes':
      return `${featsBlock(d.feats, ed)}
        ${textBlock(t('field.notes'), 'notes', d.notes, ro)}`;
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
  // Canonicalise la valeur stockée (libellé FR/EN ou clé) vers la clé stable,
  // pour qu'une ancienne fiche sélectionne la bonne entrée sous toute langue.
  const known = kind === 'cls' ? classByLabel(cur) : kind === 'race' ? raceByLabel(cur) : backgroundByLabel(cur);
  const curKey = known ? known.key : cur;
  const match = (e) => e.key === curKey || e.key === cur || e.label === cur;
  const inList = entries.some(match);
  const opts = [`<option value="">— ${label} —</option>`]
    .concat(
      entries.map(
        (e) => `<option value="${escapeHtml(e.key)}" ${match(e) ? 'selected' : ''}>${escapeHtml(e.label)}</option>`
      )
    );
  if (cur && !inList) opts.push(`<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} ${t('sheet.custom')}</option>`);
  return `<span class="sf-derive">
      <select class="sf" data-derive="${kind}" ${ro}>${opts.join('')}</select>
      ${ed && known ? `<button class="sf-cog" data-derive-open="${kind}" title="${t('sheet.derive.title', { label: escapeHtml(label.toLowerCase()) })}">⚙</button>` : ''}
    </span>`;
}

/** Menu de sous-classe dépendant de la classe sélectionnée (valeur custom préservée). */
function subSelect(d, ro, ed) {
  const cls = classByLabel(d.cls);
  const cur = String(d.sub || '');
  const known = subclassByLabel(cur);
  const curKey = known ? known.key : cur;
  const subs = cls ? cls.subclasses : [];
  // subclasses = tableau de libellés ; on résout la clé stable de chacune pour la valeur d'option.
  const subOpts = subs.map((s) => { const sc = subclassByLabel(s); return { key: sc ? sc.key : s, label: s }; });
  const match = (o) => o.key === curKey || o.key === cur || o.label === cur;
  const inList = subOpts.some(match);
  const opts = [`<option value="">${t('mc.subOpt')}</option>`]
    .concat(subOpts.map((o) => `<option value="${escapeHtml(o.key)}" ${match(o) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`));
  if (cur && !inList) opts.push(`<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} ${t('sheet.custom')}</option>`);
  return `<span class="sf-derive">
      <select class="sf" data-derive="sub" ${ro}>${opts.join('')}</select>
      ${ed && known ? `<button class="sf-cog" data-derive-open="sub" title="${t('sheet.derive.subTitle')}">⚙</button>` : ''}
    </span>`;
}

/** Sélecteur d'identité pf2e (ascendance/classe/historique) : pilote
 *  l'application du gabarit Remaster via data-pfderive (flux séparé du 5e). */
function pf2eSelect(kind, label, entries, value, ro, ed, resolve) {
  const cur = String(value || '');
  const known = resolve ? resolve(cur) : null; // cross-locale : libellé FR → clé stable
  const curKey = known ? known.key : cur;
  const match = (e) => e.key === curKey || e.key === cur || e.label === cur;
  const inList = entries.some(match);
  const opts = [`<option value="">— ${label} —</option>`].concat(
    entries.map((e) => `<option value="${escapeHtml(e.key)}" ${match(e) ? 'selected' : ''}>${escapeHtml(e.label)}</option>`)
  );
  if (cur && !inList) opts.push(`<option value="${escapeHtml(cur)}" selected>${escapeHtml(cur)} ${t('sheet.custom')}</option>`);
  return `<span class="sf-derive">
      <select class="sf" data-pfderive="${kind}" ${ro}>${opts.join('')}</select>
      ${ed && inList ? `<button class="sf-cog" data-pfderive-open="${kind}" title="${t('sheet.pfderive.title', { label: escapeHtml(label.toLowerCase()) })}">⚙</button>` : ''}
    </span>`;
}

/** Contrôle « Taille » (chaîne P/M/G) pour le rail — distinct de stat() (numérique). */
function sizeStat(val, ro) {
  const v = val || 'M';
  const opts = [['P', 'P'], ['M', 'M'], ['G', 'G']];
  return `
    <div class="combat-stat">
      <div class="cs-label">${t('field.size')}</div>
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
      <div class="ab-mod rollable" data-roll="ability" data-key="${a.key}" title="${t('sheet.rollAbility', { ability: a.label })}">${sys.fmtMod(mod)}</div>
      <input type="number" class="ab-score" value="${num(d[a.key])}" data-d="${a.key}" ${ro}/>
    </div>`;
}

function saveRow(a, d, ed, sys) {
  const has = (d.saves || []).includes(a.key);
  return `
    <label class="prof-row">
      <input type="checkbox" data-save="${a.key}" ${has ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="save" data-key="${a.key}" title="${t('sheet.rollSave', { ability: a.label })}">${sys.fmtMod(sys.saveBonus(d, a.key))}</span>
      <span class="prof-name">${a.label}</span>
    </label>`;
}

/** Ligne à rang de maîtrise (pf2e…) : un clic fait défiler les rangs. */
function rankRow(key, label, sub, rollKind, d, ed, sys) {
  const rank = Math.max(0, Math.min(sys.profRanks.length - 1, Number(d.ranks?.[key]) || 0));
  const r = sys.profRanks[rank];
  const bonus = rollKind === 'save' ? sys.saveBonus(d, key) : sys.skillBonus(d, key);
  const btn = ed
    ? `<button class="exp-toggle ${rank > 0 ? 'on' : ''}" data-rank="${key}" title="${t('sheet.rankTitle', { rank: r.label })}">${r.abbr}</button>`
    : `<span class="exp-badge" title="${r.label}">${r.abbr}</span>`;
  return `
    <label class="prof-row">
      ${btn}
      <span class="prof-bonus rollable" data-roll="${rollKind}" data-key="${key}" title="${label} (${r.label})">${sys.fmtMod(bonus)}</span>
      <span class="prof-name">${label}${sub ? ` <em>(${sub})</em>` : ''}</span>
    </label>`;
}

function skillRow(k, d, ed) {
  const sys = getSystem(activeCampaign()?.system || d.system);
  const sk = sys.skills[k];
  if (!sk) return '';
  const abRank = sys.abilities.find((a) => a.key === sk.ability)?.label || '';
  // Système à rangs de maîtrise (pf2e) : widget de rang au lieu de la case 5e.
  if (sys.profRanks) return rankRow(k, sk.label, abRank, 'skill', d, ed, sys);
  const prof = (d.profs || []).includes(k);
  const exp = (d.exp || []).includes(k);
  const ab = abRank;
  return `
    <label class="prof-row">
      <input type="checkbox" data-skill="${k}" ${prof ? 'checked' : ''} ${ed ? '' : 'disabled'}/>
      <span class="prof-bonus rollable" data-roll="skill" data-key="${k}" title="${t('sheet.skillTest', { skill: sk.label })}">${sys.fmtMod(sys.skillBonus(d, k))}</span>
      <span class="prof-name">${sk.label} <em>(${ab})</em></span>
      ${ed ? `<button class="exp-toggle ${exp ? 'on' : ''}" data-exp="${k}" title="${t('sheet.expertise')}">E</button>` : exp ? '<span class="exp-badge">E</span>' : ''}
    </label>`;
}

function atkRow(a, i, ed) {
  if (!ed) {
    return `<div class="atk-line clickable" data-cardatk="${i}" title="${t('sheet.atk.open')}">
      <strong>${escapeHtml(a.nm || '')}</strong>
      <span>${escapeHtml(a.bon || '')}</span>
      <span>${escapeHtml(a.dmg || '')} ${escapeHtml(a.typ || '')}</span>
      <em>${escapeHtml(a.prop || '')}</em>
    </div>`;
  }
  return `<div class="atk-line edit">
    <button class="atk-card-btn" data-cardatk="${i}" title="${t('sheet.atk.card')}">🎴</button>
    <input value="${escapeHtml(a.nm || '')}" data-atk="${i}" data-k="nm" placeholder="${t('cmp.namePh')}"/>
    <input value="${escapeHtml(a.bon || '')}" data-atk="${i}" data-k="bon" placeholder="+X" style="width:48px"/>
    <input value="${escapeHtml(a.dmg || '')}" data-atk="${i}" data-k="dmg" placeholder="1d8+2" style="width:70px"/>
    <input value="${escapeHtml(a.typ || '')}" data-atk="${i}" data-k="typ" placeholder="${t('sheet.atk.typePh')}" style="width:80px"/>
    <input value="${escapeHtml(a.prop || '')}" data-atk="${i}" data-k="prop" placeholder="${t('sheet.atk.propPh')}"/>
    <button class="mini-del" data-delatk="${i}">×</button>
  </div>`;
}

/** Aptitudes de classe / dons : liste cliquable (carte d'aptitude). */
function featuresSection(d, ed) {
  const list = d.features || [];
  const rows = list
    .map((f, i) => {
      if (!ed) {
        return `<div class="feat-line clickable" data-cardfeat="${i}" title="${t('sheet.feat.view')}">
          <strong>${escapeHtml(f.nm || '')}</strong>${f.lvl ? `<span class="feat-lvl">${t('sheet.lvl')}${escapeHtml(String(f.lvl))}</span>` : ''}
          <span class="feat-snip">${escapeHtml((f.desc || '').replace(/[#*_>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90))}</span>
        </div>`;
      }
      return `<div class="feat-edit">
        <div class="feat-edit-top">
          <button class="atk-card-btn" data-cardfeat="${i}" title="${t('sheet.feat.card')}">🎴</button>
          <input value="${escapeHtml(f.nm || '')}" data-feat="${i}" data-k="nm" placeholder="${t('sheet.feat.namePh')}"/>
          <input value="${escapeHtml(f.lvl || '')}" data-feat="${i}" data-k="lvl" placeholder="${t('sheet.lvlPh')}" style="width:48px"/>
          <button class="mini-del" data-delfeat="${i}">×</button>
        </div>
        <textarea class="spell-desc-in" data-feat="${i}" data-k="desc" rows="2" placeholder="${t('sheet.feat.descPh')}">${escapeHtml(f.desc || '')}</textarea>
      </div>`;
    })
    .join('');
  return `<section class="sheet-block">
    <h3>${t('sheet.h.feats')} ${ed ? `<button class="mini-add" data-add="feat">+</button>` : ''}</h3>
    <div class="feat-table">${rows || `<div class="char-empty">${t('sheet.feat.empty')}${ed ? t('sheet.feat.emptyEd') : ''}</div>`}</div>
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
          `<option value="${n}" ${n === Number(sel) ? 'selected' : ''}>${n === 0 ? t('cmp.cantrip') : `${t('sheet.lvl')}${n}`}</option>`
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
                   <button class="spell-cast" data-cardspell="${idx}" title="${t('sheet.spell.card')}">🎴</button>
                   <button class="spell-cast" data-cast="${idx}" title="${t('sheet.spell.cast')}">🪄</button>
                   <input value="${escapeHtml(s.nm)}" data-spell="${idx}" data-k="nm" placeholder="${t('sheet.spell.namePh')}"/>
                   <select class="spell-lvl-sel" data-spell="${idx}" data-k="lvl">${lvlOptions(s.lvl)}</select>
                   <button class="mini-del" data-delspell="${idx}">×</button>
                 </div>
                 <input class="spell-desc-in" value="${escapeHtml(s.desc || '')}" data-spell="${idx}" data-k="desc" placeholder="${t('sheet.spell.descPh')}"/>
                 <div class="spell-cast-fields">
                   <input value="${escapeHtml(s.atk || '')}" data-spell="${idx}" data-k="atk" placeholder="${t('sheet.spell.atkPh')}"/>
                   <input value="${escapeHtml(s.dmg || '')}" data-spell="${idx}" data-k="dmg" placeholder="${t('sheet.spell.dmgPh')}"/>
                   <input value="${escapeHtml(s.dc || '')}" data-spell="${idx}" data-k="dc" placeholder="${t('dice.dc')}"/>
                   <input value="${escapeHtml(s.heal || '')}" data-spell="${idx}" data-k="heal" placeholder="${t('sheet.spell.healPh')}" title="${t('sheet.spell.healTitle')}"/>
                   <input value="${escapeHtml(s.cond || '')}" data-spell="${idx}" data-k="cond" placeholder="${t('sheet.spell.condPh')}"/>
                 </div>
               </div>`;
          }
          const desc = effSpellDesc(s);
          const hasDesc = !!(desc && desc.trim());
          const tags = [s.atk ? `${t('sheet.spell.atkShort')} ${s.atk}` : '', s.dmg ? escapeHtml(s.dmg) : '', s.dc ? `${t('dice.dc')} ${escapeHtml(String(s.dc))}` : '']
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
      return `<div class="spell-group"><div class="spell-lv">${lv === 0 ? t('sheet.spell.cantrips') : `${t('field.lvl')} ${lv}`}</div>${rows}</div>`;
    })
    .join('');

  if (!spells.length && !hasSlots && !ed) return '';
  return `
    <section class="sheet-block">
      <h3>${t('sheet.h.spells')} ${ed ? `<button class="mini-add" data-add="spell">+</button>` : ''}</h3>
      ${slotsBlock(d, ed)}
      ${groups || (spells.length ? '' : `<div class="char-empty">${t('sheet.spell.empty')}</div>`)}
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
        `<button class="slot-pip ${i < u ? 'used' : ''}" ${ed ? '' : 'disabled'} data-slot="${lv}" data-i="${i + 1}" title="${i < u ? t('sheet.slot.recover') : t('sheet.slot.use')}"></button>`
      ).join('');
      return `<div class="slot-row"><span class="slot-lv">${t('sheet.slotLvl', { lv })}</span><span class="slot-pips">${pips}</span><span class="slot-count">${m - u}/${m}</span></div>`;
    })
    .join('');
  const editor = ed
    ? `<details class="slots-cfg"><summary>${t('sheet.slot.config')}</summary>
         <div class="slots-maxgrid">${lvls
           .map((lv) => `<label>${t('dock.slotLv', { lv })}<input type="number" min="0" max="9" value="${d.slots?.[lv]?.m || 0}" data-slotmax="${lv}"></label>`)
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
  const RESET = { short: t('sheet.reset.short'), long: t('sheet.reset.long'), none: t('sheet.reset.none') };
  const rows = res
    .map((r, i) => {
      const max = Math.max(0, Number(r.max) || 0);
      const used = Math.min(Number(r.used) || 0, max);
      const pips = Array.from({ length: max }, (_, k) =>
        `<button class="slot-pip ${k < used ? 'used' : ''}" data-res="${i}" data-i="${k + 1}" title="${k < used ? t('sheet.slot.recover') : t('sheet.slot.use')}"></button>`
      ).join('');
      if (ed) {
        return `<div class="res-edit">
            <input value="${escapeHtml(r.name || '')}" data-resk="${i}" data-k="name" placeholder="${t('sheet.res.namePh')}"/>
            <input type="number" min="0" max="30" value="${max}" data-resk="${i}" data-k="max" title="${t('sheet.res.max')}"/>
            <select data-resk="${i}" data-k="reset" title="${t('sheet.res.reset')}">
              <option value="short" ${r.reset === 'short' ? 'selected' : ''}>${t('sheet.restShort')}</option>
              <option value="long" ${r.reset === 'long' || !r.reset ? 'selected' : ''}>${t('sheet.restLong')}</option>
              <option value="none" ${r.reset === 'none' ? 'selected' : ''}>${t('sheet.restNone')}</option>
            </select>
            <button class="mini-del" data-delres="${i}">×</button>
          </div>`;
      }
      return `<div class="slot-row"><span class="slot-lv res-name">${escapeHtml(r.name || t('dock.res.title'))}</span><span class="slot-pips">${pips}</span><span class="slot-count">${max - used}/${max} <em>${RESET[r.reset] || RESET.long}</em></span></div>`;
    })
    .join('');
  return `<section class="sheet-block">
      <h3>${t('sheet.h.resources')} ${ed ? `<button class="mini-add" data-add="res">+</button> <button class="mini-add" data-init-res title="${t('sheet.initres.title')}">${t('sheet.initres')}</button>` : ''}</h3>
      <div class="slots-block">${rows || `<div class="char-empty">${t('sheet.res.empty')}</div>`}</div>
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
        <h3>${t('sheet.h.traits')}</h3>
        ${accordion}
        <details class="feats-editor">
          <summary>${t('common.edit')}</summary>
          <textarea class="sheet-text" data-d="feats" rows="6">${escapeHtml(text || '')}</textarea>
          <div class="feats-hint">${t('sheet.traits.hint')}</div>
        </details>
      </section>`;
  }
  return `
    <section class="sheet-block">
      <h3>${t('sheet.h.traits')}</h3>
      ${accordion}
    </section>`;
}

// k = clé de données (po/pe/pa/pc côté fiche) ; label/title = clés i18n
// réutilisées du trésor de groupe (pièces FR/EN), résolues à l'affichage.
const COINS = [
  { k: 'pp', label: 'loot.coin.pp', title: 'loot.coin.pp.t' },
  { k: 'po', label: 'loot.coin.gp', title: 'loot.coin.gp.t' },
  { k: 'pe', label: 'loot.coin.ep', title: 'loot.coin.ep.t' },
  { k: 'pa', label: 'loot.coin.sp', title: 'loot.coin.sp.t' },
  { k: 'pc', label: 'loot.coin.cp', title: 'loot.coin.cp.t' },
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
    <input value="${escapeHtml(it.nm || '')}" data-inv="${i}" data-k="nm" placeholder="${t('loot.item.ph')}"/>
    <input type="number" value="${escapeHtml(String(it.qty ?? 1))}" data-inv="${i}" data-k="qty" placeholder="${t('sheet.inv.qtyPh')}" style="width:54px"/>
    <input type="number" step="0.1" value="${escapeHtml(String(it.wt ?? ''))}" data-inv="${i}" data-k="wt" placeholder="lb" style="width:58px"/>
    <input value="${escapeHtml(it.note || '')}" data-inv="${i}" data-k="note" placeholder="${t('loot.note.ph')}"/>
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
      <h3>${t('sheet.h.money')}</h3>
      <div class="coins-row">
        ${COINS.map((c) => `<label class="coin" title="${t(c.title)}"><span>${t(c.label)}</span><input type="number" min="0" value="${num(coins[c.k])}" data-coin="${c.k}" ${ro}/></label>`).join('')}
      </div>
    </section>
    <section class="sheet-block">
      <h3>${t('sheet.h.inv')} ${ed ? `<button class="mini-add" data-add="inv">+</button> <button class="mini-add" data-startkit title="${t('sheet.startkit.title')}">${t('sheet.startkit')}</button>` : ''}
        <span class="inv-weight ${over ? 'over' : ''}" title="${t('sheet.inv.capTitle')}">${totalW.toFixed(1)} / ${cap} lb</span>
      </h3>
      <div class="inv-table">${items.length ? items.map((it, i) => invRow(it, i, ed)).join('') : `<div class="char-empty">${t('sheet.inv.empty')}${ed ? t('sheet.inv.emptyEd') : ''}</div>`}</div>
    </section>
    ${textBlock(t('sheet.equipNotes'), 'equip', d.equip, ro)}
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
      <h3>${t('sheet.story.shared')} <span class="story-tag story-tag-shared">${t('sheet.story.shared.tag')}</span></h3>
      <textarea class="sheet-text" data-d="story" ${ro} rows="8" placeholder="${t('sheet.story.shared.ph', { name: escapeHtml(c.name) })}">${escapeHtml(d.story || '')}</textarea>
    </section>`;
  // La partie secrète n'est rendue que pour le propriétaire et le MJ. Les autres
  // joueurs ne la voient pas (et la RLS les empêche de toute façon de la lire).
  const secret = ed
    ? `
    <section class="sheet-block">
      <h3>${t('sheet.story.secret')} <span class="story-tag story-tag-private">${t('sheet.story.secret.tag')}</span></h3>
      <textarea class="sheet-text" data-priv ${ro} rows="8" placeholder="${t('sheet.story.secret.ph')}">${escapeHtml(priv)}</textarea>
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

  // Migration validée : libellés hérités → clés stables (aperçu avant écriture).
  el.querySelector('[data-migrate-ids]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur || !canEdit(cur)) return;
    const sys = getSystem(activeCampaign()?.system || cur.data?.system);
    const changes = srdIdChanges(cur.data || {}, sys);
    if (!changes.length) return;
    const rows = changes
      .map((ch) => {
        const sum = srdEntrySummary(ch.entry, sys);
        const sumHtml = sum.length ? `<div class="migrate-srd">${sum.map((s) => escapeHtml(s)).join(' · ')}</div>` : '';
        return `<li><strong>${escapeHtml(t(ch.labelKey))}</strong> : ${escapeHtml(ch.name || ch.to)}${sumHtml}</li>`;
      })
      .join('');
    const ok = await modalConfirm(t('sheet.migrate.intro'), {
      title: t('sheet.migrate.title'),
      okLabel: t('sheet.migrate.ok'),
      bodyHtml: `<ul class="migrate-list">${rows}</ul>`,
    });
    if (!ok) return;
    updateCharacter(id, applySrdIdMigration(cur.data || {}, changes));
    showToast(t('sheet.migrate.done', { n: changes.length }), { type: 'success', timeout: 2600 });
  });

  // Pathfinder 2e : sélecteurs d'identité (flux séparé du 5e, data-pfderive).
  const PF_MODE = { race: 'ancestry', cls: 'class', bg: 'background' };
  el.querySelectorAll('[data-pfderive]').forEach((sel) =>
    sel.addEventListener('change', () => {
      const kind = sel.dataset.pfderive; // 'race' | 'cls' | 'bg'
      updateCharacter(id, { [kind]: sel.value });
      const pc = getSystem(activeCampaign()?.system)?.content;
      const known = pc && (kind === 'race' ? pc.ancestryByLabel(sel.value) : kind === 'cls' ? pc.classByLabel(sel.value) : pc.backgroundByLabel(sel.value));
      if (known) openPf2eDerive(id, PF_MODE[kind]);
    })
  );
  el.querySelectorAll('[data-pfderive-open]').forEach((b) =>
    b.addEventListener('click', () => openPf2eDerive(id, PF_MODE[b.dataset.pfderiveOpen] || 'ancestry'))
  );
  el.querySelector('[data-pflevelup]')?.addEventListener('click', () => pf2eLevelUp(id));
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
    if (await modalConfirm(t('char.del.confirm', { name: cur?.name }), { title: t('char.del.title'), danger: true, okLabel: t('common.delete') })) {
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
    if (!(await modalConfirm(t('char.lvlup.confirm5e', { name: cur.name, lvl: newLvl }), { title: t('derive.lvlup.title'), okLabel: t('derive.lvlBtn', { lvl: newLvl }) }))) return;
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
    showToast(t('char.lvlup.done5e', { name: cur.name, lvl: newLvl, prof }), { type: 'success', icon: '✨' });
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
    if (!(await modalConfirm(t('rest.short.confirm'), { title: t('rest.short.title'), okLabel: t('rest.short.ok') }))) return;
    const resources = (dd.resources || []).map((r) => (r.reset === 'short' ? { ...r, used: 0 } : r));
    updateCharacter(id, { resources });
    showToast(t('rest.short.done'), { timeout: 2000 });
    postCard({ kind: 'note', icon: '🔥', title: t('rest.short.cardTitle', { name: cur.name }), sub: t('rest.short.cardSub'), lines: [t('rest.short.cardLine')] });
  });

  el.querySelector('[data-rest="long"]')?.addEventListener('click', async () => {
    const cur = store.get().characters.find((c) => c.id === id);
    if (!cur) return;
    const dd = cur.data;
    if (!(await modalConfirm(t('rest.long.confirm'), { title: t('rest.long.title'), okLabel: t('rest.long.ok') }))) return;
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
      title: t('rest.long.cardTitle', { name: cur.name }),
      sub: t('rest.long.cardSub'),
      lines: [t('rest.long.l1'), t('rest.long.l2'), t('rest.long.l3'), t('rest.long.l4'), t('rest.long.l5', { n: regain })],
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
      modalAlert(t('rest.hd.none'), { title: t('sheet.rail.hitdice') });
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
    showToast(t('rest.hd.roll', { size, die, mod: `${conMod >= 0 ? '+' : ''}${conMod}`, gain, cur: hd - 1, max: hdMax }), { type: 'success', icon: '🩹' });
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
      const rk = node.dataset.roll;
      const k = node.dataset.key;
      // Les bonus viennent du descripteur du système de la campagne (cf. systems/).
      const sys = getSystem(activeCampaign()?.system || dd.system);
      // Maj = avantage, Ctrl/Cmd = désavantage.
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      if (rk === 'ability') {
        const lbl = sys.abilities.find((a) => a.key === k)?.label || k;
        sendD20Check(sys.abilityMod(dd[k]), t('dock.checkLabel', { name: who, ability: lbl }), { mode });
      } else if (rk === 'save') {
        const lbl = sys.saves?.find((s) => s.key === k)?.label || sys.abilities.find((a) => a.key === k)?.label || k;
        sendD20Check(sys.saveBonus(dd, k), t('char.roll.save', { name: who, save: lbl }), { mode });
      } else if (rk === 'skill') {
        sendD20Check(sys.skillBonus(dd, k), t('char.roll.skill', { name: who, skill: sys.skills[k]?.label || k }), { mode });
      } else if (rk === 'atk') {
        const a = (dd.atks || [])[Number(node.dataset.i)];
        if (!a) return;
        sendD20Check(normBon(a.bon), t('ac.lbl.atk', { who, nm: a.nm || t('combat.action.attack') }), { mode });
        if (a.dmg) sendRoll(a.dmg, 'public', t('ac.lbl.dmg', { who, nm: a.nm || t('combat.action.attack') }));
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
  // Rangs de maîtrise (pf2e) : chaque clic avance d'un rang, puis reboucle.
  el.querySelectorAll('[data-rank]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.preventDefault();
      const cur = store.get().characters.find((c) => c.id === id);
      if (!cur) return;
      const sys = getSystem(activeCampaign()?.system || cur.data?.system);
      const steps = sys.profRanks?.length || 1;
      const key = b.dataset.rank;
      const ranks = { ...(cur.data?.ranks || {}) };
      ranks[key] = ((Number(ranks[key]) || 0) + 1) % steps;
      updateCharacter(id, { ranks });
    })
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
      await modalAlert(t('char.res.noType', { cls: cur.data.cls || '—' }), { title: t('char.res.title') });
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
            const ok = await modalConfirm(t('char.cast.notEnoughRes', { name: r.name, remaining, max: r.max }), { title: t('dock.res.title'), okLabel: t('dice.roll') });
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
          const ok = await modalConfirm(t('char.cast.noSlot', { lv }), { title: t('cmp.spells'), okLabel: t('dice.roll') });
          if (!ok) return;
        } else {
          slot.u = (slot.u || 0) + 1;
          slots[lv] = slot;
          updateCharacter(id, { slots });
        }
      }
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      if (s.atk) sendD20Check(normBon(resolveNotation(s.atk, cur.data)), t('ac.lbl.atk', { who, nm: s.nm || t('combat.action.spell') }), { mode });
      if (s.dmg) sendRoll(resolveNotation(s.dmg, cur.data), 'public', t('ac.lbl.dmg', { who, nm: s.nm || t('combat.action.spell') }));
      logCombat(t('char.cast.log', { who, nm: s.nm || t('char.cast.aSpell'), lvl: lv ? t('char.cast.logLvl', { lvl: lv }) : '', dc: s.dc ? t('char.cast.logDc', { dc: s.dc }) : '' }));
      showToast(t('char.cast.toast', { nm: s.nm || t('combat.action.spell') }), { timeout: 1800 });
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
      if (f) openActionCard({ charId: id, who: cur.name || 'PJ', kind: 'atk', item: { nm: f.nm || t('char.featDefault'), desc: f.desc || '', noAtk: true } });
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
