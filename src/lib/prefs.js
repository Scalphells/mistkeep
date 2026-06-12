import { escapeHtml } from './utils.js';
import { backend } from './backend.js';
import { store } from '../state.js';

/**
 * Préférences d'affichage. Thème & lisibilité : échelle (zoom), contraste
 * élevé, réduction des animations, accent, disposition VTT.
 *
 * Persistance : localStorage (cache local immédiat) + profiles.prefs (source
 * durable, suit le compte entre appareils — cf. syncPrefsFromProfile).
 * Appliquées sur <html> : `style.zoom`, `data-contrast`, `data-motion`.
 * Le CSS réagit via les sélecteurs `html[data-contrast="high"]` et
 * `html[data-motion="reduce"]` (voir base.css).
 */

const KEY = 'vaultmj_prefs';
const DEFAULTS = { scale: 1, contrast: 'normal', motion: 'system', accent: 'violet', theme: 'dark', vttRail: true };

function load() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}
function save(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* quota / mode privé : on ignore */
  }
}

let prefs = load();

function apply() {
  const html = document.documentElement;
  html.style.zoom = String(prefs.scale);
  html.dataset.contrast = prefs.contrast;
  html.dataset.motion = prefs.motion;
  html.dataset.accent = prefs.accent;
  html.dataset.theme = prefs.theme;
  if (prefs.vttRail) html.dataset.vttrail = '1';
  else delete html.dataset.vttrail;
  // Le dock se reconfigure (rail unique on/off).
  window.dispatchEvent(new CustomEvent('vaultmj:chrome'));
}

export function initPrefs() {
  prefs = load();
  apply();
}

/* ── Synchronisation avec le profil ─────────────────────────────
 * localStorage = cache local rapide (appliqué dès le boot, avant le réseau) ;
 * la source durable est profiles.prefs : les réglages suivent le compte entre
 * appareils et survivent aux nettoyages du navigateur. */

function pushPrefsToProfile() {
  const uid = store.get().user?.id;
  if (!uid) return;
  backend.db
    .from('profiles')
    .update({ prefs })
    .eq('id', uid)
    .then(({ error }) => {
      if (error) console.warn('[prefs] sync profil impossible:', error.message);
    });
}

/** À appeler après le chargement du profil, avant le rendu du shell :
 *  applique les réglages du compte, ou y pousse les réglages locaux la
 *  première fois (compte sans prefs enregistrées). */
export function syncPrefsFromProfile() {
  const p = store.get().profile;
  if (!p) return;
  let remote = p.prefs;
  if (typeof remote === 'string') {
    // Le backend Go renvoie le jsonb SQLite sous forme de chaîne.
    try {
      remote = JSON.parse(remote);
    } catch {
      remote = null;
    }
  }
  if (remote && typeof remote === 'object') {
    prefs = { ...DEFAULTS, ...remote };
    save(prefs); // rafraîchit le cache local
    apply();
  } else {
    pushPrefsToProfile();
  }
}

/* ── Modale de réglages ─────────────────────────────────────── */
let _overlay = null;
function closePrefs() {
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
    document.removeEventListener('keydown', _onKey, true);
  }
}
function _onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closePrefs();
  }
}

export function openPrefs() {
  closePrefs();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-card pref-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">⚙ Affichage</h3>
      <div class="atk-row">
        <label>Taille de l'interface</label>
        <div class="pref-scale" id="pref-scale">
          <button data-sd="-1" title="Réduire de 25 %">−</button>
          <span class="pref-scale-v" id="pref-scale-v"></span>
          <button data-sd="1" title="Agrandir de 25 %">+</button>
        </div>
      </div>
      <div class="atk-row">
        <label>Contraste</label>
        <div class="atk-modes" id="pref-contrast">
          <button data-c="normal">Normal</button>
          <button data-c="high">Élevé</button>
        </div>
      </div>
      <div class="atk-row">
        <label>Animations</label>
        <div class="atk-modes" id="pref-motion">
          <button data-m="system">Système</button>
          <button data-m="full">Activées</button>
          <button data-m="reduce">Réduites</button>
        </div>
      </div>
      <div class="atk-row">
        <label>Couleur d'accent</label>
        <div class="pref-accents" id="pref-accent">
          <button data-a="violet" class="pref-acc" style="--p:#7c6af7" title="Violet"></button>
          <button data-a="blood" class="pref-acc" style="--p:#e0566c" title="Rouge sang"></button>
          <button data-a="poison" class="pref-acc" style="--p:#56c98a" title="Vert poison"></button>
          <button data-a="gold" class="pref-acc" style="--p:#d9b24a" title="Or"></button>
        </div>
      </div>
      <div class="atk-row">
        <label>Thème</label>
        <div class="atk-modes" id="pref-theme">
          <button data-t="dark">🌙 Sombre</button>
          <button data-t="light">☀ Clair</button>
        </div>
      </div>
      <div class="atk-row">
        <label>Disposition VTT <small style="color:var(--muted)">(rail unique, expérimental)</small></label>
        <div class="atk-modes" id="pref-vtt">
          <button data-v="off">Classique</button>
          <button data-v="on">Rail VTT</button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn pref-reset">Réinitialiser</button>
        <button class="modal-btn modal-ok pref-close">Fermer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  _overlay = overlay;
  document.addEventListener('keydown', _onKey, true);

  const sync = () => {
    const sv = overlay.querySelector('#pref-scale-v');
    if (sv) sv.textContent = `${Math.round(prefs.scale * 100)} %`;
    overlay.querySelectorAll('#pref-contrast button').forEach((b) =>
      b.classList.toggle('active', b.dataset.c === prefs.contrast)
    );
    overlay.querySelectorAll('#pref-motion button').forEach((b) =>
      b.classList.toggle('active', b.dataset.m === prefs.motion)
    );
    overlay.querySelectorAll('#pref-accent button').forEach((b) =>
      b.classList.toggle('active', b.dataset.a === prefs.accent)
    );
    overlay.querySelectorAll('#pref-theme button').forEach((b) =>
      b.classList.toggle('active', b.dataset.t === prefs.theme)
    );
    overlay.querySelectorAll('#pref-vtt button').forEach((b) =>
      b.classList.toggle('active', (b.dataset.v === 'on') === !!prefs.vttRail)
    );
  };
  const commit = () => {
    save(prefs);
    apply();
    sync();
    pushPrefsToProfile(); // réglages portés par le compte (multi-appareils)
  };

  overlay.querySelectorAll('#pref-scale button').forEach((b) =>
    b.addEventListener('click', () => {
      const d = Number(b.dataset.sd) || 0;
      prefs.scale = Math.min(2, Math.max(0.5, Math.round((prefs.scale + d * 0.25) * 100) / 100));
      commit();
    })
  );
  overlay.querySelectorAll('#pref-contrast button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.contrast = b.dataset.c;
      commit();
    })
  );
  overlay.querySelectorAll('#pref-motion button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.motion = b.dataset.m;
      commit();
    })
  );
  overlay.querySelectorAll('#pref-accent button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.accent = b.dataset.a;
      commit();
    })
  );
  overlay.querySelectorAll('#pref-theme button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.theme = b.dataset.t;
      commit();
    })
  );
  overlay.querySelectorAll('#pref-vtt button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.vttRail = b.dataset.v === 'on';
      commit();
    })
  );
  overlay.querySelector('.pref-reset').addEventListener('click', () => {
    prefs = { ...DEFAULTS };
    commit();
  });
  overlay.querySelector('.pref-close').addEventListener('click', closePrefs);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closePrefs();
  });
  sync();
}
