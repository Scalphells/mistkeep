import { escapeHtml } from './utils.js';
import { colorFor, initials } from './profile.js';
import { characterNameForUser, portraitUrl } from '../features/characters.js';
import { store } from '../state.js';
import { t } from './i18n.js';

/**
 * Cartes de jet façon Foundry VTT, partagées par le flux des dés ET le chat.
 * Un jet (ligne `dice_rolls`) devient une carte : avatar (portrait) + auteur +
 * rôle + heure relative, titre de jet, puces, formule, résultat coloré, détail,
 * puis boutons d'application (MJ).
 */

/* Temps relatif localisé (« il y a 37 s »), heure absolue conservée en infobulle. */
function timeAgo(iso) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000; // < 0 = passé
  const a = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(t('locale.bcp47'), { numeric: 'auto', style: 'short' });
  if (a < 60) return rtf.format(Math.round(diff), 'second');
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
function timeTag(iso) {
  if (!iso) return '';
  const abs = new Date(iso).toLocaleTimeString(t('locale.bcp47'), { hour: '2-digit', minute: '2-digit' });
  return `<span class="rc-time" title="${escapeHtml(abs)}">${escapeHtml(timeAgo(iso))}</span>`;
}
/* Portrait de la fiche du lanceur (URL signée en cache) ; sinon null → initiales. */
function rollerPortrait(userId) {
  const ch = userId && store.get().characters.find((c) => c.owner_id === userId);
  return ch?.data?.portrait ? portraitUrl(ch.data.portrait) : null;
}
/* Avatar : portrait de fiche si disponible, sinon pastille d'initiales colorée. */
function avatarHtml(userId, who, color) {
  const p = rollerPortrait(userId);
  return p
    ? `<div class="rc-av"><img src="${escapeHtml(p)}" alt=""></div>`
    : `<div class="rc-av" style="background:${color}">${escapeHtml(initials(who))}</div>`;
}

/** Un jet est-il visible pour l'observateur courant ? (mêmes règles partout) */
export function rollVisibleTo(r, { isDM, user }) {
  if (r.roll_type === 'dm' && !isDM) return false;
  const vis = r.details?.vis;
  if (vis === 'self' && !isDM && r.details?.owner !== user?.id) return false; // privé
  return true;
}

/** Boutons d'application aux cibles (réservés au MJ). « Dégâts » ouvre la fenêtre
 *  de réduction (résistance/immunité) ; ½ et ×2 appliquent directement. */
function applyButtons(r) {
  return `<div class="rc-apply">
      <button data-apply="damage" data-amount="${r.result}" title="${t('cc.apply.dmg.title')}">${t('applyroll.dmg')}</button>
      <button data-apply="half" data-amount="${r.result}" title="${t('cc.apply.half.title')}">${t('applyroll.half')}</button>
      <button data-apply="double" data-amount="${r.result}" title="${t('cc.apply.double.title')}">${t('applyroll.double')}</button>
      <button data-apply="heal" data-amount="${r.result}" title="${t('cc.apply.heal.title')}">${t('applyroll.heal')}</button>
    </div>`;
}

/** Un jet est-il « de dégâts » (montant applicable) plutôt qu'un test/attaque ?
 *  Les jets de d20 (test, sauvegarde, attaque) portent details.mode ; pas les
 *  jets de dégâts/soin (sendRoll). Le total d'une attaque n'est PAS des dégâts. */
function isDamageLikeRoll(r) {
  return r?.details?.mode === undefined;
}

/**
 * Rend une carte de jet (HTML).
 * @param {object} r   ligne dice_rolls
 * @param {{isDM:boolean, user:object}} ctx
 */
export function rollCardHtml(r, { isDM, user }) {
  const vis = r.details?.vis;
  const masked = vis === 'blind' && !isDM; // aveugle : caché aux joueurs
  const color = colorFor(r.roller_id, r.roller_name);
  const rolls = r.details?.rolls ?? [];
  const mod = r.details?.modifier ?? 0;
  // Décomposition du modificateur en pastilles (« Constitution +2 · Expert +7 »).
  const parts = !masked && Array.isArray(r.details?.parts) ? r.details.parts : [];

  // Critique fiable sur les jets de d20 (details.mode présent). Les systèmes à
  // dé de test configurable (1d100, 2d6…) n'ont pas de notion de 20 naturel.
  let critCls = '';
  let critTag = '';
  if (!masked && r.details?.mode !== undefined && /^1d20\b/.test(r.dice || '1d20')) {
    const kept = r.details?.kept ?? rolls[0];
    if (kept === 20) {
      critCls = 'crit-good';
      critTag = t('cc.crit');
    } else if (kept === 1) {
      critCls = 'crit-bad';
      critTag = t('cc.fail');
    }
  }

  const chips = [];
  if (r.roll_type === 'dm') chips.push(t('cc.chip.dm'));
  else if (vis === 'blind') chips.push(t('cc.chip.blind'));
  else if (vis === 'self') chips.push(t('cc.chip.self'));
  if (r.details?.mode === 'adv') chips.push(t('cc.chip.adv'));
  else if (r.details?.mode === 'dis') chips.push(t('cc.chip.dis'));

  const formula = escapeHtml(r.dice || '');
  const breakdown =
    !masked && (rolls.length > 1 || mod)
      ? `[${rolls.join(', ')}]${mod ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : ''}`
      : '';

  const charName = characterNameForUser(r.roller_id);
  const rollerWho = charName || r.roller_name || t('dock.anon');
  // Sous-ligne « rôle » : le joueur qui contrôle le personnage (façon « Cealan · Cero »).
  const roleSub = charName && r.roller_name && r.roller_name !== charName ? r.roller_name : '';
  // Titre de type de jet (« Sauvegarde de Vigueur ») en corps de carte, sauf si
  // ce n'est que la notation du dé (jet rapide).
  const title = r.roll_name && r.roll_name !== r.dice ? r.roll_name : '';
  const head = `
    <div class="rc-head">
      ${avatarHtml(r.roller_id, rollerWho, color)}
      <div class="rc-who">
        <strong style="color:${color}">${escapeHtml(rollerWho)}</strong>
        ${roleSub ? `<span class="rc-label">${escapeHtml(roleSub)}</span>` : ''}
      </div>
      ${timeTag(r.created_at)}
    </div>`;

  if (masked) {
    return `<div class="roll-card masked">
        ${head}
        <div class="rc-private">${t('cc.privateRoll')}</div>
        <div class="rc-total">?</div>
      </div>`;
  }

  return `<div class="roll-card ${critCls}">
      ${head}
      ${title ? `<div class="rc-title">${escapeHtml(title)}</div>` : ''}
      ${parts.length ? `<div class="rc-parts">${parts.map((p) => `<span class="rc-part">${escapeHtml(p.label)} ${p.value >= 0 ? '+' : '−'}${escapeHtml(String(Math.abs(Number(p.value))))}</span>`).join('')}</div>` : ''}
      ${chips.length ? `<div class="rc-tags">${chips.map((c) => `<span class="rc-chip">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
      ${formula ? `<div class="rc-formula">${formula}</div>` : ''}
      <div class="rc-total ${critCls}">${escapeHtml(String(r.result))}</div>
      ${breakdown ? `<div class="rc-detail">${escapeHtml(breakdown)}</div>` : ''}
      ${critTag ? `<div class="rc-crittag ${critCls}">${critTag}</div>` : ''}
      ${isDM && isDamageLikeRoll(r) ? applyButtons(r) : ''}
    </div>`;
}

/** En-tête commun (avatar + auteur + heure relative) pour les cartes riches. */
function msgHead(m, subtitle) {
  const color = colorFor(m.sender_id, m.sender_name);
  const who = characterNameForUser(m.sender_id) || m.sender_name || t('dock.anon');
  return `<div class="rc-head">
      ${avatarHtml(m.sender_id, who, color)}
      <div class="rc-who">
        <strong style="color:${color}">${escapeHtml(who)}</strong>
        ${subtitle ? `<span class="rc-label">${escapeHtml(subtitle)}</span>` : ''}
      </div>
      ${timeTag(m.created_at)}
    </div>`;
}

/**
 * Carte riche (façon Foundry) publiée dans le chat via chatpost.js.
 *  - kind 'action' : action/sort utilisé { name, sub, traits[], desc }
 *  - kind 'note'   : narration { icon, title, sub, lines[] }
 * @param {object} payload  charge décodée
 * @param {object} m        message porteur (auteur/heure)
 */
export function richCardHtml(payload, m) {
  if (!payload || typeof payload !== 'object') return '';
  if (payload.kind === 'note') {
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    return `<div class="rich-card note">
        ${msgHead(m, payload.sub || '')}
        <div class="nc-title">${payload.icon ? `${escapeHtml(payload.icon)} ` : ''}${escapeHtml(payload.title || '')}</div>
        ${lines.length ? `<ul class="nc-lines">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>` : ''}
      </div>`;
  }
  // Par défaut : carte d'action.
  const traits = Array.isArray(payload.traits) ? payload.traits.filter(Boolean) : [];
  return `<div class="rich-card action">
      ${msgHead(m, payload.sub || '')}
      <div class="ac-name">${escapeHtml(payload.name || t('cc.actionDefault'))}</div>
      ${traits.length ? `<div class="ac-traits">${traits.map((tr) => `<span class="ac-trait">${escapeHtml(tr)}</span>`).join('')}</div>` : ''}
      ${payload.desc ? `<div class="ac-cdesc">${escapeHtml(payload.desc)}</div>` : ''}
    </div>`;
}
