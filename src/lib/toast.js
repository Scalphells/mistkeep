import { escapeHtml } from './utils.js';

/**
 * Toasts (notifications éphémères, coin bas-droit).
 * showToast(message, { type: 'info'|'success'|'warn', icon, timeout, onClick })
 */

let host = null;
function ensureHost() {
  if (host) return host;
  host = document.createElement('div');
  host.className = 'toast-host';
  document.body.appendChild(host);
  return host;
}

export function showToast(message, { type = 'info', icon = '', timeout = 5000, onClick } = {}) {
  const h = ensureHost();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icon ? `<span class="toast-icon">${icon}</span>` : ''}<span class="toast-msg">${escapeHtml(message)}</span>${
    timeout ? `<span class="toast-bar" style="animation-duration:${timeout}ms"></span>` : ''
  }`;
  if (onClick) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      try {
        onClick();
      } finally {
        dismiss();
      }
    });
  }
  h.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  const dismiss = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  };
  if (timeout) setTimeout(dismiss, timeout);
  return dismiss;
}
