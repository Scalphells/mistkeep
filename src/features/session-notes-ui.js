import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalConfirm, modalPrompt } from '../lib/modal.js';
import { renderMarkdown } from '../lib/markdown.js';
import { colorFor } from '../lib/profile.js';
import { buildSessionRecap } from '../lib/recap.js';
import { loadCombatLog } from './initiative.js';
import { loadMessages } from './chat.js';
import { loadRecentRolls } from './dice.js';
import {
  loadNotes,
  addNote,
  updateNote,
  deleteNote,
  canEditNote,
  subscribeNotes,
} from './session-notes.js';

/**
 * UI Notes de session : chacun écrit ses notes (partagées ou privées). Le MJ
 * voit tout. Auteur ou MJ peuvent modifier/supprimer/(dé)partager.
 */

function authorName(id) {
  if (id === store.get().user?.id) return 'Moi';
  return store.get().players.find((p) => p.id === id)?.display_name || 'Joueur';
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function mountSessionNotes(container) {
  container.innerHTML = `
    <div class="sn-wrap">
      <section class="sn-composer">
        <textarea id="sn-input" class="sn-input" placeholder="Note, résumé, événement marquant… (Markdown)" maxlength="8000"></textarea>
        <div class="sn-composer-actions">
          <label class="sn-share"><input type="checkbox" id="sn-shared"> Partager avec la table</label>
          <span class="sn-hint">Sinon, visible de toi seul (et du MJ).</span>
          ${store.get().isDM ? '<button class="btn" id="sn-recap" title="Pré-remplit la note avec un brouillon de résumé (journal de combat, jets marquants)">🪄 Résumé auto</button>' : ''}
          <button class="btn" id="sn-add">Ajouter</button>
        </div>
        <div class="sn-err" id="sn-err"></div>
      </section>
      <section class="sn-list" id="sn-list"></section>
    </div>
  `;

  const input = container.querySelector('#sn-input');
  const shared = container.querySelector('#sn-shared');
  const err = container.querySelector('#sn-err');
  container.querySelector('#sn-add').addEventListener('click', async () => {
    const text = input.value.trim();
    if (!text) return;
    err.textContent = '';
    try {
      await addNote(text, shared.checked);
      input.value = '';
      shared.checked = false;
    } catch (e) {
      err.textContent = e.message || "Échec de l'ajout.";
    }
  });

  // Brouillon de résumé (MJ) : pré-remplit le composeur, rien n'est posté
  // automatiquement — le MJ relit, complète, puis ajoute/partage.
  container.querySelector('#sn-recap')?.addEventListener('click', async () => {
    const h = await modalPrompt('Reprendre les événements des dernières heures :', {
      title: '🪄 Résumé de séance', defaultValue: '4', placeholder: '4',
    });
    if (h === null) return;
    const hours = Math.max(1, Math.min(24, Number(h) || 4));
    // Recharge les sources au cas où ces onglets n'ont pas été ouverts.
    await Promise.allSettled([loadCombatLog(), loadMessages(), loadRecentRolls()]);
    const { combatLog = [], messages = [], diceHist = [] } = store.get();
    input.value = buildSessionRecap({ combatLog, messages, rolls: diceHist, sinceMs: Date.now() - hours * 3600e3 });
    input.focus();
  });

  loadNotes();
  const unsubRealtime = subscribeNotes();
  const unsubStore = store.subscribe(() => renderList(container));
  renderList(container);

  return () => {
    unsubStore();
    unsubRealtime();
  };
}

function renderList(container) {
  const el = container.querySelector('#sn-list');
  if (!el) return;
  const { sessionNotes } = store.get();

  if (el.querySelector('textarea.sn-edit-area') === document.activeElement) return; // édition en cours

  if (!sessionNotes.length) {
    el.innerHTML = `<div class="sn-empty">📝 Aucune note pour l'instant.</div>`;
    return;
  }

  el.innerHTML = sessionNotes
    .map((n) => {
      const editable = canEditNote(n);
      const mine = n.created_by === store.get().user?.id;
      return `
      <article class="sn-note" data-note="${n.id}">
        <header class="sn-note-head">
          <span class="sn-author" style="color:${colorFor(n.created_by, authorName(n.created_by))}">${escapeHtml(authorName(n.created_by))}</span>
          <span class="sn-badge ${n.shared ? 'shared' : 'private'}">${n.shared ? '🌐 Partagée' : '🔒 Privée'}</span>
          <time class="sn-time">${fmtDate(n.created_at)}</time>
          ${
            editable
              ? `<span class="sn-note-actions">
                   ${mine || store.get().isDM ? `<button class="sn-edit" data-share="${n.id}" title="${n.shared ? 'Rendre privée' : 'Partager'}">${n.shared ? '🔒' : '🌐'}</button>` : ''}
                   <button class="sn-edit" data-edit="${n.id}" title="Modifier">✏</button>
                   <button class="sn-del" data-del="${n.id}" title="Supprimer">🗑</button>
                 </span>`
              : ''
          }
        </header>
        <div class="sn-body md">${renderMarkdown(n.content)}</div>
      </article>`;
    })
    .join('');

  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (await modalConfirm('Supprimer cette note ?', { title: 'Notes de session', danger: true, okLabel: 'Supprimer' }))
        deleteNote(b.dataset.del);
    })
  );
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => startEdit(container, b.dataset.edit))
  );
  el.querySelectorAll('[data-share]').forEach((b) =>
    b.addEventListener('click', () => {
      const n = store.get().sessionNotes.find((x) => x.id === b.dataset.share);
      if (n) updateNote(n.id, { shared: !n.shared });
    })
  );
}

/** Édition inline (auteur ou MJ). */
function startEdit(container, id) {
  const note = store.get().sessionNotes.find((n) => n.id === id);
  if (!note) return;
  const article = container.querySelector(`[data-note="${id}"]`);
  if (!article) return;
  const body = article.querySelector('.sn-body');
  body.innerHTML = `
    <textarea class="sn-input sn-edit-area" maxlength="8000">${escapeHtml(note.content)}</textarea>
    <div class="sn-composer-actions">
      <button class="link sn-cancel" style="width:auto;margin:0">Annuler</button>
      <button class="btn sn-save" style="width:auto;margin:0">Enregistrer</button>
    </div>`;
  const area = body.querySelector('textarea');
  area.focus();
  body.querySelector('.sn-save').addEventListener('click', async () => {
    await updateNote(id, { content: area.value });
    renderList(container);
  });
  body.querySelector('.sn-cancel').addEventListener('click', () => renderList(container));
}
