import { backend } from '../lib/backend.js';
import { campaignId, scopedUpsert } from '../lib/campaigns.js';
import { store } from '../state.js';
import { debounce } from '../lib/utils.js';
import { showToast } from '../lib/toast.js';
import { t as tr } from '../lib/i18n.js';

/**
 * Vault privé du MJ.
 *
 * Source de vérité : table `vault_notes` (RLS : MJ uniquement).
 * Cache offline : localStorage (lecture instantanée + repli hors-ligne).
 * Écritures : debounced + granulaires (une note à la fois), jamais de
 * réécriture massive comme dans l'ancien `persist()`.
 */

const LS_KEY = 'vmj_vault_cache_v5';
const pendingSaves = new Map(); // path -> debounced fn

/* ── Cache local ──────────────────────────────────────────── */

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(files) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(files));
  } catch (e) {
    // Quota dépassé : le vault reste en DB, on n'échoue pas l'app.
    // eslint-disable-next-line no-console
    console.warn('[vault] cache localStorage plein:', e.message);
  }
}

/* ── Chargement ───────────────────────────────────────────── */

/**
 * Charge le vault : affiche d'abord le cache (rapide), puis remplace
 * par les données serveur dès qu'elles arrivent.
 */
export async function loadVault() {
  // 1. Cache immédiat
  const cached = readCache();
  if (Object.keys(cached).length) {
    store.set({ vaultFiles: cached, fileTree: buildTree(cached) });
  }

  // 2. Serveur (MJ uniquement — RLS bloque les joueurs)
  if (!store.get().isDM) return;

  const { data, error } = await backend.db
    .from('vault_notes')
    .select('path, content')
    .eq('campaign_id', campaignId());

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[vault] chargement serveur impossible:', error.message);
    return;
  }

  const files = {};
  for (const row of data) files[row.path] = row.content;
  writeCache(files);
  store.set({ vaultFiles: files, fileTree: buildTree(files) });
}

/* ── Écriture ─────────────────────────────────────────────── */

/** Programme une sauvegarde debounced d'une note précise. */
export function saveNote(path, content) {
  const files = { ...store.get().vaultFiles, [path]: content };
  writeCache(files);
  store.set({ vaultFiles: files });

  if (!store.get().isDM) return; // un joueur n'écrit jamais le vault

  if (!pendingSaves.has(path)) {
    pendingSaves.set(
      path,
      debounce(async (p, c) => {
        const { error } = await scopedUpsert('vault_notes', 'path', {
          path: p,
          content: c,
          updated_at: new Date().toISOString(),
          updated_by: store.get().user?.id ?? null,
        });
        if (error) {
          console.error('[vault] save échouée:', error.message);
          showToast(tr('vault.err.save'), { type: 'warn', icon: '⚠️' });
        }
      }, 1200)
    );
  }
  pendingSaves.get(path)(path, content);
}

/** Crée une note vide. */
export async function createNote(path) {
  const initial = `# ${path.split('/').pop().replace(/\.md$/, '')}\n\n`;
  saveNote(path, initial);
  store.set({ fileTree: buildTree(store.get().vaultFiles) });
  return path;
}

/** Renomme une note (déplace path + contenu). */
export async function renameNote(oldPath, newPath) {
  const files = { ...store.get().vaultFiles };
  if (files[newPath] !== undefined) throw new Error(tr('vault.err.dupName'));
  files[newPath] = files[oldPath];
  delete files[oldPath];
  writeCache(files);
  store.set({ vaultFiles: files, fileTree: buildTree(files) });

  if (!store.get().isDM) return;
  // Insère la nouvelle, supprime l'ancienne.
  await scopedUpsert('vault_notes', 'path', {
    path: newPath,
    content: files[newPath],
    updated_by: store.get().user?.id ?? null,
  });
  await backend.db.from('vault_notes').delete().eq('campaign_id', campaignId()).eq('path', oldPath);
}

/** Supprime une note. */
export async function deleteNote(path) {
  const files = { ...store.get().vaultFiles };
  delete files[path];
  writeCache(files);
  store.set({ vaultFiles: files, fileTree: buildTree(files) });

  if (!store.get().isDM) return;
  const { error } = await backend.db.from('vault_notes').delete().eq('campaign_id', campaignId()).eq('path', path);
  if (error) {
    console.error('[vault] suppression échouée:', error.message);
    showToast(tr('vault.err.del'), { type: 'warn', icon: '⚠️' });
  }
}

/* ── Arborescence ─────────────────────────────────────────── */

/** Construit un arbre de dossiers/fichiers à partir des chemins plats. */
export function buildTree(files) {
  const root = { name: '__root__', type: 'folder', path: '', children: [] };
  for (const path of Object.keys(files).sort()) {
    const parts = path.split('/');
    let node = root;
    let acc = '';
    parts.forEach((part, i) => {
      acc = acc ? `${acc}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      if (isLeaf) {
        node.children.push({ name: part, type: 'file', path });
      } else {
        let child = node.children.find((c) => c.type === 'folder' && c.name === part);
        if (!child) {
          child = { name: part, type: 'folder', path: acc, children: [] };
          node.children.push(child);
        }
        node = child;
      }
    });
  }
  sortTree(root);
  return root;
}

function sortTree(node) {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  node.children.forEach(sortTree);
}
