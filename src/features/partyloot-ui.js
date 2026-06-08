import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { showToast } from '../lib/toast.js';
import { updateCharacter } from './characters.js';
import { sendPlayerRequest } from './initiative.js';
import {
  getPartyLoot,
  addLootItem,
  updateLootItem,
  removeLootItem,
  setLootCoin,
  setPartyLoot,
} from '../lib/partyloot.js';

/**
 * Modale « Trésor de groupe ». Le MJ remplit le pot commun (pièces + objets) et
 * le distribue aux personnages ; les joueurs le consultent en lecture seule.
 */

const COINS = [
  { k: 'pp', label: 'PP', title: 'Platine' },
  { k: 'gp', label: 'PO', title: 'Or' },
  { k: 'ep', label: 'PE', title: 'Électrum' },
  { k: 'sp', label: 'PA', title: 'Argent' },
  { k: 'cp', label: 'PC', title: 'Cuivre' },
];

let _ov = null;
let _unsub = null;

export function closePartyLoot() {
  if (_unsub) {
    _unsub();
    _unsub = null;
  }
  if (_ov) {
    _ov.remove();
    _ov = null;
    document.removeEventListener('keydown', _key, true);
  }
}
function _key(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePartyLoot();
  }
}

/** Personnages possédés par un joueur (cibles de distribution). */
function playerCharacters() {
  return (store.get().characters || []).filter((c) => c.owner_id);
}

/** Personnage du joueur courant (actif en priorité), pour les demandes de butin. */
function myCharId() {
  const { characters, user, activeChar } = store.get();
  const owned = (characters || []).filter((c) => c.owner_id === user?.id);
  return (owned.find((c) => c.id === activeChar) || owned[0])?.id || null;
}

export function openPartyLoot() {
  closePartyLoot();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `<div class="modal-card loot-card" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) closePartyLoot();
  });

  const card = ov.querySelector('.loot-card');
  render(card);
  // Re-render en direct quand le trésor change (MJ ou synchro temps réel).
  _unsub = store.subscribe(() => {
    if (_ov) render(card);
  });
}

function render(card) {
  // Ne pas ré-rendre pendant une saisie (préserve le focus du champ en cours).
  if (card.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;

  const isDM = store.get().isDM;
  const loot = getPartyLoot();
  const chars = playerCharacters();

  const coinsHtml = COINS.map((c) => {
    const v = Number(loot.coins[c.k]) || 0;
    return isDM
      ? `<label class="coin" title="${c.title}"><span>${c.label}</span><input type="number" min="0" value="${v}" data-coin="${c.k}"/></label>`
      : `<span class="coin ro" title="${c.title}"><span>${c.label}</span><b>${v}</b></span>`;
  }).join('');

  const myId = myCharId();
  const itemsHtml = loot.items.length
    ? loot.items
        .map((it) => {
          const reqBadge = it.reqBy ? `<span class="loot-req" title="Demandé par un joueur">✋ ${escapeHtml(it.reqBy)}</span>` : '';
          const giveSel = isDM
            ? `<span class="loot-give">
                 ${reqBadge}
                 <select data-give-to="${it.id}"><option value="">Donner à…</option>${chars
                   .map((c) => `<option value="${c.id}" ${c.id === it.reqCharId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
                   .join('')}</select>
                 <button class="loot-x" data-it-del="${it.id}" title="Retirer">✕</button>
               </span>`
            : `<span class="loot-give">${reqBadge}${
                myId && it.reqCharId !== myId
                  ? `<button class="btn loot-claim" data-claim="${it.id}" title="Demander cet objet au MJ">✋ Demander</button>`
                  : ''
              }</span>`;
          return `<div class="loot-item" data-row="${it.id}">
            ${
              isDM
                ? `<input value="${escapeHtml(it.nm || '')}" data-it-nm="${it.id}" placeholder="Objet"/>
                   <input type="number" min="1" value="${escapeHtml(String(it.qty ?? 1))}" data-it-qty="${it.id}" style="width:56px"/>
                   <input value="${escapeHtml(it.note || '')}" data-it-note="${it.id}" placeholder="note" class="loot-note"/>`
                : `<span class="loot-nm">${escapeHtml(it.nm || 'Objet')}</span>
                   <span class="loot-qty">×${escapeHtml(String(it.qty ?? 1))}</span>
                   <span class="loot-note ro">${escapeHtml(it.note || '')}</span>`
            }
            ${giveSel}
          </div>`;
        })
        .join('')
    : `<div class="loot-empty">Aucun objet dans le trésor.</div>`;

  card.innerHTML = `
    <h3 class="modal-title">🪙 Trésor de groupe</h3>
    <div class="loot-coins">${coinsHtml}</div>
    ${
      isDM
        ? `<div class="loot-actions">
             <button class="btn loot-split" id="loot-split" title="Répartir les pièces équitablement entre les PJ (le reste indivisible reste dans le trésor)">⚖ Répartir les pièces</button>
           </div>`
        : ''
    }
    <div class="loot-list">${itemsHtml}</div>
    ${
      isDM
        ? `<form class="loot-add" id="loot-add">
             <input id="loot-nm" placeholder="Nouvel objet" required/>
             <input id="loot-qty" type="number" min="1" value="1" style="width:56px"/>
             <input id="loot-note2" placeholder="note (facultatif)"/>
             <button class="btn" type="submit">+ Ajouter</button>
           </form>`
        : '<p class="loot-hint">Le MJ distribue le trésor. Consultation seule.</p>'
    }
    <div class="modal-actions"><button class="modal-btn loot-close">Fermer</button></div>`;

  card.querySelector('.loot-close').addEventListener('click', closePartyLoot);

  // Joueur : demander un objet au MJ (diffusion ; le MJ le marque puis le donne).
  card.querySelectorAll('[data-claim]').forEach((b) =>
    b.addEventListener('click', () => {
      const cid = myCharId();
      if (!cid) {
        showToast('Aucune fiche à toi pour réclamer cet objet.', { timeout: 2400 });
        return;
      }
      sendPlayerRequest({ kind: 'lootclaim', itemId: b.dataset.claim, charId: cid });
      b.textContent = '✋ Demandé';
      b.disabled = true;
      showToast('✋ Demande envoyée au MJ.', { timeout: 1800 });
    })
  );

  if (!isDM) return;

  card.querySelectorAll('[data-coin]').forEach((inp) =>
    inp.addEventListener('change', () => setLootCoin(inp.dataset.coin, inp.value))
  );
  card.querySelectorAll('[data-it-nm]').forEach((inp) =>
    inp.addEventListener('change', () => updateLootItem(inp.dataset.itNm, { nm: inp.value }))
  );
  card.querySelectorAll('[data-it-qty]').forEach((inp) =>
    inp.addEventListener('change', () => updateLootItem(inp.dataset.itQty, { qty: Math.max(1, Number(inp.value) || 1) }))
  );
  card.querySelectorAll('[data-it-note]').forEach((inp) =>
    inp.addEventListener('change', () => updateLootItem(inp.dataset.itNote, { note: inp.value }))
  );
  card.querySelectorAll('[data-it-del]').forEach((b) =>
    b.addEventListener('click', () => removeLootItem(b.dataset.itDel))
  );
  card.querySelectorAll('[data-give-to]').forEach((sel) =>
    sel.addEventListener('change', () => {
      if (sel.value) giveItemToChar(sel.dataset.giveTo, sel.value);
    })
  );
  card.querySelector('#loot-split')?.addEventListener('click', distributeCoins);
  card.querySelector('#loot-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nm = card.querySelector('#loot-nm').value.trim();
    if (!nm) return;
    addLootItem({ nm, qty: card.querySelector('#loot-qty').value, note: card.querySelector('#loot-note2').value });
    e.target.reset();
    card.querySelector('#loot-qty').value = '1';
    card.querySelector('#loot-nm').focus();
  });
}

/** Donne un objet du trésor à un personnage (ajout à son inventaire). */
function giveItemToChar(itemId, charId) {
  const loot = getPartyLoot();
  const it = loot.items.find((x) => x.id === itemId);
  const ch = store.get().characters.find((c) => c.id === charId);
  if (!it || !ch) return;
  const inv = [...(ch.data?.inv || []), { nm: it.nm, qty: it.qty, wt: '', note: it.note || '' }];
  updateCharacter(charId, { inv });
  removeLootItem(itemId);
  showToast(`🎁 « ${it.nm} » donné à ${ch.name}.`, { timeout: 2200 });
}

/** Répartit chaque type de pièce équitablement entre les PJ ; le reste demeure. */
function distributeCoins() {
  const loot = getPartyLoot();
  const chars = playerCharacters();
  if (!chars.length) {
    showToast('Aucun personnage joueur pour la répartition.', { timeout: 2400 });
    return;
  }
  const n = chars.length;
  const remaining = {};
  const perChar = {};
  for (const c of COINS) {
    const total = Number(loot.coins[c.k]) || 0;
    const per = Math.floor(total / n);
    perChar[c.k] = per;
    remaining[c.k] = total - per * n;
  }
  if (!COINS.some((c) => perChar[c.k] > 0)) {
    showToast('Pas assez de pièces pour répartir.', { timeout: 2400 });
    return;
  }
  for (const ch of chars) {
    const coins = { ...(ch.data?.coins || {}) };
    for (const c of COINS) coins[c.k] = (Number(coins[c.k]) || 0) + perChar[c.k];
    updateCharacter(ch.id, { coins });
  }
  setPartyLoot({ ...loot, coins: remaining });
  const sum = COINS.filter((c) => perChar[c.k] > 0).map((c) => `${perChar[c.k]} ${c.label}`).join(', ');
  showToast(`⚖ Réparti à ${n} PJ : ${sum} chacun.`, { timeout: 3200 });
}
