import { escapeHtml } from './utils.js';
import { t as tr } from './i18n.js';

/**
 * Tirage Tarokka (deck de divination générique). On tire au hasard des
 * cartes d'un deck Tarokka *générique* (enseignes + rangs + hautes cartes) ; les
 * **significations** restent dans ton livre — l'outil ne fait que le tirage.
 *
 * Deck : 40 cartes communes (4 enseignes × As→10) + 14 hautes cartes = 54.
 */

const SUIT_KEYS = ['coins', 'stars', 'swords', 'glyphs'];
const RANKS = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const rankLabel = (r) => (r === 'As' ? tr('tarokka.rank.ace') : r);

function buildDeck() {
  const deck = [];
  for (const s of SUIT_KEYS) for (const r of RANKS) deck.push(tr('tarokka.card', { rank: rankLabel(r), suit: tr('tarokka.suit.' + s) }));
  for (let i = 1; i <= 14; i++) deck.push(tr('tarokka.highCard', { n: i }));
  return deck;
}

/** Tire `n` cartes distinctes (mélange de Fisher-Yates, RNG crypto). */
function draw(n) {
  const deck = buildDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0xffffffff / (i + 1)) * (i + 1);
    let x;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    const j = x % (i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, n);
}

// Positions neutres : le sens de chaque carte/position vient du livre du MJ.
const POSITION_KEYS = [
  'tarokka.pos.gen.1',
  'tarokka.pos.gen.2',
  'tarokka.pos.gen.3',
  'tarokka.pos.gen.4',
  'tarokka.pos.gen.5',
];

let _ov = null;
export function openTarokka() {
  if (_ov) _ov.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:420px;max-width:94vw">
      <h3 class="modal-title">${tr('tarokka.title.generic')}</h3>
      <p class="modal-msg">${tr('tarokka.intro.generic')}</p>
      <div class="tarokka-list" id="tarokka-list"></div>
      <div class="modal-actions">
        <button class="modal-btn tk-close">${tr('common.close')}</button>
        <button class="modal-btn modal-ok tk-draw">${tr('tarokka.draw')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  const list = ov.querySelector('#tarokka-list');
  const roll = () => {
    const cards = draw(POSITION_KEYS.length);
    list.innerHTML = POSITION_KEYS.map(
      (k, i) => `<div class="tarokka-row"><span class="tk-pos">${escapeHtml(tr(k))}</span><span class="tk-card">${escapeHtml(cards[i])}</span></div>`
    ).join('');
  };
  roll();
  ov.querySelector('.tk-draw').addEventListener('click', roll);
  const close = () => {
    ov.remove();
    _ov = null;
  };
  ov.querySelector('.tk-close').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
}
