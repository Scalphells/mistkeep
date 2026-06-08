import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalPrompt } from '../lib/modal.js';
import { rollCardHtml, rollVisibleTo } from '../lib/chatcards.js';
import { sendRoll, loadRecentRolls, subscribeRolls } from './dice.js';
import { requestRoll } from '../lib/rollrequest.js';
import { applyFromButton } from '../lib/applyroll.js';
import { ABILITIES, SKILLS } from './characters.js';
import { addHotbarMacro } from '../lib/hotbar.js';
import { showToast } from '../lib/toast.js';

/**
 * UI des dés partagés : boutons rapides, macros, jet personnalisé, flux temps réel.
 * Renvoie une fonction de cleanup (désinscription store + realtime).
 */

const QUICK = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/* ── Macros (locales, par appareil) ── */
const MACRO_KEY = 'vaultmj_macros';
function loadMacros() {
  try {
    return JSON.parse(localStorage.getItem(MACRO_KEY)) || [];
  } catch {
    return [];
  }
}
function saveMacros(list) {
  try {
    localStorage.setItem(MACRO_KEY, JSON.stringify(list));
  } catch {
    /* no-op */
  }
}

export async function mountDice(container) {
  const { isDM } = store.get();

  container.innerHTML = `
    <div class="dice-wrap">
      <section class="dice-controls">
        <div class="dice-quick">
          ${QUICK.map((d) => `<button class="dice-btn" data-roll="1${d}">${d}</button>`).join('')}
        </div>
        <div class="dice-macros" id="dice-macros"></div>
        <div class="dice-custom">
          <input id="dice-input" type="text" placeholder="ex: 2d6+3" autocomplete="off" />
          <select id="dice-mode" class="dice-mode" title="Visibilité du jet">
            <option value="public">👁 Public</option>
            <option value="blind">🙈 Aveugle</option>
            <option value="self">🔒 Privé</option>
            ${isDM ? '<option value="dm">🎭 MJ</option>' : ''}
          </select>
          <button class="btn" id="dice-roll">Lancer</button>
        </div>
        <div class="dice-err" id="dice-err"></div>
        ${
          isDM
            ? `<div class="dice-request">
                 <span class="dice-request-lbl">📣 Demander un jet</span>
                 <select id="rr-kind">
                   <option value="save">Sauvegarde</option>
                   <option value="ability">Caractéristique</option>
                   <option value="skill">Compétence</option>
                 </select>
                 <select id="rr-key"></select>
                 <input id="rr-dc" type="number" placeholder="DD" style="width:60px"/>
                 <button class="btn" id="rr-go">Demander</button>
               </div>`
            : ''
        }
      </section>
      <section class="dice-feed" id="dice-feed"></section>
    </div>
  `;

  const input = container.querySelector('#dice-input');
  const err = container.querySelector('#dice-err');

  // Demande de jet aux joueurs (MJ).
  if (isDM) {
    const kindSel = container.querySelector('#rr-kind');
    const keySel = container.querySelector('#rr-key');
    const fillKeys = () => {
      const opts =
        kindSel.value === 'skill'
          ? Object.entries(SKILLS).map(([k, v]) => `<option value="${k}">${v.label}</option>`)
          : ABILITIES.map((a) => `<option value="${a.key}">${a.label}</option>`);
      keySel.innerHTML = opts.join('');
    };
    kindSel.addEventListener('change', fillKeys);
    fillKeys();
    container.querySelector('#rr-go').addEventListener('click', () => {
      const dc = Number(container.querySelector('#rr-dc').value) || null;
      requestRoll({ kind: kindSel.value, key: keySel.value, dc });
    });
  }

  const doRoll = async (notation) => {
    err.textContent = '';
    const mode = container.querySelector('#dice-mode')?.value || 'public';
    let rollType = 'public';
    let vis = null;
    if (mode === 'dm' && isDM) rollType = 'dm';
    else if (mode === 'blind') vis = 'blind';
    else if (mode === 'self') vis = 'self';
    try {
      await sendRoll(notation, rollType, '', vis);
      input.value = '';
    } catch (e) {
      err.textContent = e.message || 'Erreur de jet.';
    }
  };

  container.querySelectorAll('[data-roll]').forEach((b) =>
    b.addEventListener('click', () => doRoll(b.dataset.roll))
  );
  container.querySelector('#dice-roll').addEventListener('click', () => {
    if (input.value.trim()) doRoll(input.value);
  });

  // Macros personnalisées.
  function renderMacros() {
    const el = container.querySelector('#dice-macros');
    if (!el) return;
    const macros = loadMacros();
    el.innerHTML =
      macros
        .map(
          (mac) =>
            `<span class="macro-chip"><button class="macro-btn" data-macro="${escapeHtml(mac.notation)}" title="${escapeHtml(mac.notation)}">${escapeHtml(mac.label)}</button><button class="macro-bar" data-macro-bar="${mac.id}" title="Ajouter à la barre de raccourcis">⤓</button><button class="macro-x" data-macro-del="${mac.id}" title="Retirer">×</button></span>`
        )
        .join('') + `<button class="macro-add" id="macro-add" title="Ajouter une macro">＋ Macro</button>`;
    el.querySelectorAll('[data-macro]').forEach((b) =>
      b.addEventListener('click', () => doRoll(b.dataset.macro))
    );
    el.querySelectorAll('[data-macro-del]').forEach((b) =>
      b.addEventListener('click', () => {
        saveMacros(loadMacros().filter((m) => m.id !== b.dataset.macroDel));
        renderMacros();
      })
    );
    el.querySelectorAll('[data-macro-bar]').forEach((b) =>
      b.addEventListener('click', () => {
        const mac = loadMacros().find((m) => m.id === b.dataset.macroBar);
        if (!mac) return;
        const ok = addHotbarMacro({ label: mac.label, notation: mac.notation });
        showToast(ok !== false ? `⤓ « ${mac.label} » ajouté à la barre.` : 'Barre pleine (10 emplacements).', { timeout: 2200 });
      })
    );
    el.querySelector('#macro-add')?.addEventListener('click', async () => {
      const label = await modalPrompt('Nom de la macro :', { title: 'Nouvelle macro', placeholder: 'Ex. Épée longue' });
      if (!label || !label.trim()) return;
      const notation = await modalPrompt('Notation de dés :', { title: 'Nouvelle macro', placeholder: 'Ex. 1d20+5' });
      if (!notation || !notation.trim()) return;
      const list = loadMacros();
      list.push({ id: crypto.randomUUID().slice(0, 8), label: label.trim(), notation: notation.trim() });
      saveMacros(list);
      renderMacros();
    });
  }
  renderMacros();
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) doRoll(input.value);
  });

  // Application d'un résultat aux cibles (délégation : le flux est re-rendu).
  container.querySelector('#dice-feed').addEventListener('click', (e) => {
    const b = e.target.closest('[data-apply]');
    if (!b) return;
    applyFromButton(b.dataset.apply, Number(b.dataset.amount));
  });

  await loadRecentRolls();
  const unsubRealtime = subscribeRolls();
  const unsubStore = store.subscribe(renderFeed);
  renderFeed();

  return () => {
    unsubStore();
    unsubRealtime();
  };
}

function renderFeed() {
  const el = document.getElementById('dice-feed');
  if (!el) return;
  const { diceHist, isDM, user } = store.get();

  if (!diceHist.length) {
    el.innerHTML = `<div class="dice-empty">Aucun jet pour l'instant. Lancez un dé !</div>`;
    return;
  }

  el.innerHTML = diceHist
    .slice()
    .reverse()
    .filter((r) => rollVisibleTo(r, { isDM, user }))
    .map((r) => rollCardHtml(r, { isDM, user }))
    .join('');
}
