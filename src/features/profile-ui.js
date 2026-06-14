import { store } from '../state.js';
import { t } from '../lib/i18n.js';
import { escapeHtml } from '../lib/utils.js';
import { PALETTE, colorFor, initials, updateMyProfile } from '../lib/profile.js';
import { changePassword } from '../lib/auth.js';

/** Normalise une chaîne en couleur hex #rrggbb (ou null si invalide). */
function normHex(v) {
  let s = String(v || '').trim();
  if (!s) return null;
  if (s[0] !== '#') s = '#' + s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) s = '#' + s.slice(1).replace(/(.)/g, '$1$1');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : null;
}

/** Ouvre l'éditeur de profil (nom + couleur). `onSaved` appelé après sauvegarde. */
export function openProfileEditor(onSaved) {
  const prof = store.get().profile || {};
  const uid = store.get().user?.id;
  const role = store.get().role;
  let color = colorFor(uid, prof.display_name);

  // Couleurs déjà utilisées par les autres (pour éviter les doublons).
  const taken = new Set(
    store.get().players.filter((p) => p.id !== uid && p.color).map((p) => p.color.toLowerCase())
  );

  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.innerHTML = `
    <div class="modal-card prof-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('profile.title')}</h3>

      <div class="prof-hero">
        <span class="prof-avatar prof-avatar-lg" id="prof-av">${escapeHtml(initials(prof.display_name))}</span>
        <div class="prof-hero-meta">
          <div class="prof-hero-name" id="prof-hero-name">${escapeHtml(prof.display_name || t('profile.noname'))}</div>
          <div class="prof-hero-role">${role === 'dm' ? t('profile.role.dm') : t('profile.role.player')}</div>
        </div>
      </div>

      <label class="prof-label">${t('profile.name')}</label>
      <input class="modal-input" id="prof-name" type="text" value="${escapeHtml(prof.display_name || '')}" placeholder="${t('profile.name')}" maxlength="40" />

      <label class="prof-label">${t('profile.color')}</label>
      <div class="prof-swatches" id="prof-swatches">
        ${PALETTE.map(
          (c) =>
            `<button class="prof-sw ${taken.has(c.toLowerCase()) ? 'taken' : ''}" data-c="${c}" style="background:${c}" title="${taken.has(c.toLowerCase()) ? t('profile.color.taken') : c}"></button>`
        ).join('')}
      </div>
      <div class="prof-custom">
        <input type="color" id="prof-color" value="${color}" title="${t('profile.color.custom')}" />
        <input class="modal-input prof-hex" id="prof-hex" type="text" value="${color}" maxlength="7" placeholder="#7c6af7" />
        <span class="prof-custom-lbl">${t('profile.color.free')}</span>
      </div>

      <div class="prof-previews">
        <div class="prof-prev-row" id="prof-prev-chat"></div>
        <div class="prof-prev-row" id="prof-prev-dice"></div>
      </div>

      <details class="prof-pwd">
        <summary>${t('profile.pwd.summary')}</summary>
        <input class="modal-input" id="prof-pwd0" type="password" autocomplete="current-password" placeholder="${t('profile.pwd.current')}" />
        <input class="modal-input" id="prof-pwd1" type="password" autocomplete="new-password" placeholder="${t('profile.pwd.new')}" />
        <input class="modal-input" id="prof-pwd2" type="password" autocomplete="new-password" placeholder="${t('profile.pwd.confirm')}" />
        <button class="modal-btn" id="prof-pwd-btn">${t('profile.pwd.btn')}</button>
        <div class="prof-pwd-msg" id="prof-pwd-msg"></div>
      </details>

      <div class="prof-err" id="prof-err"></div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel">${t('common.cancel')}</button>
        <button class="modal-btn modal-ok">${t('common.save')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  const av = ov.querySelector('#prof-av');
  const heroName = ov.querySelector('#prof-hero-name');
  const nameInput = ov.querySelector('#prof-name');
  const colorInput = ov.querySelector('#prof-color');
  const hexInput = ov.querySelector('#prof-hex');
  const err = ov.querySelector('#prof-err');
  const prevChat = ov.querySelector('#prof-prev-chat');
  const prevDice = ov.querySelector('#prof-prev-dice');

  function renderPreviews() {
    const nm = nameInput.value.trim() || t('profile.you');
    const ini = initials(nm);
    prevChat.innerHTML = `
      <span class="prof-chip-av" style="background:${color}">${escapeHtml(ini)}</span>
      <span class="prof-bubble"><b style="color:${color}">${escapeHtml(nm)}</b> ${t('profile.prev.chat')}</span>`;
    prevDice.innerHTML = `
      <span class="prof-chip-av" style="background:${color}">${escapeHtml(ini)}</span>
      <span class="prof-dice"><b style="color:${color}">${escapeHtml(nm)}</b> — ${t('profile.prev.dice')} <b>d20 → 17</b></span>`;
  }

  const applyColor = (c) => {
    const hx = normHex(c);
    if (!hx) return;
    color = hx;
    av.style.background = hx;
    colorInput.value = hx;
    if (document.activeElement !== hexInput) hexInput.value = hx;
    ov.querySelectorAll('.prof-sw').forEach((b) => b.classList.toggle('on', b.dataset.c.toLowerCase() === hx));
    renderPreviews();
  };
  applyColor(color);

  ov.querySelectorAll('.prof-sw').forEach((b) => b.addEventListener('click', () => applyColor(b.dataset.c)));
  colorInput.addEventListener('input', () => applyColor(colorInput.value));
  hexInput.addEventListener('input', () => {
    const hx = normHex(hexInput.value);
    if (hx) applyColor(hx);
  });
  nameInput.addEventListener('input', () => {
    av.textContent = initials(nameInput.value);
    heroName.textContent = nameInput.value.trim() || t('profile.noname');
    renderPreviews();
  });

  // Changement de mot de passe (utilisateur connecté).
  const pwdBtn = ov.querySelector('#prof-pwd-btn');
  const pwdMsg = ov.querySelector('#prof-pwd-msg');
  pwdBtn.addEventListener('click', async () => {
    pwdMsg.className = 'prof-pwd-msg';
    const p0 = ov.querySelector('#prof-pwd0').value;
    const p1 = ov.querySelector('#prof-pwd1').value;
    const p2 = ov.querySelector('#prof-pwd2').value;
    if (!p0) {
      pwdMsg.textContent = t('profile.pwd.err.current');
      pwdMsg.classList.add('err');
      return;
    }
    if (p1.length < 6) {
      pwdMsg.textContent = t('profile.pwd.err.short');
      pwdMsg.classList.add('err');
      return;
    }
    if (p1 !== p2) {
      pwdMsg.textContent = t('profile.pwd.err.mismatch');
      pwdMsg.classList.add('err');
      return;
    }
    pwdBtn.disabled = true;
    try {
      await changePassword(p0, p1);
      ov.querySelector('#prof-pwd0').value = '';
      ov.querySelector('#prof-pwd1').value = '';
      ov.querySelector('#prof-pwd2').value = '';
      pwdMsg.textContent = t('profile.pwd.ok');
      pwdMsg.classList.add('ok');
    } catch (e) {
      pwdMsg.textContent = e.message || t('profile.pwd.err.fail');
      pwdMsg.classList.add('err');
    } finally {
      pwdBtn.disabled = false;
    }
  });

  const close = () => {
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 150);
  };
  ov.querySelector('.modal-cancel').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('.modal-ok').addEventListener('click', async () => {
    err.textContent = '';
    if (!nameInput.value.trim()) {
      err.textContent = t('profile.err.noname');
      return;
    }
    try {
      await updateMyProfile({ display_name: nameInput.value, color });
      onSaved?.();
      close();
    } catch (e) {
      err.textContent = e.message || t('profile.err.save');
    }
  });
  nameInput.focus();
}
