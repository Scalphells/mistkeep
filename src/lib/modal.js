import { escapeHtml } from './utils.js';

/**
 * Modales applicatives (remplacent alert / confirm / prompt natifs).
 *
 * Toutes renvoient une promesse :
 *   - modalAlert   -> Promise<void>
 *   - modalConfirm -> Promise<boolean>
 *   - modalPrompt  -> Promise<string|null>  (null = annulé)
 *
 * Clavier : Échap annule, Entrée valide (Ctrl+Entrée pour les zones multilignes).
 * Une seule modale à la fois ; le focus revient à l'élément précédent à la
 * fermeture.
 */

let _open = null; // { overlay, resolve, prevFocus }

function close(result) {
  if (!_open) return;
  const { overlay, resolve, prevFocus, onKey } = _open;
  document.removeEventListener('keydown', onKey, true);
  overlay.classList.remove('show');
  const o = overlay;
  setTimeout(() => o.remove(), 150);
  _open = null;
  try {
    prevFocus?.focus?.();
  } catch {
    /* no-op */
  }
  resolve(result);
}

function build({ title, message, kind, fields, okLabel, cancelLabel, danger }) {
  // Ferme une éventuelle modale déjà ouverte (annulation).
  if (_open) close(kind === 'prompt' ? null : false);

  const prevFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      ${title ? `<h3 class="modal-title">${escapeHtml(title)}</h3>` : ''}
      ${message ? `<p class="modal-msg">${escapeHtml(message)}</p>` : ''}
      ${fields || ''}
      <div class="modal-actions">
        ${kind !== 'alert' ? `<button class="modal-btn modal-cancel">${escapeHtml(cancelLabel || 'Annuler')}</button>` : ''}
        <button class="modal-btn modal-ok ${danger ? 'danger' : ''}">${escapeHtml(okLabel || 'OK')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  // Animation d'entrée.
  requestAnimationFrame(() => overlay.classList.add('show'));
  return { overlay, prevFocus };
}

function modalBase(opts, onOk) {
  return new Promise((resolve) => {
    const { overlay, prevFocus } = build(opts);
    const okBtn = overlay.querySelector('.modal-ok');
    const cancelBtn = overlay.querySelector('.modal-cancel');
    const input = overlay.querySelector('.modal-input');

    const confirm = () => close(onOk(overlay));
    const cancel = () => close(opts.kind === 'prompt' ? null : false);

    okBtn.addEventListener('click', confirm);
    cancelBtn?.addEventListener('click', cancel);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) cancel();
    });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter') {
        const multiline = input && input.tagName === 'TEXTAREA';
        if (multiline && !e.ctrlKey && !e.metaKey) return; // Entrée = nouvelle ligne
        e.preventDefault();
        confirm();
      } else if (e.key === 'Tab') {
        // Piège de focus : la tabulation reste dans la fenêtre (accessibilité).
        const f = overlay.querySelectorAll(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        const here = document.activeElement;
        if (e.shiftKey && (here === first || !overlay.contains(here))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && here === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);

    _open = { overlay, resolve, prevFocus, onKey };

    // Focus initial.
    if (input) {
      input.focus();
      input.select?.();
    } else {
      okBtn.focus();
    }
  });
}

export function modalAlert(message, { title = '', okLabel = 'OK' } = {}) {
  return modalBase({ kind: 'alert', title, message, okLabel }, () => undefined);
}

export function modalConfirm(message, { title = '', okLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false } = {}) {
  return modalBase({ kind: 'confirm', title, message, okLabel, cancelLabel, danger }, () => true);
}

export function modalPrompt(message, { title = '', defaultValue = '', placeholder = '', okLabel = 'Valider', cancelLabel = 'Annuler', multiline = false } = {}) {
  const fields = multiline
    ? `<textarea class="modal-input modal-textarea" placeholder="${escapeHtml(placeholder)}">${escapeHtml(defaultValue)}</textarea>`
    : `<input class="modal-input" type="text" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}" />`;
  return modalBase(
    { kind: 'prompt', title, message, fields, okLabel, cancelLabel },
    (overlay) => overlay.querySelector('.modal-input').value
  );
}
