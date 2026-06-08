import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalConfirm } from '../lib/modal.js';
import { renderMarkdown } from '../lib/markdown.js';
import { showToPlayers } from '../lib/spotlight.js';
import { loadPlayers } from './characters.js';
import {
  loadHandouts,
  createHandout,
  uploadHandout,
  deleteHandout,
  handoutUrl,
  subscribeHandouts,
} from './handouts.js';

/**
 * UI Handouts : le MJ partage des images / textes / lettres, ciblés sur un
 * joueur ou tout le monde. Les joueurs voient une galerie filtrée.
 * Renvoie une fonction de cleanup.
 */

const TYPE_META = {
  image: { icon: '🖼', label: 'Image' },
  text: { icon: '📝', label: 'Texte' },
  letter: { icon: '✉️', label: 'Lettre' },
};

/** Un handout est-il visible par l'utilisateur courant ? */
function visibleTo(h, user, isDM) {
  return isDM || !h.target_player || h.target_player === user?.id;
}

function playerName(id) {
  if (!id) return 'Tout le monde';
  const p = store.get().players.find((x) => x.id === id);
  return p?.display_name || 'Joueur';
}

export async function mountHandouts(container) {
  const { isDM } = store.get();

  container.innerHTML = `
    <div class="ho-wrap">
      ${isDM ? renderEditor() : ''}
      <section class="ho-list" id="ho-list"></section>
    </div>
  `;

  if (isDM) wireEditor(container);

  // Données. Le MJ a besoin de la liste des joueurs pour le ciblage.
  if (isDM && !store.get().players.length) {
    try {
      await loadPlayers();
    } catch {
      /* no-op */
    }
  }
  await loadHandouts();
  if (isDM) refreshTargets(container);

  const unsubRealtime = subscribeHandouts();
  const unsubStore = store.subscribe(() => renderList(container));
  renderList(container);

  return () => {
    unsubStore();
    unsubRealtime();
  };
}

function renderEditor() {
  return `
    <section class="ho-editor">
      <div class="ho-types">
        <button class="ho-type active" data-type="image">🖼 Image</button>
        <button class="ho-type" data-type="text">📝 Texte</button>
        <button class="ho-type" data-type="letter">✉️ Lettre</button>
      </div>
      <div class="ho-fields">
        <input id="ho-title" class="ho-input" type="text" placeholder="Titre" maxlength="120" />
        <input id="ho-desc" class="ho-input" type="text" placeholder="Description (optionnel)" maxlength="240" />
        <select id="ho-target" class="ho-input"><option value="">📢 Tout le monde</option></select>
        <label class="ho-file" id="ho-file-wrap">
          <span id="ho-file-label">📎 Choisir une image…</span>
          <input id="ho-file" type="file" accept="image/*" hidden />
        </label>
        <textarea id="ho-text" class="ho-input ho-textarea" placeholder="Contenu du document…" maxlength="8000" style="display:none"></textarea>
      </div>
      <div class="ho-actions">
        <button class="btn" id="ho-share">Partager</button>
        <span class="ho-err" id="ho-err"></span>
      </div>
    </section>
  `;
}

/** Remplit le sélecteur de destinataire avec les joueurs connus. */
function refreshTargets(container) {
  const sel = container.querySelector('#ho-target');
  if (!sel) return;
  const players = store.get().players.filter((p) => p.role !== 'dm');
  const cur = sel.value;
  sel.innerHTML =
    `<option value="">📢 Tout le monde</option>` +
    players
      .map((p) => `<option value="${p.id}">🎯 ${escapeHtml(p.display_name || p.email || 'Joueur')}</option>`)
      .join('');
  sel.value = cur;
}

function wireEditor(container) {
  let type = 'image';
  const fileWrap = container.querySelector('#ho-file-wrap');
  const textArea = container.querySelector('#ho-text');
  const fileInput = container.querySelector('#ho-file');
  const fileLabel = container.querySelector('#ho-file-label');
  const err = container.querySelector('#ho-err');

  container.querySelectorAll('[data-type]').forEach((b) =>
    b.addEventListener('click', () => {
      type = b.dataset.type;
      container.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('active', x === b));
      const isImg = type === 'image';
      fileWrap.style.display = isImg ? '' : 'none';
      textArea.style.display = isImg ? 'none' : '';
      textArea.placeholder = type === 'letter' ? 'Texte de la lettre…' : 'Contenu du document…';
    })
  );

  fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files?.[0]?.name || '📎 Choisir une image…';
  });

  container.querySelector('#ho-share').addEventListener('click', async () => {
    err.textContent = '';
    const title = container.querySelector('#ho-title').value;
    const description = container.querySelector('#ho-desc').value;
    const target_player = container.querySelector('#ho-target').value;
    const btn = container.querySelector('#ho-share');
    btn.disabled = true;
    try {
      if (type === 'image') {
        const file = fileInput.files?.[0];
        if (!file) throw new Error('Choisissez une image.');
        await uploadHandout(file, { title, description, target_player });
        fileInput.value = '';
        fileLabel.textContent = '📎 Choisir une image…';
      } else {
        const text_content = textArea.value.trim();
        if (!text_content) throw new Error('Le contenu est vide.');
        await createHandout({ title, description, content_type: type, text_content, target_player });
        textArea.value = '';
      }
      container.querySelector('#ho-title').value = '';
      container.querySelector('#ho-desc').value = '';
    } catch (ex) {
      err.textContent = ex.message || 'Échec du partage.';
    } finally {
      btn.disabled = false;
    }
  });
}

function renderList(container) {
  const el = container.querySelector('#ho-list');
  if (!el) return;
  const { handouts, user, isDM } = store.get();
  if (isDM) refreshTargets(container);

  const list = handouts.filter((h) => visibleTo(h, user, isDM));
  if (!list.length) {
    el.innerHTML = `<div class="ho-empty">${
      isDM ? '🖼 Aucun handout. Partagez un document ci-dessus.' : '🖼 Aucun document partagé pour le moment.'
    }</div>`;
    return;
  }

  el.innerHTML = list
    .map((h) => {
      const meta = TYPE_META[h.content_type] || TYPE_META.text;
      const when = new Date(h.pushed_at).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      });
      const targetBadge = isDM
        ? `<span class="ho-badge ${h.target_player ? 'targeted' : ''}">${escapeHtml(playerName(h.target_player))}</span>`
        : '';
      let body = '';
      if (h.content_type === 'image') {
        const url = handoutUrl(h.image_url);
        body = url
          ? `<a class="ho-imglink" href="${url}" target="_blank" rel="noopener"><img class="ho-img" src="${url}" alt="${escapeHtml(h.title)}" loading="lazy"></a>`
          : `<div class="ho-img-loading">Chargement de l'image…</div>`;
      } else {
        body = `<div class="ho-text-body md ${h.content_type === 'letter' ? 'letter' : ''}">${renderMarkdown(h.text_content || '')}</div>`;
      }
      return `
        <article class="ho-card ${h.content_type}">
          <header class="ho-card-head">
            <span class="ho-type-icon" title="${meta.label}">${meta.icon}</span>
            <div class="ho-card-titles">
              <h3>${escapeHtml(h.title)}</h3>
              ${h.description ? `<p>${escapeHtml(h.description)}</p>` : ''}
            </div>
            ${targetBadge}
            ${isDM && h.content_type === 'image' ? `<button class="ho-del" data-show="${h.id}" title="Montrer en plein écran">👁</button>` : ''}
            ${isDM ? `<button class="ho-del" data-del="${h.id}" title="Supprimer">🗑</button>` : ''}
            <time class="ho-time">${when}</time>
          </header>
          ${body}
        </article>`;
    })
    .join('');

  if (isDM) {
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await modalConfirm('Supprimer ce handout ?', { title: 'Handouts', danger: true, okLabel: 'Supprimer' }))
          deleteHandout(b.dataset.del);
      })
    );
    el.querySelectorAll('[data-show]').forEach((b) =>
      b.addEventListener('click', () => {
        const h = store.get().handouts.find((x) => x.id === b.dataset.show);
        if (h?.image_url) showToPlayers(h.image_url, h.title);
      })
    );
  }
}
