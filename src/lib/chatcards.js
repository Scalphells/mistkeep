import { escapeHtml } from './utils.js';
import { characterNameForUser } from '../features/characters.js';
import { colorFor, initials } from './profile.js';

/**
 * Cartes de jet façon Foundry VTT, partagées par le flux des dés ET le chat.
 * Un jet (ligne `dice_rolls`) devient une carte : avatar + auteur + heure,
 * libellé, puces (MJ/aveugle/privé/avantage), encart formule, résultat coloré
 * (critique/échec), détail des dés, puis boutons d'application (MJ).
 */

/** Un jet est-il visible pour l'observateur courant ? (mêmes règles partout) */
export function rollVisibleTo(r, { isDM, user }) {
  if (r.roll_type === 'dm' && !isDM) return false;
  const vis = r.details?.vis;
  if (vis === 'self' && !isDM && r.details?.owner !== user?.id) return false; // privé
  return true;
}

/** Boutons d'application aux cibles (réservés au MJ). Le MJ choisit ensuite la
 *  réduction (plein / résistance / immunité) dans la fenêtre d'application. */
function applyButtons(r) {
  return `<div class="rc-apply">
      <button data-apply="damage" data-amount="${r.result}" title="Appliquer en dégâts (le MJ choisit résistance/immunité)">💥 Dégâts</button>
      <button data-apply="heal" data-amount="${r.result}" title="Appliquer en soin">💚 Soin</button>
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
  const time = r.created_at ? new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  const rolls = r.details?.rolls ?? [];
  const mod = r.details?.modifier ?? 0;

  // Critique fiable sur les jets de d20 (details.mode présent). Les systèmes à
  // dé de test configurable (1d100, 2d6…) n'ont pas de notion de 20 naturel.
  let critCls = '';
  let critTag = '';
  if (!masked && r.details?.mode !== undefined && /^1d20\b/.test(r.dice || '1d20')) {
    const kept = r.details?.kept ?? rolls[0];
    if (kept === 20) {
      critCls = 'crit-good';
      critTag = 'CRITIQUE !';
    } else if (kept === 1) {
      critCls = 'crit-bad';
      critTag = 'ÉCHEC';
    }
  }

  const chips = [];
  if (r.roll_type === 'dm') chips.push('🎭 MJ');
  else if (vis === 'blind') chips.push('🙈 aveugle');
  else if (vis === 'self') chips.push('🔒 privé');
  if (r.details?.mode === 'adv') chips.push('avantage');
  else if (r.details?.mode === 'dis') chips.push('désavantage');

  const formula = escapeHtml(r.dice || '');
  const breakdown =
    !masked && (rolls.length > 1 || mod)
      ? `[${rolls.join(', ')}]${mod ? (mod > 0 ? ` +${mod}` : ` ${mod}`) : ''}`
      : '';

  const rollerWho = characterNameForUser(r.roller_id) || r.roller_name || 'Anonyme';
  const head = `
    <div class="rc-head">
      <div class="rc-av" style="background:${color}">${escapeHtml(initials(rollerWho))}</div>
      <div class="rc-who">
        <strong style="color:${color}">${escapeHtml(rollerWho)}</strong>
        ${r.roll_name ? `<span class="rc-label">${escapeHtml(r.roll_name)}</span>` : ''}
      </div>
      ${time ? `<span class="rc-time">${time}</span>` : ''}
    </div>`;

  if (masked) {
    return `<div class="roll-card masked">
        ${head}
        <div class="rc-private">a lancé un dé en privé</div>
        <div class="rc-total">?</div>
      </div>`;
  }

  return `<div class="roll-card ${critCls}">
      ${head}
      ${chips.length ? `<div class="rc-tags">${chips.map((c) => `<span class="rc-chip">${escapeHtml(c)}</span>`).join('')}</div>` : ''}
      ${formula ? `<div class="rc-formula">${formula}</div>` : ''}
      <div class="rc-total ${critCls}">${escapeHtml(String(r.result))}</div>
      ${breakdown ? `<div class="rc-detail">${escapeHtml(breakdown)}</div>` : ''}
      ${critTag ? `<div class="rc-crittag ${critCls}">${critTag}</div>` : ''}
      ${isDM && isDamageLikeRoll(r) ? applyButtons(r) : ''}
    </div>`;
}

/** En-tête commun (avatar + auteur + heure) pour les cartes riches d'un message. */
function msgHead(m, subtitle) {
  const color = colorFor(m.sender_id, m.sender_name);
  const who = characterNameForUser(m.sender_id) || m.sender_name || 'Anonyme';
  const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="rc-head">
      <div class="rc-av" style="background:${color}">${escapeHtml(initials(who))}</div>
      <div class="rc-who">
        <strong style="color:${color}">${escapeHtml(who)}</strong>
        ${subtitle ? `<span class="rc-label">${escapeHtml(subtitle)}</span>` : ''}
      </div>
      ${time ? `<span class="rc-time">${time}</span>` : ''}
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
      <div class="ac-name">${escapeHtml(payload.name || 'Action')}</div>
      ${traits.length ? `<div class="ac-traits">${traits.map((t) => `<span class="ac-trait">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${payload.desc ? `<div class="ac-cdesc">${escapeHtml(payload.desc)}</div>` : ''}
    </div>`;
}
