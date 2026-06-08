import { store } from '../state.js';
import { modalAlert, modalConfirm } from '../lib/modal.js';
import { showToast } from '../lib/toast.js';
import { loadImageBank, addBankImages, removeBankImage } from './imagebank.js';
import { uploadTokenAsset, signedTokenUrl, addToken, setBackgroundFromPath } from './map.js';

/**
 * Banque d'images (MJ) : bibliothèque réutilisable. Importe des images, les
 * affiche en vignettes, et permet de les glisser sur la carte (jeton), de les
 * définir comme fond de scène, ou d'en copier le chemin pour le compendium.
 */

export async function mountImageBank(container) {
  if (!store.get().isDM) {
    container.innerHTML = `<div class="cmp-placeholder">Réservé au MJ.</div>`;
    return () => {};
  }
  container.innerHTML = `
    <div class="bank-wrap">
      <header class="bank-head">
        <div class="camp2-title">🖼 Banque d'images</div>
        <label class="btn bank-import" title="Importer des images">📂 Importer
          <input type="file" id="bank-file" accept="image/*" multiple hidden>
        </label>
        <span class="bank-count" id="bank-count"></span>
      </header>
      <p class="bank-hint">Images réutilisables pour les jetons, les fonds de carte et le compendium. Glisse une vignette sur la carte pour en faire un jeton.</p>
      <div class="bank-grid" id="bank-grid"></div>
    </div>`;

  container.querySelector('#bank-file').addEventListener('change', async (e) => {
    const files = [...(e.target.files || [])].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    showToast(`Import de ${files.length} image(s)…`, { timeout: 1500 });
    const paths = [];
    for (const f of files) {
      try {
        const p = await uploadTokenAsset(f);
        if (p) paths.push(p);
      } catch (ex) {
        await modalAlert('Import impossible : ' + ex.message, { title: 'Banque' });
      }
    }
    addBankImages(paths);
  });

  await loadImageBank();
  const unsub = store.subscribe(() => render(container));
  render(container);
  return () => unsub();
}

function render(container) {
  const grid = container.querySelector('#bank-grid');
  const count = container.querySelector('#bank-count');
  if (!grid) return;
  const imgs = store.get().imagebank || [];
  if (count) count.textContent = imgs.length ? `${imgs.length} image(s)` : '';
  if (!imgs.length) {
    grid.innerHTML = `<div class="cmp-placeholder">Aucune image. Clique sur « 📂 Importer ».</div>`;
    return;
  }
  grid.innerHTML = imgs
    .map(
      (p) => `<div class="bank-cell" data-path="${encodeURIComponent(p)}" draggable="true" title="Glisser sur la carte = jeton">
        <span class="bank-thumb" data-thumb="${encodeURIComponent(p)}"></span>
        <div class="bank-acts">
          <button class="bank-act" data-bg title="Définir comme fond de la scène active">🗺</button>
          <button class="bank-act" data-tok title="Ajouter comme jeton (scène active)">🎭</button>
          <button class="bank-act" data-copy title="Copier le chemin">📋</button>
          <button class="bank-act danger" data-del title="Supprimer de la banque">🗑</button>
        </div>
      </div>`
    )
    .join('');

  // Vignettes (URL signées résolues à la demande).
  grid.querySelectorAll('[data-thumb]').forEach((el) => {
    const path = decodeURIComponent(el.dataset.thumb);
    signedTokenUrl(path).then((u) => {
      if (u) el.style.backgroundImage = `url('${u}')`;
    });
  });

  grid.querySelectorAll('.bank-cell').forEach((cell) => {
    const path = decodeURIComponent(cell.dataset.path);
    cell.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('application/x-vaultmj-image', path);
      ev.dataTransfer.effectAllowed = 'copy';
    });
    cell.querySelector('[data-bg]').addEventListener('click', async () => {
      await setBackgroundFromPath(path);
      showToast('🗺 Fond de scène défini.', { timeout: 1800 });
    });
    cell.querySelector('[data-tok]').addEventListener('click', () => {
      const m = store.get().map;
      const cx = Math.round((m?.bgW || 1600) / 2 + (Math.random() * 120 - 60));
      const cy = Math.round((m?.bgH || 1000) / 2 + (Math.random() * 120 - 60));
      addToken({ x: cx, y: cy, label: '', img: path });
      showToast('🎭 Jeton ajouté à la scène active.', { timeout: 1800 });
    });
    cell.querySelector('[data-copy]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(path);
        showToast('📋 Chemin copié.', { timeout: 1500 });
      } catch {
        await modalAlert(path, { title: 'Chemin de l’image' });
      }
    });
    cell.querySelector('[data-del]').addEventListener('click', async () => {
      if (await modalConfirm('Retirer cette image de la banque ? (le fichier reste dans le stockage)', { title: 'Banque', danger: true, okLabel: 'Retirer' }))
        removeBankImage(path);
    });
  });
}
