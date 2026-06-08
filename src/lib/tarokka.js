import { escapeHtml } from './utils.js';

/**
 * Tirage Tarokka (deck de divination générique). On tire au hasard des
 * cartes d'un deck Tarokka *générique* (enseignes + rangs + hautes cartes) ; les
 * **significations** restent dans ton livre — l'outil ne fait que le tirage.
 *
 * Deck : 40 cartes communes (4 enseignes × As→10) + 14 hautes cartes = 54.
 */

const SUITS = ['Pièces', 'Étoiles', 'Épées', 'Glyphes'];
const RANKS = ['As', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function buildDeck() {
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(`${r} de ${s}`);
  for (let i = 1; i <= 14; i++) deck.push(`Haute carte ${i}`);
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
const POSITIONS = [
  '① Première carte',
  '② Deuxième carte',
  '③ Troisième carte',
  '④ Quatrième carte',
  '⑤ Cinquième carte',
];

let _ov = null;
export function openTarokka() {
  if (_ov) _ov.remove();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true" style="width:420px;max-width:94vw">
      <h3 class="modal-title">🃏 Tirage de cartes</h3>
      <p class="modal-msg">Tirage de 5 cartes. Reporte-toi à ton livre / ta table pour l'interprétation.</p>
      <div class="tarokka-list" id="tarokka-list"></div>
      <div class="modal-actions">
        <button class="modal-btn tk-close">Fermer</button>
        <button class="modal-btn modal-ok tk-draw">🔀 Tirer</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  const list = ov.querySelector('#tarokka-list');
  const roll = () => {
    const cards = draw(POSITIONS.length);
    list.innerHTML = POSITIONS.map(
      (p, i) => `<div class="tarokka-row"><span class="tk-pos">${escapeHtml(p)}</span><span class="tk-card">${escapeHtml(cards[i])}</span></div>`
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
