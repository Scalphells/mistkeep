import { store } from '../state.js';
import { t } from '../lib/i18n.js';
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
  image: { icon: '🖼', label: 'handouts.type.image' },
  text: { icon: '📝', label: 'handouts.type.text' },
  letter: { icon: '✉️', label: 'handouts.type.letter' },
};

/** Un handout est-il visible par l'utilisateur courant ? */
function visibleTo(h, user, isDM) {
  return isDM || !h.target_player || h.target_player === user?.id;
}

function playerName(id) {
  if (!id) return t('common.everyone');
  const p = store.get().players.find((x) => x.id === id);
  return p?.display_name || t('common.player');
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
        <button class="ho-type active" data-type="image">🖼 ${t('handouts.type.image')}</button>
        <button class="ho-type" data-type="text">📝 ${t('handouts.type.text')}</button>
        <button class="ho-type" data-type="letter">✉️ ${t('handouts.type.letter')}</button>
      </div>
      <div class="ho-fields">
        <input id="ho-title" class="ho-input" type="text" placeholder="${t('handouts.title.ph')}" maxlength="120" />
        <input id="ho-desc" class="ho-input" type="text" placeholder="${t('handouts.desc.ph')}" maxlength="240" />
        <select id="ho-target" class="ho-input"><option value="">${t('handouts.target.all')}</option></select>
        <label class="ho-file" id="ho-file-wrap">
          <span id="ho-file-label">${t('handouts.file.choose')}</span>
          <input id="ho-file" type="file" accept="image/*" hidden />
        </label>
        <textarea id="ho-text" class="ho-input ho-textarea" placeholder="${t('handouts.content.ph')}" maxlength="8000" style="display:none"></textarea>
      </div>
      <div class="ho-actions">
        <button class="btn" id="ho-share">${t('handouts.share')}</button>
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
    `<option value="">${t('handouts.target.all')}</option>` +
    players
      .map((p) => `<option value="${p.id}">🎯 ${escapeHtml(p.display_name || p.email || t('common.player'))}</option>`)
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
      textArea.placeholder = type === 'letter' ? t('handouts.letter.ph') : t('handouts.content.ph');
    })
  );

  fileInput.addEventListener('change', () => {
    fileLabel.textContent = fileInput.files?.[0]?.name || t('handouts.file.choose');
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
        if (!file) throw new Error(t('handouts.err.noImage'));
        await uploadHandout(file, { title, description, target_player });
        fileInput.value = '';
        fileLabel.textContent = t('handouts.file.choose');
      } else {
        const text_content = textArea.value.trim();
        if (!text_content) throw new Error(t('handouts.err.empty'));
        await createHandout({ title, description, content_type: type, text_content, target_player });
        textArea.value = '';
      }
      container.querySelector('#ho-title').value = '';
      container.querySelector('#ho-desc').value = '';
    } catch (ex) {
      err.textContent = ex.message || t('handouts.err.share');
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
      isDM ? t('handouts.empty.dm') : t('handouts.empty.player')
    }</div>`;
    return;
  }

  el.innerHTML = list
    .map((h) => {
      const meta = TYPE_META[h.content_type] || TYPE_META.text;
      const when = new Date(h.pushed_at).toLocaleString(t('locale.bcp47'), {
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
          : `<div class="ho-img-loading">${t('handouts.img.loading')}</div>`;
      } else {
        body = `<div class="ho-text-body md ${h.content_type === 'letter' ? 'letter' : ''}">${renderMarkdown(h.text_content || '')}</div>`;
      }
      return `
        <article class="ho-card ${h.content_type}">
          <header class="ho-card-head">
            <span class="ho-type-icon" title="${t(meta.label)}">${meta.icon}</span>
            <div class="ho-card-titles">
              <h3>${escapeHtml(h.title)}</h3>
              ${h.description ? `<p>${escapeHtml(h.description)}</p>` : ''}
            </div>
            ${targetBadge}
            ${isDM && h.content_type === 'image' ? `<button class="ho-del" data-show="${h.id}" title="${t('handouts.show')}">👁</button>` : ''}
            ${isDM ? `<button class="ho-del" data-del="${h.id}" title="${t('common.delete')}">🗑</button>` : ''}
            <time class="ho-time">${when}</time>
          </header>
          ${body}
        </article>`;
    })
    .join('');

  if (isDM) {
    el.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (await modalConfirm(t('handouts.del.confirm'), { title: t('handouts.modalTitle'), danger: true, okLabel: t('common.delete') }))
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
