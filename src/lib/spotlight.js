import { backend } from './backend.js';
import { cachedSignedUrl } from './signed-urls.js';
import { loadSessionValue, saveSessionValue, sameCampaign } from './campaigns.js';
import { store } from '../state.js';
import { escapeHtml } from './utils.js';

/**
 * « Montrer aux joueurs » : le MJ pousse une image (handout) en plein écran chez
 * tous. État partagé via session_state['spotlight'] = { path, name, on }.
 * Chaque client résout l'URL signée (bucket handouts). Le MJ ferme pour tous ;
 * un joueur peut masquer localement.
 */

const KEY = 'spotlight';
const BUCKET = 'handouts';

let overlay = null;
let channel = null;

async function resolve(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return cachedSignedUrl(BUCKET, path);
}

function hide() {
  overlay?.remove();
  overlay = null;
}

function show(url, name) {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'spotlight-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = `
    <img class="spotlight-img" src="${url}" alt="">
    ${name ? `<div class="spotlight-cap">${escapeHtml(name)}</div>` : ''}
    <button class="spotlight-close" title="Fermer">✕</button>`;
  overlay.querySelector('.spotlight-close').addEventListener('click', () => {
    if (store.get().isDM) hideSpotlight();
    else hide();
  });
}

async function apply(s) {
  if (!s || !s.on || !s.path) {
    hide();
    return;
  }
  const url = await resolve(s.path);
  if (url) show(url, s.name);
}

export async function initSpotlight() {
  apply(await loadSessionValue(KEY));
  channel = backend.realtime
    .channel('spotlight_feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${KEY}` }, (p) => sameCampaign(p) && apply(p.new?.value))
    .subscribe();
}

async function upsert(value) {
  await saveSessionValue(KEY, value);
}

/** Montre une image (chemin Storage handouts ou URL) à tous (MJ). */
export function showToPlayers(path, name) {
  if (!store.get().isDM) return;
  apply({ path, name, on: true }); // local immédiat
  upsert({ path, name, on: true });
}

export function hideSpotlight() {
  if (!store.get().isDM) return;
  hide();
  upsert({ on: false });
}
