import { backend } from './backend.js';
import { showToast } from './toast.js';

/**
 * Export / sauvegarde : télécharge un JSON de toutes les données accessibles
 * (RLS appliquée — le MJ récupère tout). Inclut fiches, compendium, scènes,
 * notes et handouts (métadonnées ; les images restent dans le Storage).
 */
const TABLES = ['characters', 'compendium', 'scenes', 'session_notes', 'handouts'];

export async function exportData() {
  const out = { app: 'mistkeep', exportedAt: new Date().toISOString() };
  for (const t of TABLES) {
    const { data, error } = await backend.db.from(t).select('*');
    out[t] = error ? [] : data;
  }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mistkeep-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Sauvegarde JSON téléchargée.', { type: 'success', icon: '💾' });
}
