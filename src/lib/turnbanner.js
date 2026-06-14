import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { colorFor, initials } from './profile.js';
import { combatantName } from '../features/initiative.js';
import { t } from './i18n.js';

/**
 * Bandeau du combattant actif (façon Foundry) : affiché en haut quand un combat
 * est en cours, montre qui joue + le round. Clic = aller au tracker de combat.
 */

let _el = null;
let _nav = null;
let _sig = '';

export function setTurnNavigate(fn) {
  _nav = fn;
}

function render() {
  const { initiative, initTurn, initRound } = store.get();
  const active = initiative[initTurn];
  if (!initiative.length || !active) {
    _sig = '';
    if (_el) {
      _el.remove();
      _el = null;
    }
    return;
  }
  const sig = `${active.entity_id}#${initRound}`;
  if (sig === _sig && _el) return;
  _sig = sig;
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'turn-banner';
    _el.title = t('tb.goCombat');
    _el.addEventListener('click', () => _nav?.('initiative'));
    document.body.appendChild(_el);
  }
  const who = combatantName(active);
  _el.innerHTML = `
    <span class="tb-av" style="background:${colorFor(active.char_id, active.name)}">${escapeHtml(initials(who))}</span>
    <span class="tb-txt"><b>${escapeHtml(who)}</b><small>${t('combat.round')} ${initRound}</small></span>`;
}

export function initTurnBanner() {
  render();
  store.subscribe(render);
}
