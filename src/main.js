import './styles/base.css';
import { store } from './state.js';
import {
  getCurrentUser,
  signIn,
  signUp,
  signOut,
  loadProfile,
  onAuthChange,
} from './lib/auth.js';
import { mountNav, navigateTo } from './features/nav.js';
import { initCampaigns } from './lib/campaigns.js';
import { initPWA } from './lib/pwa.js';
import { initNotify, setNotifyNavigate } from './lib/notify.js';
import { initSearch, openSearch } from './lib/search.js';
import { initAmbience } from './lib/ambience.js';
import { loadPartyLoot, subscribePartyLoot } from './lib/partyloot.js';
import { loadQuests, subscribeQuests } from './lib/quests.js';
import { loadDirectory, colorFor, initials } from './lib/profile.js';
import { openProfileEditor } from './features/profile-ui.js';
import { initLive } from './lib/live.js';
import { mountDock } from './features/dock.js';
import { exportData } from './lib/export.js';
import { initSpotlight } from './lib/spotlight.js';
import { initDiceAnim } from './lib/diceanim.js';
import { initPrefs, openPrefs } from './lib/prefs.js';
import { initHotkeys } from './lib/hotkeys.js';
import { initRollRequests } from './lib/rollrequest.js';
import { initPause, togglePause } from './lib/pause.js';
import { initTurnBanner, setTurnNavigate } from './lib/turnbanner.js';
import { mountHotbar } from './lib/hotbar.js';
import { initPresence } from './lib/presence.js';
import { initMdLinks } from './lib/mdlinks.js';
import { initParty, toggleParty } from './lib/party.js';
import { initClock, toggleClock } from './lib/clock.js';
import { initSfx, toggleSfx } from './lib/sfx.js';
import { getMasterVol, setMasterVol, getLayerLocal, setLayerLocal } from './lib/ambience.js';
import { escapeHtml } from './lib/utils.js';

const root = document.getElementById('app');

initPrefs();
initPWA();
initSearch();
initHotkeys();

/* ────────────────────────────────────────────────────────────
 * Gate d'authentification.
 * Le shell de l'app (vault, fiches, carte, chat…) sera monté ici
 * au fil de la migration incrémentale depuis l'ancien monolithe.
 * ──────────────────────────────────────────────────────────── */

async function boot() {
  const user = await getCurrentUser();
  if (user) {
    await enterApp(user);
  } else {
    renderAuth('login');
  }

  onAuthChange(async (u) => {
    if (!u) renderAuth('login');
  });
}

async function enterApp(user) {
  const { profile, role, isDM } = await loadProfile(user.id);
  store.set({ user, profile, role, isDM });
  // Résout la campagne active AVANT les features : toutes les requêtes sont scopées.
  await initCampaigns();
  renderShell();
  setNotifyNavigate(navigateTo);
  initNotify();
  initAmbience();
  loadDirectory();
  initLive();
  initSpotlight();
  initDiceAnim();
  initRollRequests();
  initPause();
  setTurnNavigate(navigateTo);
  initTurnBanner();
  initPresence();
  initMdLinks();
  initParty();
  initClock();
  initSfx();
  loadPartyLoot();
  subscribePartyLoot();
  loadQuests();
  subscribeQuests();
}

function renderShell() {
  const { profile, role } = store.get();
  root.innerHTML = `
    <div id="shell" style="padding:16px 56px 16px 20px">
      <header style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <h1 class="app-title" style="font-size:15px;flex:1">
          ⚔ Mistkeep <span style="font-size:10px">v5</span>
        </h1>
        <button class="hbtn" id="campaigns-btn" title="Campagnes (basculer / créer)">🏰</button>
        <button class="hbtn" id="search-btn" title="Rechercher (Ctrl+K)">🔍</button>
        <button class="hbtn" id="party-btn" title="Aperçu du groupe (PV/CA/états)">👥</button>
        <button class="hbtn" id="clock-btn" title="Temps in-game (jour/nuit)">🕐</button>
        <button class="hbtn" id="vol-btn" title="Volume du son (local)">🔉</button>
        <button class="hbtn" id="prefs-btn" title="Affichage (taille, contraste, animations)">⚙</button>
        ${store.get().isDM ? `<button class="hbtn" id="sfx-btn" title="Sons ponctuels (soundboard)">🔊</button>` : ''}
        ${store.get().isDM ? `<button class="hbtn" id="pause-btn" title="Mettre la partie en pause">⏸</button>` : ''}
        ${store.get().isDM ? `<button class="hbtn" id="export-btn" title="Exporter les données (JSON)">💾</button>` : ''}
        <button class="profile-btn" id="profile-btn" title="Mon profil">
          <span class="profile-avatar" id="hdr-av"></span>
          <span id="hdr-name"></span>
        </button>
        <button class="link" style="width:auto;margin:0" id="logout">Déconnexion</button>
      </header>
      <nav id="nav" class="nav-bar"></nav>
      <div id="view"></div>
    </div>
    <div id="dock-root"></div>
    <div id="hotbar-root"></div>
  `;
  updateHeaderProfile();
  mountDock(document.getElementById('dock-root'));
  mountHotbar(document.getElementById('hotbar-root'));
  document.getElementById('profile-btn').addEventListener('click', () =>
    openProfileEditor(updateHeaderProfile)
  );
  document.getElementById('search-btn').addEventListener('click', () => openSearch());
  document.getElementById('campaigns-btn').addEventListener('click', async () => {
    const { openCampaignManager } = await import('./features/campaigns-ui.js');
    openCampaignManager();
  });
  document.getElementById('prefs-btn').addEventListener('click', () => openPrefs());
  document.getElementById('party-btn').addEventListener('click', () => toggleParty());
  document.getElementById('clock-btn').addEventListener('click', () => toggleClock());
  document.getElementById('vol-btn').addEventListener('click', (e) => toggleVolumePopover(e.currentTarget));
  document.getElementById('sfx-btn')?.addEventListener('click', () => toggleSfx());
  document.getElementById('pause-btn')?.addEventListener('click', () => togglePause());
  document.getElementById('export-btn')?.addEventListener('click', () => exportData());
  document.getElementById('logout').addEventListener('click', async () => {
    await signOut();
    renderAuth('login');
  });

  mountNav(document.getElementById('nav'), document.getElementById('view'));
}

let _volPop = null;
function toggleVolumePopover(anchor) {
  if (_volPop) {
    _volPop.remove();
    _volPop = null;
    return;
  }
  const pop = document.createElement('div');
  pop.className = 'vol-pop';
  const layers = store.get().ambience?.layers || [];
  pop.innerHTML = `
    <div class="vol-row vol-master">
      <span class="vol-lbl">🔊 Maître</span>
      <input type="range" min="0" max="100" step="1" value="${getMasterVol()}" data-master>
      <span class="vol-pop-v">${getMasterVol()} %</span>
    </div>
    ${
      layers.length
        ? `<div class="vol-sep"></div>` +
          layers
            .map(
              (l) => `<div class="vol-row">
                <span class="vol-lbl" title="${escapeHtml(l.name || 'Piste')}">${escapeHtml(l.name || 'Piste')}</span>
                <input type="range" min="0" max="100" step="1" value="${getLayerLocal(l.id)}" data-layer="${l.id}">
                <span class="vol-pop-v">${getLayerLocal(l.id)} %</span>
              </div>`
            )
            .join('')
        : `<div class="vol-empty">Aucune piste en cours.</div>`
    }`;
  document.body.appendChild(pop);
  _volPop = pop;
  const r = anchor.getBoundingClientRect();
  pop.style.top = `${r.bottom + 6}px`;
  pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  pop.querySelector('[data-master]')?.addEventListener('input', (ev) => {
    setMasterVol(Number(ev.target.value) || 0);
    ev.target.nextElementSibling.textContent = `${getMasterVol()} %`;
  });
  pop.querySelectorAll('[data-layer]').forEach((range) =>
    range.addEventListener('input', () => {
      setLayerLocal(range.dataset.layer, Number(range.value) || 0);
      range.nextElementSibling.textContent = `${getLayerLocal(range.dataset.layer)} %`;
    })
  );
  const onDoc = (e) => {
    if (_volPop && !_volPop.contains(e.target) && e.target !== anchor) {
      _volPop.remove();
      _volPop = null;
      document.removeEventListener('pointerdown', onDoc, true);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', onDoc, true), 0);
}

function updateHeaderProfile() {
  const { profile, role, user } = store.get();
  const av = document.getElementById('hdr-av');
  const nm = document.getElementById('hdr-name');
  if (!av || !nm) return;
  const color = colorFor(user?.id, profile?.display_name);
  av.textContent = initials(profile?.display_name);
  av.style.background = color;
  nm.textContent = `${profile?.display_name ?? ''} • ${role === 'dm' ? '🎭 MJ' : '🎲 Joueur'}`;
}

function renderAuth(mode) {
  const isLogin = mode === 'login';
  root.innerHTML = `
    <div class="auth-screen">
      <div class="auth-card">
        <h1>⚔ MISTKEEP</h1>
        ${
          isLogin
            ? ''
            : `<div class="field"><label>Nom / pseudo</label><input id="name" type="text" autocomplete="nickname"></div>`
        }
        <div class="field"><label>Email</label><input id="email" type="email" autocomplete="email"></div>
        <div class="field"><label>Mot de passe</label><input id="password" type="password" autocomplete="current-password"></div>
        <button class="btn" id="submit">${isLogin ? 'Connexion' : 'Inscription'}</button>
        <div class="error" id="err"></div>
        <button class="link" id="switch">
          ${isLogin ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('switch').addEventListener('click', () =>
    renderAuth(isLogin ? 'signup' : 'login')
  );

  document.getElementById('submit').addEventListener('click', async () => {
    const err = document.getElementById('err');
    err.textContent = '';
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name')?.value.trim();

    if (!email || !password || (!isLogin && !name)) {
      err.textContent = 'Tous les champs sont requis.';
      return;
    }
    if (!isLogin && password.length < 6) {
      err.textContent = 'Mot de passe trop court (min. 6 caractères).';
      return;
    }

    try {
      const user = isLogin
        ? await signIn(email, password)
        : await signUp(email, password, name);
      if (user) await enterApp(user);
    } catch (e) {
      err.textContent = e.message || 'Erreur.';
    }
  });
}

boot();
