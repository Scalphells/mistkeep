import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { condIcon } from './conditions.js';
import { navigateTo } from '../features/nav.js';

/**
 * Aperçu du groupe (« party overview » façon Foundry) : panneau flottant
 * listant les PJ avec PV, CA et états en direct. Clic sur une ligne → ouvre la
 * fiche. Bascule via le bouton 👥 de l'en-tête (toggleParty).
 */

let _el = null;
let _open = false;

/** PV/CA/états d'un perso : combattant lié prioritaire, sinon données de fiche. */
function vitals(c) {
  const comb = store.get().initiative.find((x) => x.char_id === c.id) || null;
  const d = c.data || {};
  let hp, max, temp;
  if (comb && comb.hp != null) {
    hp = comb.hp;
    max = comb.hp_max;
    temp = comb.hp_temp || 0;
  } else {
    hp = d.hp;
    max = d.hpMax;
    temp = d.hpTmp || 0;
  }
  const conds = comb?.conditions || [];
  const conc = (comb?.effects || []).some((e) => e.concentration) || conds.includes('Concentration');
  return { hp, max, temp, ac: d.ac, conds, conc };
}

function render() {
  if (!_el) return;
  _el.classList.toggle('open', _open);
  if (!_open) return;
  const chars = store.get().characters || [];
  _el.innerHTML = `
    <div class="party-head">👥 Groupe<button class="party-x" title="Fermer">✕</button></div>
    <div class="party-list">
      ${
        chars.length
          ? chars
              .map((c) => {
                const v = vitals(c);
                const pct = v.max ? Math.max(0, Math.min(100, (v.hp / v.max) * 100)) : null;
                const color = pct == null ? 'var(--muted)' : pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--yellow)' : 'var(--red)';
                const conds = v.conds.map((x) => `<span title="${escapeHtml(x)}">${condIcon(x)}</span>`).join('');
                return `<button class="party-row" data-open-char="${c.id}">
                  <span class="party-nm">${escapeHtml(c.name)}${v.conc ? ' 🧠' : ''}</span>
                  <span class="party-vit">
                    ${v.ac != null && v.ac !== '' ? `<span class="party-ac" title="CA">🛡${escapeHtml(String(v.ac))}</span>` : ''}
                    ${v.max ? `<span class="party-hp">${v.hp ?? '?'}/${v.max}${v.temp ? ` +${v.temp}` : ''}</span>` : '<span class="party-hp muted">—</span>'}
                  </span>
                  ${pct != null ? `<span class="party-bar"><span style="width:${pct}%;background:${color}"></span></span>` : ''}
                  ${conds ? `<span class="party-conds">${conds}</span>` : ''}
                </button>`;
              })
              .join('')
          : '<div class="party-empty">Aucun personnage.</div>'
      }
    </div>`;
  _el.querySelector('.party-x')?.addEventListener('click', () => setParty(false));
  _el.querySelectorAll('[data-open-char]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set({ activeChar: b.dataset.openChar });
      navigateTo('characters');
      setParty(false);
    })
  );
}

function setParty(open) {
  _open = open;
  render();
}

export function toggleParty() {
  setParty(!_open);
}

export function initParty() {
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'party-panel';
    document.body.appendChild(_el);
  }
  store.subscribe(() => {
    if (_open) render();
  });
}
