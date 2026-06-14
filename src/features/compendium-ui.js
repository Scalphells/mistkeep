import { store } from '../state.js';
import { escapeHtml, debounce } from '../lib/utils.js';
import { renderMarkdown } from '../lib/markdown.js';
import { modalPrompt, modalConfirm, modalAlert } from '../lib/modal.js';
import {
  KINDS,
  kindLabel,
  kindPlural,
  loadCompendium,
  createEntry,
  updateEntry,
  deleteEntry,
  subscribeCompendium,
  monsterToCombat,
  rollTable,
  srdList,
  srdImport,
  srdImportMany,
} from './compendium.js';
import { t } from '../lib/i18n.js';
import { createHandout, uploadHandout } from './handouts.js';
import { sendMessage } from './chat.js';
import { addToken, uploadTokenAsset, signedTokenUrl, switchScene } from './map.js';
import { updateCharacter } from './characters.js';
import { openTarokka } from '../lib/tarokka.js';
import { openStatblock, parseStatblockActions } from '../lib/statblock.js';
import { loadImageBank } from './imagebank.js';
import { showToast } from '../lib/toast.js';

/**
 * UI Compendium (MJ) : bibliothèque de contenu réutilisable.
 * Colonne de gauche = catégories + recherche + liste ; droite = fiche/édition.
 * Renvoie une fonction de cleanup.
 */

/** Gabarits Markdown par type d'entrée (cadres vides à remplir, style « prep »). */
const TEMPLATES = {
  npc: '## Rôle\n\n## Apparence & voix\n\n## Objectifs\n\n## Infos clés\n\n## Pistes de roleplay\n',
  monster: '**CA** : \n**PV** : \n**FP** : \n\n## Capacités\n\n## Actions\n\n## Tactique\n',
  place: '## Description\n\n## Ce que perçoivent les joueurs\n\n## Rencontres\n\n## Secrets / butin\n\n## Liens (PNJ, scènes)\n',
  item: '## Description\n\n## Propriétés\n\n## Comment l’obtenir\n',
  class: '**Dé de vie** : \n**Jets de sauvegarde** : \n**Maîtrises** : \n\n## Aptitudes de classe\n\n## Sous-classes\n\n## Incantation\n',
};

let filterKind = 'all';
let query = '';
let sortDir = 'az'; // 'az' | 'za' — tri alphabétique de la liste
let activeId = null;
let editMode = false;
let isDMv = false;
let spellLevel = '';
let spellClass = '';

export async function mountCompendium(container) {
  isDMv = store.get().isDM;
  // Joueur : compendium en lecture seule, limité aux sorts + objets.
  if (!isDMv && filterKind !== 'spell' && filterKind !== 'item') filterKind = 'spell';

  container.innerHTML = `
    <div class="cmp-wrap">
      <aside class="cmp-side">
        <div class="cmp-kinds" id="cmp-kinds"></div>
        <div class="cmp-spellfilters" id="cmp-spellfilters"></div>
        <div class="cmp-searchrow">
          <input class="cmp-search" id="cmp-search" type="search" placeholder="${t('compendium.search')}" autocomplete="off" />
          <button class="cmp-sort-btn" id="cmp-sort" title="${t('compendium.sortTitle')}">A→Z</button>
        </div>
        ${
          isDMv
            ? `<button class="btn cmp-new" id="cmp-new">${t('cmp.newEntry')}</button>
               <details class="cmp-tools">
                 <summary>${t('cmp.tools')}</summary>
                 <div class="cmp-tools-body">
                   <button class="cmp-srd-btn" id="cmp-srd">${t('cmp.srd.btn')}</button>
                   <button class="cmp-srd-btn" id="cmp-paste">${t('cmp.paste.btn')}</button>
                   <button class="cmp-srd-btn" id="cmp-tarokka">🃏 Tirage de cartes</button>
                   <label class="cmp-srd-btn" id="cmp-md" title="${t('cmp.importMd.title')}">${t('cmp.importMd')}<input type="file" accept=".md,.markdown,text/markdown" multiple hidden></label>
                   <button class="cmp-srd-btn" id="cmp-bulkmove" title="${t('cmp.bulkmove.title')}">${t('cmp.bulkmove')}</button>
                   <button class="cmp-srd-btn" id="cmp-dedupe" title="${t('cmp.dedupe.title')}">${t('cmp.dedupe')}</button>
                   <button class="cmp-srd-btn" id="cmp-clear" title="${t('cmp.clear.title')}">${t('cmp.clear')}</button>
                 </div>
               </details>`
            : ''
        }
        <div class="cmp-list" id="cmp-list"></div>
      </aside>
      <main class="cmp-detail" id="cmp-detail"></main>
    </div>
  `;

  // Recherche débouncée : évite de reconstruire toute la liste à chaque frappe
  // (un compendium importé peut compter des centaines d'entrées).
  const debouncedList = debounce(() => renderList(container), 120);
  container.querySelector('#cmp-search').addEventListener('input', (e) => {
    query = e.target.value.trim().toLowerCase();
    debouncedList();
  });

  const sortBtn = container.querySelector('#cmp-sort');
  if (sortBtn) {
    const SORT_CYCLE = ['az', 'za', 'level'];
    const SORT_LABEL = { az: 'A→Z', za: 'Z→A', level: t('cmp.sort.level') };
    sortBtn.textContent = SORT_LABEL[sortDir] || 'A→Z';
    sortBtn.addEventListener('click', () => {
      sortDir = SORT_CYCLE[(SORT_CYCLE.indexOf(sortDir) + 1) % SORT_CYCLE.length];
      sortBtn.textContent = SORT_LABEL[sortDir];
      renderList(container);
    });
  }

  container.querySelector('#cmp-new')?.addEventListener('click', async () => {
    const kind = filterKind === 'all' ? 'monster' : filterKind;
    const name = await modalPrompt(t('cmp.new.prompt', { kind: kindLabel(kind) }), {
      title: t('compendium.modalTitle'),
      placeholder: kindLabel(kind),
    });
    if (!name || !name.trim()) return;
    const id = await createEntry(kind, name.trim());
    if (id) {
      if (TEMPLATES[kind]) await updateEntry(id, { data: { desc: TEMPLATES[kind] } });
      activeId = id;
      editMode = true;
      renderAll(container);
    }
  });

  container.querySelector('#cmp-srd')?.addEventListener('click', () => openSrdModal(container));
  container.querySelector('#cmp-paste')?.addEventListener('click', () => openPasteModal(container));
  container.querySelector('#cmp-tarokka')?.addEventListener('click', () => openTarokka());
  container.querySelector('#cmp-md input')?.addEventListener('change', (e) => importMarkdownFiles(e.target.files, container));
  container.querySelector('#cmp-bulkmove')?.addEventListener('click', () => openBulkMove(container));
  container.querySelector('#cmp-dedupe')?.addEventListener('click', () => dedupeCompendium(container));
  container.querySelector('#cmp-clear')?.addEventListener('click', () => openClearKind(container));

  await loadCompendium();
  consumeOpenRequest(container); // ouverture demandée par la recherche globale
  const unsubRealtime = subscribeCompendium();
  const unsubStore = store.subscribe(() => {
    if (store.get().compendiumOpenId) {
      consumeOpenRequest(container);
      return;
    }
    // Ne pas ré-rendre la fiche si on est en train d'éditer un champ.
    const inEditor = container.querySelector('#cmp-detail')?.contains(document.activeElement);
    renderList(container);
    if (!inEditor) renderDetail(container);
  });
  renderAll(container);

  return () => {
    unsubStore();
    unsubRealtime();
  };
}

/**
 * Déduplication : regroupe les entrées par (type + nom normalisé) et ne conserve
 * que la plus complète de chaque groupe (description la plus longue + plus de
 * champs renseignés) ; supprime les autres. MJ uniquement.
 */
async function dedupeCompendium(container) {
  if (!store.get().isDM) return;
  const all = store.get().compendium || [];
  const groups = new Map();
  for (const e of all) {
    const nm = (e.name || '').trim().toLowerCase();
    if (!nm) continue; // on ne fusionne pas les entrées sans nom
    const key = `${e.kind}::${nm}`;
    let arr = groups.get(key);
    if (!arr) groups.set(key, (arr = []));
    arr.push(e);
  }
  // Score : on garde l'entrée la plus « riche » (desc longue + champs remplis).
  const score = (e) => {
    const d = e.data || {};
    const filled = Object.values(d).filter((v) => v !== '' && v != null && !(Array.isArray(v) && !v.length)).length;
    return String(d.desc || '').length + filled * 8;
  };
  const toDelete = [];
  let dupGroups = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    dupGroups++;
    const sorted = [...list].sort((a, b) => score(b) - score(a) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
    toDelete.push(...sorted.slice(1)); // on garde sorted[0]
  }
  if (!toDelete.length) {
    await modalAlert(t('cmp.dedupe.none'), { title: t('cmp.dedupe.modalTitle') });
    return;
  }
  const ok = await modalConfirm(
    t('cmp.dedupe.confirm', { n: toDelete.length, groups: dupGroups }),
    { title: t('cmp.dedupe'), danger: true, okLabel: t('common.deleteN', { n: toDelete.length }) }
  );
  if (!ok) return;
  const deadIds = new Set(toDelete.map((e) => e.id));
  for (const e of toDelete) await deleteEntry(e.id);
  if (deadIds.has(activeId)) activeId = null;
  renderAll(container);
  await modalAlert(t('cmp.dedupe.done', { n: toDelete.length }), { title: t('cmp.dedupe.modalTitle') });
}

/**
 * Vider un type : modale listant chaque catégorie avec son nombre d'entrées ;
 * un clic supprime TOUTES les entrées de ce type (avec confirmation). MJ.
 */
function openClearKind(container) {
  if (!store.get().isDM) return;
  const all = store.get().compendium || [];
  const counts = {};
  for (const e of all) counts[e.kind] = (counts[e.kind] || 0) + 1;
  const kinds = Object.keys(KINDS).filter((k) => counts[k]);
  if (!kinds.length) {
    modalAlert(t('cmp.clear.empty'), { title: t('cmp.clear.modalTitle') });
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:340px;max-width:92vw">
      <h3 class="modal-title">${t('cmp.clear')}</h3>
      <p class="modal-msg">${t('cmp.clear.msg')}</p>
      <div class="clr-list">
        ${kinds
          .map(
            (k) => `<button class="clr-row" data-clr="${k}">
              <span>${KINDS[k].icon} ${escapeHtml(kindPlural(k))}</span>
              <span class="clr-n">${counts[k]}</span>
            </button>`
          )
          .join('')}
      </div>
      <div class="modal-actions"><button class="modal-btn clr-cancel">${t('common.cancel')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.clr-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelectorAll('[data-clr]').forEach((b) =>
    b.addEventListener('click', async () => {
      const k = b.dataset.clr;
      const victims = (store.get().compendium || []).filter((e) => e.kind === k);
      close();
      const ok = await modalConfirm(
        t('cmp.clear.confirm', { n: victims.length, kind: kindPlural(k).toLowerCase() }),
        { title: t('cmp.clear.confirmTitle', { kind: kindPlural(k) }), danger: true, okLabel: t('common.deleteN', { n: victims.length }) }
      );
      if (!ok) return;
      for (const e of victims) await deleteEntry(e.id);
      if (victims.some((e) => e.id === activeId)) activeId = null;
      renderAll(container);
      await modalAlert(t('cmp.clear.done', { n: victims.length }), { title: t('cmp.clear.modalTitle') });
    })
  );
}

/** Découpe une description Markdown en sections (par titres #..######). */
function splitSections(md) {
  const lines = String(md || '').split('\n');
  const secs = [];
  let cur = { title: '(début)', lines: [] };
  for (const line of lines) {
    const h = line.match(/^#{1,6}\s+(.*)/);
    if (h) {
      if (cur.lines.join('').trim()) secs.push(cur);
      cur = { title: h[1].trim(), lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  if (cur.lines.join('').trim()) secs.push(cur);
  return secs;
}

/**
 * Partage ciblé : le MJ choisit quelles sections (et l'image) envoyer aux
 * joueurs en handout — ex. « Apparence » et l'image, mais pas « Comment jouer ».
 */
function openShareModal(entry) {
  const secs = splitSections(entry.data?.desc || '');
  const hasImg = !!entry.data?.img;
  if (!secs.length && !hasImg) {
    modalAlert(t('cmp.share.empty'), { title: t('cmp.share.modalTitle') });
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:420px;max-width:94vw">
      <h3 class="modal-title">${t('cmp.share.heading', { name: escapeHtml(entry.name) })}</h3>
      <p class="modal-msg">${t('cmp.share.msg')}</p>
      <div class="share-list">
        ${hasImg ? `<label class="share-row"><input type="checkbox" data-img checked> ${t('cmp.share.img')}</label>` : ''}
        ${secs
          .map(
            (s, i) =>
              `<label class="share-row"><input type="checkbox" data-sec="${i}" ${s.title === '(début)' || /appar|description|aspect/i.test(s.title) ? 'checked' : ''}> ${escapeHtml(s.title === '(début)' ? t('cmp.share.intro') : s.title)}</label>`
          )
          .join('')}
      </div>
      <div class="modal-actions">
        <button class="modal-btn share-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok share-ok">${t('handouts.share')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.share-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.share-ok').addEventListener('click', async () => {
    const wantImg = !!ov.querySelector('[data-img]')?.checked;
    const chosen = [...ov.querySelectorAll('[data-sec]')].filter((c) => c.checked).map((c) => secs[Number(c.dataset.sec)]);
    close();
    try {
      if (chosen.length) {
        const text = chosen.map((s) => s.lines.join('\n').trim()).join('\n\n');
        await createHandout({ title: entry.name, description: KINDS[entry.kind] ? kindLabel(entry.kind) : '', content_type: 'text', text_content: text, target_player: null });
      }
      if (wantImg && entry.data?.img) {
        const url = await signedTokenUrl(entry.data.img);
        if (url) {
          const blob = await (await fetch(url)).blob();
          const file = new File([blob], `${entry.name}.jpg`, { type: blob.type || 'image/jpeg' });
          await uploadHandout(file, { title: entry.name, description: KINDS[entry.kind] ? kindLabel(entry.kind) : '', target_player: null });
        }
      }
      await modalAlert(t('cmp.share.done', { name: entry.name }), { title: t('cmp.share.modalTitle') });
    } catch (e) {
      await modalAlert(t('cmp.sendErr') + (e.message || ''), { title: t('cmp.share.modalTitle') });
    }
  });
}

/** Choix d'image pour une entrée : importer un fichier OU prendre dans la banque. */
async function openImagePicker(entry, container) {
  if (!store.get().imagebank?.length) await loadImageBank();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  const bank = store.get().imagebank || [];
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:520px;max-width:94vw">
      <h3 class="modal-title">${t('cmp.img.heading', { name: escapeHtml(entry.name) })}</h3>
      <div class="modal-actions" style="justify-content:flex-start;margin:0 0 10px">
        <label class="modal-btn modal-ok">${t('cmp.img.importFile')}<input type="file" id="imgpick-file" accept="image/*" hidden></label>
        ${entry.data?.img ? `<button class="modal-btn danger" id="imgpick-clear">${t('cmp.img.clear')}</button>` : ''}
      </div>
      <div class="imgpick-sub">${t('cmp.img.orBank')}</div>
      <div class="imgpick-grid">
        ${bank.length ? bank.map((p) => `<span class="imgpick-cell" data-p="${encodeURIComponent(p)}"></span>`).join('') : `<div class="cmp-muted">${t('cmp.img.bankEmpty')}</div>`}
      </div>
      <div class="modal-actions"><button class="modal-btn imgpick-cancel">${t('common.close')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.imgpick-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  const set = async (path) => {
    await updateEntry(entry.id, { data: { ...entry.data, img: path } });
    close();
    renderDetail(container);
  };
  ov.querySelector('#imgpick-file').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const path = await uploadTokenAsset(file);
      if (path) await set(path);
    } catch (ex) {
      await modalAlert(t('cmp.img.err') + ex.message, { title: t('cmp.img.title') });
    }
  });
  ov.querySelector('#imgpick-clear')?.addEventListener('click', () => set(null));
  ov.querySelectorAll('[data-p]').forEach((c) => {
    const path = decodeURIComponent(c.dataset.p);
    signedTokenUrl(path).then((u) => {
      if (u) c.style.backgroundImage = `url('${u}')`;
    });
    c.addEventListener('click', () => set(path));
  });
}

/** Ajoute un sort du compendium à la fiche d'un personnage choisi (MJ). */
function addSpellToSheet(entry) {
  const chars = store.get().characters || [];
  if (!chars.length) {
    modalAlert(t('cmp.noSheet'), { title: t('cmp.sheets') });
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:340px;max-width:92vw">
      <h3 class="modal-title">${t('cmp.addHeading', { name: escapeHtml(entry.name) })}</h3>
      <p class="modal-msg">${t('cmp.tofiche.which')}</p>
      <select class="modal-input" id="cmp-tofiche-sel">${chars.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.owner_id ? '' : ` (${t('kind.npc')})`}</option>`).join('')}</select>
      <div class="modal-actions">
        <button class="modal-btn cmp-tofiche-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok cmp-tofiche-ok">${t('common.add')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.cmp-tofiche-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.cmp-tofiche-ok').addEventListener('click', async () => {
    const cid = ov.querySelector('#cmp-tofiche-sel').value;
    const c = store.get().characters.find((x) => x.id === cid);
    if (!c) {
      close();
      return;
    }
    const lv = spellLevelOf(entry);
    const lvl = Number.isFinite(lv) ? lv : Number(entry.data?.level) || 0;
    const norm = (s) => String(s || '').normalize('NFC').trim().toLowerCase();
    const cur = [...(c.data.spells || [])];
    const idx = cur.findIndex((s) => norm(s.nm) === norm(entry.name));
    // On ne copie PAS le markdown dans le champ « description rapide » (il s'affiche
    // mal sur une ligne) : on lie le sort au compendium (entryId) et la carte
    // d'action récupère la description formatée. Le champ rapide reste libre.
    if (idx >= 0) {
      cur[idx] = { ...cur[idx], lvl, entryId: entry.id };
      updateCharacter(cid, { spells: cur });
      close();
      await modalAlert(t('cmp.tofiche.already', { name: entry.name, char: c.name }), { title: t('cmp.spells') });
      return;
    }
    cur.push({ nm: entry.name, lvl, entryId: entry.id });
    updateCharacter(cid, { spells: cur });
    close();
    await modalAlert(t('cmp.tofiche.done', { name: entry.name, char: c.name }), { title: t('cmp.spells') });
  });
}

/* ── Import Markdown / Obsidian ─────────────────────────────── */
function mapMdKind(s) {
  s = String(s || '').toLowerCase();
  if (/monst|creature|bestia/.test(s)) return 'monster';
  if (/\bpnj\b|\bnpc\b|person|character|perso/.test(s)) return 'npc';
  if (/item|objet|object|magic|loot/.test(s)) return 'item';
  if (/lieu|place|location|region|map|zone/.test(s)) return 'place';
  if (/sort|spell/.test(s)) return 'spell';
  if (/table|random|aléat/.test(s)) return 'table';
  return 'place';
}
/** Parse un fichier Markdown (gère frontmatter YAML + wikilinks Obsidian). */
function parseMd(filename, text) {
  let name = filename.replace(/\.(md|markdown)$/i, '').trim();
  let kind = 'place';
  let body = text;
  let nameFromFm = false;
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    body = text.slice(fm[0].length);
    const yaml = fm[1];
    const title = yaml.match(/(?:^|\n)\s*(?:title|name|nom)\s*:\s*(.+)/i);
    if (title) {
      name = title[1].trim().replace(/^["']|["']$/g, '');
      nameFromFm = true;
    }
    const t = yaml.match(/(?:^|\n)\s*(?:type|category|catégorie)\s*:\s*(.+)/i);
    const tags = yaml.match(/(?:^|\n)\s*tags?\s*:\s*(.+)/i);
    kind = mapMdKind(t ? t[1] : tags ? tags[1] : '');
  }
  // À défaut de titre explicite, on prend le premier titre « # » DU CONTENU
  // (toujours décodé en UTF-8, donc fiable) plutôt que le nom de fichier, qui
  // peut comporter des accents mal encodés selon le système d'export.
  if (!nameFromFm) {
    const h1 = body.match(/^\s*#\s+(.+?)\s*$/m);
    if (h1) name = h1[1].trim().normalize('NFC');
  }
  // Wikilinks Obsidian → texte simple ; embeds d'images supprimés.
  body = body
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .trim();
  return { name, kind, body };
}
async function importMarkdownFiles(fileList, container) {
  const files = [...(fileList || [])];
  if (!files.length) return;
  let n = 0;
  for (const f of files) {
    let text = '';
    try {
      text = await f.text();
    } catch {
      continue;
    }
    const { name, kind, body } = parseMd(f.name, text);
    if (!name) continue;
    const id = await createEntry(kind, name);
    if (!id) continue;
    const data = { desc: body };
    const ac = body.match(/(?:Armor Class|Classe d['’]armure|CA)\s*:?\s*(\d+)/i);
    const hp = body.match(/(?:Hit Points|Points de vie|PV)\s*:?\s*(\d+)/i);
    if (ac) data.ac = Number(ac[1]);
    if (hp) data.hpMax = Number(hp[1]);
    await updateEntry(id, { data });
    n++;
  }
  await modalAlert(t('cmp.mdImport.done', { n }), { title: t('cmp.mdImport.title') });
  renderAll(container);
}

/** Ajoute un objet du compendium à l'inventaire d'un personnage (MJ). */
function addItemToInventory(entry) {
  const chars = store.get().characters || [];
  if (!chars.length) {
    modalAlert(t('cmp.noSheet'), { title: t('cmp.sheets') });
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:340px;max-width:92vw">
      <h3 class="modal-title">${t('cmp.addHeading', { name: escapeHtml(entry.name) })}</h3>
      <p class="modal-msg">${t('cmp.toinv.which')}</p>
      <select class="modal-input" id="cmp-toinv-sel">${chars.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.owner_id ? '' : ` (${t('kind.npc')})`}</option>`).join('')}</select>
      <div class="modal-actions">
        <button class="modal-btn cmp-toinv-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok cmp-toinv-ok">${t('common.add')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.cmp-toinv-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.cmp-toinv-ok').addEventListener('click', async () => {
    const cid = ov.querySelector('#cmp-toinv-sel').value;
    const c = store.get().characters.find((x) => x.id === cid);
    if (!c) {
      close();
      return;
    }
    const note = String(entry.data?.desc || '').replace(/[#*_>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
    const inv = [...(c.data.inv || []), { nm: entry.name, qty: 1, wt: '', note }];
    updateCharacter(cid, { inv });
    close();
    await modalAlert(t('cmp.toinv.done', { name: entry.name, char: c.name }), { title: t('sheet.h.inv') });
  });
}

function renderAll(container) {
  renderKinds(container);
  renderSpellFilters(container);
  renderList(container);
  renderDetail(container);
}

/** Filtres niveau / classe, affichés quand la catégorie Sorts est active. */
function renderSpellFilters(container) {
  const el = container.querySelector('#cmp-spellfilters');
  if (!el) return;
  if (filterKind !== 'spell') {
    el.innerHTML = '';
    return;
  }
  const spells = store.get().compendium.filter((e) => e.kind === 'spell');
  const classes = [...new Set(spells.flatMap((e) => e.data?.classes || []))].sort();
  el.innerHTML = `
    <select id="cmp-flevel" class="cmp-fsel" title="${t('compendium.filter.levelTitle')}">
      <option value="">${t('compendium.filter.allLevels')}</option>
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((n) => `<option value="${n}" ${String(spellLevel) === String(n) ? 'selected' : ''}>${n === 0 ? t('cmp.cantrip') : t('sheet.lvl') + ' ' + n}</option>`)
        .join('')}
    </select>
    <select id="cmp-fclass" class="cmp-fsel" title="${t('compendium.filter.classTitle')}">
      <option value="">${t('compendium.filter.allClasses')}</option>
      ${classes.map((c) => `<option value="${escapeHtml(c)}" ${spellClass === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
    </select>`;
  el.querySelector('#cmp-flevel').addEventListener('change', (e) => {
    spellLevel = e.target.value;
    renderList(container);
  });
  el.querySelector('#cmp-fclass').addEventListener('change', (e) => {
    spellClass = e.target.value;
    renderList(container);
  });
}

/** Ouvre l'entrée demandée par la recherche globale, le cas échéant. */
function consumeOpenRequest(container) {
  const id = store.get().compendiumOpenId;
  if (!id) return;
  store.set({ compendiumOpenId: null });
  if (store.get().compendium.some((e) => e.id === id)) {
    activeId = id;
    editMode = false;
    filterKind = 'all';
    renderAll(container);
  }
}

function renderKinds(container) {
  const el = container.querySelector('#cmp-kinds');
  if (!el) return;
  if (!isDMv) {
    // Joueur : Sorts / Objets uniquement.
    el.innerHTML = ['spell', 'item']
      .map(
        (k) =>
          `<button class="cmp-kind ${filterKind === k ? 'active' : ''}" data-kind="${k}" title="${kindPlural(k)}">${KINDS[k].icon} ${kindPlural(k)}</button>`
      )
      .join('');
  } else {
    const all = `<button class="cmp-kind ${filterKind === 'all' ? 'active' : ''}" data-kind="all">${t('compendium.filter.all')}</button>`;
    el.innerHTML =
      all +
      Object.entries(KINDS)
        .map(
          ([k, v]) =>
            `<button class="cmp-kind ${filterKind === k ? 'active' : ''}" data-kind="${k}" title="${kindPlural(k)}">${v.icon}</button>`
        )
        .join('');
  }
  el.querySelectorAll('[data-kind]').forEach((b) =>
    b.addEventListener('click', () => {
      filterKind = b.dataset.kind;
      renderKinds(container);
      renderSpellFilters(container);
      renderList(container);
    })
  );
}

/** Niveau d'un sort : champ structuré, sinon déduit du texte (« Niveau X »). */
function spellLevelOf(e) {
  const lv = e.data?.level;
  if (lv != null && lv !== '') return Number(lv);
  const d = e.data?.desc || '';
  if (/sort mineur|niveau\s*0|cantrip|\bmineur\b/i.test(d)) return 0;
  const m = d.match(/niveau\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

function filtered() {
  const list = store.get().compendium.filter((e) => {
    if (filterKind !== 'all' && e.kind !== filterKind) return false;
    if (query && !e.name.toLowerCase().includes(query) && !(e.data?.desc || '').toLowerCase().includes(query))
      return false;
    if (e.kind === 'spell') {
      if (spellLevel !== '' && spellLevelOf(e) !== Number(spellLevel)) return false;
      if (spellClass && !(e.data?.classes || []).includes(spellClass)) return false;
    }
    return true;
  });
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' });
  // Tri par niveau (sorts) puis nom ; les entrées sans niveau passent à la fin.
  if (sortDir === 'level') {
    return list.sort((a, b) => {
      const la = spellLevelOf(a);
      const lb = spellLevelOf(b);
      const na = la == null ? 99 : la;
      const nb = lb == null ? 99 : lb;
      return na - nb || byName(a, b);
    });
  }
  // Tri alphabétique naturel (« 2 » avant « 10 », accents ignorés), A→Z / Z→A.
  const dir = sortDir === 'za' ? -1 : 1;
  return list.sort((a, b) => dir * byName(a, b));
}

function renderList(container) {
  const el = container.querySelector('#cmp-list');
  if (!el) return;
  const list = filtered();
  if (!list.length) {
    el.innerHTML = `<div class="cmp-empty">${t('compendium.empty')}</div>`;
    return;
  }
  el.innerHTML = list
    .map(
      (e) =>
        `<button class="cmp-item ${e.id === activeId ? 'active' : ''}" data-id="${e.id}" data-kind="${e.kind}" draggable="true">
           <span class="cmp-item-icon">${KINDS[e.kind]?.icon || '📄'}</span>
           <span class="cmp-item-name">${escapeHtml(e.name)}</span>
           ${(() => {
             if (e.kind !== 'spell') return '';
             const lv = spellLevelOf(e);
             return lv != null ? `<span class="cmp-lvl">${lv === 0 ? 'M' : lv}</span>` : '';
           })()}
         </button>`
    )
    .join('');
  el.querySelectorAll('[data-id]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.id === activeId && !editMode) return; // déjà sélectionnée
      activeId = b.dataset.id;
      editMode = false;
      // Bascule la surbrillance sans reconstruire toute la liste (perf).
      el.querySelector('.cmp-item.active')?.classList.remove('active');
      b.classList.add('active');
      renderDetail(container);
    });
    // Glisser une entrée → carte (jeton) ou fiche (sort/objet).
    b.addEventListener('dragstart', (ev) => {
      const e = store.get().compendium.find((x) => x.id === b.dataset.id);
      if (!e) return;
      const payload = {
        id: e.id,
        kind: e.kind,
        name: e.name,
        img: e.data?.img || null,
        ac: e.data?.ac,
        hp: e.data?.hp,
        hpMax: e.data?.hpMax,
      };
      ev.dataTransfer.setData('application/x-vaultmj-entry', JSON.stringify(payload));
      ev.dataTransfer.setData('text/plain', e.name);
      ev.dataTransfer.effectAllowed = 'copy';
    });
  });
}

/** Déplacement en lot : coche plusieurs entrées et change leur type (MJ). */
function openBulkMove(container) {
  const all = [...(store.get().compendium || [])].sort(
    (a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, 'fr', { numeric: true })
  );
  if (!all.length) {
    showToast(t('cmp.bulk.empty'), { timeout: 2000 });
    return;
  }
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card bulkmove-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('cmp.bulkmove')}</h3>
      <div class="bulk-toolbar">
        <input class="modal-input bulk-search" placeholder="${t('cmp.bulk.search')}" />
        <label class="bulk-target">${t('cmp.bulk.toLabel')}
          <select class="bulk-kind">
            ${Object.keys(KINDS).map((k) => `<option value="${k}">${KINDS[k].icon} ${escapeHtml(kindLabel(k))}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="bulk-actions-row">
        <button class="link bulk-all" type="button">${t('cmp.bulk.all')}</button>
        <button class="link bulk-none" type="button">${t('cmp.bulk.none')}</button>
        <span class="bulk-count">${t('cmp.bulk.count', { n: 0 })}</span>
      </div>
      <div class="bulk-list">
        ${all
          .map(
            (e) => `<label class="bulk-row" data-name="${escapeHtml(e.name.toLowerCase())}">
              <input type="checkbox" data-id="${e.id}">
              <span class="bulk-ic">${KINDS[e.kind]?.icon || '📄'}</span>
              <span class="bulk-name">${escapeHtml(e.name)}</span>
              <span class="bulk-kindlbl">${escapeHtml(KINDS[e.kind] ? kindLabel(e.kind) : e.kind)}</span>
            </label>`
          )
          .join('')}
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok">${t('cmp.bulk.move')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  const checks = () => [...ov.querySelectorAll('[data-id]:checked')];
  const updateCount = () => {
    ov.querySelector('.bulk-count').textContent = t('cmp.bulk.count', { n: checks().length });
  };
  ov.addEventListener('change', updateCount);
  ov.querySelector('.bulk-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    ov.querySelectorAll('.bulk-row').forEach((r) => {
      r.style.display = !q || r.dataset.name.includes(q) ? '' : 'none';
    });
  });
  ov.querySelector('.bulk-all').addEventListener('click', () => {
    ov.querySelectorAll('.bulk-row').forEach((r) => {
      if (r.style.display !== 'none') r.querySelector('[data-id]').checked = true;
    });
    updateCount();
  });
  ov.querySelector('.bulk-none').addEventListener('click', () => {
    ov.querySelectorAll('[data-id]').forEach((c) => (c.checked = false));
    updateCount();
  });
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.modal-ok').addEventListener('click', async () => {
    const ids = checks().map((c) => c.dataset.id);
    if (!ids.length) {
      showToast(t('cmp.bulk.pickOne'), { timeout: 2000 });
      return;
    }
    const kind = ov.querySelector('.bulk-kind').value;
    close();
    for (const id of ids) await updateEntry(id, { kind });
    showToast(t('cmp.bulk.done', { n: ids.length, kind: kindLabel(kind) }), { timeout: 2800 });
    renderAll(container);
  });
}

/** Sélecteur de type : déplace une entrée vers une autre catégorie (MJ). */
function openKindChooser(container, entry) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card kind-chooser" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('cmp.kindMove.heading', { name: escapeHtml(entry.name) })}</h3>
      <div class="kind-grid">
        ${Object.entries(KINDS)
          .map(
            ([k, v]) =>
              `<button class="kind-opt ${k === entry.kind ? 'current' : ''}" data-k="${k}"${k === entry.kind ? ' disabled' : ''}>
                 <span class="kind-opt-ic">${v.icon}</span> ${escapeHtml(kindLabel(k))}${k === entry.kind ? t('cmp.current') : ''}
               </button>`
          )
          .join('')}
      </div>
      <div class="modal-actions"><button class="modal-btn modal-cancel">${t('common.cancel')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelectorAll('[data-k]').forEach((b) =>
    b.addEventListener('click', async () => {
      const k = b.dataset.k;
      if (k === entry.kind) return;
      close();
      await updateEntry(entry.id, { kind: k });
      showToast(t('cmp.kindMove.done', { name: entry.name, kind: kindLabel(k) }), { timeout: 2400 });
      renderAll(container);
    })
  );
}

function renderDetail(container) {
  const el = container.querySelector('#cmp-detail');
  if (!el) return;
  const entry = store.get().compendium.find((e) => e.id === activeId);
  if (!entry) {
    el.innerHTML = `<div class="cmp-placeholder">${t('compendium.placeholder')}</div>`;
    return;
  }
  const meta = KINDS[entry.kind] || { icon: '📄', label: t('cmp.entryDefault') };

  // Actions selon le type (MJ uniquement).
  const actions = [];
  const canToken = entry.kind === 'monster' || entry.kind === 'npc';
  const canImg = canToken || entry.kind === 'place';
  if (canToken) {
    const nActs = parseStatblockActions(entry.data?.desc).length;
    if (nActs) actions.push(`<button class="btn cmp-act" data-act="statblock">${t('compendium.act.actions', { n: nActs })}</button>`);
  }
  if (isDMv && entry.kind === 'monster') actions.push(`<button class="btn cmp-act" data-act="combat">${t('compendium.act.combat')}</button>`);
  if (isDMv && canToken) actions.push(`<button class="btn cmp-act" data-act="totoken">${t('compendium.act.totoken')}</button>`);
  if (isDMv && entry.kind === 'place') actions.push(`<button class="btn cmp-act" data-act="scene">${entry.data?.sceneId ? t('compendium.act.sceneGo') : t('compendium.act.sceneLink')}</button>`);
  if (isDMv && canImg) actions.push(`<button class="btn cmp-act" data-act="img">${t('compendium.act.img')}</button>`);
  if (isDMv && entry.kind === 'spell') actions.push(`<button class="btn cmp-act" data-act="tofiche">${t('compendium.act.tofiche')}</button>`);
  if (isDMv && entry.kind === 'item') actions.push(`<button class="btn cmp-act" data-act="toinv">${t('compendium.act.toinv')}</button>`);
  if (isDMv && entry.kind === 'table') actions.push(`<button class="btn cmp-act" data-act="roll">${t('compendium.act.roll')}</button>`);
  if (isDMv && entry.kind !== 'table') actions.push(`<button class="btn cmp-act" data-act="handout">${t('compendium.act.handout')}</button>`);

  el.innerHTML = `
    <header class="cmp-detail-head" data-kind="${entry.kind}">
      ${canImg && entry.data?.img ? `<img class="cmp-token-thumb" id="cmp-token-thumb" alt="">` : `<span class="cmp-detail-icon">${meta.icon}</span>`}
      <h2${isDMv ? ` data-act="rename" role="button" title="${t('compendium.rename.hint')}" style="cursor:pointer"` : ''}>${escapeHtml(entry.name)}</h2>
      <span class="cmp-badge" data-kind="${entry.kind}"${isDMv ? ` data-act="kind" role="button" title="${t('compendium.kind.title')}"` : ''}>${kindLabel(entry.kind)}${isDMv ? ' ▾' : ''}</span>
      <span class="cmp-detail-actions">
        ${actions.join('')}
        ${
          isDMv
            ? `<button class="cmp-icon-btn" data-act="edit" title="${editMode ? t('compendium.edit.preview') : t('compendium.edit.edit')}">${editMode ? '👁' : '✏'}</button>
               <button class="cmp-icon-btn danger" data-act="del" title="${t('compendium.del.title')}">🗑</button>`
            : ''
        }
      </span>
    </header>
    <div class="cmp-detail-body" id="cmp-body"></div>
    <div class="cmp-roll-result" id="cmp-roll-result"></div>
  `;

  renderBody(container, entry);

  // Vignette du jeton illustré (URL signée résolue à la demande).
  const thumb = el.querySelector('#cmp-token-thumb');
  if (thumb && entry.data?.img) {
    signedTokenUrl(entry.data.img).then((u) => {
      if (u) thumb.src = u;
    });
  }

  el.querySelector('[data-act="rename"]')?.addEventListener('click', async () => {
    const v = await modalPrompt(t('compendium.rename.prompt'), { title: t('compendium.rename.modalTitle'), defaultValue: entry.name });
    if (v && v.trim() && v.trim() !== entry.name) {
      await updateEntry(entry.id, { name: v.trim() });
      renderAll(container);
    }
  });
  el.querySelector('[data-act="kind"]')?.addEventListener('click', () => openKindChooser(container, entry));
  el.querySelector('[data-act="edit"]')?.addEventListener('click', () => {
    editMode = !editMode;
    renderDetail(container);
  });
  el.querySelector('[data-act="del"]')?.addEventListener('click', async () => {
    if (await modalConfirm(t('compendium.del.confirm', { name: entry.name }), { title: t('compendium.modalTitle'), danger: true, okLabel: t('compendium.del.ok') })) {
      const wasActive = activeId === entry.id;
      await deleteEntry(entry.id);
      if (wasActive) activeId = null;
      renderAll(container);
    }
  });
  el.querySelector('[data-act="statblock"]')?.addEventListener('click', () => openStatblock(entry));
  el.querySelector('[data-act="combat"]')?.addEventListener('click', async () => {
    monsterToCombat(entry);
    await modalAlert(t('cmp.act.toCombat.done', { name: entry.name }), { title: t('cmp.combat') });
  });
  el.querySelector('[data-act="tofiche"]')?.addEventListener('click', () => addSpellToSheet(entry));
  el.querySelector('[data-act="toinv"]')?.addEventListener('click', () => addItemToInventory(entry));
  el.querySelector('[data-act="scene"]')?.addEventListener('click', async () => {
    if (entry.data?.sceneId) {
      await switchScene(entry.data.sceneId);
      await modalAlert(t('cmp.act.sceneActivated', { name: entry.name }), { title: t('cmp.map') });
    } else {
      const sid = store.get().activeSceneId;
      if (!sid) {
        await modalAlert(t('cmp.act.noScene'), { title: t('cmp.map') });
        return;
      }
      await updateEntry(entry.id, { data: { ...entry.data, sceneId: sid } });
      renderDetail(container);
      await modalAlert(t('cmp.act.sceneLinked', { name: entry.name }), { title: t('cmp.map') });
    }
  });
  el.querySelector('[data-act="totoken"]')?.addEventListener('click', async () => {
    const m = store.get().map;
    const cx = Math.round((m?.bgW || 1600) / 2 + (Math.random() * 120 - 60));
    const cy = Math.round((m?.bgH || 1000) / 2 + (Math.random() * 120 - 60));
    addToken({ x: cx, y: cy, label: entry.name.slice(0, 6), img: entry.data?.img || null });
    await modalAlert(
      entry.data?.img ? t('cmp.act.tokenAddedImg', { name: entry.name }) : t('cmp.act.tokenAdded', { name: entry.name }),
      { title: t('cmp.map') }
    );
  });
  el.querySelector('[data-act="img"]')?.addEventListener('click', () => openImagePicker(entry, container));
  el.querySelector('[data-act="handout"]')?.addEventListener('click', () => openShareModal(entry));
  el.querySelector('[data-act="roll"]')?.addEventListener('click', () => {
    const res = rollTable(entry);
    const out = container.querySelector('#cmp-roll-result');
    if (!res) {
      out.innerHTML = `<span class="cmp-muted">${t('cmp.table.empty')}</span>`;
      return;
    }
    // Tirage local d'abord (le MJ peut rester discret), annonce au chat en option.
    out.innerHTML = `🎲 <strong>${escapeHtml(res)}</strong>
      <button class="btn cmp-act" data-act="announce" title="${t('cmp.announce.title')}">${t('cmp.announce')}</button>`;
    out.querySelector('[data-act="announce"]')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await sendMessage(`🎲 ${entry.name} — ${res}`, 'public');
        btn.textContent = t('cmp.announced');
      } catch (err) {
        btn.disabled = false;
        showToast(t('cmp.sendErr') + err.message, { type: 'warn', icon: '⚠️' });
      }
    });
  });
}

function renderBody(container, entry) {
  const el = container.querySelector('#cmp-body');
  if (!el) return;

  if (!editMode) {
    let extra = '';
    if (entry.kind === 'monster') {
      const d = entry.data || {};
      const stats = [
        d.ac != null && d.ac !== '' ? `CA ${escapeHtml(String(d.ac))}` : '',
        d.hpMax != null && d.hpMax !== '' ? `PV ${escapeHtml(String(d.hpMax))}` : '',
        d.cr ? `FP ${escapeHtml(String(d.cr))}` : '',
      ].filter(Boolean);
      if (stats.length) extra = `<div class="cmp-stats">${stats.map((s) => `<span>${s}</span>`).join('')}</div>`;
    }
    if (entry.kind === 'table') {
      const rows = (entry.data?.entries || []).filter((r) => r && r.text);
      extra = rows.length
        ? `<table class="cmp-table"><tbody>${rows
            .map((r) => `<tr><td>${escapeHtml(String(r.weight || 1))}</td><td>${escapeHtml(r.text)}</td></tr>`)
            .join('')}</tbody></table>`
        : '';
    }
    if (entry.kind === 'spell') {
      const d = entry.data || {};
      const lv = spellLevelOf(entry);
      const bits = [
        lv != null ? (lv === 0 ? t('cmp.spellCantrip') : t('cmp.levelN', { lv })) : '',
        (d.classes || []).join(', '),
      ].filter(Boolean);
      if (bits.length) extra = `<div class="cmp-stats">${bits.map((s) => `<span>${escapeHtml(s)}</span>`).join('')}</div>`;
    }
    el.innerHTML = extra + `<div class="md">${renderMarkdown(entry.data?.desc || t('cmp.noDescFull'))}</div>`;
    return;
  }

  // Mode édition.
  const d = entry.data || {};
  let fields = '';
  if (entry.kind === 'monster') {
    fields = `
      <div class="cmp-row">
        <label class="cmp-field">${t('dock.ac')}<input id="f-ac" type="number" value="${escapeHtml(String(d.ac ?? ''))}"></label>
        <label class="cmp-field">${t('combat.add.hpmax')}<input id="f-hpmax" type="number" value="${escapeHtml(String(d.hpMax ?? ''))}"></label>
        <label class="cmp-field">${t('enc.cr')}<input id="f-cr" type="text" value="${escapeHtml(String(d.cr ?? ''))}"></label>
      </div>`;
  }
  if (entry.kind === 'spell') {
    fields = `
      <div class="cmp-row">
        <label class="cmp-field">${t('cmp.level')}<input id="f-level" type="number" min="0" max="9" value="${escapeHtml(String(d.level ?? ''))}"></label>
        <label class="cmp-field" style="flex:1; min-width:180px">${t('cmp.classesLabel')}<input id="f-classes" type="text" value="${escapeHtml((d.classes || []).join(', '))}"></label>
      </div>`;
  }
  let tableEditor = '';
  if (entry.kind === 'table') {
    const rows = d.entries || [];
    tableEditor = `
      <div class="cmp-table-edit" id="cmp-table-edit">
        ${rows
          .map(
            (r, i) => `<div class="cmp-trow" data-i="${i}">
              <input class="cmp-w" type="number" min="1" value="${escapeHtml(String(r.weight || 1))}" title="${t('cmp.weight')}">
              <input class="cmp-t" type="text" value="${escapeHtml(r.text || '')}" placeholder="${t('cmp.resultPh')}">
              <button class="cmp-icon-btn danger" data-del-row="${i}" title="${t('common.remove')}">✕</button>
            </div>`
          )
          .join('')}
        <button class="link" id="cmp-add-row" style="width:auto;margin:6px 0 0">${t('cmp.addRow')}</button>
      </div>`;
  }
  el.innerHTML = `
    <input id="f-name" class="cmp-name-input" type="text" value="${escapeHtml(entry.name)}" placeholder="${t('cmp.namePh')}">
    ${fields}
    ${tableEditor}
    <textarea id="f-desc" class="cmp-desc" placeholder="${t('cmp.descPh')}">${escapeHtml(d.desc || '')}</textarea>
    <div class="cmp-hint">${t('cmp.autosave')}</div>
  `;

  // Sauvegardes.
  const saveName = () => {
    const v = el.querySelector('#f-name').value.trim();
    if (v && v !== entry.name) updateEntry(entry.id, { name: v });
  };
  el.querySelector('#f-name').addEventListener('change', saveName);

  const saveData = () => {
    const data = { ...(entry.data || {}) };
    data.desc = el.querySelector('#f-desc').value;
    if (entry.kind === 'monster') {
      data.ac = el.querySelector('#f-ac').value;
      data.hpMax = el.querySelector('#f-hpmax').value;
      data.hp = data.hpMax;
      data.cr = el.querySelector('#f-cr').value;
    }
    if (entry.kind === 'spell') {
      const lv = el.querySelector('#f-level').value;
      data.level = lv === '' ? '' : Number(lv);
      data.classes = el.querySelector('#f-classes').value.split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (entry.kind === 'table') {
      data.entries = [...el.querySelectorAll('.cmp-trow')].map((row) => ({
        weight: Number(row.querySelector('.cmp-w').value) || 1,
        text: row.querySelector('.cmp-t').value,
      }));
    }
    updateEntry(entry.id, { data });
  };
  el.querySelectorAll('#f-desc, #f-ac, #f-hpmax, #f-cr, #f-level, #f-classes, .cmp-w, .cmp-t').forEach((inp) =>
    inp.addEventListener('change', saveData)
  );

  el.querySelector('#cmp-add-row')?.addEventListener('click', () => {
    const data = { ...(entry.data || {}) };
    data.entries = [...(data.entries || []), { weight: 1, text: '' }];
    updateEntry(entry.id, { data });
    renderBody(container, store.get().compendium.find((e) => e.id === entry.id));
  });
  el.querySelectorAll('[data-del-row]').forEach((b) =>
    b.addEventListener('click', () => {
      const i = Number(b.dataset.delRow);
      const data = { ...(entry.data || {}) };
      data.entries = (data.entries || []).filter((_, idx) => idx !== i);
      updateEntry(entry.id, { data });
      renderBody(container, store.get().compendium.find((e) => e.id === entry.id));
    })
  );
}

/**
 * Coller-importer : crée une entrée à partir d'un texte collé (statblock,
 * description). Tente d'extraire CA / PV / FP (formats anglais & français 2014).
 */
function openPasteModal(container) {
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:560px;max-width:94vw">
      <h3 class="modal-title">${t('cmp.paste.btn')}</h3>
      <div class="atk-row atk-grid2">
        <div><label>${t('cmp.namePh')}</label><input class="atk-in" id="pa-name" placeholder="Nom du PNJ"></div>
        <div><label>${t('cmp.type')}</label><select class="atk-sel" id="pa-kind">
          ${Object.keys(KINDS).map((k) => `<option value="${k}">${escapeHtml(kindLabel(k))}</option>`).join('')}
        </select></div>
      </div>
      <div class="atk-row"><label>${t('cmp.paste.textLabel')}</label>
        <textarea class="atk-in" id="pa-text" style="min-height:200px; font-family:inherit; line-height:1.5" placeholder="${t('cmp.paste.ph')}"></textarea>
      </div>
      <p class="modal-msg" id="pa-info" style="display:none"></p>
      <div class="modal-actions">
        <button class="modal-btn pa-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok pa-ok">${t('cmp.import')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('.pa-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.pa-ok').addEventListener('click', async () => {
    const name = ov.querySelector('#pa-name').value.trim();
    const kind = ov.querySelector('#pa-kind').value;
    const text = ov.querySelector('#pa-text').value.trim();
    if (!name) {
      ov.querySelector('#pa-name').focus();
      return;
    }
    const id = await createEntry(kind, name);
    if (!id) {
      close();
      return;
    }
    const data = { desc: text };
    const num = (re) => {
      const m = text.match(re);
      return m ? m[1] : null;
    };
    const ac = num(/(?:Armor Class|Classe d['’]armure|CA)\s*:?\s*(\d+)/i);
    const hp = num(/(?:Hit Points|Points de vie|PV)\s*:?\s*(\d+)/i);
    const cr = num(/(?:Challenge|Facteur de puissance|FP)\s*:?\s*([\d/]+)/i);
    if (ac) data.ac = Number(ac);
    if (hp) data.hpMax = Number(hp);
    if (cr) data.cr = cr;
    await updateEntry(id, { data });
    activeId = id;
    editMode = false;
    renderAll(container);
    close();
  });
  ov.querySelector('#pa-name').focus();
}

/** Modal d'import depuis le SRD (dnd5eapi.co, règles 2014). */
function openSrdModal(container) {
  let kind = 'monster';
  let all = [];
  let loading = false;
  let error = '';

  const ov = document.createElement('div');
  ov.className = 'srd-overlay';
  ov.innerHTML = `
    <div class="srd-box">
      <header class="srd-head">
        <strong>Import SRD (2014)</strong>
        <div class="srd-kinds">
          <button class="srd-kind active" data-k="monster">👹 ${t('kind.monster.pl')}</button>
          <button class="srd-kind" data-k="spell">✨ ${t('kind.spell.pl')}</button>
          <button class="srd-kind" data-k="class">🎓 ${t('kind.class.pl')}</button>
          <button class="srd-kind" data-k="race">🧝 ${t('kind.race.pl')}</button>
          <button class="srd-kind" data-k="background">📜 ${t('kind.background.pl')}</button>
        </div>
        <button class="srd-close" title="${t('common.close')}">✕</button>
      </header>
      <input class="srd-search" placeholder="${t('cmp.srd.search')}">
      <div class="srd-bar">
        <label class="srd-fr"><input type="checkbox" id="srd-fr"> ${t('cmp.srd.frLabels')}</label>
        <button class="srd-all" id="srd-all">${t('cmp.srd.all')}</button>
        <span class="srd-progress" id="srd-progress"></span>
      </div>
      <div class="srd-results" id="srd-results"></div>
    </div>`;
  document.body.appendChild(ov);

  const results = ov.querySelector('#srd-results');
  const search = ov.querySelector('.srd-search');
  const frBox = ov.querySelector('#srd-fr');
  const allBtn = ov.querySelector('#srd-all');
  const progress = ov.querySelector('#srd-progress');
  const filteredItems = () => {
    const q = search.value.trim().toLowerCase();
    return all.filter((x) => !q || x.name.toLowerCase().includes(q));
  };
  const close = () => ov.remove();
  ov.querySelector('.srd-close').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });

  const render = () => {
    if (loading) {
      results.innerHTML = `<div class="srd-hint">${t('common.loading')}</div>`;
      return;
    }
    if (error) {
      results.innerHTML = `<div class="srd-hint">${escapeHtml(error)}</div>`;
      return;
    }
    const items = filteredItems();
    const n = items.length;
    allBtn.textContent = `${t('cmp.srd.all')}${n ? ` (${n})` : ''}`;
    allBtn.disabled = !n;
    const list = items.slice(0, 80);
    if (!list.length) {
      results.innerHTML = `<div class="srd-hint">${t('help.empty')}</div>`;
      return;
    }
    results.innerHTML = list
      .map(
        (x) =>
          `<div class="srd-row"><span>${escapeHtml(x.name)}</span><button class="srd-imp" data-i="${escapeHtml(x.index)}">${t('cmp.import')}</button></div>`
      )
      .join('');
    results.querySelectorAll('[data-i]').forEach((b) =>
      b.addEventListener('click', async () => {
        b.disabled = true;
        b.textContent = '…';
        try {
          const id = await srdImport(kind, b.dataset.i, { fr: frBox.checked });
          b.textContent = t('cmp.srd.imported');
          activeId = id;
          editMode = false;
          renderAll(container);
        } catch {
          b.disabled = false;
          b.textContent = t('cmp.retry');
        }
      })
    );
  };

  allBtn.addEventListener('click', async () => {
    const items = filteredItems();
    if (!items.length) return;
    if (!(await modalConfirm(t('cmp.srd.confirm', { n: items.length }), { title: t('cmp.srd.title'), okLabel: t('cmp.import') }))) return;
    allBtn.disabled = true;
    const res = await srdImportMany(kind, items, { fr: frBox.checked }, (done, total, name) => {
      progress.textContent = `${done}/${total} — ${name}`;
    });
    progress.textContent = t('cmp.srd.summary', { imported: res.imported, updated: res.updated, skipped: res.skipped });
    allBtn.disabled = false;
    renderAll(container);
  });

  const load = async () => {
    loading = true;
    error = '';
    render();
    try {
      all = await srdList(kind);
    } catch {
      error = t('cmp.srd.unavailable');
      all = [];
    }
    loading = false;
    render();
  };

  ov.querySelectorAll('[data-k]').forEach((btn) =>
    btn.addEventListener('click', () => {
      kind = btn.dataset.k;
      ov.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('active', x === btn));
      load();
    })
  );
  search.addEventListener('input', render);
  load();
}
