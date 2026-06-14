import { store } from '../state.js';
import { t } from '../lib/i18n.js';
import { escapeHtml } from '../lib/utils.js';
import { modalConfirm, modalPrompt } from '../lib/modal.js';
import { renderMarkdown } from '../lib/markdown.js';
import {
  loadVault,
  saveNote,
  createNote,
  deleteNote,
} from './vault.js';

/**
 * UI du vault : arborescence à gauche, éditeur Markdown à droite avec bascule
 * Éditer / Aperçu (rendu Markdown sûr via markdown-it + DOMPurify).
 */

let unsub = null;
let previewMode = false;

export async function mountVault(container) {
  container.innerHTML = `
    <div style="display:flex;height:calc(100vh - 90px);border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <aside id="vault-tree" style="width:260px;min-width:260px;background:var(--bg1);border-right:1px solid var(--border);overflow-y:auto;padding:8px"></aside>
      <main id="vault-editor" style="flex:1;display:flex;flex-direction:column;background:var(--bg2);min-width:0"></main>
    </div>
  `;

  await loadVault();
  if (unsub) unsub();
  unsub = store.subscribe(() => {
    renderTree();
    renderEditor();
  });
  renderTree();
  renderEditor();

  return () => {
    if (unsub) unsub();
    unsub = null;
  };
}

function renderTree() {
  const el = document.getElementById('vault-tree');
  if (!el) return;
  const { fileTree, isDM, activeTab } = store.get();

  const actions = isDM
    ? `<button class="link" id="new-note" style="text-align:left;margin:0 0 8px">${t('vaultui.new')}</button>`
    : `<div style="color:var(--muted);font-size:11px;margin-bottom:8px">${t('vaultui.private')}</div>`;

  el.innerHTML = actions + (fileTree ? renderNode(fileTree, 0, activeTab) : '');

  el.querySelector('#new-note')?.addEventListener('click', async () => {
    const name = await modalPrompt(t('vaultui.new.prompt'), { title: t('vaultui.new.title'), placeholder: t('vaultui.new.ph') });
    if (!name || !name.trim()) return;
    const path = name.endsWith('.md') ? name : `${name}.md`;
    await createNote(path);
    openNote(path);
  });

  el.querySelectorAll('[data-open]').forEach((node) =>
    node.addEventListener('click', () => openNote(node.dataset.open))
  );
  el.querySelectorAll('[data-del]').forEach((node) =>
    node.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (await modalConfirm(t('vaultui.del.confirm', { name: node.dataset.del }), { title: t('vaultui.del.title'), danger: true, okLabel: t('common.delete') }))
        await deleteNote(node.dataset.del);
    })
  );
}

function renderNode(node, depth, activeTab) {
  let html = '';
  for (const child of node.children || []) {
    const pad = 4 + depth * 12;
    if (child.type === 'folder') {
      html += `<div style="padding:3px 6px;padding-left:${pad}px;color:var(--td);font-size:12px">📁 ${escapeHtml(child.name)}</div>`;
      html += renderNode(child, depth + 1, activeTab);
    } else {
      const on = activeTab === child.path;
      const name = child.name.replace(/\.md$/, '');
      html += `<div data-open="${escapeHtml(child.path)}" style="display:flex;align-items:center;gap:4px;padding:3px 6px;padding-left:${pad}px;cursor:pointer;font-size:12px;border-radius:4px;${on ? 'background:var(--bg4);color:var(--text)' : 'color:var(--td)'}">
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${escapeHtml(name)}</span>
        ${store.get().isDM ? `<span data-del="${escapeHtml(child.path)}" title="${t('common.delete')}" style="color:var(--muted);font-size:13px">×</span>` : ''}
      </div>`;
    }
  }
  return html;
}

function openNote(path) {
  store.set({ activeTab: path });
}

function renderEditor() {
  const el = document.getElementById('vault-editor');
  if (!el) return;
  const { activeTab, vaultFiles, isDM } = store.get();

  if (!activeTab) {
    el.innerHTML = `<div style="margin:auto;color:var(--muted);font-size:13px">${t('vaultui.pick')}</div>`;
    return;
  }

  const content = vaultFiles[activeTab] ?? '';
  // Ne re-render que si la note ou le mode change (évite de perdre le curseur).
  const key = `${activeTab}|${previewMode}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;

  el.innerHTML = `
    <div class="vault-head">
      <span class="vault-path">${escapeHtml(activeTab)}</span>
      <button class="vault-toggle" id="vault-toggle">${previewMode ? t('vaultui.edit') : t('vaultui.preview')}</button>
    </div>
    ${
      previewMode
        ? `<div class="vault-preview md">${renderMarkdown(content)}</div>`
        : `<textarea id="md" ${isDM ? '' : 'readonly'} class="vault-editor-area">${escapeHtml(content)}</textarea>`
    }
  `;

  el.querySelector('#vault-toggle')?.addEventListener('click', () => {
    previewMode = !previewMode;
    renderEditor();
  });

  const ta = el.querySelector('#md');
  if (ta && isDM) {
    ta.addEventListener('input', () => saveNote(activeTab, ta.value));
  }
}
