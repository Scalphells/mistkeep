import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalAlert } from '../lib/modal.js';
import { addLayer, updateLayer, removeLayer, uploadAmbience, getMasterVol, setMasterVol } from '../lib/ambience.js';

/**
 * Contrôle MJ de l'ambiance audio MULTI-PISTES : empile plusieurs sons (ambiance
 * + cris + pluie…), chacun avec volume %, boucle et lecture indépendants. Le
 * volume maître est local (chaque appareil), réglable aussi par les joueurs.
 */

export function mountAmbience(container) {
  container.innerHTML = `
    <div class="amb-wrap">
      <div class="amb-master">
        🔊 Volume maître (local) <input id="amb-master" type="range" min="0" max="100" step="1">
        <span id="amb-master-v" class="amb-master-v"></span>
      </div>
      <div class="amb-controls">
        <input id="amb-url" class="amb-url" type="text" placeholder="URL audio (mp3/ogg)" autocomplete="off" />
        <input id="amb-name" class="amb-name" type="text" placeholder="Nom (optionnel)" autocomplete="off" />
        <button class="btn" id="amb-add">➕ Ajouter la piste</button>
        <label class="amb-file btn-like" title="Importer un fichier audio">📂 Importer<input id="amb-file" type="file" accept="audio/*" hidden></label>
      </div>
      <div class="amb-err" id="amb-err"></div>
      <div class="amb-layers" id="amb-layers"></div>
      <p class="amb-hint">Empile plusieurs sons en boucle (ex. forêt + pluie + cris lointains). Accepte les fichiers/URL .mp3/.ogg <strong>et les liens YouTube</strong> (lecteur caché). Chaque joueur règle son propre volume maître. À la première écoute, un bouton « Activer le son » peut apparaître (politique navigateur).</p>
    </div>
  `;

  const err = container.querySelector('#amb-err');
  const urlInput = container.querySelector('#amb-url');
  const nameInput = container.querySelector('#amb-name');

  container.querySelector('#amb-add').addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) return;
    err.textContent = '';
    addLayer({ url, name: nameInput.value.trim() });
    urlInput.value = '';
    nameInput.value = '';
  });
  container.querySelector('#amb-file').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    err.textContent = '';
    try {
      await uploadAmbience(f);
    } catch (ex) {
      await modalAlert('Import audio impossible : ' + ex.message, { title: 'Ambiance' });
    }
    e.target.value = '';
  });
  container.querySelector('#amb-master').addEventListener('input', (e) => {
    setMasterVol(Number(e.target.value) || 0);
    container.querySelector('#amb-master-v').textContent = `${getMasterVol()} %`;
  });

  function render() {
    const list = container.querySelector('#amb-layers');
    const mv = container.querySelector('#amb-master');
    const mvv = container.querySelector('#amb-master-v');
    if (mv && document.activeElement !== mv) mv.value = getMasterVol();
    if (mvv) mvv.textContent = `${getMasterVol()} %`;
    if (!list) return;
    const layers = store.get().ambience?.layers || [];
    if (!layers.length) {
      list.innerHTML = `<div class="amb-empty">Aucune piste. Ajoute une URL ou importe un fichier.</div>`;
      return;
    }
    // On ne reconstruit pas si un curseur de volume est en cours de réglage.
    if (list.contains(document.activeElement) && document.activeElement.type === 'range') return;
    list.innerHTML = layers
      .map(
        (l) => `
        <div class="amb-layer ${l.playing ? 'on' : ''}" data-l="${l.id}">
          <button class="amb-lbtn" data-toggle="${l.id}" title="${l.playing ? 'Pause' : 'Lecture'}">${l.playing ? '⏸' : '▶'}</button>
          <span class="amb-lname" title="${escapeHtml(l.name || '')}">${escapeHtml(l.name || 'Piste')}</span>
          <button class="amb-lbtn ${l.loop !== false ? 'active' : ''}" data-loop="${l.id}" title="Boucle">🔁</button>
          <input class="amb-lvol" type="range" min="0" max="100" step="1" value="${l.vol ?? 60}" data-vol="${l.id}" title="Volume ${l.vol ?? 60}%">
          <span class="amb-lvolv">${l.vol ?? 60}%</span>
          <button class="amb-lbtn danger" data-del="${l.id}" title="Retirer">🗑</button>
        </div>`
      )
      .join('');
    list.querySelectorAll('[data-toggle]').forEach((b) =>
      b.addEventListener('click', () => {
        const l = layers.find((x) => x.id === b.dataset.toggle);
        updateLayer(b.dataset.toggle, { playing: !l?.playing });
      })
    );
    list.querySelectorAll('[data-loop]').forEach((b) =>
      b.addEventListener('click', () => {
        const l = layers.find((x) => x.id === b.dataset.loop);
        updateLayer(b.dataset.loop, { loop: !(l?.loop !== false) });
      })
    );
    list.querySelectorAll('[data-vol]').forEach((inp) =>
      inp.addEventListener('input', () => {
        inp.nextElementSibling.textContent = `${inp.value}%`;
        updateLayer(inp.dataset.vol, { vol: Number(inp.value) || 0 });
      })
    );
    list.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => removeLayer(b.dataset.del))
    );
  }

  const unsub = store.subscribe(render);
  render();
  return () => unsub();
}
