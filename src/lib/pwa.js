import { store } from '../state.js';
import { flushOutbox, pendingCount } from './outbox.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/* Identifiant de build injecté par Vite (cf. vite.config.js). */
export const BUILD_ID = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

/**
 * Intégration PWA : enregistrement du service worker + indicateur hors-ligne.
 *
 * Le service worker (public/sw.js) met en cache le « shell » de l'app pour un
 * démarrage hors-ligne. Ici on gère son enregistrement et une bannière qui
 * prévient l'utilisateur quand la connexion est perdue (les écritures ne
 * seront alors pas synchronisées tant que le réseau n'est pas revenu).
 */

let bannerEl = null;

function setOnline(online) {
  store.set({ isOnline: online });
  renderBanner(online);
  if (online) flushOutbox(); // rejoue les écritures mises en file hors-ligne
}

function renderBanner(online) {
  if (online) {
    if (bannerEl) {
      bannerEl.remove();
      bannerEl = null;
    }
    return;
  }
  if (bannerEl) return;
  bannerEl = document.createElement('div');
  bannerEl.className = 'offline-banner';
  bannerEl.textContent = t('pwa.offline');
  document.body.appendChild(bannerEl);
}

export function initPWA() {
  // Enregistrement du service worker (production uniquement, HTTPS/localhost).
  if ('serviceWorker' in navigator) {
    // Y avait-il déjà un SW au chargement ? Sinon, la 1ʳᵉ prise de contrôle est
    // une installation initiale (pas une mise à jour) → on ne notifie pas.
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      showToast(t('pwa.update'), {
        type: 'info',
        timeout: 0,
        onClick: () => window.location.reload(),
      });
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[pwa] service worker non enregistré:', err?.message);
      });
    });
    console.info(`[mistkeep] build ${BUILD_ID}`);
  }

  // Détection de connectivité.
  window.addEventListener('online', () => setOnline(true));
  window.addEventListener('offline', () => setOnline(false));
  if (!navigator.onLine) setOnline(false);

  // Rejoue d'éventuelles écritures en attente d'une session précédente.
  if (navigator.onLine && pendingCount()) flushOutbox();
}
