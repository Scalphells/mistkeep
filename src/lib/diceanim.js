import { store } from '../state.js';
import { escapeHtml } from './utils.js';

/**
 * Animation de dés : à l'arrivée d'un nouveau jet (visible), affiche un dé qui
 * « roule » au centre de l'écran puis le résultat. Overlay éphémère, non bloquant.
 */

let lastId = null;
let primed = false;
let host = null;

function animate(r) {
  if (!host) {
    host = document.createElement('div');
    host.className = 'diceanim-host';
    document.body.appendChild(host);
  }
  // 20/1 naturels : uniquement sur un vrai test de d20 (pas 1d100, 2d6…).
  const isD20 = /^1d20\b/.test(r.dice || '1d20');
  const crit = isD20 && r.details?.mode && (r.details.kept === 20 || r.details.kept === 1);
  const el = document.createElement('div');
  el.className = `diceanim ${isD20 && r.details?.kept === 20 ? 'crit' : isD20 && r.details?.kept === 1 ? 'fumble' : ''}`;
  el.innerHTML = `
    <div class="diceanim-die">🎲</div>
    <div class="diceanim-res">${r.result}</div>
    <div class="diceanim-name">${escapeHtml(r.roller_name || '')} — ${escapeHtml(r.roll_name || '')}</div>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, crit ? 2200 : 1600);
}

export function initDiceAnim() {
  store.subscribe(() => {
    const hist = store.get().diceHist;
    if (!hist.length) return;
    const latest = hist[hist.length - 1];
    if (!primed) {
      primed = true;
      lastId = latest.id;
      return; // ne pas animer les jets déjà présents au chargement
    }
    if (!latest.id || latest.id === lastId) return;
    lastId = latest.id;
    const isDM = store.get().isDM;
    const vis = latest.details?.vis;
    if (latest.roll_type === 'dm' && !isDM) return; // jet caché MJ
    if (vis === 'blind' && !isDM) return; // aveugle : pas d'animation chez les joueurs
    if (vis === 'self' && !isDM && latest.details?.owner !== store.get().user?.id) return; // privé
    animate(latest);
  });
}
