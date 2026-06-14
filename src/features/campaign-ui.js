import { store } from '../state.js';
import { t } from '../lib/i18n.js';
import { escapeHtml } from '../lib/utils.js';
import { renderMarkdown } from '../lib/markdown.js';
import { modalConfirm, modalAlert } from '../lib/modal.js';
import { navigateTo } from './nav.js';
import { switchScene } from './map.js';
import {
  loadCampaign,
  setCampaign,
  cloneCampaign,
  findNode,
  removeNode,
  pathTo,
  campaignProgress,
  campNode,
} from './campaign.js';
import { loadCompendium } from './compendium.js';

/**
 * Classeur de campagne (MJ) — interface 2 volets façon Obsidian :
 *   • Gauche : arbre de pages (pliage, glisser-déposer pour réordonner/imbriquer).
 *   • Droite : la page sélectionnée (titre, notes Markdown optionnelles, liens).
 */

const expanded = new Set(); // ids dépliés
let selectedId = null;
let editMode = false; // volet droit : édition vs aperçu
let dragId = null; // nœud en cours de glissement
let _container = null;

export async function mountCampaign(container) {
  _container = container;
  await loadCampaign();
  if (!store.get().compendium.length) loadCompendium();
  const unsub = store.subscribe(() => render(container));
  render(container);
  return () => {
    unsub();
    _container = null;
  };
}

/** Ouvre une page précise (depuis le dock) : sélection + dépliage du chemin. */
export function openCampaignNode(id) {
  const path = pathTo(store.get().campaign || [], id);
  if (path) path.forEach((pid) => expanded.add(pid));
  selectNode(id, false);
  navigateTo('campaign');
}

function selectNode(id, focusEdit) {
  selectedId = id;
  const n = findNode(store.get().campaign || [], id);
  editMode = focusEdit !== undefined ? focusEdit : !(n && n.body && n.body.trim());
}

function render(container) {
  const ae = document.activeElement;
  if (container.contains(ae) && /INPUT|TEXTAREA/.test(ae.tagName)) return;

  const nodes = store.get().campaign || [];
  const { pct, done, total } = campaignProgress(nodes);

  container.innerHTML = `
    <div class="camp2">
      <aside class="camp2-tree">
        <div class="camp2-head">
          <span class="camp2-title">${t('nav.campaign')}</span>
          <div class="camp2-prog" title="${done}/${total}"><span style="width:${pct}%"></span></div>
        </div>
        <div class="camp2-toolbar2">
          <button class="camp-mini" data-add-root title="${t('camp.addRoot.title')}">${t('camp.addRoot')}</button>
          <button class="camp-mini" data-sort-all title="${t('camp.sortAll.title')}">${t('camp.sortAll')}</button>
          <label class="camp-mini" title="${t('camp.importMd.title')}">📁<input type="file" id="camp-md" webkitdirectory directory multiple hidden></label>
        </div>
        <div class="camp2-list" id="camp2-list">
          ${nodes.map((n) => rowView(n, 0)).join('') || `<div class="camp-empty">${t('camp.empty')}</div>`}
        </div>
      </aside>
      <main class="camp2-main" id="camp2-main">${docView()}</main>
    </div>`;

  wire(container);
}

function rowView(n, depth) {
  const isOpen = expanded.has(n.id);
  const hasKids = (n.children || []).length > 0;
  const tw = hasKids ? (isOpen ? '▾' : '▸') : '·';
  const row = `
    <div class="camp2-row ${selectedId === n.id ? 'active' : ''} ${n.done ? 'done' : ''}" data-node="${n.id}" draggable="true" style="padding-left:${6 + depth * 15}px">
      <button class="camp2-tw" data-toggle="${n.id}">${tw}</button>
      <span class="camp2-name" data-open="${n.id}" title="${escapeHtml(n.name)}">${escapeHtml(n.name)}</span>
      ${n.sceneId ? `<span class="camp2-sc" title="${t('camp.sceneLinked')}">🗺</span>` : ''}
      <span class="camp2-acts">
        <button class="camp2-act" data-up="${n.id}" title="${t('camp.up')}">▲</button>
        <button class="camp2-act" data-down="${n.id}" title="${t('camp.down')}">▼</button>
        <button class="camp2-act" data-addchild="${n.id}" title="${t('camp.addChild.title')}">＋</button>
        <button class="camp2-act danger" data-del="${n.id}" title="${t('common.delete')}">×</button>
      </span>
    </div>`;
  const kids = isOpen ? (n.children || []).map((c) => rowView(c, depth + 1)).join('') : '';
  return row + kids;
}

function docView() {
  const nodes = store.get().campaign || [];
  const n = selectedId ? findNode(nodes, selectedId) : null;
  if (!n) return `<div class="camp2-empty">${t('camp.pickPage')}</div>`;
  const comp = store.get().compendium || [];
  const path = (pathTo(nodes, n.id) || []).map((id) => findNode(nodes, id)).filter(Boolean);
  const crumbs = path
    .map((p, i) => `<span class="camp2-crumb" data-crumb="${p.id}">${escapeHtml(p.name)}</span>${i < path.length - 1 ? '<span class="camp2-sep">/</span>' : ''}`)
    .join('');
  const links = (n.entryIds || [])
    .map((id) => comp.find((e) => e.id === id))
    .filter(Boolean)
    .map((e) => `<span class="camp-chip" data-open-entry="${e.id}">📚 ${escapeHtml(e.name)}<button class="camp-chip-x" data-unlink="${n.id}:${e.id}">×</button></span>`)
    .join('');
  return `
    <div class="camp2-doc">
      <div class="camp2-bc">${crumbs}</div>
      <input class="camp2-doctitle" data-title="${n.id}" value="${escapeHtml(n.name)}" placeholder="${t('camp.pageTitle.ph')}"/>
      <div class="camp2-docbar">
        <label class="camp2-done"><input type="checkbox" data-done="${n.id}" ${n.done ? 'checked' : ''}/> ${t('camp.done')}</label>
        <button class="camp-mini" data-preview="${n.id}">${editMode ? t('camp.preview') : t('camp.edit')}</button>
        <button class="camp-mini" data-linkscene="${n.id}">${n.sceneId ? t('camp.sceneGo') : t('camp.sceneLink')}</button>
        <select class="camp-linksel" data-linkentry="${n.id}">
          <option value="">${t('camp.linkEntry')}</option>
          ${comp.map((e) => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}
        </select>
        <button class="camp-mini" data-addchild="${n.id}" title="${t('camp.addChild.title')}">${t('camp.addSub')}</button>
      </div>
      ${links ? `<div class="camp-chips">${links}</div>` : ''}
      ${
        editMode
          ? `<textarea class="camp2-body" data-body="${n.id}" placeholder="${t('camp.body.ph')}">${escapeHtml(n.body || '')}</textarea>`
          : `<div class="camp2-md md">${n.body && n.body.trim() ? renderMarkdown(n.body) : `<span class="camp2-empty-note">${t('camp.noNote')}</span>`}</div>`
      }
    </div>`;
}

/** Tri naturel (B2 < B10, accents ignorés) des frères, récursif. */
function sortTreeNatural(nodes) {
  nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  nodes.forEach((n) => sortTreeNatural(n.children || []));
}

/* ── Mutations ── */
function mutate(fn, immediate = false) {
  const tree = cloneCampaign();
  fn(tree);
  setCampaign(tree, immediate);
}
function isDescendant(node, id) {
  return !!findNode(node.children || [], id);
}
function locate(nodes, id) {
  const i = nodes.findIndex((n) => n.id === id);
  if (i >= 0) return { siblings: nodes, index: i };
  for (const n of nodes) {
    const r = locate(n.children || [], id);
    if (r) return r;
  }
  return null;
}
/** Déplace dragId : 'before' = avant la cible (même niveau) ; 'inside' = enfant. */
function moveNode(tree, drag, target, mode) {
  if (!drag || drag === target) return;
  const dn = findNode(tree, drag);
  if (!dn || dn.id === target || isDescendant(dn, target)) return;
  removeNode(tree, drag);
  if (mode === 'inside') {
    const t = findNode(tree, target);
    if (t) t.children.push(dn);
  } else {
    const loc = locate(tree, target);
    if (loc) loc.siblings.splice(loc.index, 0, dn);
    else tree.push(dn);
  }
}

/** Déplace un nœud parmi ses frères (alternative tactile au glisser-déposer). */
function moveSibling(tree, id, dir) {
  const loc = locate(tree, id);
  if (!loc) return;
  const j = loc.index + dir;
  if (j < 0 || j >= loc.siblings.length) return;
  const [n] = loc.siblings.splice(loc.index, 1);
  loc.siblings.splice(j, 0, n);
}

function rerender() {
  if (_container) render(_container);
}

function wire(container) {
  container.querySelector('[data-add-root]')?.addEventListener('click', () => {
    const node = campNode(t('camp.newSection'));
    mutate((tree) => tree.push(node), true);
    expanded.add(node.id);
    selectNode(node.id, true);
    rerender();
  });
  container.querySelector('#camp-md')?.addEventListener('change', (e) => importCampaignFolder(e.target.files, container));
  container.querySelector('[data-sort-all]')?.addEventListener('click', async () => {
    if (!(await modalConfirm(t('camp.sort.confirm'), { title: t('camp.sort.title'), okLabel: t('camp.sort.ok') }))) return;
    mutate((tree) => sortTreeNatural(tree), true);
    rerender();
  });

  // Réordonnancement tactile (alternative au glisser-déposer).
  container.querySelectorAll('[data-up]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      mutate((tree) => moveSibling(tree, b.dataset.up, -1), true);
      rerender();
    })
  );
  container.querySelectorAll('[data-down]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      mutate((tree) => moveSibling(tree, b.dataset.down, 1), true);
      rerender();
    })
  );

  // Arbre : pliage, ouverture, ajout, suppression.
  container.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = b.dataset.toggle;
      if (expanded.has(id)) expanded.delete(id);
      else expanded.add(id);
      rerender();
    })
  );
  container.querySelectorAll('[data-open]').forEach((s) =>
    s.addEventListener('click', () => {
      selectNode(s.dataset.open);
      rerender();
    })
  );
  container.querySelectorAll('[data-addchild]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = b.dataset.addchild;
      const child = campNode(t('camp.newPage'));
      mutate((tree) => {
        const p = findNode(tree, pid);
        if (p) p.children.push(child);
      }, true);
      expanded.add(pid);
      selectNode(child.id, true);
      rerender();
    })
  );
  container.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      const node = findNode(store.get().campaign, b.dataset.del);
      const kids = node?.children?.length;
      const nm = node?.name || t('camp.thisItem');
      const msg = kids ? t('camp.del.confirmKids', { name: nm }) : t('camp.del.confirm', { name: nm });
      if (await modalConfirm(msg, { title: t('camp.modalTitle'), danger: true, okLabel: t('common.delete') })) {
        if (selectedId === b.dataset.del) selectedId = null;
        mutate((tree) => removeNode(tree, b.dataset.del), true);
        rerender();
      }
    })
  );

  // Volet droit : titre, terminé, aperçu, liens, corps.
  container.querySelectorAll('[data-title]').forEach((inp) =>
    inp.addEventListener('input', () =>
      mutate((tree) => {
        const n = findNode(tree, inp.dataset.title);
        if (n) n.name = inp.value;
      })
    )
  );
  container.querySelectorAll('[data-done]').forEach((cb) =>
    cb.addEventListener('change', () =>
      mutate((tree) => {
        const n = findNode(tree, cb.dataset.done);
        if (n) n.done = cb.checked;
      }, true)
    )
  );
  container.querySelectorAll('[data-preview]').forEach((b) =>
    b.addEventListener('click', () => {
      editMode = !editMode;
      rerender();
    })
  );
  container.querySelectorAll('[data-body]').forEach((ta) =>
    ta.addEventListener('input', () =>
      mutate((tree) => {
        const n = findNode(tree, ta.dataset.body);
        if (n) n.body = ta.value;
      })
    )
  );
  container.querySelectorAll('[data-linkscene]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = findNode(store.get().campaign, b.dataset.linkscene);
      if (n?.sceneId) {
        switchScene(n.sceneId);
        navigateTo('map');
      } else {
        const sid = store.get().activeSceneId;
        if (!sid) return;
        mutate((tree) => {
          const x = findNode(tree, b.dataset.linkscene);
          if (x) x.sceneId = sid;
        }, true);
        rerender();
      }
    })
  );
  container.querySelectorAll('[data-linkentry]').forEach((sel) =>
    sel.addEventListener('change', () => {
      const eid = sel.value;
      if (!eid) return;
      mutate((tree) => {
        const n = findNode(tree, sel.dataset.linkentry);
        if (n && !(n.entryIds || []).includes(eid)) n.entryIds = [...(n.entryIds || []), eid];
      }, true);
      rerender();
    })
  );
  container.querySelectorAll('[data-unlink]').forEach((b) =>
    b.addEventListener('click', () => {
      const [nid, eid] = b.dataset.unlink.split(':');
      mutate((tree) => {
        const n = findNode(tree, nid);
        if (n) n.entryIds = (n.entryIds || []).filter((x) => x !== eid);
      }, true);
      rerender();
    })
  );
  container.querySelectorAll('[data-open-entry]').forEach((chip) =>
    chip.addEventListener('click', (e) => {
      if (e.target.closest('[data-unlink]')) return;
      store.set({ compendiumOpenId: chip.dataset.openEntry });
      navigateTo('compendium');
    })
  );
  container.querySelectorAll('[data-crumb]').forEach((c) =>
    c.addEventListener('click', () => {
      selectNode(c.dataset.crumb);
      rerender();
    })
  );

  wireDrag(container);
}

/* ── Glisser-déposer (réordonner / imbriquer) ── */
function wireDrag(container) {
  container.querySelectorAll('.camp2-row').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragId = row.dataset.node;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragId);
    });
    row.addEventListener('dragend', () => {
      dragId = null;
      container.querySelectorAll('.camp2-row').forEach((r) => r.classList.remove('dz-before', 'dz-inside'));
    });
    row.addEventListener('dragover', (e) => {
      if (!dragId || dragId === row.dataset.node) return;
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const inside = e.clientY - r.top > r.height * 0.5;
      row.classList.toggle('dz-inside', inside);
      row.classList.toggle('dz-before', !inside);
    });
    row.addEventListener('dragleave', () => row.classList.remove('dz-before', 'dz-inside'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const target = row.dataset.node;
      const r = row.getBoundingClientRect();
      const mode = e.clientY - r.top > r.height * 0.5 ? 'inside' : 'before';
      const drag = dragId;
      dragId = null;
      if (!drag || drag === target) return;
      mutate((tree) => moveNode(tree, drag, target, mode), true);
      if (mode === 'inside') expanded.add(target);
      rerender();
    });
  });
}

/* ── Import d'un dossier de notes (.md) → arbre ── */
function parseCampMd(filename, text) {
  let name = filename.replace(/\.(md|markdown)$/i, '').trim();
  let body = text || '';
  const fm = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fm) {
    body = body.slice(fm[0].length);
    const tm = fm[1].match(/(?:^|\n)\s*(?:title|nom)\s*:\s*(.+)/i);
    if (tm) name = tm[1].trim().replace(/^["']|["']$/g, '');
  }
  body = body
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
  return { name, body: body.trim() };
}

async function importCampaignFolder(fileList, container) {
  const files = [...(fileList || [])].filter((f) => /\.(md|markdown)$/i.test(f.name));
  if (!files.length) {
    await modalAlert(t('camp.import.none'), { title: t('camp.import.title') });
    return;
  }
  const tree = cloneCampaign();
  const folderMap = new Map();
  let n = 0;
  for (const f of files) {
    const rel = (f.webkitRelativePath || f.name).split('/').filter(Boolean);
    let siblings = tree;
    let key = '';
    for (let i = 0; i < rel.length - 1; i++) {
      key += '/' + rel[i];
      let folder = folderMap.get(key);
      if (!folder) {
        folder = campNode(rel[i]);
        folderMap.set(key, folder);
        siblings.push(folder);
      }
      siblings = folder.children;
    }
    let text = '';
    try {
      text = await f.text();
    } catch {
      continue;
    }
    const { name, body } = parseCampMd(rel[rel.length - 1], text);
    siblings.push(campNode(name, body));
    n++;
  }
  sortTreeNatural(tree); // ordre naturel (B0→B5…) quel que soit l'ordre des fichiers
  setCampaign(tree, true);
  rerender();
  await modalAlert(t('camp.import.done', { n }), { title: t('camp.import.title') });
}
