import { escapeHtml } from './utils.js';
import { backend } from './backend.js';
import { store } from '../state.js';
import { playTurnChime } from './turnsound.js';
import { t, setLocale, LOCALES, DEFAULT_LOCALE } from './i18n.js';

/**
 * Préférences d'affichage. Thème & lisibilité : échelle (zoom), contraste
 * élevé, réduction des animations, accent, disposition VTT, langue.
 *
 * Persistance : localStorage (cache local immédiat) + profiles.prefs (source
 * durable, suit le compte entre appareils — cf. syncPrefsFromProfile).
 * Appliquées sur <html> : `style.zoom`, `data-contrast`, `data-motion`.
 * Le CSS réagit via les sélecteurs `html[data-contrast="high"]` et
 * `html[data-motion="reduce"]` (voir base.css). La langue pilote i18n
 * (setLocale) ; un changement recharge l'app pour ré-évaluer tous les t().
 */

const KEY = 'vaultmj_prefs';
const DEFAULTS = { scale: 1, contrast: 'normal', motion: 'system', accent: 'violet', theme: 'dark', density: 'aere', vttRail: true, glass: false, turnSound: true, locale: DEFAULT_LOCALE };

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
  setLocale(prefs.locale); // langue active avant tout rendu de texte
  const html = document.documentElement;
  html.style.zoom = String(prefs.scale);
  html.dataset.contrast = prefs.contrast;
  html.dataset.motion = prefs.motion;
  html.dataset.accent = prefs.accent;
  html.dataset.theme = prefs.theme;
  html.dataset.density = prefs.density; // compact | standard | aere → multiplicateur --density
  if (prefs.vttRail) html.dataset.vttrail = '1';
  else delete html.dataset.vttrail;
  if (prefs.glass) html.dataset.glass = '1';
  else delete html.dataset.glass;
  // Le dock se reconfigure (rail unique on/off).
  window.dispatchEvent(new CustomEvent('vaultmj:chrome'));
}

export function initPrefs() {
  prefs = load();
  apply();
}

/** Lit une préférence hors de la modale (ex. `turnSound` pour le carillon). */
export function getPref(name) {
  return prefs[name];
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
      <h3 class="modal-title">${t('prefs.title')}</h3>
      <div class="atk-row">
        <label>${t('prefs.scale')}</label>
        <div class="pref-scale" id="pref-scale">
          <button data-sd="-1" title="${t('prefs.scale.dec')}">−</button>
          <span class="pref-scale-v" id="pref-scale-v"></span>
          <button data-sd="1" title="${t('prefs.scale.inc')}">+</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.contrast')}</label>
        <div class="atk-modes" id="pref-contrast">
          <button data-c="normal">${t('prefs.contrast.normal')}</button>
          <button data-c="high">${t('prefs.contrast.high')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.motion')}</label>
        <div class="atk-modes" id="pref-motion">
          <button data-m="system">${t('prefs.motion.system')}</button>
          <button data-m="full">${t('prefs.motion.full')}</button>
          <button data-m="reduce">${t('prefs.motion.reduce')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.density')}</label>
        <div class="atk-modes" id="pref-density">
          <button data-d="compact">${t('prefs.density.compact')}</button>
          <button data-d="standard">${t('prefs.density.standard')}</button>
          <button data-d="aere">${t('prefs.density.aere')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.accent')}</label>
        <div class="pref-accents" id="pref-accent">
          <button data-a="violet" class="pref-acc" style="--p:#7c6af7" title="${t('prefs.accent.violet')}"></button>
          <button data-a="blood" class="pref-acc" style="--p:#e0566c" title="${t('prefs.accent.blood')}"></button>
          <button data-a="poison" class="pref-acc" style="--p:#56c98a" title="${t('prefs.accent.poison')}"></button>
          <button data-a="gold" class="pref-acc" style="--p:#d9b24a" title="${t('prefs.accent.gold')}"></button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.theme')}</label>
        <div class="atk-modes" id="pref-theme">
          <button data-t="dark">${t('prefs.theme.dark')}</button>
          <button data-t="light">${t('prefs.theme.light')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.glass')} <small style="color:var(--muted)">${t('prefs.glass.note')}</small></label>
        <div class="atk-modes" id="pref-glass">
          <button data-g="off">${t('prefs.glass.off')}</button>
          <button data-g="on">${t('prefs.glass.on')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.vtt')} <small style="color:var(--muted)">${t('prefs.vtt.note')}</small></label>
        <div class="atk-modes" id="pref-vtt">
          <button data-v="off">${t('prefs.vtt.off')}</button>
          <button data-v="on">${t('prefs.vtt.on')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.turnsound')} <small style="color:var(--muted)">${t('prefs.turnsound.note')}</small></label>
        <div class="atk-modes" id="pref-turnsound">
          <button data-s="on">${t('prefs.turnsound.on')}</button>
          <button data-s="off">${t('prefs.turnsound.off')}</button>
        </div>
      </div>
      <div class="atk-row">
        <label>${t('prefs.lang')} <small style="color:var(--muted)">${t('prefs.lang.note')}</small></label>
        <div class="atk-modes" id="pref-lang">
          ${LOCALES.map((l) => `<button data-l="${l.code}">${escapeHtml(l.label)}</button>`).join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn pref-reset">${t('prefs.reset')}</button>
        <button class="modal-btn modal-ok pref-close">${t('prefs.close')}</button>
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
    overlay.querySelectorAll('#pref-density button').forEach((b) =>
      b.classList.toggle('active', b.dataset.d === prefs.density)
    );
    overlay.querySelectorAll('#pref-accent button').forEach((b) =>
      b.classList.toggle('active', b.dataset.a === prefs.accent)
    );
    overlay.querySelectorAll('#pref-theme button').forEach((b) =>
      b.classList.toggle('active', b.dataset.t === prefs.theme)
    );
    overlay.querySelectorAll('#pref-glass button').forEach((b) =>
      b.classList.toggle('active', (b.dataset.g === 'on') === !!prefs.glass)
    );
    overlay.querySelectorAll('#pref-vtt button').forEach((b) =>
      b.classList.toggle('active', (b.dataset.v === 'on') === !!prefs.vttRail)
    );
    overlay.querySelectorAll('#pref-turnsound button').forEach((b) =>
      b.classList.toggle('active', (b.dataset.s === 'on') === !!prefs.turnSound)
    );
    overlay.querySelectorAll('#pref-lang button').forEach((b) =>
      b.classList.toggle('active', b.dataset.l === (prefs.locale || DEFAULT_LOCALE))
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
  overlay.querySelectorAll('#pref-density button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.density = b.dataset.d;
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
  overlay.querySelectorAll('#pref-glass button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.glass = b.dataset.g === 'on';
      commit();
    })
  );
  overlay.querySelectorAll('#pref-vtt button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.vttRail = b.dataset.v === 'on';
      commit();
    })
  );
  overlay.querySelectorAll('#pref-turnsound button').forEach((b) =>
    b.addEventListener('click', () => {
      prefs.turnSound = b.dataset.s === 'on';
      commit();
      if (prefs.turnSound) playTurnChime(); // aperçu immédiat du carillon
    })
  );
  overlay.querySelectorAll('#pref-lang button').forEach((b) =>
    b.addEventListener('click', () => {
      const code = b.dataset.l;
      if (code === (prefs.locale || DEFAULT_LOCALE)) return;
      prefs.locale = code;
      save(prefs);
      pushPrefsToProfile(); // langue portée par le compte
      setLocale(code);
      // Tous les textes passent par t() au rendu : on recharge pour les ré-évaluer.
      location.reload();
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
