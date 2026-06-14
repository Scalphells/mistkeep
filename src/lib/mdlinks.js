import { store } from '../state.js';
import { showToast } from './toast.js';
import { sendRoll } from '../features/dice.js';
import { navigateTo } from '../features/nav.js';
import { t } from './i18n.js';

/**
 * Gestion globale des liens enrichis du Markdown (cf. lib/markdown.js) :
 *  - `.md-roll[data-roll]` → lance le jet en ligne (résultat public dans les dés) ;
 *  - `.md-ref[data-ref]`   → ouvre l'entrée de compendium portant ce nom.
 * Un seul écouteur délégué sur le document couvre tous les rendus Markdown.
 */
export function initMdLinks() {
  document.addEventListener('click', (e) => {
    const roll = e.target.closest?.('.md-roll[data-roll]');
    if (roll) {
      e.preventDefault();
      const expr = roll.dataset.roll;
      sendRoll(expr, 'public', t('mdlinks.inlineRoll', { expr })).catch(() => {});
      showToast(`🎲 ${expr}`, { timeout: 1500 });
      return;
    }
    const ref = e.target.closest?.('.md-ref[data-ref]');
    if (ref) {
      e.preventDefault();
      const name = (ref.dataset.ref || '').trim().toLowerCase();
      const entry = (store.get().compendium || []).find((x) => x.name.trim().toLowerCase() === name);
      if (entry) {
        store.set({ compendiumOpenId: entry.id });
        navigateTo('compendium');
      } else {
        showToast(t('mdlinks.notFound', { ref: ref.dataset.ref }), { timeout: 2200 });
      }
    }
  });
}
