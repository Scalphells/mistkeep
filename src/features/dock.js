import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { colorFor, initials } from '../lib/profile.js';
import { condIcon, condIconHtml } from '../lib/conditions.js';
import { sendMessage } from './chat.js';
import { sendRoll, sendD20Check } from './dice.js';
import { ABILITIES, abilityMod, fmtMod, updateCharacter, portraitUrl } from './characters.js';
import { sendPlayerRequest } from './initiative.js';
import { loadNotes, addNote } from './session-notes.js';
import { loadCompendium, KINDS } from './compendium.js';
import { loadCampaign, flattenCampaign, findNode } from './campaign.js';
import { hpTierLabel } from '../lib/hptiers.js';
import { openCampaignNode } from './campaign-ui.js';
import { navigateTo } from './nav.js';
import { isWindowOpen, closeWindow, openWindowIds } from '../lib/floatwindow.js';
import { openPrefs } from '../lib/prefs.js';
import { openProfileEditor } from './profile-ui.js';
import { togglePause } from '../lib/pause.js';
import { exportData } from '../lib/export.js';
import { signOut } from '../lib/auth.js';
import { BUILD_ID } from '../lib/pwa.js';
import { openSearch } from '../lib/search.js';
import { toggleParty } from '../lib/party.js';
import { toggleClock } from '../lib/clock.js';
import { toggleSfx } from '../lib/sfx.js';
import { getMasterVol, setMasterVol, getLayerLocal, setLayerLocal } from '../lib/ambience.js';
import { CONDITIONS } from '../lib/conditions.js';
import { renderMarkdown } from '../lib/markdown.js';
import { openActionCard } from '../lib/actioncard.js';
import { rollCardHtml, rollVisibleTo, richCardHtml } from '../lib/chatcards.js';
import { parseCard } from '../lib/chatpost.js';
import { applyFromButton } from '../lib/applyroll.js';

/**
 * Dock latéral droit (façon Foundry) : accès rapide Combat / Chat / Dés depuis
 * n'importe quelle vue. Overlay fixe (aucun reflow des vues existantes). Les
 * panneaux sont en LECTURE/usage rapide et lisent le store, tenu à jour par les
 * abonnements globaux (lib/live.js) — ils ne créent aucun abonnement propre.
 */

let open = null; // 'combat' | 'chat' | 'dice' | null
let host = null;

const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/** Un onglet du rail : 'dock' = ouvre le tiroir ; 'nav' = change la vue centrale. */
function railTab(kind, id, icon, title) {
  const attr = kind === 'nav' ? `data-nav="${id}"` : `data-dock="${id}"`;
  return `<button class="dock-tab" ${attr} title="${escapeHtml(title)}">${icon}</button>`;
}

/** (Re)construit le rail selon la préférence « Disposition VTT ». */
function renderTabs() {
  const el = host?.querySelector('#dock-tabs');
  if (!el) return;
  const isDM = store.get().isDM;
  const vtt = document.documentElement.dataset.vttrail === '1';
  if (!vtt) {
    el.innerHTML =
      railTab('dock', 'fiche', '🛡', 'Mon perso') +
      railTab('dock', 'combat', '⚔', 'Combat') +
      railTab('dock', 'chat', '💬', 'Chat') +
      railTab('dock', 'dice', '🎲', 'Dés') +
      railTab('dock', 'notes', '📝', 'Notes / Journal') +
      railTab('dock', 'compendium', '📚', 'Compendium') +
      (isDM ? railTab('dock', 'campagne', '📖', 'Campagne') : '') +
      railTab('dock', 'settings', '⚙', 'Paramètres');
  } else {
    // Outils (tiroir, glanceable) + vues lourdes (zone centrale pleine largeur).
    const tools =
      railTab('dock', 'fiche', '🛡', 'Mon perso') +
      railTab('dock', 'combat', '⚔', 'Combat') +
      railTab('dock', 'chat', '💬', 'Chat') +
      railTab('dock', 'dice', '🎲', 'Dés');
    const views =
      railTab('nav', 'map', '🗺', 'Carte') +
      railTab('nav', 'characters', '📋', 'Fiches') +
      railTab('nav', 'compendium', '📚', 'Compendium') +
      (isDM ? railTab('nav', 'campaign', '📖', 'Campagne') : '') +
      railTab('nav', 'handouts', '🖼', 'Handouts') +
      railTab('nav', 'notes', '📝', 'Notes') +
      (isDM ? railTab('nav', 'vault', '🧰', 'Banque') : '') +
      (isDM ? railTab('nav', 'ambience', '🎵', 'Ambiance') : '') +
      railTab('nav', 'help', '❓', 'Aide') +
      railTab('dock', 'settings', '⚙', 'Paramètres');
    el.innerHTML = tools + '<div class="dock-sep"></div>' + views;
  }
  highlightTabs();
}

/** Met en surbrillance l'onglet outil ouvert et la vue centrale active. */
function highlightTabs() {
  const el = host?.querySelector('#dock-tabs');
  if (!el) return;
  el.querySelectorAll('[data-dock]').forEach((b) => b.classList.toggle('active', b.dataset.dock === open));
  const vtt = document.documentElement.dataset.vttrail === '1';
  if (vtt) {
    // La carte est toujours visible (élément central) ; les autres vues sont
    // actives tant que leur fenêtre flottante est ouverte.
    const openIds = new Set(openWindowIds());
    el.querySelectorAll('[data-nav]').forEach((b) =>
      b.classList.toggle('active', b.dataset.nav === 'map' || openIds.has(b.dataset.nav))
    );
  } else {
    const view = store.get().sideTab;
    el.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === view));
  }
}

export function mountDock(container) {
  host = container;
  container.innerHTML = `
    <div class="dock" id="dock">
      <div class="dock-tabs" id="dock-tabs"></div>
      <div class="dock-body" id="dock-body"></div>
      <div class="dock-resizer" id="dock-resizer" title="Redimensionner"></div>
    </div>
  `;
  const tabsEl = container.querySelector('#dock-tabs');
  tabsEl.addEventListener('click', (e) => {
    const navBtn = e.target.closest('[data-nav]');
    if (navBtn) {
      const id = navBtn.dataset.nav;
      const vtt = document.documentElement.dataset.vttrail === '1';
      // En VTT, recliquer un onglet déjà ouvert referme sa fenêtre (bascule).
      if (vtt && id !== 'map' && isWindowOpen(id)) {
        closeWindow(id);
        highlightTabs();
        return;
      }
      open = null; // une vue centrale referme le tiroir
      applyOpen();
      navigateTo(id);
      highlightTabs();
      return;
    }
    const dockBtn = e.target.closest('[data-dock]');
    if (dockBtn) toggle(dockBtn.dataset.dock);
  });
  renderTabs();
  initResizer(container.querySelector('#dock-resizer'), container.querySelector('#dock-body'));
  store.subscribe(() => {
    if (open) updatePanel();
    highlightTabs();
  });
  // Reconfiguration quand on bascule la « Disposition VTT » dans les préférences.
  window.addEventListener('vaultmj:chrome', renderTabs);
  // Suivi des fenêtres flottantes (ouverture/fermeture) pour la surbrillance du rail.
  window.addEventListener('vaultmj:windows', highlightTabs);
  // Ouverture de fiche demandée depuis le HUD de jeton de la carte.
  window.addEventListener('vaultmj:opensheet', (e) => {
    const charId = e.detail?.charId;
    if (!charId) return;
    store.set({ activeChar: charId });
    navigateTo('characters');
  });
  applyOpen();
}

/* ── Largeur redimensionnable + mémorisée (localStorage) ──── */
const DOCK_W_KEY = 'vaultmj_dockw';
function savedWidth() {
  const v = Number(localStorage.getItem(DOCK_W_KEY));
  return Number.isFinite(v) && v >= 260 ? v : 340;
}
function applyWidth(body, w) {
  body.style.width = `${w}px`;
}
function initResizer(handle, body) {
  if (!handle || !body) return;
  let startX = 0;
  let startW = 0;
  const onMove = (e) => {
    const max = Math.min(window.innerWidth * 0.7, 720);
    const w = Math.max(260, Math.min(max, startW + (startX - e.clientX)));
    applyWidth(body, w);
  };
  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.body.classList.remove('dock-resizing');
    const w = parseInt(body.style.width, 10);
    if (Number.isFinite(w)) localStorage.setItem(DOCK_W_KEY, String(w));
  };
  handle.addEventListener('pointerdown', (e) => {
    if (!open) return; // rien à redimensionner si fermé
    e.preventDefault();
    startX = e.clientX;
    startW = body.getBoundingClientRect().width;
    document.body.classList.add('dock-resizing');
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
}

function toggle(which) {
  open = open === which ? null : which;
  applyOpen();
}

function applyOpen() {
  const dock = host?.querySelector('#dock');
  if (!dock) return;
  dock.classList.toggle('open', !!open);
  dock.querySelectorAll('[data-dock]').forEach((b) => b.classList.toggle('active', b.dataset.dock === open));
  const body = dock.querySelector('#dock-body');
  dock.classList.toggle('resizable', !!open);
  if (!open) {
    body.innerHTML = '';
    body.style.width = '';
    return;
  }
  body.style.width = `${savedWidth()}px`;
  buildPanel(body, open);
  updatePanel();
}

function buildPanel(body, which) {
  if (which === 'fiche') {
    body.innerHTML = `<div class="dock-head">🛡 Ma fiche</div><div class="dock-scroll" id="dk-fiche"></div>`;
  } else if (which === 'combat') {
    body.innerHTML = `<div class="dock-head">⚔ Combat</div><div class="dock-scroll" id="dk-combat"></div>`;
  } else if (which === 'chat') {
    body.innerHTML = `
      <div class="dock-head">💬 Chat public</div>
      <div class="dock-scroll" id="dk-chatfeed"></div>
      <form class="dock-chatform" id="dk-chatform">
        <input id="dk-chatinput" type="text" placeholder="Message…" autocomplete="off" maxlength="2000" />
        <button class="btn" type="submit">→</button>
      </form>`;
    body.querySelector('#dk-chatfeed').addEventListener('click', applyDelegate);
    body.querySelector('#dk-chatform').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = body.querySelector('#dk-chatinput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        await sendMessage(text, 'public');
      } catch {
        /* affiché ailleurs */
      }
    });
  } else if (which === 'dice') {
    body.innerHTML = `
      <div class="dock-head">🎲 Dés</div>
      <div class="dock-dice-quick">
        ${DICE.map((d) => `<button class="dice-btn" data-dk-roll="1${d}">${d}</button>`).join('')}
      </div>
      <form class="dock-diceform" id="dk-diceform">
        <input id="dk-diceinput" type="text" placeholder="2d6+3" autocomplete="off" />
        <button class="btn" type="submit">Lancer</button>
      </form>
      <div class="dock-scroll" id="dk-dicefeed"></div>`;
    body.querySelector('#dk-dicefeed').addEventListener('click', applyDelegate);
    body.querySelectorAll('[data-dk-roll]').forEach((b) =>
      b.addEventListener('click', () => sendRoll(b.dataset.dkRoll).catch(() => {}))
    );
    body.querySelector('#dk-diceform').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = body.querySelector('#dk-diceinput');
      if (input.value.trim()) {
        sendRoll(input.value.trim()).catch(() => {});
        input.value = '';
      }
    });
  } else if (which === 'notes') {
    body.innerHTML = `
      <div class="dock-head">📝 Notes</div>
      <form class="dock-chatform" id="dk-noteform">
        <input id="dk-noteinput" type="text" placeholder="Nouvelle note…" autocomplete="off" maxlength="1000" />
        <label class="dk-note-share" title="Partager à la table"><input type="checkbox" id="dk-noteshared">👁</label>
        <button class="btn" type="submit">+</button>
      </form>
      <div class="dock-scroll" id="dk-notes"></div>`;
    loadNotes();
    body.querySelector('#dk-noteform').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = body.querySelector('#dk-noteinput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      try {
        await addNote(text, body.querySelector('#dk-noteshared').checked);
      } catch {
        /* affiché ailleurs */
      }
    });
  } else if (which === 'compendium') {
    body.innerHTML = `
      <div class="dock-head">📚 Compendium</div>
      <input class="dock-cmp-search" id="dk-cmp-search" type="search" placeholder="Rechercher…" autocomplete="off" />
      <div class="dk-cmp-filters" id="dk-cmp-filters"></div>
      <div class="dock-scroll" id="dk-cmp"></div>`;
    loadCompendium();
    body.querySelector('#dk-cmp-search').addEventListener('input', () => updateCompendium());
  } else if (which === 'campagne') {
    body.innerHTML = `
      <div class="dock-head">📖 Campagne</div>
      <button class="dk-action" id="dk-camp-notes" style="margin:8px 10px 4px;width:calc(100% - 20px)">📝 Notes de session</button>
      <input class="dock-cmp-search" id="dk-camp-search" type="search" placeholder="Rechercher une page…" autocomplete="off" />
      <div class="dock-scroll" id="dk-camp"></div>`;
    loadCampaign();
    body.querySelector('#dk-camp-search').addEventListener('input', () => updateCampagne());
    body.querySelector('#dk-camp-notes').addEventListener('click', () => navigateTo('notes'));
  } else if (which === 'settings') {
    const isDM = store.get().isDM;
    const layers = store.get().ambience?.layers || [];
    body.innerHTML = `
      <div class="dock-head">⚙ Paramètres</div>
      <div class="dock-scroll dk-settings">
        <div class="dk-set-ver">Mistkeep · build ${escapeHtml(BUILD_ID)}</div>
        <div class="dk-set-group">Affichage &amp; compte</div>
        <button class="dk-set-btn" data-set="prefs">🎛 Préférences d'affichage</button>
        <button class="dk-set-btn" data-set="profile">🙂 Mon profil &amp; mot de passe</button>
        <div class="dk-set-group">Outils</div>
        <button class="dk-set-btn" data-set="search">🔍 Recherche (Ctrl+K)</button>
        <button class="dk-set-btn" data-set="party">👥 Aperçu du groupe</button>
        <button class="dk-set-btn" data-set="clock">🕐 Horloge in-game</button>
        <div class="dk-set-group">Son (cet appareil)</div>
        <div class="dk-vol">
          <div class="dk-vol-row"><span class="dk-vol-lbl">🔊 Maître</span><input type="range" min="0" max="100" value="${getMasterVol()}" data-vmaster><span class="dk-vol-v">${getMasterVol()} %</span></div>
          ${layers
            .map(
              (l) =>
                `<div class="dk-vol-row"><span class="dk-vol-lbl" title="${escapeHtml(l.name || 'Piste')}">${escapeHtml(l.name || 'Piste')}</span><input type="range" min="0" max="100" value="${getLayerLocal(l.id)}" data-vlayer="${escapeHtml(l.id)}"><span class="dk-vol-v">${getLayerLocal(l.id)} %</span></div>`
            )
            .join('') || '<div class="dock-empty" style="margin:4px">Aucune piste en cours.</div>'}
        </div>
        <div class="dk-set-group">Aide</div>
        <button class="dk-set-btn" data-set="help">📖 Aide &amp; documentation</button>
        ${isDM ? `<div class="dk-set-group">Partie (MJ)</div>
          <button class="dk-set-btn" data-set="sfx">🔊 Soundboard</button>
          <button class="dk-set-btn" data-set="pause">⏸ Mettre en pause</button>
          <button class="dk-set-btn" data-set="export">💾 Exporter les données (JSON)</button>` : ''}
        <div class="dk-set-group">Session</div>
        <button class="dk-set-btn danger" data-set="logout">🚪 Déconnexion</button>
      </div>`;
    body.querySelector('[data-set="prefs"]')?.addEventListener('click', () => openPrefs());
    body.querySelector('[data-set="profile"]')?.addEventListener('click', () => openProfileEditor());
    body.querySelector('[data-vmaster]')?.addEventListener('input', (e) => {
      setMasterVol(Number(e.target.value) || 0);
      e.target.nextElementSibling.textContent = `${getMasterVol()} %`;
    });
    body.querySelectorAll('[data-vlayer]').forEach((r) =>
      r.addEventListener('input', () => {
        setLayerLocal(r.dataset.vlayer, Number(r.value) || 0);
        r.nextElementSibling.textContent = `${getLayerLocal(r.dataset.vlayer)} %`;
      })
    );
    body.querySelector('[data-set="search"]')?.addEventListener('click', () => openSearch());
    body.querySelector('[data-set="party"]')?.addEventListener('click', () => toggleParty());
    body.querySelector('[data-set="clock"]')?.addEventListener('click', () => toggleClock());
    body.querySelector('[data-set="help"]')?.addEventListener('click', () => {
      open = null;
      applyOpen();
      navigateTo('help');
    });
    body.querySelector('[data-set="sfx"]')?.addEventListener('click', () => toggleSfx());
    body.querySelector('[data-set="pause"]')?.addEventListener('click', () => togglePause());
    body.querySelector('[data-set="export"]')?.addEventListener('click', () => exportData());
    body.querySelector('[data-set="logout"]')?.addEventListener('click', async () => {
      await signOut();
      window.location.reload();
    });
  }
}

function updatePanel() {
  if (open === 'fiche') updateFiche();
  else if (open === 'combat') updateCombat();
  else if (open === 'chat') updateChat();
  else if (open === 'dice') updateDice();
  else if (open === 'notes') updateNotes();
  else if (open === 'compendium') updateCompendium();
  else if (open === 'campagne') updateCampagne();
}

let _dkCampId = null;
function updateCampagne() {
  const el = host?.querySelector('#dk-camp');
  if (!el) return;

  // Vue lecture : contenu de la page sélectionnée, directement dans le dock.
  if (_dkCampId) {
    const node = findNode(store.get().campaign || [], _dkCampId);
    if (!node) {
      _dkCampId = null;
    } else {
      el.innerHTML = `
        <div class="dk-camp-detail-head">
          <button class="dk-camp-back" title="Retour à la liste">← Liste</button>
          <button class="dk-camp-open" title="Ouvrir en plein écran">⤢</button>
        </div>
        <div class="dk-camp-doctitle">${escapeHtml(node.name)}</div>
        <div class="dk-camp-doc md">${node.body && node.body.trim() ? renderMarkdown(node.body) : '<span class="dock-empty">Page sans note.</span>'}</div>`;
      el.querySelector('.dk-camp-back').addEventListener('click', () => {
        _dkCampId = null;
        updateCampagne();
      });
      el.querySelector('.dk-camp-open').addEventListener('click', () => openCampaignNode(node.id));
      return;
    }
  }

  // Vue liste (arbre à plat, cherchable).
  const q = (host.querySelector('#dk-camp-search')?.value || '').trim().toLowerCase();
  const flat = flattenCampaign(store.get().campaign || []);
  const list = flat.filter((x) => !q || x.node.name.toLowerCase().includes(q));
  if (!list.length) {
    el.innerHTML = `<div class="dock-empty">Aucune page.</div>`;
    return;
  }
  el.innerHTML = list
    .map(
      ({ node, depth }) =>
        `<button class="dk-camp-item ${node.done ? 'done' : ''}" data-camp="${node.id}" style="padding-left:${8 + depth * 14}px" title="${escapeHtml(node.name)}">
          ${node.done ? '✓ ' : ''}${escapeHtml(node.name)}${node.sceneId ? ' 🗺' : ''}
        </button>`
    )
    .join('');
  el.querySelectorAll('[data-camp]').forEach((b) =>
    b.addEventListener('click', () => {
      _dkCampId = b.dataset.camp;
      updateCampagne();
    })
  );
}

function updateNotes() {
  const el = host?.querySelector('#dk-notes');
  if (!el) return;
  if (el.contains(document.activeElement)) return;
  const { sessionNotes, players } = store.get();
  if (!sessionNotes.length) {
    el.innerHTML = `<div class="dock-empty">Aucune note.</div>`;
    return;
  }
  const author = (uid) => players.find((p) => p.id === uid)?.display_name || 'Anonyme';
  el.innerHTML = sessionNotes
    .slice(0, 40)
    .map(
      (n) => `<div class="dk-note">
        <div class="dk-note-meta">${escapeHtml(author(n.created_by))} · ${n.shared ? '👁 partagé' : '🔒 privé'}</div>
        <div class="dk-note-body">${renderMarkdown(n.content || '')}</div>
      </div>`
    )
    .join('');
}

let _dkCmpId = null;
let _dkCmpKind = 'all';

/** Rangée de filtres par type (Tous + chaque catégorie présente, avec compteur). */
function renderDkFilters() {
  const fl = host?.querySelector('#dk-cmp-filters');
  if (!fl) return;
  const all = store.get().compendium || [];
  const counts = {};
  for (const e of all) counts[e.kind] = (counts[e.kind] || 0) + 1;
  const present = Object.keys(KINDS).filter((k) => counts[k]);
  if (_dkCmpKind !== 'all' && !counts[_dkCmpKind]) _dkCmpKind = 'all';
  const chip = (k, label) =>
    `<button class="dk-cmp-filt ${_dkCmpKind === k ? 'active' : ''}" data-kf="${k}">${label}</button>`;
  fl.innerHTML =
    chip('all', `Tous (${all.length})`) +
    present.map((k) => chip(k, `${KINDS[k].icon} ${counts[k]}`)).join('');
  fl.querySelectorAll('[data-kf]').forEach((b) =>
    b.addEventListener('click', () => {
      _dkCmpKind = b.dataset.kf;
      updateCompendium();
    })
  );
}

function updateCompendium() {
  const el = host?.querySelector('#dk-cmp');
  if (!el) return;
  renderDkFilters();
  const q = (host.querySelector('#dk-cmp-search')?.value || '').trim().toLowerCase();
  const list = store.get().compendium.filter(
    (e) => (_dkCmpKind === 'all' || e.kind === _dkCmpKind) && (!q || e.name.toLowerCase().includes(q))
  );
  if (!list.length) {
    el.innerHTML = `<div class="dock-empty">Aucune entrée.</div>`;
    return;
  }
  const detail = _dkCmpId && list.find((e) => e.id === _dkCmpId);
  el.innerHTML =
    list
      .slice(0, 60)
      .map(
        (e) =>
          `<button class="dk-cmp-item ${e.id === _dkCmpId ? 'active' : ''}" data-cmp="${e.id}" draggable="true">${KINDS[e.kind]?.icon || '📄'} ${escapeHtml(e.name)}</button>`
      )
      .join('') +
    (detail ? `<div class="dk-cmp-detail">${renderMarkdown(detail.data?.desc || '*(pas de description)*')}</div>` : '');
  el.querySelectorAll('[data-cmp]').forEach((b) => {
    b.addEventListener('click', () => {
      _dkCmpId = _dkCmpId === b.dataset.cmp ? null : b.dataset.cmp;
      updateCompendium();
    });
    // Glisser vers la carte (jeton) ou la fiche (sort/objet).
    b.addEventListener('dragstart', (ev) => {
      const e = store.get().compendium.find((x) => x.id === b.dataset.cmp);
      if (!e) return;
      const payload = { id: e.id, kind: e.kind, name: e.name, img: e.data?.img || null, ac: e.data?.ac, hp: e.data?.hp, hpMax: e.data?.hpMax };
      ev.dataTransfer.setData('application/x-vaultmj-entry', JSON.stringify(payload));
      ev.dataTransfer.setData('text/plain', e.name);
      ev.dataTransfer.effectAllowed = 'copy';
    });
  });
}

function updateFiche() {
  const el = host?.querySelector('#dk-fiche');
  if (!el) return;
  const { characters, activeChar, user, isDM } = store.get();

  // MJ : liste de TOUS les personnages (façon « Acteurs ») → clic = ouvre la fiche.
  if (isDM) {
    if (!characters.length) {
      el.innerHTML = `<div class="dock-empty">Aucune fiche. Crée-en dans l'onglet Fiches.</div>`;
      return;
    }
    el.innerHTML = `<div class="dk-actors">${characters
      .map((ch) => {
        const dd = ch.data || {};
        const url = portraitUrl(dd.portrait);
        const sub = [dd.cls, dd.lvl ? `niv. ${dd.lvl}` : ''].filter(Boolean).join(' · ');
        const owner = ch.owner_id ? '' : ' <span class="dk-actor-npc">PNJ</span>';
        return `<button class="dk-actor ${ch.id === activeChar ? 'active' : ''}" data-actor="${ch.id}">
            <span class="dk-av" style="background:${colorFor(ch.owner_id, ch.name)}">${url ? `<img src="${url}" alt="">` : escapeHtml(initials(ch.name))}</span>
            <span class="dk-actor-id"><strong>${escapeHtml(ch.name)}</strong>${owner}<span class="dk-actor-sub">${escapeHtml(sub)}</span></span>
            ${dd.hpMax != null ? `<span class="dk-actor-hp">${dd.hp ?? '?'}/${dd.hpMax}</span>` : ''}
          </button>`;
      })
      .join('')}</div>`;
    el.querySelectorAll('[data-actor]').forEach((b) =>
      b.addEventListener('click', () => {
        store.set({ activeChar: b.dataset.actor });
        navigateTo('characters');
      })
    );
    return;
  }

  let c = characters.find((x) => x.id === activeChar);
  if (!c && !isDM) c = characters.find((x) => x.owner_id === user?.id);
  if (!c) c = characters[0];
  if (!c) {
    el.innerHTML = `<div class="dock-empty">Aucune fiche disponible.</div>`;
    return;
  }
  const d = c.data || {};
  const url = portraitUrl(d.portrait);
  el.innerHTML = `
    <div class="dk-fiche-head">
      <span class="dk-av lg" style="background:${colorFor(c.owner_id, c.name)}">${url ? `<img src="${url}" alt="">` : escapeHtml(initials(c.name))}</span>
      <div class="dk-fiche-id"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(d.cls || '')}${d.lvl ? ` · Niv. ${d.lvl}` : ''}</span></div>
    </div>
    <div class="dk-fiche-hp">
      <button class="dk-hpbtn" data-hp="-5">−5</button>
      <button class="dk-hpbtn" data-hp="-1">−1</button>
      <span class="dk-fiche-hpval">${d.hp ?? '?'} / ${d.hpMax ?? '?'} PV${d.hpTmp ? ` (+${d.hpTmp})` : ''}</span>
      <button class="dk-hpbtn" data-hp="1">+1</button>
      <button class="dk-hpbtn" data-hp="5">+5</button>
    </div>
    <div class="dk-fiche-stats">
      <span>CA ${escapeHtml(String(d.ac ?? '?'))}</span>
      <span>Init ${fmtMod(Number(d.initB) || 0)}</span>
      <span>Vit ${escapeHtml(String(d.spd ?? '?'))}</span>
    </div>
    <div class="dk-fiche-abil">
      ${ABILITIES.map((a) => `<button data-ab="${a.key}" title="Test de ${a.label} (Maj = avantage, Ctrl = désavantage)">${a.label}<em>${fmtMod(abilityMod(d[a.key]))}</em></button>`).join('')}
    </div>
    <div class="dk-fiche-hint">Clic = test (Maj = avantage · Ctrl = désavantage)</div>
    ${dockActions(c)}
    ${dockResources(d)}
    ${dockSlots(d)}
    ${!isDM && c.owner_id === user?.id ? dockPlayerActions(c) : ''}
  `;
  el.querySelectorAll('[data-act-atk]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = (c.data.atks || [])[Number(b.dataset.actAtk)];
      if (a) openActionCard({ charId: c.id, who: c.name, kind: 'atk', item: a });
    })
  );
  el.querySelectorAll('[data-act-spell]').forEach((b) =>
    b.addEventListener('click', () => {
      const s = (c.data.spells || [])[Number(b.dataset.actSpell)];
      if (s) openActionCard({ charId: c.id, who: c.name, kind: 'spell', item: s });
    })
  );
  const inCombat = store.get().initiative.some((x) => x.char_id === c.id);
  el.querySelectorAll('[data-hp]').forEach((b) =>
    b.addEventListener('click', () => {
      const delta = Number(b.dataset.hp);
      // Joueur en combat : déléguer au MJ ; sinon écrire sa fiche.
      if (!isDM && inCombat) {
        sendPlayerRequest({ kind: 'hp', charId: c.id, delta });
      } else {
        updateCharacter(c.id, { hp: Math.max(0, (Number(d.hp) || 0) + delta) });
      }
    })
  );
  el.querySelector('[data-pp="join"]')?.addEventListener('click', () => sendPlayerRequest({ kind: 'join', charId: c.id }));
  el.querySelector('[data-pp="leave"]')?.addEventListener('click', () => sendPlayerRequest({ kind: 'leave', charId: c.id }));
  el.querySelector('[data-pp="rollinit"]')?.addEventListener('click', () => sendPlayerRequest({ kind: 'rollinit', charId: c.id }));
  el.querySelectorAll('.dk-conds .ipp-cond').forEach((b) =>
    b.addEventListener('click', () => {
      const comb = store.get().initiative.find((x) => x.char_id === c.id);
      const set = new Set(comb?.conditions || []);
      const k = b.dataset.cond;
      if (set.has(k)) set.delete(k);
      else set.add(k);
      sendPlayerRequest({ kind: 'conds', charId: c.id, conditions: [...set] });
    })
  );
  el.querySelectorAll('[data-ab]').forEach((b) =>
    b.addEventListener('click', (e) => {
      const k = b.dataset.ab;
      const mode = e.shiftKey ? 'adv' : e.ctrlKey || e.metaKey ? 'dis' : 'normal';
      const lbl = ABILITIES.find((a) => a.key === k)?.label || k;
      sendD20Check(abilityMod(d[k]), `${c.name} — Test de ${lbl}`, { mode });
    })
  );
  el.querySelectorAll('[data-slot]').forEach((b) =>
    b.addEventListener('click', () => {
      const lv = b.dataset.slot;
      const i = Number(b.dataset.i);
      const slots = { ...(d.slots || {}) };
      const s = { ...(slots[lv] || { m: 0, u: 0 }) };
      s.u = (s.u || 0) >= i ? i - 1 : i;
      slots[lv] = s;
      updateCharacter(c.id, { slots });
    })
  );
  el.querySelectorAll('[data-res]').forEach((b) =>
    b.addEventListener('click', () => {
      const ri = Number(b.dataset.res);
      const i = Number(b.dataset.i);
      const resources = (d.resources || []).map((r) => ({ ...r }));
      const r = resources[ri];
      if (!r) return;
      const used = r.used || 0;
      // Clic sur un pip plein → libère jusqu'ici ; sur un pip vide → consomme jusqu'ici.
      r.used = used >= i ? i - 1 : i;
      updateCharacter(c.id, { resources });
    })
  );
}

/** Rangs d'emplacements de sorts (pips cliquables) pour le dock. */
/** Liste d'actions (attaques + sorts offensifs) → ouvre la carte d'action. */
function dockActions(c) {
  const atks = c.data?.atks || [];
  const spells = (c.data?.spells || []).map((s, i) => ({ s, i })).filter((x) => x.s.atk || x.s.dmg);
  if (!atks.length && !spells.length) return '';
  return `<div class="dk-actionlist">
      <div class="dk-actionlist-h">⚔ Actions</div>
      ${atks.map((a, i) => `<button class="dk-action" data-act-atk="${i}">⚔ ${escapeHtml(a.nm || 'Attaque')}</button>`).join('')}
      ${spells.map((x) => `<button class="dk-action" data-act-spell="${x.i}">✨ ${escapeHtml(x.s.nm || 'Sort')}</button>`).join('')}
    </div>`;
}

/** Actions rapides du joueur sur son perso (combat) : rejoindre/init/états. */
function dockPlayerActions(c) {
  const comb = store.get().initiative.find((x) => x.char_id === c.id);
  const conds = comb?.conditions || [];
  return `<div class="dk-actions">
      ${
        comb
          ? `<div class="dk-actions-row">
               <button class="dice-btn" data-pp="rollinit">🎲 Init</button>
               <button class="dice-btn" data-pp="leave">✖ Quitter</button>
             </div>
             <div class="dk-conds">${CONDITIONS.map((cd) => `<button class="ipp-cond ${conds.includes(cd.n) ? 'on' : ''}" data-cond="${escapeHtml(cd.n)}" title="${escapeHtml(cd.n)}">${cd.i}</button>`).join('')}</div>`
          : `<button class="dice-btn" data-pp="join">➕ Rejoindre le combat</button>`
      }
    </div>`;
}

function dockSlots(d) {
  const lvls = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((lv) => (d.slots?.[lv]?.m || 0) > 0);
  if (!lvls.length) return '';
  return `<div class="dk-slots">${lvls
    .map((lv) => {
      const m = d.slots[lv].m;
      const u = Math.min(d.slots[lv].u || 0, m);
      const pips = Array.from({ length: m }, (_, i) => `<button class="slot-pip ${i < u ? 'used' : ''}" data-slot="${lv}" data-i="${i + 1}"></button>`).join('');
      return `<div class="dk-slot-row"><span class="dk-slot-lv">N${lv}</span>${pips}</div>`;
    })
    .join('')}</div>`;
}

/** Ressources de classe (ki, rage…) : pips cliquables dans le dock. */
function dockResources(d) {
  const res = (d.resources || []).filter((r) => (r.max || 0) > 0);
  if (!res.length) return '';
  return `<div class="dk-slots">${res
    .map((r, ri) => {
      const m = r.max;
      const u = Math.min(r.used || 0, m);
      const pips = Array.from({ length: Math.min(m, 12) }, (_, i) => `<button class="slot-pip ${i < u ? 'used' : ''}" data-res="${ri}" data-i="${i + 1}"></button>`).join('');
      return `<div class="dk-slot-row"><span class="dk-slot-lv" title="${escapeHtml(r.name || 'Ressource')}">${escapeHtml(r.name || 'Ress.')}</span>${pips}<span class="dk-res-count">${m - u}/${m}</span></div>`;
    })
    .join('')}</div>`;
}

function updateCombat() {
  const el = host?.querySelector('#dk-combat');
  if (!el) return;
  const { initiative, initTurn, isDM } = store.get();
  const rows = initiative.length
    ? initiative
        .map((c, i) => {
          const pct = c.hp_max && c.hp != null ? Math.max(0, Math.min(100, (c.hp / c.hp_max) * 100)) : null;
          const color = pct == null ? '' : pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--yellow)' : 'var(--red)';
          const conds = (c.conditions || []).map((x) => condIconHtml(x)).join(' ');
          // PV cachés pour les monstres côté joueur : palier au lieu du chiffre.
          const monster = !c.char_id;
          const hpHtml =
            pct == null
              ? ''
              : !isDM && monster
                ? `<span class="dk-comb-tier" style="color:${color}">${hpTierLabel(pct)}</span>`
                : `<span class="dk-comb-hp"><span class="dk-comb-bar" style="width:${pct}%;background:${color}"></span><em>${c.hp ?? '?'}/${c.hp_max ?? '?'}</em></span>`;
          // Indicateur compact de jets de mort (PJ à 0 PV).
          const ds = c.hp === 0 && c.char_id && c.death_saves ? c.death_saves : null;
          const dsHtml = ds
            ? ds.f >= 3
              ? ' <span class="dk-comb-ds dead">☠️</span>'
              : ds.s >= 3
                ? ' <span class="dk-comb-ds stable">🟢</span>'
                : ` <span class="dk-comb-ds" title="Jets de mort">✔${ds.s}/✘${ds.f}</span>`
            : '';
          return `<div class="dk-comb ${i === initTurn ? 'active' : ''}">
              <span class="dk-comb-init">${c.initiative}</span>
              <span class="dk-comb-name">${escapeHtml(c.name)} ${conds}${dsHtml}</span>
              ${hpHtml}
            </div>`;
        })
        .join('')
    : `<div class="dock-empty">Aucun combat en cours.</div>`;
  const log = (store.get().combatLog || []).filter((e) => isDM || !e.dm).slice(-50);
  const logHtml = log.length
    ? log
        .map((e) => {
          const time = new Date(e.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
          return `<div class="dk-logrow"><time>${time}</time> ${escapeHtml(e.text)}</div>`;
        })
        .join('')
    : `<div class="dock-empty">Aucun événement.</div>`;
  el.innerHTML = `${rows}<div class="dk-log-h">📜 Journal de combat</div><div class="dk-log" id="dk-log">${logHtml}</div>`;
  const logEl = el.querySelector('#dk-log');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

/** Application aux cibles depuis une carte de jet du dock (MJ) — délégation. */
function applyDelegate(e) {
  const b = e.target.closest('[data-apply]');
  if (!b) return;
  applyFromButton(b.dataset.apply, Number(b.dataset.amount));
}

function updateChat() {
  const el = host?.querySelector('#dk-chatfeed');
  if (!el) return;
  const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  const { messages, diceHist, combatLog, isDM, user } = store.get();

  // Frise unifiée (messages/cartes + jets + journal de combat), façon Foundry.
  const items = [];
  for (const m of messages.filter((x) => x.channel === 'public')) {
    const card = parseCard(m.content);
    items.push({ kind: card ? 'card' : 'msg', t: +new Date(m.created_at), m, card });
  }
  for (const r of diceHist || []) {
    if (rollVisibleTo(r, { isDM, user })) items.push({ kind: 'roll', t: +new Date(r.created_at), r });
  }
  for (const ev of combatLog || []) {
    if (!ev.dm || isDM) items.push({ kind: 'sys', t: ev.t, ev });
  }
  items.sort((a, b) => a.t - b.t);
  const recent = items.slice(-60);

  el.innerHTML = recent.length
    ? recent
        .map((it) => {
          if (it.kind === 'roll') return `<div class="chat-rollcard">${rollCardHtml(it.r, { isDM, user })}</div>`;
          if (it.kind === 'card') return `<div class="chat-rollcard">${richCardHtml(it.card, it.m)}</div>`;
          if (it.kind === 'sys') return `<div class="chat-sys ${it.ev.dm ? 'dm' : ''}">${escapeHtml(it.ev.text)}</div>`;
          const m = it.m;
          const color = colorFor(m.sender_id, m.sender_name);
          return `<div class="dk-msg">
            <span class="dk-av" style="background:${color}">${escapeHtml(initials(m.sender_name))}</span>
            <span class="dk-msg-txt"><strong style="color:${color}">${escapeHtml(m.sender_name)}</strong> ${escapeHtml(m.content)}</span>
          </div>`;
        })
        .join('')
    : `<div class="dock-empty">Aucun message.</div>`;
  if (stick) el.scrollTop = el.scrollHeight;
}

function updateDice() {
  const el = host?.querySelector('#dk-dicefeed');
  if (!el) return;
  const { diceHist, isDM, user } = store.get();
  const list = diceHist
    .slice()
    .reverse()
    .filter((r) => rollVisibleTo(r, { isDM, user }))
    .slice(0, 25);
  el.innerHTML = list.length
    ? list.map((r) => rollCardHtml(r, { isDM, user })).join('')
    : `<div class="dock-empty">Aucun jet.</div>`;
}
