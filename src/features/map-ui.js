import { store } from '../state.js';
import { escapeHtml, safeColor } from '../lib/utils.js';
import { templateSvg, templateLabel } from '../lib/tmplgeom.js';
import { modalAlert, modalConfirm, modalPrompt } from '../lib/modal.js';
import { showToast } from '../lib/toast.js';
import { loadCharacters, updateCharacter, saveBonus } from './characters.js';
import { loadInitiative, subscribeInitiative, adjustHp, toggleCondition, logCombat, addCombatant, sendPlayerRequest } from './initiative.js';
import { rollDice } from './dice.js';
import { condIcon } from '../lib/conditions.js';
import { openAttackResolver } from '../lib/attack.js';
import { openActionCard } from '../lib/actioncard.js';
import {
  DEFAULT_MAP,
  loadMap,
  patchMap,
  uploadBackground,
  bgUrl,
  addToken,
  addTokensFromParty,
  moveToken,
  updateToken,
  removeToken,
  addTile,
  updateTile,
  removeTile,
  setFog,
  paintFog,
  revealAll,
  hideAll,
  setLighting,
  setTokenVision,
  addWall,
  toggleDoor,
  updateWallAt,
  removeWallAt,
  removeLastWall,
  clearWalls,
  accumulateExplored,
  clearExplored,
  addLight,
  updateLight,
  removeLight,
  clearLights,
  uploadTokenImage,
  uploadTokenAsset,
  signedTokenUrl,
  uploadLibraryImage,
  removeLibraryImage,
  createScene,
  switchScene,
  renameScene,
  deleteScene,
  exportActiveScene,
  importSceneState,
  addPin,
  updatePin,
  removePin,
  addDrawing,
  removeLastDrawing,
  clearDrawings,
  addLabel,
  updateLabel,
  removeLabel,
  tokenImgUrl,
  resolveTokenUrls,
  subscribeMap,
  subscribeMapBroadcast,
  sendPing,
  sendTokenMove,
  sendView,
  sendDraw,
  sendCursor,
  sendTemplate,
  reloadActiveScene,
  applyTokenMoveLocal,
} from './map.js';
import { colorFor } from '../lib/profile.js';

/**
 * Carte de combat : fond + grille, jetons déplaçables (MJ), brouillard de
 * guerre, règle de distance et pings. Pan/zoom local à chaque utilisateur.
 *
 * Tout est rendu dans une « scène » à l'échelle de l'image native ; un
 * transform CSS (translate + scale) gère le pan/zoom sans redessiner.
 */

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;

// Vue (pan/zoom) mémorisée par scène, conservée entre les changements d'onglet.
const mapViews = {};

// États 5e affichables sur les jetons (clé -> { icône, libellé }).
const CONDITIONS = {
  blinded: { icon: '🙈', label: 'Aveuglé' },
  charmed: { icon: '💗', label: 'Charmé' },
  deafened: { icon: '🔇', label: 'Assourdi' },
  frightened: { icon: '😱', label: 'Effrayé' },
  grappled: { icon: '✊', label: 'Agrippé' },
  incapacitated: { icon: '💫', label: 'Neutralisé' },
  invisible: { icon: '👻', label: 'Invisible' },
  paralyzed: { icon: '🥶', label: 'Paralysé' },
  petrified: { icon: '🗿', label: 'Pétrifié' },
  poisoned: { icon: '🤢', label: 'Empoisonné' },
  prone: { icon: '🛌', label: 'À terre' },
  restrained: { icon: '⛓', label: 'Entravé' },
  stunned: { icon: '😵', label: 'Étourdi' },
  unconscious: { icon: '💤', label: 'Inconscient' },
  concentration: { icon: '🧠', label: 'Concentration' },
};

/* Barre d'outils repliable : chaque groupe gagne un en-tête cliquable qui
 * masque/affiche ses contrôles. État mémorisé par appareil ; tout est replié par
 * défaut sauf le groupe « Outils ». */
const TOOLBAR_KEY = 'vaultmj_toolbar_collapsed';
function setupCollapsibleToolbar(container) {
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(TOOLBAR_KEY)) || {};
  } catch {
    /* no-op */
  }
  const groups = container.querySelectorAll('.map-tool-group[data-label]');
  groups.forEach((g, i) => {
    if (g.querySelector(':scope > .mtg-toggle')) return; // déjà traité
    const label = g.dataset.label;
    g.classList.add('has-toggle');
    const collapsed = label in state ? state[label] : i !== 0; // déplie « Outils »
    g.classList.toggle('collapsed', collapsed);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mtg-toggle';
    const paint = () => {
      btn.innerHTML = `<span class="mtg-caret">${g.classList.contains('collapsed') ? '▸' : '▾'}</span>${escapeHtml(label)}`;
    };
    paint();
    btn.addEventListener('click', () => {
      g.classList.toggle('collapsed');
      state[label] = g.classList.contains('collapsed');
      try {
        localStorage.setItem(TOOLBAR_KEY, JSON.stringify(state));
      } catch {
        /* no-op */
      }
      paint();
    });
    g.insertBefore(btn, g.firstChild);
  });
}

export async function mountMap(container) {
  const isDM = store.get().isDM;

  // Jeu en pause : les joueurs ne peuvent plus interagir avec la carte (le MJ,
  // lui, conserve la main pour préparer/placer pendant la pause).
  const playerLocked = () => !isDM && store.get().paused;

  // État de vue local (non synchronisé).
  const view = { px: 40, py: 40, z: 0.5 };
  let tool = 'move'; // move | ruler | ping | reveal | hide
  let dragging = null; // { type:'pan'|'token'|'ruler'|'fog', ... }
  let suppressRender = false;
  let fogMode = 'cell'; // cell (pinceau) | rect (rectangle)
  let fogPreview = null; // { a, b, reveal } pendant un drag rectangle
  let wallPreview = null; // { a, b } pendant le tracé d'un mur
  let lightPreview = null; // { x, y, r } pendant la pose d'une lumière
  let lastVisible = null; // dernier ensemble de cases vues (pour la mémoire)
  let selectedIds = new Set(); // jetons sélectionnés (outil Sélection, MJ)
  let targetIds = new Set(); // cibles courantes pour la résolution d'attaque (MJ)
  let selPreview = null; // { a, b } cadre de sélection en cours
  // Calques : visibilité locale par couche (MJ, non persisté).
  const layers = { grid: true, tokens: true, walls: true, lights: true, fog: true, draw: true, tiles: true };
  let drawShape = 'free'; // free | rect | circle | arrow | text
  let drawColor = '#e06c75';
  const drawWidth = 4;
  let drawPreview = null; // dessin en cours (aperçu)
  let ephemeralDraws = []; // dessins éphémères (joueurs, diffusés ~6 s)
  let tmplShape = 'circle'; // circle | cone | line
  let tmplDistFt = 0; // distance fixe du gabarit (rayon/longueur), en unités de carte ; 0 = libre
  let template = null; // { shape, a, b, fixed } gabarit de sort affiché (local)
  let tmplHits = new Set(); // jetons couverts par le gabarit courant (surbrillance)
  let _lastTmplSend = 0; // throttle de diffusion du gabarit
  const remoteTemplates = new Map(); // by -> { shape, a, b, color, name, t } (autres joueurs)
  let selectedTile = null; // décor sélectionné (outil Décor)
  let tileDrag = null; // déplacement d'un décor en cours
  let movePreview = null; // { gs, cells:[{cx,cy}], end } trajet d'un jeton en cours de déplacement
  let rulerPts = []; // waypoints de la règle (clics successifs), en px image
  let wallChain = []; // points du mur en cours de tracé (chaînage par clics)
  let _dragRaf = 0; // rAF d'aperçu de déplacement (vision live + trajet)

  container.innerHTML = `
    <div class="map-root">
      <div class="map-toolbar" id="map-tools">
        <div class="map-tool-group" data-label="Navigation">
          <button class="map-tool active" data-tool="move" title="Déplacer">✋</button>
          <button class="map-tool" data-tool="ruler" title="Mesurer (clic = étape, double-clic / clic droit = fin)">📏</button>
          ${isDM ? `<button class="map-tool" data-tool="select" title="Sélection multiple (glisser un cadre ; Suppr = supprimer)">⬚</button>` : ''}
        </div>
        <div class="map-tool-group" data-label="Marqueurs">
          <button class="map-tool" data-tool="ping" title="Ping (clic)">📍</button>
          <button class="map-tool" data-tool="pin" title="Marqueur / note (clic pour poser)">📌</button>
          ${isDM ? `<button class="map-tool" data-tool="label" title="Étiquette de zone (clic pour poser un libellé)">🏷</button>` : ''}
        </div>
        <div class="map-tool-group" data-label="Gabarit de sort">
          <button class="map-tool" data-tool="tmpl" title="Gabarit de sort (glisser depuis l'origine)">🎯</button>
          <select id="map-tmpl-shape" class="map-sel" title="Forme du gabarit">
            <option value="circle">● Cercle</option>
            <option value="cone">▲ Cône</option>
            <option value="line">▬ Ligne</option>
          </select>
          <label class="map-num" title="Distance du gabarit (rayon/longueur) — vide = libre au glisser">Dist.<input type="number" id="map-tmpl-dist" min="0" step="5" placeholder="∞"></label>
          ${isDM ? `<button class="map-btn" data-act="zone-save" title="Sauvegarde de zone : pose un gabarit puis résous les jets">💥</button>` : ''}
        </div>
        <div class="map-tool-group" data-label="Vue">
          <button class="map-btn" data-act="zoom-out" title="Dézoomer">－</button>
          <span class="map-zoom" id="map-zoom">50%</span>
          <button class="map-btn" data-act="zoom-in" title="Zoomer">＋</button>
          <button class="map-btn" data-act="fit" title="Ajuster">⤢</button>
          <button class="map-btn" data-act="immersive" title="Plein écran immersif">⛶</button>
          ${isDM ? `<button class="map-btn" data-act="push-view" title="Recadrer la vue de tous les joueurs ici">👁</button>` : ''}
        </div>
        <div class="map-tool-group" data-label="Dessin">
          <button class="map-tool" data-tool="draw" title="Dessiner / annoter${isDM ? '' : ' (éphémère)'}">✏</button>
          <select id="map-draw-shape" class="map-sel" title="Forme de dessin">
            <option value="free">✎ Libre</option>
            <option value="rect">▭ Rectangle</option>
            <option value="circle">○ Cercle</option>
            <option value="arrow">➤ Flèche</option>
            ${isDM ? '<option value="text">🅣 Texte</option>' : ''}
          </select>
          <input type="color" id="map-draw-color" class="map-color" value="#e06c75" title="Couleur de dessin">
          ${isDM ? `<button class="map-btn" data-act="draw-undo" title="Annuler le dernier dessin">↶✏</button>
                    <button class="map-btn" data-act="draw-clear" title="Effacer tous les dessins">🧹✏</button>` : ''}
        </div>
        ${
          isDM
            ? `<div class="map-tool-group" data-label="Scène active">
                 <select id="map-scene-sel" class="map-sel" title="Scène active (la sélectionner la rend visible aux joueurs)"></select>
                 <button class="map-btn" data-act="scene-new" title="Nouvelle scène">➕🗺</button>
                 <button class="map-btn" data-act="scene-rename" title="Renommer la scène">✏</button>
                 <button class="map-btn" data-act="scene-del" title="Supprimer la scène">🗑</button>
                 <button class="map-btn" data-act="scene-export" title="Exporter la scène (JSON)">⬆</button>
                 <label class="map-btn" title="Importer une scène (JSON)">⬇<input type="file" id="map-scene-file" accept="application/json,.json" hidden></label>
               </div>
               <div class="map-tool-group" data-label="Jetons &amp; décor">
                 <label class="map-btn" title="Importer un fond">🖼<input type="file" id="map-file" accept="image/*" hidden></label>
                 <button class="map-btn" data-act="add-token" title="Ajouter un jeton">➕</button>
                 <button class="map-btn" data-act="add-prop" title="Ajouter un décor (image posée sur la carte)">🪟➕</button>
                 <button class="map-tool" data-tool="tile" title="Décor : déplacer / éditer les props (double-clic = options, clic droit = options)">🪟</button>
                 <button class="map-btn" data-act="party" title="Importer les PJ">🛡</button>
                 <button class="map-btn" data-act="token-lib" title="Bibliothèque d'images de jetons">🖼</button>
               </div>
               <div class="map-tool-group" data-label="Grille">
                 <button class="map-btn" data-act="grid" title="Grille">▦</button>
                 <button class="map-btn" data-act="grid-cal" title="Caler la grille (taille + décalage)">📐</button>
                 <label class="map-num" title="Taille de case (px)">Case<input type="number" id="map-grid" min="10" max="400" step="2"></label>
                 <label class="map-num" title="Opacité de la grille">Opac<input type="range" id="map-gridop" min="0" max="60" step="2"></label>
                 <label class="map-num" title="Distance par case">Dist<input type="number" id="map-feet" min="1" max="100"></label>
                 <select id="map-unit" class="map-sel" title="Unité"><option value="ft">ft</option><option value="m">m</option></select>
               </div>
               <div class="map-tool-group" data-label="Brouillard">
                 <button class="map-tool" data-tool="reveal" title="Révéler le brouillard (pinceau)">🔦</button>
                 <button class="map-tool" data-tool="hide" title="Masquer (brouillard, pinceau)">🌑</button>
                 <button class="map-btn" data-act="fog" title="Activer/désactiver le brouillard">🌫</button>
                 <button class="map-btn" data-act="fog-mode" id="map-fogmode" title="Pinceau (clic) ↔ Rectangle (glisser)">▣</button>
                 <button class="map-btn" data-act="reveal-all" title="Tout révéler">☀</button>
                 <button class="map-btn" data-act="hide-all" title="Tout masquer">🕳</button>
               </div>
               <div class="map-tool-group" data-label="Murs &amp; lumière">
                 <button class="map-tool" data-tool="wall" title="Murs : clic = point, enchaîne les segments, double-clic / clic droit = fin">🧱</button>
                 <button class="map-tool" data-tool="door" title="Porte : glisser = créer, clic = ouvrir/fermer">🚪</button>
                 <button class="map-tool" data-tool="light" title="Lumière : glisser = rayon, clic = poser/retirer">🕯</button>
                 <button class="map-btn" data-act="lighting" id="map-lighting" title="Lumière dynamique (vision + murs)">💡</button>
                 <button class="map-btn" data-act="wall-undo" title="Annuler le dernier mur">↶🧱</button>
                 <button class="map-btn" data-act="wall-clear" title="Effacer tous les murs">🧹🧱</button>
                 <button class="map-btn" data-act="light-clear" title="Effacer toutes les lumières">🧹🕯</button>
                 <button class="map-btn" data-act="explored-clear" title="Réinitialiser la mémoire d'exploration">🌑👁</button>
               </div>
               <div class="map-tool-group" data-label="Ambiance">
                 <label class="map-num" title="Obscurité (jour → nuit)">🌙<input type="range" id="map-dark" min="0" max="100" step="5"></label>
                 <select id="map-weather-sel" class="map-sel" title="Météo">
                   <option value="none">☀ Clair</option>
                   <option value="rain">🌧 Pluie</option>
                   <option value="snow">❄ Neige</option>
                   <option value="fog">🌫 Brume</option>
                 </select>
                 <button class="map-btn" data-act="soundscape" id="map-soundscape" title="Lier l'ambiance sonore à cette scène : mémorise les pistes en cours de lecture ; elles se relanceront à l'activation de la scène">🔊</button>
               </div>
               <div class="map-tool-group" data-label="Calques">
                 <button class="map-btn layer-btn active" data-layer="grid" title="Calque grille">▦</button>
                 <button class="map-btn layer-btn active" data-layer="tokens" title="Calque jetons">🎭</button>
                 <button class="map-btn layer-btn active" data-layer="tiles" title="Calque décors">🪟</button>
                 <button class="map-btn layer-btn active" data-layer="walls" title="Calque murs/portes">🧱</button>
                 <button class="map-btn layer-btn active" data-layer="lights" title="Calque lumières">🕯</button>
                 <button class="map-btn layer-btn active" data-layer="fog" title="Calque brouillard">🌫</button>
                 <button class="map-btn layer-btn active" data-layer="draw" title="Calque dessins">✏</button>
               </div>`
            : ''
        }
      </div>
      ${isDM ? '<div class="scene-nav" id="scene-nav"></div>' : ''}
      <div class="map-viewport" id="map-vp">
        <div class="map-scene" id="map-scene">
          <img class="map-bg" id="map-bg" alt="" draggable="false" />
          <canvas class="map-fog" id="map-fog"></canvas>
          <div class="map-atmo" id="map-atmo"></div>
          <div class="map-tokens" id="map-tokens"></div>
          <div class="map-doors" id="map-doors"></div>
          <div class="map-labels" id="map-labels"></div>
          <div class="map-pinsmark" id="map-pinsmark"></div>
          <svg class="map-draw" id="map-draw"></svg>
          <svg class="map-ruler" id="map-ruler"></svg>
          <svg class="map-tmpl" id="map-tmpl"></svg>
          <div class="map-weather" id="map-weather"></div>
          <div class="map-pings" id="map-pings"></div>
        </div>
        <div class="map-hud" id="map-hud"></div>
        <div class="map-empty" id="map-empty"></div>
      </div>
    </div>
  `;

  setupCollapsibleToolbar(container);
  const vp = container.querySelector('#map-vp');
  const scene = container.querySelector('#map-scene');
  const bgImg = container.querySelector('#map-bg');
  const fogCanvas = container.querySelector('#map-fog');
  const tokensEl = container.querySelector('#map-tokens');
  const doorsEl = container.querySelector('#map-doors');
  const labelsEl = container.querySelector('#map-labels');
  const pinsMark = container.querySelector('#map-pinsmark');
  const rulerEl = container.querySelector('#map-ruler');
  const tmplEl = container.querySelector('#map-tmpl');
  const drawEl = container.querySelector('#map-draw');
  const atmoEl = container.querySelector('#map-atmo');
  const weatherEl = container.querySelector('#map-weather');
  const pingsEl = container.querySelector('#map-pings');
  const hud = container.querySelector('#map-hud');
  const emptyEl = container.querySelector('#map-empty');
  const zoomLabel = container.querySelector('#map-zoom');
  const ctx = fogCanvas.getContext('2d');

  // Décors (props) : une couche sous les jetons (mobilier) + une au-dessus (toits).
  const tilesBelowEl = document.createElement('div');
  tilesBelowEl.className = 'map-tiles below';
  scene.insertBefore(tilesBelowEl, fogCanvas);
  const tilesAboveEl = document.createElement('div');
  tilesAboveEl.className = 'map-tiles above';
  scene.insertBefore(tilesAboveEl, doorsEl);

  // Couche des halos de lumière colorés (sous les jetons, au-dessus du brouillard).
  const glowEl = document.createElement('div');
  glowEl.className = 'map-glows';
  scene.insertBefore(glowEl, tokensEl);

  // Couche des gabarits des autres joueurs (temps réel, colorés par joueur).
  const remoteTmplEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  remoteTmplEl.setAttribute('class', 'map-tmpl');
  scene.appendChild(remoteTmplEl);

  // Couche des curseurs des autres utilisateurs (temps réel).
  const cursorsEl = document.createElement('div');
  cursorsEl.className = 'map-cursors';
  scene.appendChild(cursorsEl);
  const cursors = new Map(); // by -> { el, t }
  let _lastCursorSend = 0;

  const sceneDims = () => {
    const m = store.get().map || DEFAULT_MAP;
    return { w: m.bgW || 1600, h: m.bgH || 1000 };
  };

  /* ── Transform ── */
  function applyTransform() {
    scene.style.transform = `translate(${view.px}px, ${view.py}px) scale(${view.z})`;
    zoomLabel.textContent = `${Math.round(view.z * 100)}%`;
    const sid = store.get().activeSceneId;
    if (sid) mapViews[sid] = { px: view.px, py: view.py, z: view.z }; // mémorise par scène
    // Garde le HUD de jeton à taille écran constante pendant le zoom.
    const hud = tokensEl.querySelector('.map-token-hud');
    if (hud) hud.style.setProperty('--hud-z', (1 / view.z).toFixed(3));
  }

  /** Centre la vue sur un point image (sans changer le zoom). */
  function centerOn(ix, iy) {
    const r = vp.getBoundingClientRect();
    view.px = r.width / 2 - ix * view.z;
    view.py = r.height / 2 - iy * view.z;
    applyTransform();
  }

  /** « Amener les joueurs ici » : centre la vue du MJ sur le point puis la pousse. */
  function pullPlayersTo(ix, iy) {
    if (!isDM) return;
    centerOn(ix, iy);
    sendView({ px: view.px, py: view.py, z: view.z });
    showToast('📍 Joueurs amenés ici.', { icon: '👁', timeout: 2000 });
  }

  function toImage(clientX, clientY) {
    const r = vp.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.px) / view.z,
      y: (clientY - r.top - view.py) / view.z,
    };
  }

  function zoomAt(factor, cx, cy) {
    const r = vp.getBoundingClientRect();
    const ox = cx - r.left;
    const oy = cy - r.top;
    const img = toImage(cx, cy);
    view.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, view.z * factor));
    view.px = ox - img.x * view.z;
    view.py = oy - img.y * view.z;
    applyTransform();
  }

  function fit() {
    const { w, h } = sceneDims();
    const r = vp.getBoundingClientRect();
    const z = Math.min((r.width - 40) / w, (r.height - 40) / h);
    view.z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
    view.px = (r.width - w * view.z) / 2;
    view.py = (r.height - h * view.z) / 2;
    applyTransform();
  }

  /* ── Rendu ── */
  function renderAll() {
    const m = store.get().map;
    if (!m) return;
    // Synchronise les cibles depuis le store (ciblage possible depuis le combat).
    targetIds = new Set(store.get().targets || []);
    const { w, h } = sceneDims();

    scene.style.width = `${w}px`;
    scene.style.height = `${h}px`;

    const url = bgUrl();
    if (url) {
      bgImg.style.display = 'block';
      if (bgImg.src !== url) bgImg.src = url;
      emptyEl.style.display = 'none';
    } else {
      bgImg.style.display = 'none';
      emptyEl.style.display = isDM ? 'flex' : 'none';
      emptyEl.innerHTML = isDM
        ? `<div>Aucun fond de carte.<br><span class="map-empty-hint">Cliquez sur 🖼 pour en importer un.</span></div>`
        : '';
    }

    drawCanvas(m, w, h);
    renderTiles(m);
    renderLights(m);
    renderTokens(m);
    renderDoors(m);
    renderDrawings(m);
    renderLabels(m);
    renderPins(m);
    renderAtmosphere(m);
    syncControls(m);

    // Mémoire d'exploration : le MJ persiste les cases nouvellement vues.
    // Idempotent (n'écrit que s'il y a du nouveau) → pas de boucle de rendu.
    if (isDM && m.lighting?.on && lastVisible && lastVisible.size) {
      accumulateExplored([...lastVisible]);
    }
  }

  /** Convertit #rrggbb en rgba(...) avec l'alpha donné. */
  function hexToRgba(hex, a) {
    const h = String(hex || '#e5c07b').replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  /** Cases de grille traversées par le segment c0→c1 (indices de case). */
  function lineCells(c0, c1) {
    const n = Math.max(Math.abs(c1.cx - c0.cx), Math.abs(c1.cy - c0.cy));
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      out.push({ cx: Math.round(c0.cx + (c1.cx - c0.cx) * t), cy: Math.round(c0.cy + (c1.cy - c0.cy) * t) });
    }
    return out;
  }

  /**
   * Aperçu pendant le déplacement d'un jeton (throttlé à 1 rendu/frame) :
   * recalcule la vision dynamique avec le jeton à sa position provisoire (vision
   * live) et redessine le trajet sur le canevas.
   */
  function scheduleDragDraw(tempTokens) {
    if (_dragRaf) return;
    _dragRaf = requestAnimationFrame(() => {
      _dragRaf = 0;
      const m = store.get().map;
      if (!m) return;
      const tm = tempTokens ? { ...m, tokens: tempTokens } : m;
      const { w, h } = sceneDims();
      drawCanvas(tm, w, h);
    });
  }

  function drawCanvas(m, w, h) {
    if (fogCanvas.width !== w) fogCanvas.width = w;
    if (fogCanvas.height !== h) fogCanvas.height = h;
    ctx.clearRect(0, 0, w, h);

    // Grille
    if (layers.grid && m.grid.show && m.grid.size > 0) {
      const gop = m.grid.opacity ?? 0.12;
      ctx.strokeStyle = `rgba(255,255,255,${gop})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const gs = m.grid.size;
      for (let x = m.grid.ox % gs; x <= w; x += gs) {
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
      }
      for (let y = m.grid.oy % gs; y <= h; y += gs) {
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
      }
      ctx.stroke();
    }

    // Auras / portées autour des jetons (sous le brouillard).
    if (layers.tokens) {
      const gs = m.grid.size || 70;
      for (const t of m.tokens) {
        if (!t.aura || !t.aura.r) continue;
        if (!isDM && t.hidden) continue;
        ctx.beginPath();
        ctx.fillStyle = hexToRgba(t.aura.color, 0.16);
        ctx.strokeStyle = hexToRgba(t.aura.color, 0.6);
        ctx.lineWidth = 1.5;
        ctx.arc(t.x, t.y, t.aura.r * gs, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Lumière dynamique (vision + murs + mémoire) — prioritaire sur le brouillard manuel.
    if (layers.fog && m.lighting?.on) {
      drawLighting(m, w, h);
    } else if (layers.fog && m.fog.on) {
      const all = m.fog.revealed.includes('ALL');
      const cell = m.fog.cell || 70;
      const cols = Math.ceil(w / cell);
      const rows = Math.ceil(h / cell);
      const revealed = new Set(m.fog.revealed);
      // MJ : brouillard semi-transparent (il voit dessous). Joueur : opaque.
      ctx.fillStyle = isDM ? 'rgba(8,8,14,0.62)' : 'rgba(4,4,8,1)';
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          if (all || revealed.has(`${cx},${cy}`)) continue;
          ctx.fillRect(cx * cell, cy * cell, cell, cell);
        }
      }
    }

    // Murs et portes (visibles par le MJ uniquement).
    if (isDM && layers.walls && m.walls.length) {
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const w of m.walls) {
        ctx.beginPath();
        if (w.door) {
          // Porte ouverte : verte pointillée. Fermée : ambre solide.
          ctx.setLineDash(w.open ? [8, 8] : []);
          ctx.strokeStyle = w.open ? 'rgba(78,201,148,0.9)' : 'rgba(229,192,123,0.95)';
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(229,108,117,0.85)';
        }
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // Aperçu du mur/porte en cours de tracé.
    if (isDM && wallPreview) {
      ctx.strokeStyle = wallPreview.door ? 'rgba(229,192,123,0.95)' : 'rgba(255,200,120,0.95)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(wallPreview.a.x, wallPreview.a.y);
      ctx.lineTo(wallPreview.b.x, wallPreview.b.y);
      ctx.stroke();
    }

    // Sources de lumière (repères MJ uniquement).
    if (isDM) {
      for (const l of layers.lights ? m.lights || [] : []) {
        ctx.strokeStyle = 'rgba(229,192,123,0.45)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(l.x, l.y, (l.radius || 4) * (m.fog.cell || 70), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,210,120,0.95)';
        ctx.beginPath();
        ctx.arc(l.x, l.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lightPreview) {
        ctx.strokeStyle = 'rgba(255,210,120,0.8)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lightPreview.x, lightPreview.y, lightPreview.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Cadre de sélection multiple.
    if (selPreview) {
      const { a, b } = selPreview;
      ctx.fillStyle = 'rgba(124,106,247,0.15)';
      ctx.strokeStyle = 'rgba(124,106,247,0.9)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      ctx.fillRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
    }

    // Aperçu du rectangle de brouillard en cours de tracé.
    if (fogPreview) {
      const { a, b, reveal } = fogPreview;
      ctx.fillStyle = reveal ? 'rgba(110,180,255,0.30)' : 'rgba(0,0,0,0.45)';
      ctx.strokeStyle = reveal ? 'rgba(150,200,255,0.9)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const rw = Math.abs(b.x - a.x);
      const rh = Math.abs(b.y - a.y);
      ctx.fillRect(x, y, rw, rh);
      ctx.strokeRect(x, y, rw, rh);
    }

    // Trajet d'un jeton en cours de déplacement (cases surlignées + case finale).
    if (movePreview) {
      const gs = movePreview.gs;
      const ox = movePreview.ox || 0;
      const oy = movePreview.oy || 0;
      ctx.fillStyle = 'rgba(124,106,247,0.22)';
      for (const c of movePreview.cells) ctx.fillRect(c.cx * gs + ox, c.cy * gs + oy, gs, gs);
      if (movePreview.end) {
        ctx.strokeStyle = 'rgba(124,106,247,0.95)';
        ctx.lineWidth = 2;
        ctx.strokeRect(movePreview.end.cx * gs + ox, movePreview.end.cy * gs + oy, gs, gs);
      }
    }
  }

  /** Rendu du brouillard piloté par la vision : 3 niveaux (vu / exploré / inconnu). */
  function drawLighting(m, w, h) {
    const cell = m.fog.cell || 70;
    const cols = Math.ceil(w / cell);
    const rows = Math.ceil(h / cell);
    const visible = computeVisible(m);
    lastVisible = visible;
    const explored = new Set(m.fog.explored);
    const revealed = new Set(m.fog.revealed);
    const all = revealed.has('ALL');
    // MJ : voit faiblement sous le brouillard. Joueur : opaque hors exploré.
    const cUnknown = isDM ? 'rgba(8,8,14,0.60)' : 'rgba(2,2,6,1)';
    const cExplored = isDM ? 'rgba(8,8,14,0.30)' : 'rgba(2,2,8,0.70)';
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const key = `${cx},${cy}`;
        if (all || visible.has(key) || revealed.has(key)) continue; // vu → clair
        ctx.fillStyle = explored.has(key) ? cExplored : cUnknown;
        ctx.fillRect(cx * cell, cy * cell, cell, cell);
      }
    }
  }

  function renderTokens(m) {
    if (!layers.tokens) {
      tokensEl.innerHTML = '';
      return;
    }
    // Jeton dont c'est le tour (lié au tracker d'initiative).
    const active = store.get().initiative[store.get().initTurn];

    // Couleur d'anneau selon la disposition (façon Foundry) : PJ vert, monstre
    // rouge, PNJ jaune ; sinon la couleur propre du jeton.
    const chars = store.get().characters || [];
    const ringFor = (t, comb) => {
      // Override manuel de disposition prioritaire (éditeur de jeton).
      if (t.disp === 'ally') return 'var(--green)';
      if (t.disp === 'hostile') return 'var(--red)';
      if (t.disp === 'neutral') return 'var(--yellow)';
      if (t.disp === 'custom') return safeColor(t.color, 'var(--accent)');
      if (comb) {
        if (!comb.char_id) return 'var(--red)';
        const ch = chars.find((c) => c.id === comb.char_id);
        return ch?.owner_id ? 'var(--green)' : 'var(--yellow)';
      }
      if (t.charId) {
        const ch = chars.find((c) => c.id === t.charId);
        return ch?.owner_id ? 'var(--green)' : 'var(--yellow)';
      }
      return safeColor(t.color, 'rgba(255,255,255,0.85)');
    };

    tokensEl.innerHTML = m.tokens
      .map((t) => {
        // Les joueurs ne voient pas les jetons masqués par le MJ.
        if (!isDM && t.hidden) return '';
        const gs = m.grid.size || 70;
        const d = gs * (t.size || 1);
        const hp = hpFor(t);
        const hpBar = hp
          ? `<div class="map-token-hp">
               <span class="hpfill" style="width:${hp.pct}%; background:${hp.color}"></span>
               ${hp.tempPct ? `<span class="hptmp" style="width:${hp.tempPct}%"></span>` : ''}
             </div>`
          : '';
        const url = t.img ? tokenImgUrl(t.img) : null;
        const rot = Number(t.rot) || 0;
        // L'image va dans un calque interne pour pouvoir pivoter SANS tourner
        // l'étiquette ni la barre de PV.
        const art = url ? `<span class="map-token-art" style="background-image:url('${url}'); transform:rotate(${rot}deg)"></span>` : '';
        const bg = url ? 'background:transparent;' : `background:${safeColor(t.color, 'var(--accent)')};`;
        const elev = Number(t.elev) || 0;
        const elevBadge = elev ? `<span class="map-token-elev" title="Élévation">${elev > 0 ? '▲' : '▼'}${Math.abs(elev)}</span>` : '';
        // États repris du combattant lié (par entity_id ou char_id).
        const comb = combatantForToken(t);
        const conds = (comb?.conditions || [])
          .map((c) => `<span class="tok-cond" title="${escapeHtml(c)}">${condIcon(c)}</span>`)
          .join('');
        const isActive = !!(active && comb && active.entity_id === comb.entity_id);
        const cls = [
          'map-token',
          canMoveToken(t) ? 'editable' : '',
          t.hidden ? 'hidden-dm' : '',
          isActive ? 'active-turn' : '',
          t.locked ? 'locked' : '',
          url ? 'has-img' : '',
          targetIds.has(t.id) ? 'targeted' : '',
          tmplHits.has(t.id) ? 'tmpl-hit' : '',
          selectedIds.has(t.id) ? 'selected' : '',
        ].filter(Boolean).join(' ');
        const ring = ringFor(t, comb);
        return `<div class="${cls}" data-token="${t.id}"
          style="left:${t.x}px; top:${t.y}px; width:${d}px; height:${d}px; ${bg} --tring:${ring};
                 transform:translate(-50%,-50%); font-size:${Math.max(10, d * 0.34)}px">
          ${art}
          ${url ? '' : `<span class="map-token-label">${escapeHtml(shortLabel(t.label))}</span>`}
          ${t.label ? `<span class="map-token-name">${escapeHtml(t.label)}</span>` : ''}
          ${t.hidden ? '<span class="map-token-eye">🙈</span>' : ''}
          ${t.locked ? '<span class="map-token-lock">🔒</span>' : ''}
          ${elevBadge}
          ${conds ? `<span class="map-token-conds">${conds}</span>` : ''}
          ${hpBar}
          ${tokenHudHtml(t, comb)}
        </div>`;
      })
      .join('');
  }

  /**
   * HUD de jeton (façon Foundry) : contrôles rapides autour du jeton sélectionné
   * (MJ, outil Sélection, un seul jeton). Contre-mis à l'échelle (1/zoom) pour
   * garder une taille écran constante.
   */
  function tokenHudHtml(t, comb) {
    if (!isDM || tool !== 'select' || selectedIds.size !== 1 || !selectedIds.has(t.id)) return '';
    const cur = comb?.hp ?? t.hp;
    const max = comb?.hp_max ?? t.hpMax;
    const hpTxt = cur != null ? `${cur}${max != null ? `/${max}` : ''}` : '—';
    const isTarget = targetIds.has(t.id);
    return `<div class="map-token-hud" data-hudfor="${t.id}" style="--hud-z:${(1 / view.z).toFixed(3)}">
        <div class="thud-row">
          <button class="thud-btn" data-hud="hp-" title="−1 PV (Maj : −5)">➖</button>
          <span class="thud-hp" title="Points de vie">${hpTxt}</span>
          <button class="thud-btn" data-hud="hp+" title="+1 PV (Maj : +5)">➕</button>
        </div>
        <div class="thud-row">
          <button class="thud-btn ${isTarget ? 'on' : ''}" data-hud="target" title="Cibler / décibler">🎯</button>
          <button class="thud-btn" data-hud="conds" title="États">🩹</button>
          <button class="thud-btn ${t.hidden ? 'on' : ''}" data-hud="hide" title="${t.hidden ? 'Afficher aux joueurs' : 'Masquer aux joueurs'}">${t.hidden ? '👁' : '🙈'}</button>
          ${t.charId ? `<button class="thud-btn" data-hud="sheet" title="Ouvrir la fiche">👤</button>` : ''}
          <button class="thud-btn" data-hud="edit" title="Modifier (PV / infos)">📋</button>
        </div>
        <div class="thud-row">
          <button class="thud-btn" data-hud="pull" title="Amener les joueurs ici">📍</button>
          <button class="thud-btn" data-hud="shrink" title="Réduire">🔽</button>
          <button class="thud-btn" data-hud="grow" title="Agrandir">🔼</button>
          <button class="thud-btn danger" data-hud="del" title="Supprimer">🗑</button>
        </div>
      </div>`;
  }

  /** PV rapides depuis le HUD : combattant lié en priorité, sinon PV du jeton. */
  function hudQuickHp(t, delta) {
    const comb = combatantForToken(t);
    if (comb) {
      adjustHp(comb.entity_id, delta);
      return;
    }
    if (t.hp != null) {
      const max = t.hpMax != null ? Number(t.hpMax) : Infinity;
      updateToken(t.id, { hp: Math.max(0, Math.min(max, (Number(t.hp) || 0) + delta)) });
    } else {
      showToast('Ce jeton n’a pas de PV — utilise 📋 pour lui en donner.', { timeout: 2400 });
    }
  }

  /** Décors / props posés sur la carte (deux couches : sous/au-dessus des jetons). */
  function renderTiles(m) {
    const editing = tool === 'tile' && isDM;
    const html = (which) =>
      (m.tiles || [])
        .filter((t) => (which === 'above' ? t.above : !t.above))
        .map((t) => {
          const url = t.img ? tokenImgUrl(t.img) : null;
          return `<div class="map-tile${editing ? ' editing' : ''}${selectedTile === t.id ? ' sel' : ''}" data-tile="${t.id}"
            style="left:${t.x}px; top:${t.y}px; width:${t.w}px; height:${t.h}px;
                   transform:translate(-50%,-50%) rotate(${t.rot || 0}deg); opacity:${t.opacity ?? 1};
                   ${url ? `background-image:url('${url}')` : 'background:rgba(124,106,247,.25)'}"></div>`;
        })
        .join('');
    if (!layers.tiles) {
      tilesBelowEl.innerHTML = '';
      tilesAboveEl.innerHTML = '';
      return;
    }
    tilesBelowEl.innerHTML = html('below');
    tilesAboveEl.innerHTML = html('above');
    tilesBelowEl.classList.toggle('editing', editing);
    tilesAboveEl.classList.toggle('editing', editing);
  }

  /** Halos de lumière colorés (sources + lumières portées par les jetons). */
  function renderLights(m) {
    if (!layers.lights) {
      glowEl.innerHTML = '';
      return;
    }
    const cell = m.fog.cell || m.grid.size || 70;
    const explored = new Set(m.fog.explored);
    const lightingOn = !!m.lighting?.on;
    const items = [
      ...(m.lights || []).map((l) => ({ x: l.x, y: l.y, r: l.radius || 4, color: l.color || '#ffb86b' })),
      ...m.tokens
        .filter((t) => t.light && t.light.r > 0 && !(!isDM && t.hidden))
        .map((t) => ({ x: t.x, y: t.y, r: t.light.r, color: t.light.color || '#ffb86b' })),
    ];
    glowEl.innerHTML = items
      .map((g, i) => {
        // Anti-fuite : un joueur ne voit pas un halo dans une zone non explorée.
        if (!isDM && lightingOn) {
          const key = `${Math.floor(g.x / cell)},${Math.floor(g.y / cell)}`;
          if (!(lastVisible && lastVisible.has(key)) && !explored.has(key)) return '';
        }
        const rpx = g.r * cell;
        const delay = ((i * 0.37) % 2).toFixed(2);
        return `<span class="map-glow" style="left:${g.x}px; top:${g.y}px; width:${rpx * 2}px; height:${rpx * 2}px; --glow:${g.color}; animation-delay:${delay}s"></span>`;
      })
      .join('');
  }

  /** Ambiance de scène : teinte d'obscurité (jour/nuit) + overlay météo. */
  function renderAtmosphere(m) {
    const a = m.atmosphere || { darkness: 0, weather: 'none' };
    atmoEl.style.opacity = String((Number(a.darkness) || 0) / 100 * 0.82);
    const wx = ['rain', 'snow', 'fog'].includes(a.weather) ? a.weather : '';
    weatherEl.className = `map-weather${wx ? ' ' + wx : ''}`;
  }

  /** Étiquettes de zone : MJ voit tout, joueurs voient les révélées. */
  function renderLabels(m) {
    const list = isDM ? m.labels || [] : (m.labels || []).filter((l) => l.revealed);
    labelsEl.innerHTML = list
      .map(
        (l) =>
          `<div class="map-label ${isDM ? 'clickable' : ''} ${l.revealed ? '' : 'hidden-dm'}" data-label-id="${l.id}" style="left:${l.x}px; top:${l.y}px; color:${l.color || '#e5c07b'}">${escapeHtml(l.text)}</div>`
      )
      .join('');
  }

  function openLabel(id, e) {
    if (!isDM) return;
    const l = (store.get().map?.labels || []).find((x) => x.id === id);
    if (!l) return;
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx';
    ctxMenu.innerHTML = `
      <button data-lc="edit">✏ Modifier le texte</button>
      <button data-lc="reveal">${l.revealed ? '🙈 Masquer aux joueurs' : '👁 Révéler aux joueurs'}</button>
      <button data-lc="del" class="danger">🗑 Supprimer</button>`;
    document.body.appendChild(ctxMenu);
    const mr = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - mr.width - 8))}px`;
    ctxMenu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - mr.height - 8))}px`;
    ctxMenu.querySelectorAll('[data-lc]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.lc;
        closeCtx();
        if (act === 'edit') {
          const nv = await modalPrompt('Texte de l’étiquette :', { title: 'Étiquette', defaultValue: l.text || '' });
          if (nv !== null && nv.trim()) updateLabel(id, { text: nv.trim() });
        } else if (act === 'reveal') {
          updateLabel(id, { revealed: !l.revealed });
        } else if (act === 'del') {
          removeLabel(id);
        }
      })
    );
  }

  function renderPins(m) {
    const pins = m.pins || [];
    const list = isDM ? pins : pins.filter((p) => p.revealed);
    pinsMark.innerHTML = list
      .map(
        (p) =>
          `<div class="map-pin-mark ${p.revealed ? 'revealed' : ''}" data-pin="${p.id}" style="left:${p.x}px; top:${p.y}px" title="${escapeHtml(p.note || '')}">${p.n}</div>`
      )
      .join('');
  }

  /**
   * Marqueurs de porte cliquables (MJ) : posés au milieu de chaque segment
   * `door`. Clic = ouvrir/fermer (fiable, contrairement au hit-test canvas) ;
   * clic droit = supprimer la porte.
   */
  function renderDoors(m) {
    // Les portes sont visibles de tous (les joueurs peuvent les ouvrir/fermer).
    if (!layers.walls) {
      doorsEl.innerHTML = '';
      return;
    }
    const html = (m.walls || [])
      .map((w, i) => {
        if (!w.door) return '';
        // Porte secrète : invisible pour les joueurs (elle bloque comme un mur).
        if (w.secret && !isDM) return '';
        const mx = (w.x1 + w.x2) / 2;
        const my = (w.y1 + w.y2) / 2;
        const icon = w.open ? '🔓' : w.locked ? '🔒' : w.secret ? '🕵' : '🚪';
        const state = w.open ? 'Porte ouverte — clic pour fermer' : w.locked ? 'Porte verrouillée' : 'Porte fermée — clic pour ouvrir';
        const cls = ['map-door-mark', w.open ? 'open' : 'closed', w.locked ? 'locked' : '', w.secret ? 'secret' : ''].filter(Boolean).join(' ');
        return `<button class="${cls}" data-door="${i}"
          style="left:${mx}px; top:${my}px"
          title="${state}${isDM ? ' (clic droit = options)' : ''}">${icon}</button>`;
      })
      .join('');
    doorsEl.innerHTML = html;
  }

  /** SVG d'une annotation (libre / rect / cercle / flèche / texte). */
  function drawingSvg(d) {
    const w = d.w || 4;
    const c = d.color || '#e06c75';
    if (d.type === 'free') {
      const pts = (d.pts || []).map((p) => `${p.x},${p.y}`).join(' ');
      return `<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    if (d.type === 'rect') {
      const x = Math.min(d.a.x, d.b.x);
      const y = Math.min(d.a.y, d.b.y);
      return `<rect x="${x}" y="${y}" width="${Math.abs(d.b.x - d.a.x)}" height="${Math.abs(d.b.y - d.a.y)}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    }
    if (d.type === 'circle') {
      const r = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y);
      return `<circle cx="${d.a.x}" cy="${d.a.y}" r="${r}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
    }
    if (d.type === 'arrow') {
      const { a, b } = d;
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const hl = 12 + w * 2.5;
      const p1x = b.x + Math.cos(ang - 2.6) * hl;
      const p1y = b.y + Math.sin(ang - 2.6) * hl;
      const p2x = b.x + Math.cos(ang + 2.6) * hl;
      const p2y = b.y + Math.sin(ang + 2.6) * hl;
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/><polygon points="${b.x},${b.y} ${p1x},${p1y} ${p2x},${p2y}" fill="${c}"/>`;
    }
    if (d.type === 'text') {
      const fs = d.fs || 28;
      return `<text x="${d.x}" y="${d.y}" fill="${c}" font-size="${fs}" font-weight="700" paint-order="stroke" stroke="#000" stroke-width="${Math.max(2, fs / 12)}" stroke-linejoin="round">${escapeHtml(d.text || '')}</text>`;
    }
    return '';
  }
  function renderDrawings(m) {
    if (!layers.draw) {
      drawEl.innerHTML = '';
      return;
    }
    const all = [...(m.drawings || []), ...ephemeralDraws];
    if (drawPreview) all.push(drawPreview);
    drawEl.innerHTML = all.map(drawingSvg).join('');
  }
  /** Ajoute un dessin éphémère (effacé après ~6 s) et planifie le nettoyage. */
  function addEphemeralDraw(drawing) {
    ephemeralDraws.push({ ...drawing, _exp: Date.now() + 6000 });
    renderDrawings(store.get().map);
    setTimeout(() => {
      ephemeralDraws = ephemeralDraws.filter((d) => d._exp > Date.now());
      renderDrawings(store.get().map);
    }, 6200);
  }

  function openPin(id, e) {
    const p = (store.get().map?.pins || []).find((x) => x.id === id);
    if (!p) return;
    if (!isDM) {
      if (p.revealed && p.note) modalAlert(p.note, { title: `Marqueur ${p.n}` });
      return;
    }
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx';
    ctxMenu.innerHTML = `
      <button data-pc="note">✏ Note</button>
      <button data-pc="reveal">${p.revealed ? '🙈 Masquer aux joueurs' : '👁 Révéler aux joueurs'}</button>
      <button data-pc="del" class="danger">🗑 Supprimer</button>`;
    document.body.appendChild(ctxMenu);
    const mr = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - mr.width - 8))}px`;
    ctxMenu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - mr.height - 8))}px`;
    ctxMenu.querySelectorAll('[data-pc]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.pc;
        closeCtx();
        if (act === 'note') {
          const nv = await modalPrompt('Note du marqueur :', { title: `Marqueur ${p.n}`, defaultValue: p.note || '', multiline: true });
          if (nv !== null) updatePin(id, { note: nv });
        } else if (act === 'reveal') {
          updatePin(id, { revealed: !p.revealed });
        } else if (act === 'del') {
          removePin(id);
        }
      })
    );
  }

  /** Combattant du turn order lié à ce jeton (par entity_id, sinon par char_id). */
  function combatantForToken(t) {
    if (!t) return null;
    const init = store.get().initiative;
    if (t.entityId) {
      const c = init.find((x) => x.entity_id === t.entityId);
      if (c) return c;
    }
    if (t.charId) return init.find((x) => x.char_id === t.charId) || null;
    return null;
  }

  /** Étiquette compacte affichée DANS le jeton (initiales / 3 lettres). */
  function shortLabel(s) {
    s = String(s || '').trim();
    if (!s) return '';
    const words = s.split(/\s+/);
    if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
    return s.slice(0, 3);
  }

  /** PV d'un jeton : combattant lié > fiche liée > PV propres du jeton. */
  function hpFor(token) {
    if (!token) return null;
    const charId = token.charId;
    let hp, max, temp;
    const comb = combatantForToken(token);
    if (comb && comb.hp !== null && comb.hp !== undefined) {
      hp = comb.hp;
      max = comb.hp_max;
      temp = comb.hp_temp || 0;
    } else {
      const ch = charId ? store.get().characters.find((c) => c.id === charId) : null;
      const dd = ch?.data;
      if (dd && dd.hp != null) {
        hp = dd.hp;
        max = dd.hpMax;
        temp = dd.hpTmp || 0;
      } else if (token.hp != null || token.hpMax != null) {
        // Jeton autonome (monstre/PNJ sans fiche).
        hp = token.hp ?? 0;
        max = token.hpMax;
        temp = token.hpTemp || 0;
      } else {
        return null;
      }
    }
    if (!max) return null;
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    const tempPct = temp ? Math.max(0, Math.min(100, (temp / max) * 100)) : 0;
    const color = pct > 50 ? 'var(--green)' : pct > 25 ? 'var(--yellow)' : 'var(--red)';
    return { pct, tempPct, color };
  }

  function syncControls(m) {
    const g = container.querySelector('#map-grid');
    const f = container.querySelector('#map-feet');
    const u = container.querySelector('#map-unit');
    const o = container.querySelector('#map-gridop');
    if (g && document.activeElement !== g) g.value = m.grid.size;
    if (f && document.activeElement !== f) f.value = m.feetPerCell;
    if (u && document.activeElement !== u) u.value = m.unit;
    if (o && document.activeElement !== o) o.value = Math.round((m.grid.opacity ?? 0.12) * 100);
    const lit = container.querySelector('#map-lighting');
    if (lit) lit.classList.toggle('active', !!m.lighting?.on);

    const dark = container.querySelector('#map-dark');
    if (dark && document.activeElement !== dark) dark.value = m.atmosphere?.darkness ?? 0;
    const wsel = container.querySelector('#map-weather-sel');
    if (wsel && document.activeElement !== wsel) wsel.value = m.atmosphere?.weather ?? 'none';
    const sscape = container.querySelector('#map-soundscape');
    if (sscape) {
      const n = (m.soundscape || []).length;
      sscape.classList.toggle('active', n > 0);
      sscape.textContent = n > 0 ? '🔊✓' : '🔊';
    }

    const sceneSel = container.querySelector('#map-scene-sel');
    const scenes = store.get().scenes;
    const active = store.get().activeSceneId;
    const sig = scenes.map((s) => `${s.id}:${s.name}`).join('|') + `#${active}`;
    if (sceneSel && document.activeElement !== sceneSel && sceneSel.dataset.sig !== sig) {
      sceneSel.dataset.sig = sig;
      sceneSel.innerHTML = scenes
        .map((s) => `<option value="${s.id}" ${s.id === active ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
        .join('');
    }
    // Barre de scènes (vignettes cliquables) façon VTT.
    const sceneNav = container.querySelector('#scene-nav');
    if (sceneNav && sceneNav.dataset.sig !== sig) {
      sceneNav.dataset.sig = sig;
      sceneNav.innerHTML = scenes.length
        ? scenes
            .map((s) => `<button class="scene-chip ${s.id === active ? 'active' : ''}" data-scene="${s.id}" title="${escapeHtml(s.name)}">${s.id === active ? '👁 ' : ''}${escapeHtml(s.name)}</button>`)
            .join('') + '<button class="scene-chip scene-add" data-act="scene-new" title="Nouvelle scène">＋</button>'
        : '<button class="scene-chip scene-add" data-act="scene-new" title="Nouvelle scène">＋ Scène</button>';
    }
  }

  /* ── Règle de distance ── */
  /** Distance 5e cumulée (diagonale = 1 case) le long d'une polyligne. */
  function rulerCells(pts) {
    const gs = store.get().map?.grid?.size || 70;
    let cells = 0;
    for (let i = 1; i < pts.length; i++) {
      const dxC = Math.abs(pts[i].x - pts[i - 1].x) / gs;
      const dyC = Math.abs(pts[i].y - pts[i - 1].y) / gs;
      cells += Math.round(Math.max(dxC, dyC));
    }
    return cells;
  }
  /** Dessine la règle multi-segments (waypoints posés + segment vers le curseur). */
  function drawRulerPath(cursor) {
    const m = store.get().map || DEFAULT_MAP;
    const pts = cursor ? [...rulerPts, cursor] : [...rulerPts];
    if (!pts.length) {
      rulerEl.innerHTML = '';
      hud.style.display = 'none';
      return;
    }
    const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');
    const dots = pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="6" class="ruler-dot"/>`).join('');
    rulerEl.innerHTML = `<polyline points="${poly}" class="ruler-line" fill="none"/>${dots}`;
    const cells = rulerCells(pts);
    const canMove = rulerPts.length >= 2 && tokenAtRulerStart();
    hud.style.display = 'block';
    hud.textContent = `${cells} cases · ${cells * m.feetPerCell} ${m.unit}${rulerPts.length > 1 ? ` (${rulerPts.length} étapes)` : ''}${canMove ? ' · Entrée = déplacer' : ''}`;
  }
  function clearRuler() {
    rulerPts = [];
    rulerEl.innerHTML = '';
    hud.style.display = 'none';
  }
  /** Jeton (déplaçable) situé au point de départ de la règle, le cas échéant. */
  function tokenAtRulerStart() {
    if (!rulerPts.length) return null;
    const m = store.get().map;
    if (!m) return null;
    const gs = m.grid.size || 70;
    const s = rulerPts[0];
    return (m.tokens || []).find((t) => Math.hypot(t.x - s.x, t.y - s.y) <= gs * 0.7 && canMoveToken(t)) || null;
  }

  /* ── Gabarits de sorts (cercle / cône / ligne) ── */
  /** Couleur de l'utilisateur courant (pour son gabarit). */
  function myColor() {
    return colorFor(store.get().user?.id, store.get().profile?.display_name);
  }
  /** Forme SVG d'un gabarit, colorée. */
  // Adaptateurs fins vers la géométrie pure (lib/tmplgeom.js) : on injecte la grille.
  function tmplShapesSvg(shape, a, b, color) {
    const m = store.get().map || DEFAULT_MAP;
    return templateSvg(shape, a, b, color, m.grid.size || 70);
  }
  function tmplLabel(shape, dist) {
    const m = store.get().map || DEFAULT_MAP;
    return templateLabel(shape, dist, m.grid.size || 70, m.feetPerCell, m.unit);
  }

  function clearTemplate() {
    const had = !!template;
    template = null;
    tmplEl.innerHTML = '';
    tmplHits = new Set();
    tokensEl.querySelectorAll('.tmpl-hit').forEach((el) => el.classList.remove('tmpl-hit'));
    hud.style.display = 'none';
    if (had) sendTemplate({ cleared: true }); // retire le gabarit chez les autres
  }

  function renderTemplate() {
    if (!template) {
      tmplEl.innerHTML = '';
      return;
    }
    const dist = Math.hypot(template.b.x - template.a.x, template.b.y - template.a.y);
    tmplEl.innerHTML = tmplShapesSvg(template.shape, template.a, template.b, myColor());
    updateTemplateHits();
    hud.style.display = 'block';
    hud.textContent = `${tmplLabel(template.shape, dist)}${tmplHits.size ? ` · 🎯 ${tmplHits.size}` : ''}`;
    // Diffuse aux autres (throttlé) — visible par tous, à la couleur du joueur.
    const now = performance.now();
    if (now - _lastTmplSend > 90) {
      _lastTmplSend = now;
      sendTemplate({ shape: template.shape, a: template.a, b: template.b });
    }
  }

  /** Affiche les gabarits diffusés par les autres joueurs. */
  function renderRemoteTemplates() {
    let html = '';
    for (const t of remoteTemplates.values()) {
      html += tmplShapesSvg(t.shape, t.a, t.b, t.color);
      if (t.name) {
        html += `<text x="${t.a.x + 6}" y="${t.a.y - 6}" fill="${t.color}" font-size="13" font-weight="700" paint-order="stroke" stroke="#000" stroke-width="2">${escapeHtml(t.name)}</text>`;
      }
    }
    remoteTmplEl.innerHTML = html;
  }

  /** Jetons dont le centre tombe dans le gabarit (cercle / cône / ligne). */
  function tokensInTemplate(tmpl) {
    const m = store.get().map;
    if (!m || !tmpl) return new Set();
    const gs = m.grid.size || 70;
    const { shape, a, b } = tmpl;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const out = new Set();
    if (dist < 1) return out;
    for (const t of m.tokens) {
      if (!isDM && t.hidden) continue;
      const px = t.x;
      const py = t.y;
      let inside = false;
      if (shape === 'circle') {
        inside = Math.hypot(px - a.x, py - a.y) <= dist;
      } else if (shape === 'cone') {
        const d = Math.hypot(px - a.x, py - a.y);
        if (d <= dist) {
          const ang = Math.atan2(dy, dx);
          const ta = Math.atan2(py - a.y, px - a.x);
          let diff = Math.abs(ta - ang);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          inside = diff <= Math.atan(0.5) + 1e-3;
        }
      } else {
        // Ligne large d'une case : proche du segment et dans sa longueur.
        const dd = pointSegDist(px, py, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        const proj = ((px - a.x) * dx + (py - a.y) * dy) / (dist * dist);
        inside = dd <= gs / 2 && proj >= -0.05 && proj <= 1.05;
      }
      if (inside) out.add(t.id);
    }
    return out;
  }

  /** Recalcule la surbrillance des jetons couverts par le gabarit (en direct). */
  function updateTemplateHits() {
    tmplHits = template ? tokensInTemplate(template) : new Set();
    tokensEl.querySelectorAll('[data-token]').forEach((el) =>
      el.classList.toggle('tmpl-hit', tmplHits.has(el.dataset.token))
    );
  }

  /* ── Pings ── */
  function spawnPing(x, y, name) {
    const el = document.createElement('div');
    el.className = 'map-ping';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerHTML = `<span class="map-ping-ring"></span><span class="map-ping-name">${escapeHtml(name || '')}</span>`;
    pingsEl.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /** Affiche / met à jour le curseur en direct d'un autre utilisateur. */
  function renderCursor(p) {
    if (!p || !p.by || p.by === store.get().user?.id) return;
    let c = cursors.get(p.by);
    if (!c) {
      const el = document.createElement('div');
      el.className = 'map-cursor';
      const col = colorFor(p.by, p.name);
      el.style.color = col;
      el.innerHTML = `<span class="map-cursor-arrow">➤</span><span class="map-cursor-name" style="background:${col}"></span>`;
      cursorsEl.appendChild(el);
      c = { el };
      cursors.set(p.by, c);
    }
    c.el.style.left = `${p.x}px`;
    c.el.style.top = `${p.y}px`;
    c.el.querySelector('.map-cursor-name').textContent = p.name || '';
    c.t = Date.now();
  }
  // Retire les curseurs inactifs (>4 s sans mise à jour).
  const cursorCleanup = setInterval(() => {
    const now = Date.now();
    for (const [by, c] of cursors) {
      if (now - (c.t || 0) > 4000) {
        c.el.remove();
        cursors.delete(by);
      }
    }
  }, 1500);

  /* ── Brouillard : cases sous le pointeur ── */
  function cellsAt(img) {
    const m = store.get().map || DEFAULT_MAP;
    const cell = m.fog.cell || 70;
    const cx = Math.floor(img.x / cell);
    const cy = Math.floor(img.y / cell);
    const out = [];
    const r = 1; // pinceau 3×3
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && ny >= 0) out.push(`${nx},${ny}`);
      }
    return out;
  }

  /* ── Lumière dynamique : géométrie ── */

  /** Les segments p1p2 et p3p4 se croisent-ils ? (orientation classique) */
  function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
  }

  /** La ligne de vue (ax,ay)→(bx,by) est-elle coupée par un mur ? */
  function losBlocked(ax, ay, bx, by, walls) {
    for (const w of walls) {
      if (w.door && w.open) continue; // porte ouverte : ne bloque pas
      if (segCross(ax, ay, bx, by, w.x1, w.y1, w.x2, w.y2)) return true;
    }
    return false;
  }

  /** Distance d'un point au segment [a,b] (px image). */
  function pointSegDist(px, py, w) {
    const vx = w.x2 - w.x1;
    const vy = w.y2 - w.y1;
    const len2 = vx * vx + vy * vy || 1;
    let t = ((px - w.x1) * vx + (py - w.y1) * vy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = w.x1 + t * vx;
    const cy = w.y1 + t * vy;
    return Math.hypot(px - cx, py - cy);
  }

  /** Index de la porte la plus proche d'un point (ou -1). */
  function nearestDoor(img) {
    const m = store.get().map || DEFAULT_MAP;
    let best = -1;
    let bestD = 14 / view.z; // ~14 px écran de tolérance
    m.walls.forEach((w, i) => {
      if (!w.door) return;
      const d = pointSegDist(img.x, img.y, w);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Menu d'une source de lumière (MJ) : couleur, rayon, suppression. */
  function openLightMenu(id, e) {
    const l = (store.get().map?.lights || []).find((x) => x.id === id);
    if (!l) return;
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx';
    ctxMenu.innerHTML = `
      <label class="map-ctx-color">🎨 Couleur <input type="color" value="${l.color || '#ffb86b'}" data-lcolor></label>
      <button data-lr="1">➕ Rayon (${l.radius || 4})</button>
      <button data-lr="-1">➖ Rayon</button>
      <button data-ldel class="danger">🗑 Supprimer</button>`;
    document.body.appendChild(ctxMenu);
    const mr = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - mr.width - 8))}px`;
    ctxMenu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - mr.height - 8))}px`;
    ctxMenu.querySelector('[data-lcolor]')?.addEventListener('input', (ev) => updateLight(id, { color: ev.target.value }));
    ctxMenu.querySelectorAll('[data-lr]').forEach((b) =>
      b.addEventListener('click', () => {
        const cur = (store.get().map?.lights || []).find((x) => x.id === id);
        if (cur) updateLight(id, { radius: Math.max(1, Math.min(40, (cur.radius || 4) + Number(b.dataset.lr))) });
      })
    );
    ctxMenu.querySelector('[data-ldel]')?.addEventListener('click', () => {
      removeLight(id);
      closeCtx();
    });
  }

  /** Après pose d'un gabarit : propose de lancer un sort/attaque sur les cibles. */
  function openSpellChooserForTargets() {
    const chars = store.get().characters || [];
    const me = store.get().user?.id;
    const caster = chars.find((c) => c.id === store.get().activeChar) || chars.find((c) => c.owner_id === me) || null;
    const spells = caster?.data?.spells || [];
    const atks = caster?.data?.atks || [];
    if (!caster || (!spells.length && !atks.length)) return;
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx tmpl-pick';
    ctxMenu.innerHTML = `
      <div class="tmpl-pick-h">🔮 Lancer sur ${store.get().targets.length} cible(s)</div>
      ${spells.map((s, i) => `<button data-spick="${i}">✨ ${escapeHtml(s.nm || 'Sort')}${s.lvl ? ` (niv.${s.lvl})` : ''}</button>`).join('')}
      ${atks.map((a, i) => `<button data-apick="${i}">⚔ ${escapeHtml(a.nm || 'Attaque')}</button>`).join('')}
      <button data-pick-cancel>Annuler (garder les cibles)</button>`;
    document.body.appendChild(ctxMenu);
    const mr = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = `${Math.max(8, window.innerWidth / 2 - mr.width / 2)}px`;
    ctxMenu.style.top = `${Math.max(8, window.innerHeight - mr.height - 90)}px`;
    ctxMenu.querySelectorAll('[data-spick]').forEach((b) =>
      b.addEventListener('click', () => {
        const s = spells[Number(b.dataset.spick)];
        closeCtx();
        if (s) openActionCard({ charId: caster.id, who: caster.name, kind: 'spell', item: s });
      })
    );
    ctxMenu.querySelectorAll('[data-apick]').forEach((b) =>
      b.addEventListener('click', () => {
        const a = atks[Number(b.dataset.apick)];
        closeCtx();
        if (a) openActionCard({ charId: caster.id, who: caster.name, kind: 'atk', item: a });
      })
    );
    ctxMenu.querySelector('[data-pick-cancel]').addEventListener('click', closeCtx);
  }

  /** Id de la source de lumière la plus proche d'un point (ou null). */
  function nearestLight(img) {
    const m = store.get().map || DEFAULT_MAP;
    let best = null;
    let bestD = 18 / view.z;
    for (const l of m.lights || []) {
      const d = Math.hypot(img.x - l.x, img.y - l.y);
      if (d < bestD) {
        bestD = d;
        best = l.id;
      }
    }
    return best;
  }

  /**
   * Un jeton appartient-il au « camp des joueurs » (et donne donc de la vision
   * partagée) ? PJ lié à une fiche possédée par un joueur, ou disposition « allié ».
   * Les monstres / PNJ hostiles / neutres n'éclairent PAS la vue des joueurs
   * (sinon, vision par défaut = 6, ils révéleraient toute la carte aux joueurs).
   */
  function isPartyToken(t) {
    if (t.disp === 'hostile') return false;
    if (t.disp === 'ally') return true;
    if (t.charId) {
      const ch = (store.get().characters || []).find((c) => c.id === t.charId);
      if (ch?.owner_id) return true;
    }
    return false;
  }

  /**
   * Ensemble des cases "cx,cy" vues par le groupe.
   * Modèle de vision nocturne : une source de lumière (décor ou portée par un PJ)
   * éclaire et révèle son rayon ; un PJ voit toujours dans son rayon de « vision
   * dans le noir » (darkvision) et, au-delà, sa « vision normale » uniquement là
   * où c'est éclairé. Rétro-compatible : si un jeton n'a pas de darkvision défini,
   * darkvision = vision (il voit donc tout son rayon, comme avant).
   */
  function computeVisible(m) {
    const cell = m.fog.cell || 70;
    const walls = m.walls || [];
    const visible = new Set();
    const lit = new Set();
    const party = m.tokens.filter(isPartyToken);

    // 1) Sources de lumière : marquent les cases éclairées ET les révèlent.
    const lights = [
      ...(m.lights || []).map((l) => ({ x: l.x, y: l.y, r: l.radius || 4 })),
      ...party.filter((t) => t.light && t.light.r > 0).map((t) => ({ x: t.x, y: t.y, r: t.light.r })),
    ];
    for (const L of lights) {
      const r = L.r;
      const rpx = r * cell;
      const tcx = Math.floor(L.x / cell);
      const tcy = Math.floor(L.y / cell);
      for (let cy = tcy - r - 1; cy <= tcy + r + 1; cy++) {
        if (cy < 0) continue;
        for (let cx = tcx - r - 1; cx <= tcx + r + 1; cx++) {
          if (cx < 0) continue;
          const key = `${cx},${cy}`;
          const px = cx * cell + cell / 2;
          const py = cy * cell + cell / 2;
          if (Math.hypot(px - L.x, py - L.y) > rpx) continue;
          if (losBlocked(L.x, L.y, px, py, walls)) continue;
          lit.add(key);
          visible.add(key);
        }
      }
    }

    // 2) Vision des PJ : darkvision (toujours) + vision normale là où c'est éclairé.
    for (const t of party) {
      const sight = t.vision || 0;
      const dv = t.darkvision != null && t.darkvision !== '' ? Number(t.darkvision) : sight;
      const rMax = Math.max(dv, sight);
      if (rMax <= 0) continue;
      const rpxMax = rMax * cell;
      const tcx = Math.floor(t.x / cell);
      const tcy = Math.floor(t.y / cell);
      for (let cy = tcy - rMax - 1; cy <= tcy + rMax + 1; cy++) {
        if (cy < 0) continue;
        for (let cx = tcx - rMax - 1; cx <= tcx + rMax + 1; cx++) {
          if (cx < 0) continue;
          const key = `${cx},${cy}`;
          if (visible.has(key)) continue;
          const px = cx * cell + cell / 2;
          const py = cy * cell + cell / 2;
          const dist = Math.hypot(px - t.x, py - t.y);
          if (dist > rpxMax) continue;
          const inDark = dist <= dv * cell;
          const inSight = dist <= sight * cell;
          if (!inDark && !(inSight && lit.has(key))) continue;
          if (losBlocked(t.x, t.y, px, py, walls)) continue;
          visible.add(key);
        }
      }
    }
    return visible;
  }

  /** Le jeton est-il déplaçable par l'utilisateur courant ? (MJ ou son PJ) */
  function canMoveToken(t) {
    if (isDM) return true;
    if (!t?.charId) return false;
    const ch = store.get().characters.find((c) => c.id === t.charId);
    return ch?.owner_id === store.get().user?.id;
  }

  /** Centre de la case contenant le point, en tenant compte du décalage de grille. */
  function cellCenter(img) {
    const m = store.get().map || DEFAULT_MAP;
    const gs = m.grid.size || 70;
    const ox = m.grid.ox || 0;
    const oy = m.grid.oy || 0;
    return {
      x: Math.floor((img.x - ox) / gs) * gs + gs / 2 + ox,
      y: Math.floor((img.y - oy) / gs) * gs + gs / 2 + oy,
    };
  }

  /** Distance fixe du gabarit convertie en px image (0 = libre au glisser). */
  function tmplFixedPx() {
    if (!tmplDistFt) return 0;
    const m = store.get().map || DEFAULT_MAP;
    const gs = m.grid.size || 70;
    const fpc = m.feetPerCell || 5;
    return (tmplDistFt / fpc) * gs;
  }

  /** Aimante un point sur l'intersection de grille la plus proche. */
  function snapToGrid(img) {
    const m = store.get().map || DEFAULT_MAP;
    const gs = m.grid.size || 70;
    return {
      x: Math.round((img.x - m.grid.ox) / gs) * gs + m.grid.ox,
      y: Math.round((img.y - m.grid.oy) / gs) * gs + m.grid.oy,
    };
  }

  /** Toutes les cases couvertes par le rectangle a→b (px image). */
  function cellsInRect(a, b) {
    const m = store.get().map || DEFAULT_MAP;
    const cell = m.fog.cell || 70;
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) / cell));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) / cell));
    const x1 = Math.floor(Math.max(a.x, b.x) / cell);
    const y1 = Math.floor(Math.max(a.y, b.y) / cell);
    const out = [];
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) out.push(`${cx},${cy}`);
    return out;
  }
  function setTool(t) {
    tool = t;
    container
      .querySelectorAll('[data-tool]')
      .forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    vp.dataset.tool = t;
    if (t !== 'tmpl') clearTemplate(); // le gabarit disparaît au changement d'outil
    if (t !== 'ruler') clearRuler(); // la règle disparaît au changement d'outil
    if (t !== 'wall' && wallChain.length) clearWallChain(); // termine le tracé de mur
    if (t !== 'select' && selectedIds.size) {
      selectedIds.clear();
      selPreview = null;
      renderAll();
    }
    if (store.get().map) renderTiles(store.get().map); // bascule l'édition des décors
  }

  container.querySelectorAll('[data-tool]').forEach((b) =>
    b.addEventListener('click', () => setTool(b.dataset.tool))
  );

  container.querySelector('#map-tmpl-shape')?.addEventListener('change', (e) => {
    tmplShape = e.target.value;
    if (template) {
      template.shape = tmplShape;
      renderTemplate();
    }
  });
  container.querySelector('#map-tmpl-dist')?.addEventListener('input', (e) => {
    tmplDistFt = Math.max(0, Number(e.target.value) || 0);
  });

  container.querySelector('#map-draw-shape')?.addEventListener('change', (e) => {
    drawShape = e.target.value;
    setTool('draw');
  });
  container.querySelector('#map-draw-color')?.addEventListener('input', (e) => {
    drawColor = e.target.value;
  });

  container.querySelector('#map-dark')?.addEventListener('input', (e) => {
    const a = store.get().map?.atmosphere || {};
    patchMap({ atmosphere: { ...a, darkness: Number(e.target.value) || 0 } });
  });
  container.querySelector('#map-weather-sel')?.addEventListener('change', (e) => {
    const a = store.get().map?.atmosphere || {};
    patchMap({ atmosphere: { ...a, weather: e.target.value } });
  });

  container.querySelectorAll('[data-layer]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.layer;
      layers[k] = !layers[k];
      b.classList.toggle('active', layers[k]);
      renderAll();
    })
  );

  /* ── Boutons d'action ── */
  container.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      const m = store.get().map || DEFAULT_MAP;
      switch (b.dataset.act) {
        case 'zoom-in': {
          const r = vp.getBoundingClientRect();
          zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2);
          break;
        }
        case 'zoom-out': {
          const r = vp.getBoundingClientRect();
          zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2);
          break;
        }
        case 'fit':
          fit();
          break;
        case 'immersive':
          document.body.classList.toggle('immersive');
          setTimeout(fit, 60); // recadre après le changement de taille du viewport
          break;
        case 'push-view':
          sendView({ px: view.px, py: view.py, z: view.z });
          showToast('Vue envoyée aux joueurs.', { icon: '👁', timeout: 2000 });
          break;
        case 'grid':
          patchMap({ grid: { ...m.grid, show: !m.grid.show } });
          break;
        case 'grid-cal':
          openGridCalib();
          break;
        case 'zone-save':
          openZoneSave();
          break;
        case 'draw-undo':
          removeLastDrawing();
          break;
        case 'draw-clear':
          if (await modalConfirm('Effacer tous les dessins de cette scène ?', { title: 'Dessins', danger: true, okLabel: 'Effacer' })) {
            clearDrawings();
          }
          break;
        case 'add-token': {
          const r = vp.getBoundingClientRect();
          const c = toImage(r.left + r.width / 2, r.top + r.height / 2);
          openTokenEditor({ create: { x: Math.round(c.x), y: Math.round(c.y) } });
          break;
        }
        case 'add-prop':
          addPropImage();
          break;
        case 'party':
          addTokensFromParty();
          break;
        case 'token-lib':
          openTokenLibrary();
          break;
        case 'scene-new': {
          const name = await modalPrompt('Nom de la nouvelle scène :', { title: 'Scènes', placeholder: 'Donjon, niveau 1' });
          if (name && name.trim()) createScene(name.trim());
          break;
        }
        case 'scene-rename': {
          const sc = store.get().scenes.find((s) => s.id === store.get().activeSceneId);
          const name = await modalPrompt('Renommer la scène :', { title: 'Scènes', defaultValue: sc?.name || '' });
          if (name && name.trim()) renameScene(store.get().activeSceneId, name.trim());
          break;
        }
        case 'scene-del': {
          if (store.get().scenes.length <= 1) {
            await modalAlert('Impossible de supprimer la dernière scène.', { title: 'Scènes' });
            break;
          }
          const sc = store.get().scenes.find((s) => s.id === store.get().activeSceneId);
          if (await modalConfirm(`Supprimer la scène « ${sc?.name} » ? Son contenu sera perdu.`, { title: 'Scènes', danger: true, okLabel: 'Supprimer' }))
            deleteScene(store.get().activeSceneId);
          break;
        }
        case 'scene-export': {
          const data = exportActiveScene();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${String(data.name || 'scene').replace(/[^\w\-]+/g, '_')}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
          break;
        }
        case 'fog':
          setFog(!m.fog.on);
          break;
        case 'fog-mode': {
          fogMode = fogMode === 'cell' ? 'rect' : 'cell';
          const fm = container.querySelector('#map-fogmode');
          if (fm) {
            fm.textContent = fogMode === 'cell' ? '▣' : '⬚';
            fm.classList.toggle('active', fogMode === 'rect');
          }
          break;
        }
        case 'reveal-all':
          revealAll();
          break;
        case 'hide-all':
          hideAll();
          break;
        case 'lighting':
          setLighting(!m.lighting?.on);
          break;
        case 'soundscape': {
          // Mémorise les pistes d'ambiance en cours de lecture pour cette scène.
          const playing = (store.get().ambience?.layers || []).filter((l) => l.playing).map((l) => l.id);
          patchMap({ soundscape: playing });
          showToast(
            playing.length
              ? `🔊 Ambiance liée à la scène (${playing.length} piste${playing.length > 1 ? 's' : ''}) — elle se relancera à l'activation.`
              : '🔇 Ambiance déliée de la scène (aucune piste en lecture).',
            { timeout: 3000 }
          );
          break;
        }
        case 'wall-undo':
          removeLastWall();
          break;
        case 'wall-clear':
          if (m.walls.length && (await modalConfirm('Effacer tous les murs ?', { title: 'Murs', danger: true, okLabel: 'Effacer' })))
            clearWalls();
          break;
        case 'light-clear':
          if (m.lights.length && (await modalConfirm('Effacer toutes les lumières ?', { title: 'Lumières', danger: true, okLabel: 'Effacer' })))
            clearLights();
          break;
        case 'explored-clear':
          if (await modalConfirm("Réinitialiser la mémoire d'exploration (tout redevient sombre) ?", { title: 'Mémoire d\'exploration', danger: true, okLabel: 'Réinitialiser' }))
            clearExplored();
          break;
      }
    })
  );

  // Import du fond
  const fileInput = container.querySelector('#map-file');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      await uploadBackground(file);
      fit();
    } catch (e) {
      await modalAlert('Import impossible : ' + e.message, { title: 'Fond de carte' });
    }
    fileInput.value = '';
  });

  // Réglages grille / distance
  container.querySelector('#map-grid')?.addEventListener('change', (e) => {
    const m = store.get().map || DEFAULT_MAP;
    const size = Math.max(10, Number(e.target.value) || 70);
    patchMap({ grid: { ...m.grid, size }, fog: { ...m.fog, cell: size } });
  });
  container.querySelector('#map-feet')?.addEventListener('change', (e) => {
    patchMap({ feetPerCell: Math.max(1, Number(e.target.value) || 5) });
  });
  container.querySelector('#map-gridop')?.addEventListener('input', (e) => {
    const m = store.get().map || DEFAULT_MAP;
    const opacity = Math.max(0, Math.min(1, (Number(e.target.value) || 0) / 100));
    patchMap({ grid: { ...m.grid, opacity } });
  });
  container.querySelector('#map-unit')?.addEventListener('change', (e) => {
    patchMap({ unit: e.target.value });
  });
  container.querySelector('#map-scene-sel')?.addEventListener('change', async (e) => {
    const sel = e.target;
    const name = sel.options[sel.selectedIndex]?.text || '';
    await switchScene(sel.value);
    showToast(`👁 Scène active : ${name} — visible par les joueurs`, { icon: '🗺', timeout: 2600 });
  });
  // Barre de scènes (vignettes) : changer de scène active ou en créer une.
  container.querySelector('#scene-nav')?.addEventListener('click', async (e) => {
    const newBtn = e.target.closest('[data-act="scene-new"]');
    if (newBtn) {
      const name = await modalPrompt('Nom de la nouvelle scène :', { title: 'Scènes', placeholder: 'Donjon, niveau 1' });
      if (name && name.trim()) createScene(name.trim());
      return;
    }
    const chip = e.target.closest('[data-scene]');
    if (!chip) return;
    const s = store.get().scenes.find((x) => x.id === chip.dataset.scene);
    await switchScene(chip.dataset.scene);
    showToast(`👁 Scène active : ${s?.name || ''} — visible par les joueurs`, { icon: '🗺', timeout: 2600 });
  });
  container.querySelector('#map-scene-file')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = JSON.parse(await file.text());
      const state = obj.state || obj; // accepte { type, name, state } ou un état brut
      const name = obj.name || file.name.replace(/\.json$/i, '');
      const id = await importSceneState(name, state);
      if (id) {
        showToast(`🗺 Scène « ${name} » importée.`, { timeout: 2600 });
        setTimeout(fit, 80);
      }
    } catch (ex) {
      await modalAlert('Scène JSON invalide : ' + ex.message, { title: 'Import de scène' });
    }
  });

  /* ── Interaction pointeur ── */
  vp.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Alt + molette au-dessus d'un jeton (MJ) → rotation par pas de 15°.
    if (e.altKey && isDM) {
      const el = e.target.closest('[data-token]');
      if (el) {
        const t = (store.get().map?.tokens || []).find((x) => x.id === el.dataset.token);
        if (t) {
          const rot = (((Number(t.rot) || 0) + (e.deltaY < 0 ? -15 : 15)) % 360 + 360) % 360;
          updateToken(t.id, { rot });
          return;
        }
      }
    }
    zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY);
  }, { passive: false });

  // Diffuse la position du curseur (throttlé) pour l'afficher chez les autres.
  vp.addEventListener('pointermove', (e) => {
    const now = performance.now();
    if (now - _lastCursorSend < 70) return;
    _lastCursorSend = now;
    const img = toImage(e.clientX, e.clientY);
    sendCursor(Math.round(img.x), Math.round(img.y));
  }, { passive: true });

  // Règle / mur : double-clic ou clic droit = terminer le tracé.
  vp.addEventListener('dblclick', () => {
    if (tool === 'ruler') clearRuler();
    if (tool === 'wall') clearWallChain();
  });
  vp.addEventListener('contextmenu', (e) => {
    if (tool === 'ruler' && rulerPts.length) {
      e.preventDefault();
      clearRuler();
    } else if (tool === 'wall' && wallChain.length) {
      e.preventDefault();
      clearWallChain();
    }
  });
  function clearWallChain() {
    wallChain = [];
    wallPreview = null;
    renderAll();
  }

  // Glisser-déposer d'une image (depuis le bureau) → crée un jeton (MJ).
  if (isDM) {
    const DND_ENTRY = 'application/x-vaultmj-entry';
    const DND_IMAGE = 'application/x-vaultmj-image';
    vp.addEventListener('dragover', (e) => {
      const ty = e.dataTransfer?.types;
      if (ty?.includes('Files') || ty?.includes(DND_ENTRY) || ty?.includes(DND_IMAGE)) {
        e.preventDefault();
        vp.classList.add('drop-hover');
      }
    });
    vp.addEventListener('dragleave', (e) => {
      if (e.target === vp) vp.classList.remove('drop-hover');
    });
    vp.addEventListener('drop', async (e) => {
      vp.classList.remove('drop-hover');
      const m = store.get().map || DEFAULT_MAP;
      const gs = m.grid.size || 70;
      const p = toImage(e.clientX, e.clientY);
      const x = e.shiftKey ? Math.round(p.x) : Math.floor(p.x / gs) * gs + gs / 2;
      const y = e.shiftKey ? Math.round(p.y) : Math.floor(p.y / gs) * gs + gs / 2;

      // 0) Glisser une image de la banque → jeton (chemin Storage existant).
      const bankPath = e.dataTransfer?.getData(DND_IMAGE);
      if (bankPath) {
        e.preventDefault();
        addToken({ x: Math.round(x), y: Math.round(y), label: '', img: bankPath });
        await resolveTokenUrls();
        showToast('🎭 Jeton ajouté.', { timeout: 1500 });
        return;
      }

      // 1) Glisser une entrée du compendium → jeton (monstre / PNJ / lieu).
      const raw = e.dataTransfer?.getData(DND_ENTRY);
      if (raw) {
        e.preventDefault();
        let entry;
        try {
          entry = JSON.parse(raw);
        } catch {
          return;
        }
        if (!['monster', 'npc', 'place'].includes(entry.kind)) {
          showToast('Seuls les monstres/PNJ/lieux deviennent des jetons.', { timeout: 2200 });
          return;
        }
        addToken({
          x: Math.round(x),
          y: Math.round(y),
          label: (entry.name || '').slice(0, 12),
          img: entry.img || null,
          ac: entry.ac,
          hp: entry.hp,
          hpMax: entry.hpMax,
        });
        await resolveTokenUrls();
        showToast(`🗺 ${entry.name} placé`, { timeout: 1600 });
        return;
      }

      // 2) Glisser une image du bureau → jeton.
      const file = [...(e.dataTransfer?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      try {
        const path = await uploadLibraryImage(file);
        if (path) addToken({ x: Math.round(x), y: Math.round(y), label: '', img: path });
      } catch (ex) {
        await modalAlert('Import impossible : ' + ex.message, { title: 'Jeton' });
      }
    });
  }

  vp.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) {
      // Clic droit sur un jeton (MJ) : laisser le menu contextuel s'ouvrir.
      if (isDM && e.button === 2 && e.target.closest?.('[data-token]')) return;
      // Bouton droit/milieu : pan rapide.
      dragging = { type: 'pan', sx: e.clientX, sy: e.clientY, px: view.px, py: view.py };
      vp.setPointerCapture(e.pointerId);
      return;
    }
    // Jeu en pause : le joueur ne peut que se déplacer dans la vue (pan), pas agir.
    if (playerLocked()) {
      dragging = { type: 'pan', sx: e.clientX, sy: e.clientY, px: view.px, py: view.py };
      vp.setPointerCapture(e.pointerId);
      return;
    }
    const img = toImage(e.clientX, e.clientY);
    const tokenEl = e.target.closest?.('[data-token]');

    // Clic sur un marqueur (tout outil) : ouvrir sa note / son menu.
    const pinEl = e.target.closest?.('[data-pin]');
    if (pinEl) {
      openPin(pinEl.dataset.pin, e);
      return;
    }
    // Outil marqueur (MJ) : poser un marqueur.
    if (tool === 'pin') {
      const px = Math.round(img.x);
      const py = Math.round(img.y);
      if (isDM) addPin({ x: px, y: py });
      else {
        sendPlayerRequest({ kind: 'pin', x: px, y: py, note: store.get().profile?.display_name || '' });
        showToast('📌 Marqueur envoyé.', { timeout: 1500 });
      }
      return;
    }
    if (isDM && tool === 'label') {
      const px = Math.round(img.x);
      const py = Math.round(img.y);
      modalPrompt('Texte de l’étiquette :', { title: 'Étiquette de zone', placeholder: 'Taverne, Pont…' }).then((txt) => {
        if (txt && txt.trim()) addLabel({ x: px, y: py, text: txt.trim() });
      });
      return;
    }

    if (tool === 'ping') {
      sendPing(Math.round(img.x), Math.round(img.y));
      return;
    }
    if (tool === 'ruler') {
      rulerPts.push(img); // clic = ajoute un waypoint (double-clic / clic droit = effacer)
      drawRulerPath();
      return;
    }
    if (tool === 'tmpl') {
      // Origine aimantée au centre de la case cliquée (« centré sur la case
      // d'où le sort est lancé »).
      const origin = cellCenter(img);
      const fixed = tmplFixedPx();
      let b = origin;
      if (fixed > 0) {
        // Distance imposée : b à `fixed` px de l'origine (orienté vers le curseur).
        const ang = Math.atan2(img.y - origin.y, img.x - origin.x) || 0;
        b = { x: origin.x + Math.cos(ang) * fixed, y: origin.y + Math.sin(ang) * fixed };
      }
      template = { shape: tmplShape, a: origin, b, fixed };
      dragging = { type: 'tmpl' };
      renderTemplate();
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (isDM && tool === 'wall') {
      // Tracé en chaîne : chaque clic ajoute un point ; le segment précédent est
      // posé. Double-clic / clic droit / Échap = terminer.
      const p = e.shiftKey ? img : snapToGrid(img);
      if (wallChain.length) {
        const prev = wallChain[wallChain.length - 1];
        if (Math.hypot(p.x - prev.x, p.y - prev.y) > 4) addWall({ x1: prev.x, y1: prev.y, x2: p.x, y2: p.y });
      }
      wallChain.push(p);
      wallPreview = { a: p, b: p };
      renderAll();
      return;
    }
    if (isDM && tool === 'door') {
      const a = e.shiftKey ? img : snapToGrid(img);
      dragging = { type: 'door', a, start: img };
      wallPreview = { a, b: a, door: true };
      renderAll();
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (isDM && tool === 'light') {
      dragging = { type: 'light', a: img };
      lightPreview = { x: img.x, y: img.y, r: 0 };
      renderAll();
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (tool === 'draw') {
      if (isDM && drawShape === 'text') {
        const gs = store.get().map?.grid?.size || 70;
        modalPrompt('Texte de l’annotation :', { title: 'Annotation' }).then((txt) => {
          if (txt && txt.trim()) {
            addDrawing({ type: 'text', x: Math.round(img.x), y: Math.round(img.y), text: txt.trim(), color: drawColor, fs: Math.round(gs * 0.4) });
          }
        });
        return;
      }
      dragging = { type: 'draw', shape: drawShape, a: img, pts: [img] };
      drawPreview = { type: drawShape, a: img, b: img, pts: [img], color: drawColor, w: drawWidth };
      renderDrawings(store.get().map);
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (isDM && tool === 'select') {
      if (tokenEl) {
        const id = tokenEl.dataset.token;
        if (!selectedIds.has(id)) {
          if (!e.shiftKey) selectedIds.clear();
          selectedIds.add(id);
        }
        // Déplacement groupé : mémorise la position d'origine de chaque sélectionné.
        const tokens = store.get().map?.tokens || [];
        const origins = new Map();
        for (const t of tokens) if (selectedIds.has(t.id)) origins.set(t.id, { x: t.x, y: t.y });
        suppressRender = true;
        dragging = { type: 'selmove', start: img, origins };
        renderAll();
      } else {
        if (!e.shiftKey) selectedIds.clear();
        dragging = { type: 'selrect', a: img, base: new Set(selectedIds) };
        selPreview = { a: img, b: img };
        renderAll();
      }
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (isDM && (tool === 'reveal' || tool === 'hide')) {
      const reveal = tool === 'reveal';
      if (fogMode === 'rect') {
        dragging = { type: 'fogrect', reveal, a: img };
        fogPreview = { a: img, b: img, reveal };
        renderAll();
      } else {
        dragging = { type: 'fog', reveal };
        paintFog(cellsAt(img), reveal);
      }
      vp.setPointerCapture(e.pointerId);
      return;
    }
    if (tokenEl) {
      const tk = (store.get().map?.tokens || []).find((x) => x.id === tokenEl.dataset.token);
      // Déplaçable par le MJ, ou par le joueur propriétaire du PJ lié.
      if (tk && canMoveToken(tk) && !tk.locked) {
        suppressRender = true;
        dragging = {
          type: 'token',
          id: tokenEl.dataset.token,
          el: tokenEl,
          start: { x: tk.x ?? img.x, y: tk.y ?? img.y },
          // Dernière position franchissable (collision murs pour les joueurs).
          validX: tk.x ?? img.x,
          validY: tk.y ?? img.y,
        };
        tokenEl.classList.add('dragging');
        vp.setPointerCapture(e.pointerId);
        return;
      }
      // Jeton non contrôlé (ennemi pour un joueur) : clic gauche = cibler/décibler.
      if (tk && !isDM && !canMoveToken(tk)) {
        if (targetIds.has(tk.id)) targetIds.delete(tk.id);
        else targetIds.add(tk.id);
        store.set({ targets: [...targetIds] });
        showToast(targetIds.has(tk.id) ? `🎯 ${tk.label || 'Cible'} ciblé(e) (${targetIds.size})` : `Cible retirée (${targetIds.size})`, { timeout: 1300 });
        renderAll();
        return;
      }
      // sinon (verrouillé / pas le droit) → pan
    }
    // Sinon : pan.
    dragging = { type: 'pan', sx: e.clientX, sy: e.clientY, px: view.px, py: view.py };
    vp.setPointerCapture(e.pointerId);
  });

  vp.addEventListener('pointermove', (e) => {
    // Règle à waypoints : le segment vers le curseur suit la souris (sans bouton).
    if (tool === 'ruler' && rulerPts.length) {
      drawRulerPath(toImage(e.clientX, e.clientY));
      return;
    }
    // Mur en chaîne : aperçu du segment depuis le dernier point vers le curseur.
    if (isDM && tool === 'wall' && wallChain.length) {
      const raw = toImage(e.clientX, e.clientY);
      wallPreview = { a: wallChain[wallChain.length - 1], b: e.shiftKey ? raw : snapToGrid(raw) };
      const m = store.get().map;
      if (m) drawCanvas(m, ...Object.values(sceneDims()));
      return;
    }
    if (!dragging) {
      if (tool === 'move' || tool === 'ping') return;
    }
    if (!dragging) return;
    const img = toImage(e.clientX, e.clientY);

    if (dragging.type === 'pan') {
      view.px = dragging.px + (e.clientX - dragging.sx);
      view.py = dragging.py + (e.clientY - dragging.sy);
      applyTransform();
    } else if (dragging.type === 'tmpl') {
      if (template) {
        if (template.fixed > 0) {
          // Rayon/longueur verrouillé : on ne fait qu'orienter le gabarit.
          const ang = Math.atan2(img.y - template.a.y, img.x - template.a.x);
          template.b = { x: template.a.x + Math.cos(ang) * template.fixed, y: template.a.y + Math.sin(ang) * template.fixed };
        } else {
          template.b = img;
        }
        renderTemplate();
      }
    } else if (dragging.type === 'fog') {
      paintFog(cellsAt(img), dragging.reveal);
    } else if (dragging.type === 'fogrect') {
      fogPreview = { a: dragging.a, b: img, reveal: dragging.reveal };
      const m = store.get().map;
      if (m) drawCanvas(m, ...Object.values(sceneDims()));
    } else if (dragging.type === 'wall' || dragging.type === 'door') {
      wallPreview = { a: dragging.a, b: e.shiftKey ? img : snapToGrid(img), door: dragging.type === 'door' };
      const m = store.get().map;
      if (m) drawCanvas(m, ...Object.values(sceneDims()));
    } else if (dragging.type === 'light') {
      const m = store.get().map || DEFAULT_MAP;
      const gs = m.grid.size || 70;
      const r = Math.hypot(img.x - dragging.a.x, img.y - dragging.a.y);
      lightPreview = { x: dragging.a.x, y: dragging.a.y, r };
      hud.style.display = 'block';
      hud.textContent = `Lumière ${Math.round(r / gs) || 0} cases`;
      drawCanvas(m, ...Object.values(sceneDims()));
    } else if (dragging.type === 'draw') {
      if (dragging.shape === 'free') {
        dragging.pts.push(img);
        drawPreview.pts = dragging.pts;
      } else {
        drawPreview.a = dragging.a;
        drawPreview.b = img;
      }
      renderDrawings(store.get().map);
    } else if (dragging.type === 'selrect') {
      selPreview = { a: dragging.a, b: img };
      // Sélection vive : jetons dont le centre est dans le cadre (+ base si Maj).
      const x0 = Math.min(dragging.a.x, img.x);
      const x1 = Math.max(dragging.a.x, img.x);
      const y0 = Math.min(dragging.a.y, img.y);
      const y1 = Math.max(dragging.a.y, img.y);
      const next = new Set(dragging.base);
      for (const t of store.get().map?.tokens || []) {
        if (t.x >= x0 && t.x <= x1 && t.y >= y0 && t.y <= y1) next.add(t.id);
      }
      selectedIds = next;
      renderAll();
    } else if (dragging.type === 'selmove') {
      const m = store.get().map || DEFAULT_MAP;
      const gs = m.grid.size || 70;
      let ddx = img.x - dragging.start.x;
      let ddy = img.y - dragging.start.y;
      if (!e.shiftKey) {
        ddx = Math.round(ddx / gs) * gs;
        ddy = Math.round(ddy / gs) * gs;
      }
      dragging.delta = { ddx, ddy };
      for (const [id, o] of dragging.origins) {
        const el = tokensEl.querySelector(`[data-token="${id}"]`);
        if (el) {
          el.style.left = `${o.x + ddx}px`;
          el.style.top = `${o.y + ddy}px`;
        }
      }
      hud.style.display = 'block';
      const cells = Math.round(Math.max(Math.abs(ddx), Math.abs(ddy)) / gs);
      hud.textContent = `${cells} cases · ${cells * m.feetPerCell} ${m.unit}`;
    } else if (dragging.type === 'token') {
      const m = store.get().map || DEFAULT_MAP;
      const gs = m.grid.size || 70;
      // Aimantation sur le centre de la case (tient compte du décalage de grille).
      let x = img.x;
      let y = img.y;
      if (!e.shiftKey) {
        const c = cellCenter(img);
        x = c.x;
        y = c.y;
      }
      // Collision : un joueur ne peut pas franchir un mur / une porte fermée.
      // (Le MJ déplace librement.) On teste le pas depuis la dernière position
      // valide ; si bloqué, le jeton reste collé contre l'obstacle.
      if (!isDM && (m.walls || []).length) {
        if (losBlocked(dragging.validX, dragging.validY, x, y, m.walls)) {
          x = dragging.validX;
          y = dragging.validY;
        } else {
          dragging.validX = x;
          dragging.validY = y;
        }
      }
      dragging.el.style.left = `${x}px`;
      dragging.el.style.top = `${y}px`;
      dragging.lastX = Math.round(x);
      dragging.lastY = Math.round(y);
      // Distance parcourue depuis le point de départ (règle 5e : diagonale = 1 case).
      if (dragging.start) {
        const dxC = Math.abs(x - dragging.start.x) / gs;
        const dyC = Math.abs(y - dragging.start.y) / gs;
        const cells = Math.round(Math.max(dxC, dyC));
        hud.style.display = 'block';
        hud.textContent = `${cells} cases · ${cells * m.feetPerCell} ${m.unit}`;
        // Trajet surligné uniquement (la vision n'est PAS recalculée pendant le
        // drag : elle ne se met à jour qu'au drop, pour éviter qu'un joueur
        // « explore » la carte en promenant son jeton sans le déposer).
        const ox = m.grid.ox || 0;
        const oy = m.grid.oy || 0;
        const c0 = { cx: Math.floor((dragging.start.x - ox) / gs), cy: Math.floor((dragging.start.y - oy) / gs) };
        const c1 = { cx: Math.floor((x - ox) / gs), cy: Math.floor((y - oy) / gs) };
        movePreview = { gs, ox, oy, cells: lineCells(c0, c1), end: c1 };
        scheduleDragDraw();
      }
    }
  });

  vp.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    if (dragging.type === 'fogrect') {
      paintFog(cellsInRect(dragging.a, toImage(e.clientX, e.clientY)), dragging.reveal);
      fogPreview = null;
      renderAll();
    } else if (dragging.type === 'wall' || dragging.type === 'door') {
      const raw = toImage(e.clientX, e.clientY);
      const b = e.shiftKey ? raw : snapToGrid(raw);
      const { a } = dragging;
      const isDoor = dragging.type === 'door';
      if (Math.hypot(b.x - a.x, b.y - a.y) > 4) {
        addWall(isDoor ? { x1: a.x, y1: a.y, x2: b.x, y2: b.y, door: true, open: false }
                       : { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      } else if (isDoor) {
        // Clic simple en mode porte : ouvrir/fermer la porte la plus proche.
        const i = nearestDoor(raw);
        if (i >= 0) toggleDoor(i);
      }
      wallPreview = null;
      renderAll();
    } else if (dragging.type === 'light') {
      const m = store.get().map || DEFAULT_MAP;
      const gs = m.grid.size || 70;
      const raw = toImage(e.clientX, e.clientY);
      const r = Math.hypot(raw.x - dragging.a.x, raw.y - dragging.a.y);
      if (r > gs * 0.4) {
        addLight({ x: Math.round(dragging.a.x), y: Math.round(dragging.a.y), radius: Math.max(1, Math.round(r / gs)) });
      } else {
        // Clic simple : retirer une lumière proche, sinon en poser une (rayon 4).
        const lid = nearestLight(raw);
        if (lid) openLightMenu(lid, e); // édition (couleur/rayon/suppr.)
        else addLight({ x: Math.round(dragging.a.x), y: Math.round(dragging.a.y), radius: 4 });
      }
      lightPreview = null;
      hud.style.display = 'none';
      renderAll();
    } else if (dragging.type === 'draw') {
      const shape = dragging.shape;
      let d = null;
      if (shape === 'free') {
        if (dragging.pts.length > 1) {
          d = { type: 'free', pts: dragging.pts.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), color: drawColor, w: drawWidth };
        }
      } else {
        const b = toImage(e.clientX, e.clientY);
        if (Math.hypot(b.x - dragging.a.x, b.y - dragging.a.y) > 4) {
          d = {
            type: shape,
            a: { x: Math.round(dragging.a.x), y: Math.round(dragging.a.y) },
            b: { x: Math.round(b.x), y: Math.round(b.y) },
            color: drawColor,
            w: drawWidth,
          };
        }
      }
      drawPreview = null;
      if (d) {
        if (isDM) addDrawing(d); // MJ : persiste dans la scène
        else {
          addEphemeralDraw(d); // joueur : éphémère + diffusé
          sendDraw(d);
        }
      } else renderDrawings(store.get().map);
    } else if (dragging.type === 'selrect') {
      selPreview = null;
      renderAll();
    } else if (dragging.type === 'selmove') {
      const d = dragging.delta;
      hud.style.display = 'none';
      suppressRender = false;
      if (d && (d.ddx || d.ddy)) {
        const m = store.get().map;
        if (m) {
          patchMap({
            tokens: m.tokens.map((t) =>
              dragging.origins.has(t.id)
                ? { ...t, x: dragging.origins.get(t.id).x + d.ddx, y: dragging.origins.get(t.id).y + d.ddy }
                : t
            ),
          });
        }
      } else {
        renderAll();
      }
    } else if (dragging.type === 'token') {
      dragging.el.classList.remove('dragging');
      hud.style.display = 'none'; // masque la distance de déplacement
      if (_dragRaf) { cancelAnimationFrame(_dragRaf); _dragRaf = 0; }
      movePreview = null; // efface le trajet
      // Lever la garde AVANT de persister, pour que le déplacement déclenche un
      // rendu immédiat (recalcul de la vision dynamique au drop).
      suppressRender = false;
      if (dragging.lastX != null) {
        if (isDM) {
          moveToken(dragging.id, dragging.lastX, dragging.lastY);
        } else {
          // Joueur : applique en local + diffuse (le MJ persistera).
          applyTokenMoveLocal(dragging.id, dragging.lastX, dragging.lastY);
          sendTokenMove(dragging.id, dragging.lastX, dragging.lastY);
          renderAll();
        }
      }
    } else if (dragging.type === 'tmpl') {
      // Au lâcher : les jetons sous le gabarit deviennent les cibles courantes.
      if (tmplHits.size) {
        targetIds = new Set(tmplHits);
        store.set({ targets: [...targetIds] });
        showToast(`🎯 ${targetIds.size} cible(s) sous le gabarit`, { timeout: 1900 });
        renderAll();
        updateTemplateHits();
        openSpellChooserForTargets(); // propose de lancer un sort sur ces cibles
      }
    }
    try {
      vp.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    dragging = null;
  });

  // Édition / suppression d'un jeton (MJ) au double-clic.
  tokensEl.addEventListener('dblclick', async (e) => {
    if (!isDM) return;
    const el = e.target.closest('[data-token]');
    if (!el) return;
    const id = el.dataset.token;
    const t = (store.get().map?.tokens || []).find((x) => x.id === id);
    if (!t) return;
    // Renommage simple. Suppression/visibilité/taille : via le menu contextuel (clic droit).
    const label = await modalPrompt('Étiquette du jeton :', { title: 'Renommer le jeton', defaultValue: t.label || '' });
    if (label !== null) updateToken(id, { label: label.trim() });
  });

  // Menu contextuel d'un jeton (MJ) : visibilité / renommer / supprimer.
  let ctxMenu = null;
  function closeCtx() {
    if (ctxMenu) {
      ctxMenu.remove();
      ctxMenu = null;
    }
  }
  tokensEl.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-token]');
    if (!el) return;
    if (playerLocked()) return; // jeu en pause : pas de ciblage/attaque joueur
    e.preventDefault();
    const id = el.dataset.token;
    const t = (store.get().map?.tokens || []).find((x) => x.id === id);
    if (!t) return;
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx';
    ctxMenu.style.left = `${e.clientX}px`;
    ctxMenu.style.top = `${e.clientY}px`;

    // Menu réduit pour les joueurs : cibler + attaquer depuis son propre jeton.
    if (!isDM) {
      const own = canMoveToken(t);
      ctxMenu.innerHTML = `
        <button data-ctx="target">${targetIds.has(id) ? '🎯 Cible (retirer)' : '🎯 Ajouter aux cibles'}</button>
        ${targetIds.size ? `<button data-ctx="cleartargets">🎯 Effacer les cibles (${targetIds.size})</button>` : ''}
        ${own ? `<button data-ctx="attack">⚔ Attaquer${targetIds.size ? ` (${targetIds.size})` : ''}…</button>` : ''}`;
      document.body.appendChild(ctxMenu);
      const mr0 = ctxMenu.getBoundingClientRect();
      ctxMenu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - mr0.width - 8))}px`;
      ctxMenu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - mr0.height - 8))}px`;
      ctxMenu.querySelectorAll('[data-ctx]').forEach((b) =>
        b.addEventListener('click', () => {
          const act = b.dataset.ctx;
          closeCtx();
          if (act === 'target') {
            if (targetIds.has(id)) targetIds.delete(id);
            else targetIds.add(id);
            store.set({ targets: [...targetIds] });
            showToast(targetIds.size ? `🎯 ${targetIds.size} cible(s)` : 'Cibles effacées', { timeout: 1500 });
            renderAll();
          } else if (act === 'cleartargets') {
            targetIds.clear();
            store.set({ targets: [] });
            renderAll();
          } else if (act === 'attack') {
            openAttackResolver({ attackerTokenId: id, targetTokenIds: [...targetIds] });
          }
        })
      );
      return;
    }

    ctxMenu.innerHTML = `
      <button data-ctx="edit">📋 Modifier (PV / infos)…</button>
      <button data-ctx="tocombat">⚔ Ajouter au combat</button>
      <button data-ctx="attack">⚔ Attaquer${targetIds.size > 1 ? ` (${targetIds.size} cibles)` : ''}…</button>
      <button data-ctx="target">${targetIds.has(id) ? '🎯 Cible (retirer)' : '🎯 Ajouter aux cibles'}</button>
      ${targetIds.size ? `<button data-ctx="cleartargets">🎯 Effacer les cibles (${targetIds.size})</button>` : ''}
      <button data-ctx="image">🖼 Image…</button>
      <button data-ctx="conds">🩹 États…</button>
      <button data-ctx="vis">${t.hidden ? '👁 Afficher aux joueurs' : '🙈 Masquer aux joueurs'}</button>
      <button data-ctx="pull">📍 Amener les joueurs ici</button>
      <button data-ctx="vision">🔦 Vision : ${t.vision ? `${t.vision} cases` : 'aucune'}</button>
      <button data-ctx="lock">${t.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</button>
      <button data-ctx="rename">✏ Renommer</button>
      <button data-ctx="grow">⬆ Agrandir</button>
      <button data-ctx="shrink">⬇ Réduire</button>
      <button data-ctx="dup">🔁 Dupliquer${selectedIds.size > 1 && selectedIds.has(id) ? ` (${selectedIds.size})` : ''}</button>
      ${selectedIds.size > 1 ? `<button data-ctx="delsel" class="danger">🗑 Supprimer la sélection (${selectedIds.size})</button>` : ''}
      <button data-ctx="del" class="danger">🗑 Supprimer</button>`;
    document.body.appendChild(ctxMenu);
    // Repositionne le menu pour qu'il reste dans la fenêtre.
    const mr = ctxMenu.getBoundingClientRect();
    const mx = Math.min(e.clientX, window.innerWidth - mr.width - 8);
    const my = Math.min(e.clientY, window.innerHeight - mr.height - 8);
    ctxMenu.style.left = `${Math.max(8, mx)}px`;
    ctxMenu.style.top = `${Math.max(8, my)}px`;
    ctxMenu.querySelectorAll('[data-ctx]').forEach((b) =>
      b.addEventListener('click', async () => {
        const act = b.dataset.ctx;
        const cur = (store.get().map?.tokens || []).find((x) => x.id === id);
        closeCtx(); // ferme le menu avant d'ouvrir une éventuelle modale
        switch (act) {
          case 'edit':
            openTokenEditor({ id });
            break;
          case 'tocombat': {
            if (combatantForToken(cur)) {
              showToast('Ce jeton est déjà dans le combat.', { timeout: 2000 });
              break;
            }
            const ch = cur?.charId ? store.get().characters.find((c) => c.id === cur.charId) : null;
            const eid = await addCombatant({
              name: cur?.label || ch?.name || 'Combattant',
              initiative: 0,
              hp: ch ? ch.data?.hp : cur?.hp,
              hpMax: ch ? ch.data?.hpMax : cur?.hpMax,
              hpTemp: ch ? ch.data?.hpTmp : cur?.hpTemp,
              charId: cur?.charId ?? null,
            });
            if (eid) {
              updateToken(id, { entityId: eid });
              showToast('⚔ Ajouté au combat (jeton lié).', { timeout: 2200 });
            }
            break;
          }
          case 'attack':
            openAttackResolver({ attackerTokenId: id, targetTokenIds: [...targetIds] });
            break;
          case 'target':
            if (targetIds.has(id)) targetIds.delete(id);
            else targetIds.add(id);
            store.set({ targets: [...targetIds] });
            showToast(targetIds.size ? `🎯 ${targetIds.size} cible(s)` : 'Cibles effacées', { timeout: 1600 });
            renderAll();
            break;
          case 'cleartargets':
            targetIds.clear();
            store.set({ targets: [] });
            renderAll();
            break;
          case 'image':
            pickTokenImage(id);
            break;
          case 'conds':
            openConditionsPicker(id, e.clientX, e.clientY);
            break;
          case 'lock':
            updateToken(id, { locked: !cur?.locked });
            break;
          case 'vis':
            updateToken(id, { hidden: !cur?.hidden });
            break;
          case 'pull':
            if (cur) pullPlayersTo(cur.x, cur.y);
            break;
          case 'vision': {
            const nv = await modalPrompt('Rayon de vision du jeton, en cases (0 = aucune) :', {
              title: 'Vision du jeton',
              defaultValue: String(cur?.vision ?? 0),
            });
            if (nv !== null) setTokenVision(id, nv);
            break;
          }
          case 'rename': {
            const nv = await modalPrompt('Étiquette du jeton :', { title: 'Renommer le jeton', defaultValue: cur?.label || '' });
            if (nv !== null) updateToken(id, { label: nv.trim() });
            break;
          }
          case 'grow':
            updateToken(id, { size: Math.min(4, (cur?.size || 1) + 1) });
            break;
          case 'shrink':
            updateToken(id, { size: Math.max(1, (cur?.size || 1) - 1) });
            break;
          case 'dup': {
            if (selectedIds.size > 1 && selectedIds.has(id)) {
              const sel = (store.get().map?.tokens || []).filter((x) => selectedIds.has(x.id));
              sel.forEach(dupToken);
              showToast(`🔁 ${sel.length} jeton(s) dupliqué(s)`, { timeout: 1800 });
            } else {
              dupToken(cur);
              showToast('🔁 Jeton dupliqué', { timeout: 1500 });
            }
            break;
          }
          case 'delsel': {
            const n = selectedIds.size;
            if (await modalConfirm(`Supprimer ${n} jeton(s) sélectionné(s) ?`, { title: 'Jetons', danger: true, okLabel: 'Supprimer' })) {
              const m = store.get().map;
              if (m) patchMap({ tokens: m.tokens.filter((x) => !selectedIds.has(x.id)) });
              selectedIds.clear();
              renderAll();
            }
            break;
          }
          case 'del':
            removeToken(id);
            break;
        }
      })
    );
  });

  /** Duplique un jeton (nouveau id, légèrement décalé ; lien combat non partagé). */
  function dupToken(t) {
    const m = store.get().map;
    if (!m || !t) return;
    const gs = m.grid.size || 70;
    // Décale d'une case pleine (conserve l'alignement de l'original).
    const copy = { ...t, id: `t_${crypto.randomUUID().slice(0, 8)}`, x: Math.round(t.x + gs), y: Math.round(t.y) };
    delete copy.entityId; // ne pas partager le lien au combattant d'origine
    patchMap({ tokens: [...m.tokens, copy] });
    return copy.id;
  }
  const onDocPointer = (e) => {
    if (ctxMenu && !ctxMenu.contains(e.target)) closeCtx();
  };
  document.addEventListener('pointerdown', onDocPointer, true);

  // HUD de jeton : intercepte les clics sur ses boutons AVANT le drag/pan
  // (phase de capture + stopPropagation), puis exécute l'action.
  tokensEl.addEventListener(
    'pointerdown',
    (e) => {
      const b = e.target.closest('[data-hud]');
      if (!b) return;
      e.stopPropagation();
      e.preventDefault();
      const tid = b.closest('[data-hudfor]')?.dataset.hudfor;
      const t = (store.get().map?.tokens || []).find((x) => x.id === tid);
      if (!t) return;
      switch (b.dataset.hud) {
        case 'hp-':
          hudQuickHp(t, e.shiftKey ? -5 : -1);
          break;
        case 'hp+':
          hudQuickHp(t, e.shiftKey ? 5 : 1);
          break;
        case 'target':
          if (targetIds.has(t.id)) targetIds.delete(t.id);
          else targetIds.add(t.id);
          store.set({ targets: [...targetIds] });
          renderAll();
          break;
        case 'conds':
          openConditionsPicker(t.id, e.clientX, e.clientY);
          break;
        case 'hide':
          updateToken(t.id, { hidden: !t.hidden });
          break;
        case 'edit':
          openTokenEditor({ id: t.id });
          break;
        case 'grow':
          updateToken(t.id, { size: Math.min(4, (t.size || 1) + 1) });
          break;
        case 'shrink':
          updateToken(t.id, { size: Math.max(1, (t.size || 1) - 1) });
          break;
        case 'sheet':
          if (t.charId) window.dispatchEvent(new CustomEvent('vaultmj:opensheet', { detail: { charId: t.charId } }));
          break;
        case 'pull':
          pullPlayersTo(t.x, t.y);
          break;
        case 'del':
          removeToken(t.id);
          break;
      }
    },
    true
  );

  /* ── Portes : clic = ouvrir/fermer, clic droit = supprimer (MJ) ── */
  doorsEl.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-door]')) e.stopPropagation(); // n'amorce pas un pan
  });
  doorsEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-door]');
    if (!b) return;
    e.stopPropagation();
    const i = Number(b.dataset.door);
    if (isDM) {
      toggleDoor(i);
      return;
    }
    if (store.get().paused) {
      showToast('⏸ Jeu en pause.', { timeout: 1500 });
      return;
    }
    // Joueur : il faut un de ses jetons à proximité de la porte.
    const m = store.get().map;
    const w = m?.walls?.[i];
    if (!w) return;
    if (w.locked) {
      showToast('🔒 Cette porte est verrouillée.', { timeout: 2000 });
      return;
    }
    const mx = (w.x1 + w.x2) / 2;
    const my = (w.y1 + w.y2) / 2;
    const gs = m.grid.size || 70;
    const near = (m.tokens || []).some((t) => canMoveToken(t) && Math.hypot(t.x - mx, t.y - my) <= gs * 1.5);
    if (!near) {
      showToast('🚪 Trop éloigné pour atteindre cette porte.', { timeout: 2200 });
      return;
    }
    sendPlayerRequest({ kind: 'door', index: i }); // le MJ applique
  });
  doorsEl.addEventListener('contextmenu', (e) => {
    const b = e.target.closest('[data-door]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    if (isDM) openDoorMenu(Number(b.dataset.door), e); // options MJ (verrou/secret/suppr.)
  });

  /** Menu contextuel d'une porte (MJ) : ouvrir, verrouiller, secret, supprimer. */
  function openDoorMenu(i, e) {
    const w = store.get().map?.walls?.[i];
    if (!w) return;
    closeCtx();
    ctxMenu = document.createElement('div');
    ctxMenu.className = 'map-ctx';
    ctxMenu.innerHTML = `
      <button data-dm="open">${w.open ? '🚪 Fermer' : '🔓 Ouvrir'}</button>
      <button data-dm="lock">${w.locked ? '🔓 Déverrouiller' : '🔒 Verrouiller'}</button>
      <button data-dm="secret">${w.secret ? '👁 Rendre visible' : '🕵 Rendre secrète'}</button>
      <button data-dm="del" class="danger">🗑 Supprimer</button>`;
    document.body.appendChild(ctxMenu);
    const mr = ctxMenu.getBoundingClientRect();
    ctxMenu.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - mr.width - 8))}px`;
    ctxMenu.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - mr.height - 8))}px`;
    ctxMenu.querySelectorAll('[data-dm]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const act = btn.dataset.dm;
        closeCtx();
        if (act === 'open') toggleDoor(i);
        else if (act === 'lock') updateWallAt(i, { locked: !w.locked, open: w.locked ? w.open : false });
        else if (act === 'secret') updateWallAt(i, { secret: !w.secret });
        else if (act === 'del') removeWallAt(i);
      })
    );
  }

  /* ── Étiquettes : clic (MJ) = menu modifier/révéler/supprimer ── */
  labelsEl.addEventListener('pointerdown', (e) => {
    if (isDM && e.target.closest('[data-label-id]')) e.stopPropagation();
  });
  labelsEl.addEventListener('click', (e) => {
    const el = e.target.closest('[data-label-id]');
    if (!el || !isDM) return;
    e.stopPropagation();
    openLabel(el.dataset.labelId, e);
  });

  /** Sélection d'une image pour un jeton (upload). */
  function pickTokenImage(id) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        await uploadTokenImage(file, id);
      } catch (e) {
        await modalAlert('Image impossible : ' + e.message, { title: 'Image du jeton' });
      }
    });
    inp.click();
  }

  /* ── Décors / props ── */
  function addPropImage() {
    if (!isDM) return;
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.addEventListener('change', async () => {
      const file = inp.files?.[0];
      if (!file) return;
      try {
        const path = await uploadTokenAsset(file);
        if (!path) return;
        const m = store.get().map || DEFAULT_MAP;
        const gs = m.grid.size || 70;
        const r = vp.getBoundingClientRect();
        const c = toImage(r.left + r.width / 2, r.top + r.height / 2);
        const id = addTile({ img: path, x: Math.round(c.x), y: Math.round(c.y), w: gs * 2, h: gs * 2 });
        selectedTile = id;
        await resolveTokenUrls();
        setTool('tile');
        showToast('🪟 Décor ajouté — outil Décor actif pour le placer.', { timeout: 2600 });
      } catch (e) {
        await modalAlert('Image impossible : ' + e.message, { title: 'Décor' });
      }
    });
    inp.click();
  }

  function setupTileLayer(el) {
    el.addEventListener('pointerdown', (e) => {
      if (tool !== 'tile' || !isDM) return;
      const td = e.target.closest('[data-tile]');
      if (!td) return;
      e.stopPropagation();
      const id = td.dataset.tile;
      const t = (store.get().map?.tiles || []).find((x) => x.id === id);
      if (!t) return;
      selectedTile = id;
      const img0 = toImage(e.clientX, e.clientY);
      tileDrag = { id, el: td, dx: t.x - img0.x, dy: t.y - img0.y, lastX: t.x, lastY: t.y };
      td.setPointerCapture(e.pointerId);
      renderTiles(store.get().map);
    });
    el.addEventListener('pointermove', (e) => {
      if (!tileDrag) return;
      const img = toImage(e.clientX, e.clientY);
      let x = img.x + tileDrag.dx;
      let y = img.y + tileDrag.dy;
      if (!e.shiftKey) {
        const gs = (store.get().map?.grid?.size || 70) / 2; // aimante au demi-carreau
        x = Math.round(x / gs) * gs;
        y = Math.round(y / gs) * gs;
      }
      tileDrag.lastX = x;
      tileDrag.lastY = y;
      tileDrag.el.style.left = `${x}px`;
      tileDrag.el.style.top = `${y}px`;
    });
    const end = (e) => {
      if (!tileDrag) return;
      updateTile(tileDrag.id, { x: Math.round(tileDrag.lastX), y: Math.round(tileDrag.lastY) });
      try {
        tileDrag.el.releasePointerCapture(e.pointerId);
      } catch {
        /* no-op */
      }
      tileDrag = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('dblclick', (e) => {
      if (!isDM) return;
      const td = e.target.closest('[data-tile]');
      if (!td) return;
      e.stopPropagation();
      openTileEditor(td.dataset.tile);
    });
    el.addEventListener('contextmenu', (e) => {
      if (tool !== 'tile' || !isDM) return;
      const td = e.target.closest('[data-tile]');
      if (!td) return;
      e.preventDefault();
      e.stopPropagation();
      openTileEditor(td.dataset.tile);
    });
  }
  setupTileLayer(tilesBelowEl);
  setupTileLayer(tilesAboveEl);

  let tileEditor = null;
  function openTileEditor(id) {
    if (!isDM) return;
    if (tileEditor) tileEditor.remove();
    const t = (store.get().map?.tiles || []).find((x) => x.id === id);
    if (!t) return;
    const ov = document.createElement('div');
    ov.className = 'modal-overlay show';
    ov.innerHTML = `
      <div class="modal-card" role="dialog" aria-modal="true" style="width:300px;max-width:92vw">
        <h3 class="modal-title">🪟 Décor</h3>
        <div class="atk-row atk-grid2">
          <div><label>Largeur (px)</label><input class="atk-in" id="tl-w" type="number" min="10" value="${Math.round(t.w)}"></div>
          <div><label>Hauteur (px)</label><input class="atk-in" id="tl-h" type="number" min="10" value="${Math.round(t.h)}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Rotation (°)</label><input class="atk-in" id="tl-rot" type="number" step="15" value="${t.rot || 0}"></div>
          <div><label>Opacité (%)</label><input class="atk-in" id="tl-op" type="number" min="10" max="100" value="${Math.round((t.opacity ?? 1) * 100)}"></div>
        </div>
        <label class="atk-row" style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="tl-above" ${t.above ? 'checked' : ''}> Au-dessus des jetons (toit / surplomb)</label>
        <div class="modal-actions">
          <button class="modal-btn danger" id="tl-del">🗑 Supprimer</button>
          <button class="modal-btn modal-ok" id="tl-ok">Appliquer</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    tileEditor = ov;
    const close = () => {
      ov.remove();
      tileEditor = null;
    };
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) close();
    });
    ov.querySelector('#tl-del').addEventListener('click', () => {
      removeTile(id);
      close();
    });
    ov.querySelector('#tl-ok').addEventListener('click', () => {
      updateTile(id, {
        w: Math.max(10, Number(ov.querySelector('#tl-w').value) || t.w),
        h: Math.max(10, Number(ov.querySelector('#tl-h').value) || t.h),
        rot: Number(ov.querySelector('#tl-rot').value) || 0,
        opacity: Math.max(0.1, Math.min(1, (Number(ov.querySelector('#tl-op').value) || 100) / 100)),
        above: ov.querySelector('#tl-above').checked,
      });
      close();
    });
  }

  /**
   * Éditeur de jeton (création ou modification) : nom, PV/PV temp/PV max, CA,
   * taille, vision, couleur, image, note. À la création, place le jeton aux
   * coordonnées fournies ; à l'édition, applique les changements au jeton.
   */
  let tokEditor = null;
  function closeTokenEditor() {
    if (tokEditor) {
      tokEditor.remove();
      tokEditor = null;
    }
  }
  function openTokenEditor({ id = null, create = null } = {}) {
    if (!isDM) return;
    closeTokenEditor();
    const existing = id ? (store.get().map?.tokens || []).find((x) => x.id === id) : null;
    const combatants = store.get().initiative;
    const chars = store.get().characters;
    const initLink = existing?.entityId
      ? `e:${existing.entityId}`
      : existing?.charId
        ? `c:${existing.charId}`
        : '';
    const linkOptions = `
      <option value="">Aucun (jeton autonome)</option>
      ${combatants.length ? `<optgroup label="Turn order (combat)">${combatants.map((c) => `<option value="e:${c.entity_id}" ${initLink === `e:${c.entity_id}` ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</optgroup>` : ''}
      ${chars.length ? `<optgroup label="Fiches">${chars.map((c) => `<option value="c:${c.id}" ${initLink === `c:${c.id}` ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</optgroup>` : ''}`;
    const f = {
      label: existing?.label ?? '',
      hp: existing?.hp ?? '',
      hpMax: existing?.hpMax ?? '',
      hpTemp: existing?.hpTemp ?? '',
      ac: existing?.ac ?? '',
      size: existing?.size ?? 1,
      vision: existing?.vision ?? '',
      darkvision: existing?.darkvision ?? '',
      color: existing?.color ?? '#7c6af7',
      note: existing?.note ?? '',
      img: existing?.img ?? null,
      auraR: existing?.aura?.r ?? '',
      auraColor: existing?.aura?.color ?? '#e5c07b',
      lightR: existing?.light?.r ?? '',
      lightColor: existing?.light?.color ?? '#ffb86b',
      rot: existing?.rot ?? '',
      elev: existing?.elev ?? '',
      disp: existing?.disp ?? 'auto',
    };
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-card tokedit-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">${existing ? '📋 Modifier le jeton' : '➕ Nouveau jeton'}</h3>
        <div class="atk-row"><label>Nom / étiquette</label><input class="atk-in" id="te-label" value="${escapeHtml(String(f.label))}" placeholder="Gobelin"></div>
        <div class="atk-row"><label>Lié à (PV/états/tour)</label><select class="atk-sel" id="te-link">${linkOptions}</select></div>
        <p class="modal-msg" id="te-linkmsg" style="display:none">Lié au turn order / à une fiche : les PV sont pilotés par le combat ou la fiche.</p>
        <div class="atk-row atk-grid2">
          <div><label>PV actuels</label><input class="atk-in" id="te-hp" type="number" value="${escapeHtml(String(f.hp))}"></div>
          <div><label>PV max</label><input class="atk-in" id="te-hpmax" type="number" value="${escapeHtml(String(f.hpMax))}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>PV temp</label><input class="atk-in" id="te-hptemp" type="number" value="${escapeHtml(String(f.hpTemp))}"></div>
          <div><label>CA</label><input class="atk-in" id="te-ac" type="number" value="${escapeHtml(String(f.ac))}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Taille (cases)</label>
            <select class="atk-sel" id="te-size">
              ${[1, 2, 3, 4].map((s) => `<option value="${s}" ${s === f.size ? 'selected' : ''}>${s}×${s}${s === 1 ? ' (Moyen)' : ''}</option>`).join('')}
            </select></div>
          <div><label>Vision (cases, 0 = aucune)</label><input class="atk-in" id="te-vision" type="number" min="0" value="${escapeHtml(String(f.vision))}"></div>
          <div><label>Vision dans le noir (cases, vide = comme vision)</label><input class="atk-in" id="te-dvision" type="number" min="0" value="${escapeHtml(String(f.darkvision))}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Aura / portée (cases)</label><input class="atk-in" id="te-aura" type="number" min="0" value="${escapeHtml(String(f.auraR))}"></div>
          <div><label>Couleur aura</label><input class="atk-in tokedit-color" id="te-auracolor" type="color" value="${f.auraColor}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Lumière portée (cases)</label><input class="atk-in" id="te-light" type="number" min="0" value="${escapeHtml(String(f.lightR))}"></div>
          <div><label>Couleur lumière</label><input class="atk-in tokedit-color" id="te-lightcolor" type="color" value="${f.lightColor}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Rotation (°)</label><input class="atk-in" id="te-rot" type="number" step="15" value="${escapeHtml(String(f.rot))}"></div>
          <div><label>Élévation (± pieds)</label><input class="atk-in" id="te-elev" type="number" value="${escapeHtml(String(f.elev))}"></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Couleur</label><input class="atk-in tokedit-color" id="te-color" type="color" value="${f.color}"></div>
          <div><label>Image</label>
            <div class="tokedit-img">
              <span class="tokedit-thumb" id="te-thumb"></span>
              <button class="modal-btn" id="te-imgbtn" type="button">Choisir…</button>
              <button class="modal-btn" id="te-imgclr" type="button" ${f.img ? '' : 'style="display:none"'}>✕</button>
            </div></div>
        </div>
        <div class="atk-row"><label>Disposition (couleur de l'anneau)</label>
          <select class="atk-sel" id="te-disp">
            <option value="auto" ${f.disp === 'auto' ? 'selected' : ''}>Auto (selon le lien)</option>
            <option value="ally" ${f.disp === 'ally' ? 'selected' : ''}>🟢 Allié</option>
            <option value="neutral" ${f.disp === 'neutral' ? 'selected' : ''}>🟡 Neutre</option>
            <option value="hostile" ${f.disp === 'hostile' ? 'selected' : ''}>🔴 Hostile</option>
            <option value="custom" ${f.disp === 'custom' ? 'selected' : ''}>🎨 Couleur perso</option>
          </select></div>
        <div class="atk-row"><label>Note (MJ)</label><textarea class="atk-in tokedit-note" id="te-note" placeholder="Tactique, butin, rappel…">${escapeHtml(String(f.note))}</textarea></div>
        <div class="modal-actions">
          <button class="modal-btn tokedit-cancel">Annuler</button>
          <button class="modal-btn modal-ok tokedit-save">${existing ? 'Enregistrer' : 'Créer'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    tokEditor = overlay;

    const thumb = overlay.querySelector('#te-thumb');
    const setThumb = () => {
      if (f.img) {
        signedTokenUrl(f.img).then((u) => {
          if (u && tokEditor) thumb.style.backgroundImage = `url('${u}')`;
        });
        thumb.classList.add('has');
      } else {
        thumb.style.backgroundImage = '';
        thumb.classList.remove('has');
      }
      overlay.querySelector('#te-imgclr').style.display = f.img ? '' : 'none';
    };
    setThumb();

    overlay.querySelector('#te-imgbtn').addEventListener('click', () => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.addEventListener('change', async () => {
        const file = inp.files?.[0];
        if (!file) return;
        try {
          const path = await uploadTokenAsset(file);
          if (path) {
            f.img = path;
            setThumb();
          }
        } catch (err) {
          await modalAlert('Image impossible : ' + err.message, { title: 'Image du jeton' });
        }
      });
      inp.click();
    });
    overlay.querySelector('#te-imgclr').addEventListener('click', () => {
      f.img = null;
      setThumb();
    });

    // Lien turn order / fiche : pilote l'activation des champs PV.
    const linkSel = overlay.querySelector('#te-link');
    const linkMsg = overlay.querySelector('#te-linkmsg');
    const updateLinkUI = () => {
      const linked = linkSel.value !== '';
      linkMsg.style.display = linked ? 'block' : 'none';
      ['#te-hp', '#te-hpmax', '#te-hptemp'].forEach((s) => {
        overlay.querySelector(s).disabled = linked;
      });
    };
    linkSel.addEventListener('change', updateLinkUI);
    updateLinkUI();

    const cancel = () => closeTokenEditor();
    overlay.querySelector('.tokedit-cancel').addEventListener('click', cancel);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) cancel();
    });
    overlay.querySelector('.tokedit-save').addEventListener('click', () => {
      const num = (sel) => {
        const v = overlay.querySelector(sel).value;
        return v === '' ? null : Number(v);
      };
      const patch = {
        label: overlay.querySelector('#te-label').value.trim(),
        ac: num('#te-ac'),
        size: Number(overlay.querySelector('#te-size').value) || 1,
        vision: num('#te-vision'),
        darkvision: num('#te-dvision'),
        color: overlay.querySelector('#te-color').value,
        disp: overlay.querySelector('#te-disp').value,
        note: overlay.querySelector('#te-note').value.trim(),
        img: f.img,
      };
      const ar = num('#te-aura');
      patch.aura = ar ? { r: ar, color: overlay.querySelector('#te-auracolor').value } : null;
      const lr = num('#te-light');
      patch.light = lr ? { r: lr, color: overlay.querySelector('#te-lightcolor').value } : null;
      patch.rot = num('#te-rot') || 0;
      patch.elev = num('#te-elev') || 0;
      // Lien : 'e:<entity_id>' (turn order) ou 'c:<char_id>' (fiche), ou aucun.
      const lv = linkSel.value;
      if (lv.startsWith('e:')) {
        const eid = lv.slice(2);
        patch.entityId = eid;
        patch.charId = store.get().initiative.find((c) => c.entity_id === eid)?.char_id || null;
      } else if (lv.startsWith('c:')) {
        patch.charId = lv.slice(2);
        patch.entityId = null;
      } else {
        patch.entityId = null;
        patch.charId = null;
      }
      // PV propres : seulement si jeton autonome (sinon combat/fiche font foi).
      if (lv === '') {
        patch.hp = num('#te-hp');
        patch.hpMax = num('#te-hpmax');
        patch.hpTemp = num('#te-hptemp');
      }
      if (existing) {
        updateToken(existing.id, patch);
      } else if (create) {
        addToken({ x: create.x, y: create.y, ...patch });
      }
      resolveTokenUrls();
      closeTokenEditor();
    });
  }

  /**
   * Panneau de calage de grille (MJ) : règle taille de case et décalage X/Y en
   * direct (la grille se redessine via patchMap). Idéal pour aligner la grille
   * sur une battlemap importée.
   */
  let gridCalEl = null;
  function closeGridCalib() {
    if (gridCalEl) {
      gridCalEl.remove();
      gridCalEl = null;
    }
  }
  function openGridCalib() {
    if (!isDM) return;
    if (gridCalEl) {
      closeGridCalib();
      return;
    }
    const panel = document.createElement('div');
    panel.className = 'map-gridcal';
    panel.innerHTML = `
      <div class="map-gridcal-head">📐 Calage de la grille<button class="map-gridcal-x" title="Fermer">✕</button></div>
      <div class="map-gridcal-row"><span>Taille</span><button data-gc="size" data-d="-1">−</button><input type="number" id="gc-size" min="10" max="400"><button data-gc="size" data-d="1">+</button></div>
      <div class="map-gridcal-row"><span>Décalage X</span><button data-gc="ox" data-d="-1">−</button><input type="number" id="gc-ox"><button data-gc="ox" data-d="1">+</button></div>
      <div class="map-gridcal-row"><span>Décalage Y</span><button data-gc="oy" data-d="-1">−</button><input type="number" id="gc-oy"><button data-gc="oy" data-d="1">+</button></div>
      <div class="map-gridcal-hint">Ajustez jusqu'à ce que la grille colle à l'image.</div>`;
    (container.querySelector('.map-viewport') || container).appendChild(panel);
    gridCalEl = panel;
    // Les clics dans le panneau ne doivent pas amorcer un pan de la carte.
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());

    const curGrid = () => store.get().map?.grid || DEFAULT_MAP.grid;
    const syncInputs = () => {
      const g = curGrid();
      panel.querySelector('#gc-size').value = g.size;
      panel.querySelector('#gc-ox').value = g.ox || 0;
      panel.querySelector('#gc-oy').value = g.oy || 0;
    };
    const setProp = (prop, val) => {
      const g = curGrid();
      let v = Number(val) || 0;
      if (prop === 'size') v = Math.max(10, Math.min(400, v));
      patchMap({ grid: { ...g, [prop]: v } });
      syncInputs();
    };
    panel.querySelectorAll('[data-gc]').forEach((b) =>
      b.addEventListener('click', () => {
        const prop = b.dataset.gc;
        setProp(prop, (curGrid()[prop] || 0) + Number(b.dataset.d));
      })
    );
    ['size', 'ox', 'oy'].forEach((prop) =>
      panel.querySelector(`#gc-${prop}`).addEventListener('input', (e) => setProp(prop, e.target.value))
    );
    panel.querySelector('.map-gridcal-x').addEventListener('click', closeGridCalib);
    syncInputs();
  }

  /* ── Sauvegarde de zone (gabarit → combat) ── */

  /** Applique des dégâts à un jeton (combattant lié > fiche > PV propres) + journal. */
  function applyTokenDamage(token, dmg) {
    if (dmg <= 0) return;
    const comb = combatantForToken(token);
    if (comb) {
      adjustHp(comb.entity_id, -dmg);
      return;
    }
    const ch = token.charId ? store.get().characters.find((c) => c.id === token.charId) : null;
    if (ch && ch.data?.hp != null) {
      let hp = Number(ch.data.hp) || 0;
      let temp = Number(ch.data.hpTmp) || 0;
      const ft = Math.min(temp, dmg);
      temp -= ft;
      const after = Math.max(0, hp - (dmg - ft));
      updateCharacter(token.charId, { hp: after, hpTmp: temp });
      logCombat(`💥 ${token.label || 'Jeton'} subit ${dmg} dégâts (PV ${hp}→${after}).`);
      return;
    }
    if (token.hp != null || token.hpMax != null) {
      let hp = Number(token.hp) || 0;
      let temp = Number(token.hpTemp) || 0;
      const ft = Math.min(temp, dmg);
      temp -= ft;
      const after = Math.max(0, hp - (dmg - ft));
      updateToken(token.id, { hp: after, hpTemp: temp });
      logCombat(`💥 ${token.label || 'Jeton'} subit ${dmg} dégâts (PV ${hp}→${after}).`);
    }
  }

  /** Jetons dont le centre est couvert par le gabarit courant. */
  function tokensInTemplate() {
    if (!template) return [];
    const m = store.get().map;
    if (!m) return [];
    const gs = m.grid.size || 70;
    const { shape, a, b } = template;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return (m.tokens || []).filter((t) => {
      const dx = t.x - a.x;
      const dy = t.y - a.y;
      const dist = Math.hypot(dx, dy);
      if (shape === 'circle') return dist <= len;
      if (shape === 'cone') {
        if (dist > len) return false;
        if (dist < 1) return true;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        let diff = Math.abs(Math.atan2(dy, dx) - ang);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        return diff <= Math.atan(0.5) + 0.05;
      }
      // ligne (large d'une case)
      return pointSegDist(t.x, t.y, { x1: a.x, y1: a.y, x2: b.x, y2: b.y }) <= gs / 2;
    });
  }

  let zoneEl = null;
  function closeZoneSave() {
    if (zoneEl) {
      zoneEl.remove();
      zoneEl = null;
    }
  }
  function openZoneSave() {
    if (!isDM) return;
    if (!template) {
      showToast('Place d’abord un gabarit (🎯) sur la zone.', { timeout: 2600 });
      return;
    }
    const targets = tokensInTemplate();
    if (!targets.length) {
      showToast('Aucun jeton sous le gabarit.', { timeout: 2600 });
      return;
    }
    closeZoneSave();
    const ABS = [['dex', 'DEX'], ['con', 'CON'], ['wis', 'SAG'], ['str', 'FOR'], ['int', 'INT'], ['cha', 'CHA']];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal-card atk-card" role="dialog" aria-modal="true">
        <h3 class="modal-title">💥 Sauvegarde de zone</h3>
        <p class="modal-msg">${targets.length} jeton(s) sous le gabarit.</p>
        <div class="atk-row atk-grid2">
          <div><label>DD</label><input class="atk-in" id="zs-dc" type="number" value="13"></div>
          <div><label>Caractéristique</label><select class="atk-sel" id="zs-ab">${ABS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
        </div>
        <div class="atk-row atk-grid2">
          <div><label>Dégâts</label><input class="atk-in" id="zs-dmg" value="8d6" placeholder="8d6"></div>
          <div><label>Si réussite</label><select class="atk-sel" id="zs-half"><option value="half">½ dégâts</option><option value="none">aucun dégât</option></select></div>
        </div>
        <div class="atk-result" id="zs-result"></div>
        <div class="modal-actions">
          <button class="modal-btn zs-close">Fermer</button>
          <button class="modal-btn modal-ok" id="zs-go">🎲 Résoudre</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    zoneEl = overlay;
    overlay.querySelector('.zs-close').addEventListener('click', closeZoneSave);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) closeZoneSave();
    });
    overlay.querySelector('#zs-go').addEventListener('click', () => {
      const dc = Number(overlay.querySelector('#zs-dc').value) || 10;
      const ab = overlay.querySelector('#zs-ab').value;
      const half = overlay.querySelector('#zs-half').value === 'half';
      const total = rollDice(overlay.querySelector('#zs-dmg').value)?.total ?? 0;
      const d20 = () => {
        const buf = new Uint32Array(1);
        const max = Math.floor(0xffffffff / 20) * 20;
        do {
          crypto.getRandomValues(buf);
        } while (buf[0] >= max);
        return (buf[0] % 20) + 1;
      };
      logCombat(`💥 Sauvegarde de zone — DD ${dc} (${ab.toUpperCase()}), ${total} dégâts.`);
      const rows = tokensInTemplate().map((t) => {
        const ch = t.charId ? store.get().characters.find((c) => c.id === t.charId) : null;
        const bonus = ch ? saveBonus(ch.data, ab) : 0;
        const nat = d20();
        const roll = nat + bonus;
        const ok = roll >= dc;
        const dmg = ok ? (half ? Math.floor(total / 2) : 0) : total;
        applyTokenDamage(t, dmg);
        return { name: t.label || ch?.name || 'Jeton', roll, ok, dmg, linked: !!ch || !!combatantForToken(t) || t.hp != null };
      });
      overlay.querySelector('#zs-result').innerHTML = `
        <div class="zs-rows">${rows
          .map(
            (r) =>
              `<div class="zs-line ${r.ok ? 'ok' : 'ko'}"><span>${escapeHtml(r.name)}</span><span>${r.roll} ${r.ok ? '✔' : '✘'}</span><span>${r.dmg ? `−${r.dmg}` : '0'}${r.linked ? '' : ' ⚠'}</span></div>`
          )
          .join('')}</div>`;
      const applied = rows.filter((r) => r.linked && r.dmg).length;
      const unlinked = rows.filter((r) => !r.linked).length;
      showToast(
        `💥 ${rows.length} cible(s), ${applied} touchée(s)${unlinked ? ` — ${unlinked} non liée(s) (PV non appliqués)` : ''}`,
        { timeout: 3500 }
      );
    });
  }

  /** Petit sélecteur d'états (multi-choix) ancré près du curseur. */
  let condMenu = null;
  function closeConds() {
    if (condMenu) {
      condMenu.remove();
      condMenu = null;
    }
  }
  function openConditionsPicker(id, cx, cy) {
    closeConds();
    const cur = (store.get().map?.tokens || []).find((x) => x.id === id);
    const set = new Set(cur?.conditions || []);
    condMenu = document.createElement('div');
    condMenu.className = 'map-ctx map-conds';
    condMenu.innerHTML = Object.entries(CONDITIONS)
      .map(
        ([k, v]) =>
          `<button data-cond="${k}" class="${set.has(k) ? 'on' : ''}"><span>${v.icon} ${v.label}</span><span class="ck">${set.has(k) ? '✓' : ''}</span></button>`
      )
      .join('');
    document.body.appendChild(condMenu);
    const mr = condMenu.getBoundingClientRect();
    condMenu.style.left = `${Math.max(8, Math.min(cx, window.innerWidth - mr.width - 8))}px`;
    condMenu.style.top = `${Math.max(8, Math.min(cy, window.innerHeight - mr.height - 8))}px`;
    condMenu.querySelectorAll('[data-cond]').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const k = b.dataset.cond;
        const s = new Set((store.get().map?.tokens || []).find((x) => x.id === id)?.conditions || []);
        if (s.has(k)) s.delete(k);
        else s.add(k);
        updateToken(id, { conditions: [...s] });
        b.classList.toggle('on', s.has(k));
        b.querySelector('.ck').textContent = s.has(k) ? '✓' : '';
      })
    );
    const onClose = (ev) => {
      if (condMenu && !condMenu.contains(ev.target)) {
        closeConds();
        document.removeEventListener('pointerdown', onClose, true);
      }
    };
    setTimeout(() => document.addEventListener('pointerdown', onClose, true), 0);
  }

  // Raccourcis carte : Échap (gabarit/sélection), Suppr (sélection).
  const onKey = async (e) => {
    // Ne pas intercepter quand on tape dans un champ.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'Escape') {
      if (template) clearTemplate();
      if (rulerPts.length) clearRuler();
      if (wallChain.length) clearWallChain();
      if (selectedIds.size) {
        selectedIds.clear();
        selPreview = null;
        renderAll();
      }
    } else if (e.key === 'Enter' && tool === 'ruler' && rulerPts.length >= 2) {
      // Déplace le jeton situé au départ du tracé jusqu'au dernier waypoint.
      e.preventDefault();
      const tk = tokenAtRulerStart();
      if (tk) {
        const m = store.get().map;
        const gs = m.grid.size || 70;
        const end = rulerPts[rulerPts.length - 1];
        const x = Math.round(Math.floor(end.x / gs) * gs + gs / 2);
        const y = Math.round(Math.floor(end.y / gs) * gs + gs / 2);
        // Joueur : refuse la téléportation si le trajet traverse un mur / une porte fermée.
        if (!isDM && (m.walls || []).length && losBlocked(tk.x, tk.y, x, y, m.walls)) {
          showToast('🧱 Un mur bloque ce déplacement.', { timeout: 2200 });
          return;
        }
        if (isDM) {
          moveToken(tk.id, x, y);
        } else {
          applyTokenMoveLocal(tk.id, x, y);
          sendTokenMove(tk.id, x, y);
          renderAll();
        }
        clearRuler();
      } else {
        showToast('Commence la règle sur ton jeton pour le déplacer.', { timeout: 2600 });
      }
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && isDM && selectedIds.size) {
      e.preventDefault();
      const n = selectedIds.size;
      if (await modalConfirm(`Supprimer ${n} jeton${n > 1 ? 's' : ''} sélectionné${n > 1 ? 's' : ''} ?`, { title: 'Jetons', danger: true, okLabel: 'Supprimer' })) {
        const m = store.get().map;
        if (m) patchMap({ tokens: m.tokens.filter((t) => !selectedIds.has(t.id)) });
        selectedIds.clear();
        renderAll();
      }
    }
  };
  document.addEventListener('keydown', onKey);

  /* ── Bibliothèque d'images de jetons ── */
  let libCleanup = null;
  function closeLib() {
    if (libCleanup) {
      libCleanup();
      libCleanup = null;
    }
  }
  function applyLibImage(path) {
    if (selectedIds.size) {
      for (const id of selectedIds) updateToken(id, { img: path });
    } else {
      const r = vp.getBoundingClientRect();
      const c = toImage(r.left + r.width / 2, r.top + r.height / 2);
      addToken({ x: Math.round(c.x), y: Math.round(c.y), label: '', img: path });
    }
  }
  function openTokenLibrary() {
    closeLib();
    const ov = document.createElement('div');
    ov.className = 'tok-lib-overlay';
    ov.innerHTML = `
      <div class="tok-lib">
        <header class="tok-lib-head">
          <strong>Bibliothèque de jetons</strong>
          <label class="map-btn" title="Importer une image">⬆<input type="file" id="lib-file" accept="image/*" hidden></label>
          <button class="tok-lib-close" title="Fermer">✕</button>
        </header>
        <div class="tok-lib-hint" id="lib-hint"></div>
        <div class="tok-lib-grid" id="lib-grid"></div>
      </div>`;
    document.body.appendChild(ov);
    const grid = ov.querySelector('#lib-grid');
    const hint = ov.querySelector('#lib-hint');

    const renderGrid = () => {
      const lib = store.get().map?.tokenLib || [];
      hint.textContent = selectedIds.size
        ? `Clic : appliquer aux ${selectedIds.size} jeton(s) sélectionné(s).`
        : 'Clic : créer un jeton au centre de la vue.';
      if (!lib.length) {
        grid.innerHTML = `<div class="tok-lib-empty">Aucune image. Importez-en une avec ⬆.</div>`;
        return;
      }
      grid.innerHTML = lib
        .map((p) => {
          const u = tokenImgUrl(p);
          return `<div class="tok-lib-cell" data-path="${escapeHtml(p)}" title="Utiliser">
              ${u ? `<img src="${u}" alt="">` : '<span class="tok-lib-load">…</span>'}
              <button class="tok-lib-rm" data-rm="${escapeHtml(p)}" title="Retirer de la bibliothèque">✕</button>
            </div>`;
        })
        .join('');
      grid.querySelectorAll('[data-path]').forEach((cell) =>
        cell.addEventListener('click', (e) => {
          if (e.target.closest('[data-rm]')) return;
          applyLibImage(cell.dataset.path);
        })
      );
      grid.querySelectorAll('[data-rm]').forEach((b) =>
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          removeLibraryImage(b.dataset.rm);
        })
      );
    };

    ov.querySelector('#lib-file').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        await uploadLibraryImage(f);
      } catch (ex) {
        await modalAlert('Import impossible : ' + ex.message, { title: 'Bibliothèque' });
      }
      e.target.value = '';
    });
    ov.querySelector('.tok-lib-close').addEventListener('click', closeLib);
    ov.addEventListener('mousedown', (e) => {
      if (e.target === ov) closeLib();
    });
    const unsub = store.subscribe(renderGrid);
    libCleanup = () => {
      unsub();
      ov.remove();
    };
    renderGrid();
  }

  /* ── Démarrage ── */
  await loadMap();
  if (!store.get().map) store.set({ map: { ...DEFAULT_MAP } });
  // Les fiches alimentent l'import des PJ et les barres de PV. Les charger si
  // l'utilisateur arrive directement sur la carte sans passer par Fiches/Combat.
  if (!store.get().characters.length) {
    try {
      await loadCharacters();
    } catch {
      /* no-op */
    }
  }
  await resolveTokenUrls();
  // Initiative : pour la surbrillance live du combattant actif sur la carte.
  if (!store.get().initiative.length) {
    try {
      await loadInitiative();
    } catch {
      /* no-op */
    }
  }

  const unsubPings = subscribeMapBroadcast({
    onPing: (p) => spawnPing(p.x, p.y, p.name),
    onTokenMove: (p) => {
      if (!p?.id) return;
      if (isDM) moveToken(p.id, p.x, p.y); // persiste
      else applyTokenMoveLocal(p.id, p.x, p.y);
    },
    onView: (p) => {
      if (!p || p.by === store.get().user?.id) return; // pas pour l'émetteur
      view.px = p.px;
      view.py = p.py;
      view.z = p.z;
      applyTransform();
      showToast(`👁 ${p.name || 'MJ'} recadre la vue`, { icon: '🗺', timeout: 2500 });
    },
    onDraw: (p) => {
      if (!p || p.by === store.get().user?.id) return; // déjà affiché localement par l'émetteur
      addEphemeralDraw(p);
    },
    onCursor: renderCursor,
    onSceneDirty: (p) => {
      if (!p || p.by === store.get().user?.id) return;
      if (p.id && p.id !== store.get().activeSceneId) return;
      reloadActiveScene(); // recharge la scène (nouveaux jetons visibles sans refresh)
    },
    onTemplate: (p) => {
      if (!p || p.by === store.get().user?.id) return;
      if (p.cleared) remoteTemplates.delete(p.by);
      else remoteTemplates.set(p.by, { shape: p.shape, a: p.a, b: p.b, color: colorFor(p.by, p.name), name: p.name, t: Date.now() });
      renderRemoteTemplates();
    },
  });
  // Retire les gabarits distants inactifs.
  const tmplCleanup = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [by, t] of remoteTemplates) {
      if (now - t.t > 12000) {
        remoteTemplates.delete(by);
        changed = true;
      }
    }
    if (changed) renderRemoteTemplates();
  }, 3000);
  const unsubInit = subscribeInitiative();
  const unsubRealtime = subscribeMap();
  const unsubStore = store.subscribe(() => {
    if (suppressRender) return;
    renderAll();
  });

  /* ── Barre PV rapide au survol d'un jeton (MJ, sans ouvrir de panneau) ── */
  let hoverBar = null;
  let hoverTokenId = null;
  let hoverHideT = 0;
  function quickAdjust(tokenId, delta) {
    if (playerLocked()) return; // jeu en pause : pas d'action joueur
    const t = (store.get().map?.tokens || []).find((x) => x.id === tokenId);
    if (!t) return;
    // Joueur : agit sur SON perso (combattant via le MJ, ou directement sa fiche).
    if (!isDM) {
      const ch = t.charId ? store.get().characters.find((c) => c.id === t.charId) : null;
      if (!ch || ch.owner_id !== store.get().user?.id) return;
      const linked = store.get().initiative.some((c) => c.char_id === t.charId);
      if (linked) {
        sendPlayerRequest({ kind: 'hp', charId: ch.id, delta });
      } else if (ch.data?.hp != null) {
        let hp = (Number(ch.data.hp) || 0) + delta;
        if (delta > 0 && ch.data.hpMax != null) hp = Math.min(Number(ch.data.hpMax), hp);
        updateCharacter(ch.id, { hp: Math.max(0, hp) });
      }
      return;
    }
    const comb = t.charId ? store.get().initiative.find((c) => c.char_id === t.charId) : null;
    if (comb) {
      adjustHp(comb.entity_id, delta); // journalise + synchronise (combat)
      return;
    }
    const ch = t.charId ? store.get().characters.find((c) => c.id === t.charId) : null;
    if (ch && ch.data?.hp != null) {
      let hp = (Number(ch.data.hp) || 0) + delta;
      if (delta > 0 && ch.data.hpMax != null) hp = Math.min(Number(ch.data.hpMax), hp);
      updateCharacter(t.charId, { hp: Math.max(0, hp) });
      return;
    }
    // Jeton autonome : PV propres (les dégâts entament d'abord les PV temp).
    if (t.hp != null || t.hpMax != null) {
      let hp = Number(t.hp) || 0;
      let temp = Number(t.hpTemp) || 0;
      if (delta < 0) {
        let d = -delta;
        const ft = Math.min(temp, d);
        temp -= ft;
        d -= ft;
        hp = Math.max(0, hp - d);
      } else {
        hp = t.hpMax != null ? Math.min(Number(t.hpMax), hp + delta) : hp + delta;
      }
      updateToken(tokenId, { hp, hpTemp: temp });
    }
  }
  function hideHoverBar() {
    if (hoverBar) hoverBar.style.display = 'none';
    hoverTokenId = null;
  }
  function scheduleHideBar() {
    clearTimeout(hoverHideT);
    hoverHideT = setTimeout(hideHoverBar, 200);
  }
  function showHoverBar(tokenEl) {
    if (dragging || playerLocked()) return;
    const t = (store.get().map?.tokens || []).find((x) => x.id === tokenEl.dataset.token);
    // MJ : tous les jetons ; joueur : seulement le sien (PV de son perso).
    if (!t || !hpFor(t) || (!isDM && !canMoveToken(t))) {
      hideHoverBar();
      return;
    }
    hoverTokenId = t.id;
    if (!hoverBar) {
      hoverBar = document.createElement('div');
      hoverBar.className = 'tok-quickbar';
      document.body.appendChild(hoverBar);
      hoverBar.addEventListener('pointerenter', () => clearTimeout(hoverHideT));
      hoverBar.addEventListener('pointerleave', scheduleHideBar);
    }
    hoverBar.innerHTML = `
      <button data-qd="-5" title="5 dégâts">−5</button>
      <button data-qd="-1" title="1 dégât">−1</button>
      <button data-qd="1" title="1 PV">+1</button>
      <button data-qd="5" title="5 PV">+5</button>
      ${isDM ? '<button data-qcond title="États">🩹</button>' : ''}`;
    hoverBar.querySelectorAll('[data-qd]').forEach((b) =>
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        quickAdjust(hoverTokenId, Number(b.dataset.qd));
      })
    );
    hoverBar.querySelector('[data-qcond]')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      const r2 = tokenEl.getBoundingClientRect();
      openConditionsPicker(hoverTokenId, r2.left, r2.bottom);
    });
    const r = tokenEl.getBoundingClientRect();
    hoverBar.style.display = 'flex';
    const bw = hoverBar.offsetWidth || 170;
    hoverBar.style.left = `${Math.max(6, Math.min(r.left + r.width / 2 - bw / 2, window.innerWidth - bw - 6))}px`;
    hoverBar.style.top = `${Math.max(6, r.top - 36)}px`;
  }
  // Barre de PV au survol retirée (jugée gênante) : les PV se règlent via le
  // tracker de combat, l'éditeur de jeton, le dock Fiche ou « appliquer » des dés.
  void showHoverBar; // (fonctions conservées mais non déclenchées)

  renderAll();
  // Restaure la vue mémorisée de la scène (zoom/centre), sinon ajuste.
  const savedView = mapViews[store.get().activeSceneId];
  if (savedView) {
    view.px = savedView.px;
    view.py = savedView.py;
    view.z = savedView.z;
    applyTransform();
  } else {
    fit();
  }

  return () => {
    unsubStore();
    unsubRealtime();
    unsubPings();
    unsubInit();
    document.removeEventListener('pointerdown', onDocPointer, true);
    document.removeEventListener('keydown', onKey);
    closeCtx();
    closeConds();
    closeLib();
    closeTokenEditor();
    closeGridCalib();
    closeZoneSave();
    clearTimeout(hoverHideT);
    clearInterval(cursorCleanup);
    clearInterval(tmplCleanup);
    tileEditor?.remove();
    hoverBar?.remove();
    document.body.classList.remove('immersive'); // sortir du plein écran en quittant la carte
  };
}
