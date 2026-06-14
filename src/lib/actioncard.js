import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { renderMarkdown } from './markdown.js';
import { sendRoll, sendD20Check, parseDice } from '../features/dice.js';
import { updateCharacter } from '../features/characters.js';
import { resolveAttackVsTargets, applyToTargets, applyConditionToTargets, applyDamageRollToTargets } from './applyroll.js';
import { logAction, sendPlayerRequest } from '../features/initiative.js';
import { resolveNotation } from '../features/characters.js';
import { postCard } from './chatpost.js';
import { showToast } from './toast.js';
import { t } from './i18n.js';

/**
 * Carte d'action (façon Foundry) : clic sur une attaque ou un sort → fenêtre
 * avec description + boutons (jet d'attaque, dégâts, dégâts critiques, DD de
 * sauvegarde, consommer un emplacement). Chaque jet est publié dans le flux des
 * dés (donc applicable aux cibles via les boutons Dégâts/Soin).
 */

function normBon(v) {
  const n = parseInt(String(v ?? '').replace(/[^\d+-]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}
/** Lance une notation de soin (sans critique) et renvoie le total. */
function rollHeal(notation) {
  const p = parseDice(notation);
  if (!p) {
    const f = Number(String(notation).trim());
    return Number.isFinite(f) ? Math.max(0, f) : 0;
  }
  const buf = new Uint32Array(1);
  let s = 0;
  for (let i = 0; i < p.count; i++) {
    const limit = Math.floor(0xffffffff / p.sides) * p.sides;
    let x;
    do {
      crypto.getRandomValues(buf);
      x = buf[0];
    } while (x >= limit);
    s += (x % p.sides) + 1;
  }
  return Math.max(0, s + p.modifier);
}
/** Notation des dégâts avec dés doublés (critique). */
function critNotation(dmg) {
  const p = parseDice(dmg);
  if (!p) return dmg;
  const mod = p.modifier > 0 ? `+${p.modifier}` : p.modifier < 0 ? `${p.modifier}` : '';
  return `${p.count * 2}d${p.sides}${mod}`;
}

let _ov = null;
export function closeActionCard() {
  if (_ov) {
    _ov.remove();
    _ov = null;
    document.removeEventListener('keydown', _key, true);
  }
}
function _key(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeActionCard();
  }
}

/**
 * @param {{charId, who, kind:'atk'|'spell', item}} opts
 *   item attaque : {nm, bon, dmg, typ, prop}
 *   item sort    : {nm, lvl, desc, atk, dmg, dc}
 */
/** Nom normalisé pour le rapprochement avec le compendium (accents/casse/suffixe). */
function normNm(s) {
  return String(s || '')
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, ''); // retire un suffixe « (2 ki) », « (rituel) »…
}

/**
 * Complète une action de la fiche avec l'entrée du compendium de même nom :
 * la description (et le niveau d'un sort) sont reflétés sur la fiche sans
 * dupliquer la saisie. Les champs déjà renseignés sur la fiche priment.
 */
function enrichFromCompendium(kind, item) {
  if (!item || item.desc) return item;
  const list = store.get().compendium || [];
  // Lien explicite (entryId posé à l'ajout depuis le compendium) prioritaire,
  // sinon rapprochement par nom.
  let entry = item.entryId ? list.find((e) => e.id === item.entryId) : null;
  if (!entry) {
    const wantKind = kind === 'spell' ? 'spell' : 'item';
    const target = normNm(item.nm);
    if (!target) return item;
    entry =
      list.find((e) => e.kind === wantKind && normNm(e.name) === target) ||
      list.find((e) => (e.kind === 'spell' || e.kind === 'item') && normNm(e.name) === target);
  }
  if (!entry) return item;
  return { ...item, desc: entry.data?.desc || item.desc, lvl: item.lvl ?? entry.data?.level };
}

export function openActionCard({ charId, who, kind, item }) {
  closeActionCard();
  if (!item) return;
  item = enrichFromCompendium(kind, item);
  const isSpell = kind === 'spell';
  // Données de la fiche pour résoudre les jetons (MOD = caract. d'incantation, etc.).
  const cdata = store.get().characters.find((c) => c.id === charId)?.data || null;
  const bon = normBon(resolveNotation(isSpell ? item.atk : item.bon, cdata));
  // noAtk : action à sauvegarde / sans jet d'attaque (ex. souffle de monstre).
  const hasAtk = item.noAtk ? false : isSpell ? item.atk != null && item.atk !== '' : true;
  const dmg = resolveNotation(item.dmg || '', cdata);
  const heal = resolveNotation(item.heal || '', cdata);
  const cond = (item.cond || '').trim();
  const dc = item.dc || '';
  const lvl = Number(item.lvl) || 0;
  const nm = item.nm || (isSpell ? t('combat.action.spell') : t('combat.action.attack'));
  const meta = isSpell ? '' : [item.typ, item.prop].filter(Boolean).map(escapeHtml).join(' · ');

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card atk-card ac-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">${escapeHtml(nm)}${isSpell && lvl ? ` <small>${t('ac.lvlSmall', { lvl })}</small>` : isSpell ? ` <small>${t('ac.cantrip')}</small>` : ''}</h3>
      <div class="ac-sub">${escapeHtml(who || '')}${meta ? ` — ${meta}` : ''}</div>
      ${item.desc ? `<div class="ac-desc">${renderMarkdown(item.desc)}</div>` : ''}
      <div class="atk-row"><label>${t('ac.roll')}</label>
        <div class="atk-modes" id="ac-mode">
          <button data-m="normal" class="active">${t('ac.mode.normal')}</button>
          <button data-m="adv">${t('ac.mode.adv')}</button>
          <button data-m="dis">${t('ac.mode.dis')}</button>
        </div>
      </div>
      <div class="ac-actions">
        ${hasAtk ? `<button class="modal-btn ac-btn modal-ok" data-do="atk">🎲 ${t('ac.atk')} (${bon >= 0 ? '+' : ''}${bon})${store.get().targets?.length ? ` — ${t('ac.targets', { n: store.get().targets.length })}` : ''}</button>` : ''}
        ${dmg ? `<button class="modal-btn ac-btn" data-do="dmg">💥 ${t('ac.dmg')} (${escapeHtml(dmg)})</button>` : ''}
        ${dmg ? `<button class="modal-btn ac-btn crit" data-do="crit">💥 ${t('ac.crit')} (${escapeHtml(critNotation(dmg))})</button>` : ''}
        ${heal ? `<button class="modal-btn ac-btn heal" data-do="heal">💚 ${t('ac.heal')} (${escapeHtml(heal)})</button>` : ''}
        ${cond ? `<button class="modal-btn ac-btn" data-do="cond">🩹 ${t('ac.applyCond', { cond: escapeHtml(cond) })}</button>` : ''}
        ${dc ? `<button class="modal-btn ac-btn" data-do="dc">🛡 ${t('ac.saveDC', { dc: escapeHtml(String(dc)) })}</button>` : ''}
        ${isSpell && lvl ? `<button class="modal-btn ac-btn" data-do="slot">🔮 ${t('ac.consumeSlot', { lvl })}</button>` : ''}
      </div>
      <div class="ac-followup" id="ac-followup"></div>
      <div class="ac-result" id="ac-result"></div>
      <div class="modal-actions"><button class="modal-btn ac-close">${t('common.close')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);

  let mode = 'normal';
  ov.querySelectorAll('#ac-mode button').forEach((b) =>
    b.addEventListener('click', () => {
      mode = b.dataset.m;
      ov.querySelectorAll('#ac-mode button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  ov.querySelector('.ac-close').addEventListener('click', closeActionCard);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) closeActionCard();
  });

  const followEl = ov.querySelector('#ac-followup');
  const resultEl = ov.querySelector('#ac-result');

  /**
   * Lance les dégâts (normaux ou critiques), affiche le total, le journalise et
   * route l'application : le MJ ouvre la modale de réduction (résistances) ;
   * un joueur envoie le total au MJ qui valide le montant appliqué.
   */
  async function rollDamage(crit) {
    if (!dmg) return;
    const note = crit ? critNotation(dmg) : dmg;
    const label = crit ? t('ac.lbl.dmgCrit', { who, nm }) : t('ac.lbl.dmg', { who, nm });
    const outcome = await sendRoll(note, 'public', label).catch(() => null);
    const total = outcome?.total;
    // Pas de doublon : la carte de jet (chat/flux des dés) affiche déjà le total.
    if (resultEl && total != null) {
      const detail = outcome.rolls?.length ? `[${outcome.rolls.join(', ')}]${outcome.modifier ? (outcome.modifier > 0 ? ` +${outcome.modifier}` : ` ${outcome.modifier}`) : ''}` : '';
      const isDM = store.get().isDM;
      const hint = !store.get().targets?.length
        ? t('ac.hint.target')
        : isDM
          ? t('ac.hint.dm')
          : t('ac.hint.player');
      resultEl.innerHTML = `<div class="ac-dmg ${crit ? 'crit' : ''}"><span class="ac-dmg-total">${total}</span> ${t('ac.dmgWord')}${crit ? ` <span class="ac-crit-tag">${t('ac.critTag')}</span>` : ''} ${detail ? `<span class="ac-dmg-detail">${escapeHtml(detail)}</span>` : ''}<div class="ac-dmg-hint">${hint}</div></div>`;
    }
    if (total == null) return;
    const targets = store.get().targets || [];
    if (store.get().isDM) {
      if (targets.length) {
        applyDamageRollToTargets({ amount: total, who, nm, crit });
      } else {
        showToast(t('ac.toast.noTarget'), { timeout: 4200 });
      }
    } else {
      // Joueur : on délègue TOUJOURS au MJ (qui appliquera sur ses propres cibles
      // si le joueur n'en a pas sélectionné de son côté).
      sendPlayerRequest({ kind: 'dmgask', amount: total, who, nm, crit, tokenIds: [...targets] });
      showToast(t('ac.toast.dmgSent'), { timeout: 2600 });
    }
  }

  /**
   * Bandeau de statut affiché après un jet d'attaque. On ne duplique PAS les
   * boutons de dégâts (déjà présents au-dessus) : on indique seulement le
   * verdict — visible du MJ uniquement (c'est lui qui décide si ça touche).
   */
  function renderFollowup(res) {
    if (!followEl) return;
    if (!res || !res.any) {
      followEl.innerHTML = '';
      return;
    }
    const isDM = store.get().isDM;
    const crit = res.anyCrit;
    const tip = dmg ? t('ac.follow.tipDmg') : '';
    let cls = 'hit';
    let msg;
    if (!isDM) {
      msg = t('ac.follow.sent') + (dmg ? t('ac.follow.sentDmg') : '');
    } else if (res.anyHit) {
      msg = crit ? t('ac.follow.crit') + (dmg ? t('ac.follow.critDmg') : '') : t('ac.follow.hit') + tip;
    } else if (res.anyUnknownAc) {
      cls = 'unknown';
      msg = t('ac.follow.unknownAc') + tip;
    } else {
      cls = 'miss';
      msg = t('ac.follow.miss');
    }
    followEl.innerHTML = `<div class="ac-follow ${cls}">${msg}</div>`;
  }

  // Annonce l'action dans le chat (carte façon Foundry) une seule fois par usage.
  let announced = false;
  function announce() {
    if (announced) return;
    announced = true;
    const traits = (isSpell ? [lvl ? t('ac.trait.lvl', { lvl }) : t('ac.trait.cantrip')] : [t('combat.action.attack')])
      .concat(isSpell ? [] : [item.typ, item.prop])
      .filter(Boolean);
    postCard({ kind: 'action', name: nm, sub: who, traits, desc: item.desc || '' });
  }

  ov.querySelectorAll('[data-do]').forEach((b) =>
    b.addEventListener('click', () => {
      const act = b.dataset.do;
      if (['atk', 'dmg', 'crit', 'heal', 'cond', 'dc'].includes(act)) announce();
      if (act === 'atk') {
        // On lance le d20 UNE fois (flux des dés) puis on résout avec ce même dé.
        sendD20Check(bon, t('ac.lbl.atk', { who, nm }), { mode }).then((d20) => {
          if (!d20) return;
          const targets = store.get().targets || [];
          if (!targets.length) {
            // Le dé est déjà affiché par la carte de jet ; rien à journaliser ici.
            return;
          }
          if (store.get().isDM) {
            // Le MJ résout localement (CA réelle) et voit le verdict.
            renderFollowup(resolveAttackVsTargets({ kept: d20.kept, total: d20.total }, who, nm));
          } else {
            // Le joueur délègue la résolution au MJ (CA cachée) ; pas de verdict côté joueur.
            sendPlayerRequest({ kind: 'atkask', d20: { kept: d20.kept, total: d20.total, mode: d20.mode }, tokenIds: [...targets], who, nm });
            renderFollowup({ any: true, anyCrit: d20.kept === 20 });
          }
        });
      } else if (act === 'dmg') rollDamage(false);
      else if (act === 'crit') rollDamage(true);
      else if (act === 'heal') {
        applyToTargets(rollHeal(heal), 'heal');
      } else if (act === 'cond') {
        applyConditionToTargets(cond);
      } else if (act === 'dc') {
        logAction(lvl ? t('ac.log.saveLvl', { who, nm, lvl, dc }) : t('ac.log.save', { who, nm, dc }));
        showToast(t('ac.toast.save', { nm, dc }), { timeout: 2000 });
      } else if (act === 'slot') {
        consumeSlot(charId, lvl);
      }
    })
  );
}

function consumeSlot(charId, lvl) {
  const cur = store.get().characters.find((c) => c.id === charId);
  if (!cur) return;
  const slots = { ...(cur.data.slots || {}) };
  const s = { ...(slots[lvl] || { m: 0, u: 0 }) };
  if ((s.u || 0) >= (s.m || 0)) {
    showToast(t('ac.toast.noSlot', { lvl }), { timeout: 2000 });
    return;
  }
  s.u = (s.u || 0) + 1;
  slots[lvl] = s;
  updateCharacter(charId, { slots });
  showToast(t('ac.toast.slotUsed', { lvl }), { timeout: 1600 });
}
