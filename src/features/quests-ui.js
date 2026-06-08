import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { renderMarkdown } from '../lib/markdown.js';
import { getQuests, addQuest, updateQuest, toggleQuestDone, removeQuest } from '../lib/quests.js';

/**
 * Modale « Journal de quêtes ». Le MJ ajoute/coche les objectifs ; les joueurs
 * consultent en lecture seule. Synchro temps réel via lib/quests.js.
 */

let _ov = null;
let _unsub = null;

export function closeQuests() {
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
    closeQuests();
  }
}

export function openQuests() {
  closeQuests();
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `<div class="modal-card quest-card" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) closeQuests();
  });
  const card = ov.querySelector('.quest-card');
  render(card);
  _unsub = store.subscribe(() => {
    if (_ov) render(card);
  });
}

function questRow(q, isDM) {
  const note = q.note && q.note.trim() ? `<div class="quest-note md">${renderMarkdown(q.note)}</div>` : '';
  return `<div class="quest-item ${q.done ? 'done' : ''}" data-q="${q.id}">
      <div class="quest-line">
        <button class="quest-check ${q.done ? 'on' : ''}" ${isDM ? `data-q-done="${q.id}"` : 'disabled'} title="${q.done ? 'Terminée' : 'En cours'}">${q.done ? '✓' : ''}</button>
        ${
          isDM
            ? `<input class="quest-title-in" value="${escapeHtml(q.title || '')}" data-q-title="${q.id}" placeholder="Objectif"/>
               <button class="quest-x" data-q-del="${q.id}" title="Retirer">✕</button>`
            : `<span class="quest-title">${escapeHtml(q.title || 'Objectif')}</span>`
        }
      </div>
      ${
        isDM
          ? `<textarea class="quest-note-in" data-q-note="${q.id}" rows="1" placeholder="Détails (Markdown, facultatif)">${escapeHtml(q.note || '')}</textarea>`
          : note
      }
    </div>`;
}

function render(card) {
  if (card.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;

  const isDM = store.get().isDM;
  const { quests } = getQuests();
  const active = quests.filter((q) => !q.done);
  const done = quests.filter((q) => q.done);

  const section = (title, list) =>
    `<div class="quest-sec-h">${title} <span class="quest-count">${list.length}</span></div>` +
    (list.length ? list.map((q) => questRow(q, isDM)).join('') : `<div class="quest-empty">—</div>`);

  card.innerHTML = `
    <h3 class="modal-title">📜 Journal de quêtes</h3>
    <div class="quest-list">
      ${section('🟢 En cours', active)}
      ${done.length || isDM ? section('✓ Terminées', done) : ''}
    </div>
    ${
      isDM
        ? `<form class="quest-add" id="quest-add">
             <input id="quest-title" placeholder="Nouvelle quête / objectif" required/>
             <button class="btn" type="submit">+ Ajouter</button>
           </form>`
        : '<p class="quest-hint">Objectifs tenus à jour par le MJ.</p>'
    }
    <div class="modal-actions"><button class="modal-btn quest-close">Fermer</button></div>`;

  card.querySelector('.quest-close').addEventListener('click', closeQuests);
  if (!isDM) return;

  card.querySelectorAll('[data-q-done]').forEach((b) =>
    b.addEventListener('click', () => toggleQuestDone(b.dataset.qDone))
  );
  card.querySelectorAll('[data-q-title]').forEach((inp) =>
    inp.addEventListener('change', () => updateQuest(inp.dataset.qTitle, { title: inp.value }))
  );
  card.querySelectorAll('[data-q-note]').forEach((inp) =>
    inp.addEventListener('change', () => updateQuest(inp.dataset.qNote, { note: inp.value }))
  );
  card.querySelectorAll('[data-q-del]').forEach((b) =>
    b.addEventListener('click', () => removeQuest(b.dataset.qDel))
  );
  card.querySelector('#quest-add')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = card.querySelector('#quest-title').value.trim();
    if (!t) return;
    addQuest({ title: t });
    e.target.reset();
    card.querySelector('#quest-title').focus();
  });
}
