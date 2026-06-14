import { backend } from './backend.js';
import { cachedSignedUrl } from './signed-urls.js';
import { uploadMedia } from './media.js';
import { campaignId, loadSessionValue, saveSessionValue, sameCampaign } from './campaigns.js';
import { store } from '../state.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/**
 * Sons ponctuels (« soundboard » façon Foundry). Le MJ constitue sa planche de
 * sons (URL ou fichiers du bucket) — persistée dans `session_state['sfxboard']`
 * — et déclenche un son ponctuel diffusé à tous via un canal broadcast éphémère
 * (`sfx_rt`). Aucun contenu fourni : le MJ apporte ses propres sons.
 */

const KEY = 'sfxboard';
const BUCKET = 'battlemap';

let _ch = null;
let _el = null;
let _open = false;

async function resolveUrl(u) {
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  return cachedSignedUrl(BUCKET, u);
}

/** Joue un son ponctuel localement (non bouclé). */
async function playLocal(url, vol = 80) {
  const real = await resolveUrl(url);
  if (!real) return;
  const a = new Audio(real);
  a.volume = Math.max(0, Math.min(1, vol / 100));
  a.play().catch(() => {});
}

/** Déclenche un son pour tout le monde (broadcast) + lecture locale (MJ). */
export function playSfx(url, name) {
  playLocal(url);
  _ch?.send({ type: 'broadcast', event: 'play', payload: { url, name } });
  if (name) showToast(`🔊 ${name}`, { timeout: 1400 });
}

async function persistBoard(board) {
  store.set({ sfxboard: board });
  if (!store.get().isDM) return;
  await saveSessionValue(KEY, board);
}

function board() {
  return store.get().sfxboard || [];
}

function render() {
  if (!_el) return;
  _el.classList.toggle('open', _open);
  if (!_open) return;
  const pads = board();
  _el.innerHTML = `
    <div class="sfx-head">${t('sfx.title')}<button class="sfx-x" title="${t('common.close')}">✕</button></div>
    <div class="sfx-pads">
      ${
        pads.length
          ? pads
              .map(
                (p) => `<div class="sfx-pad" data-play="${p.id}" title="${escapeAttr(p.name)}">
                  <span class="sfx-pad-nm">${escapeHtml(p.name)}</span>
                  <button class="sfx-pad-x" data-del="${p.id}" title="${t('common.remove')}">×</button>
                </div>`
              )
              .join('')
          : `<div class="sfx-empty">${t('sfx.empty')}</div>`
      }
    </div>
    <div class="sfx-ctrls">
      <button data-add>${t('sfx.addUrl')}</button>
      <label class="sfx-up">${t('sfx.file')}<input type="file" accept="audio/*" hidden></label>
    </div>`;
  _el.querySelector('.sfx-x')?.addEventListener('click', () => setOpen(false));
  _el.querySelectorAll('[data-play]').forEach((pad) =>
    pad.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) return;
      const p = board().find((x) => x.id === pad.dataset.play);
      if (p) playSfx(p.url, p.name);
    })
  );
  _el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => persistBoard(board().filter((x) => x.id !== b.dataset.del)))
  );
  _el.querySelector('[data-add]')?.addEventListener('click', addByUrl);
  _el.querySelector('.sfx-up input')?.addEventListener('change', onUpload);
}

async function addByUrl() {
  const { modalPrompt } = await import('./modal.js');
  const url = await modalPrompt(t('sfx.url.prompt'), { title: t('sfx.add.title') });
  if (!url || !url.trim()) return;
  const name = await modalPrompt(t('sfx.name.prompt'), { title: t('sfx.add.title'), defaultValue: t('sfx.defaultName') });
  if (name === null) return;
  persistBoard([...board(), { id: `sfx_${crypto.randomUUID().slice(0, 8)}`, name: (name || t('sfx.defaultName')).trim(), url: url.trim() }]);
}

async function onUpload(e) {
  const file = e.target.files?.[0];
  if (!file || !store.get().isDM) return;
  e.target.value = '';
  try {
    const ext = (file.name.split('.').pop() || 'mp3').toLowerCase();
    const key = `audio/sfx_${Date.now()}.${ext}`;
    const ref = await uploadMedia(BUCKET, key, file, file.type || 'audio/mpeg');
    const name = file.name.replace(/\.[^.]+$/, '');
    persistBoard([...board(), { id: `sfx_${crypto.randomUUID().slice(0, 8)}`, name, url: ref }]);
  } catch (err) {
    const { modalAlert } = await import('./modal.js');
    await modalAlert(t('sfx.err.import') + err.message, { title: t('sfx.modalTitle') });
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

function setOpen(open) {
  _open = open;
  render();
}
export function toggleSfx() {
  setOpen(!_open);
}

export async function initSfx() {
  if (!_el) {
    _el = document.createElement('div');
    _el.className = 'sfx-panel';
    document.body.appendChild(_el);
  }
  const v = await loadSessionValue(KEY);
  if (Array.isArray(v)) store.set({ sfxboard: v });
  // Canal éphémère : les autres entendent le son (l'émetteur l'a déjà joué).
  _ch = backend.realtime.channel(`sfx_rt:${campaignId()}`, { config: { broadcast: { self: false } } });
  _ch.on('broadcast', { event: 'play' }, ({ payload }) => payload?.url && playLocal(payload.url)).subscribe();
  render();
  store.subscribe(() => {
    if (_open) render();
  });
  backend.realtime
    .channel('sfxboard_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` }, (p) => {
      if (!sameCampaign(p)) return;
      if (Array.isArray(p.new?.value)) store.set({ sfxboard: p.new.value });
    })
    .subscribe();
}
