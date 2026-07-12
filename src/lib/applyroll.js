import { store } from '../state.js';
import { adjustHp, logCombat, logAction, sendPlayerRequest, updateCombatant, applyDmgToTarget } from '../features/initiative.js';
import { updateCharacter } from '../features/characters.js';
import { updateToken } from '../features/map.js';
import { parseDice } from '../features/dice.js';
import { showToast } from './toast.js';
import { openDamageApply } from './dmgapply.js';
import { openApplyPicker } from './applypicker.js';
import { getSystem } from './systems/index.js';
import { activeCampaign } from './campaigns.js';
import { d20Degree } from './rules.js';
import { t } from './i18n.js';

function rng(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / range) * range;
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return min + (x % range);
}
function charOf(charId) {
  return charId ? store.get().characters.find((c) => c.id === charId) || null : null;
}
function acOf(t) {
  const ch = charOf(t?.charId);
  if (ch?.data?.ac != null) return Number(ch.data.ac);
  return t?.ac != null ? Number(t.ac) : null;
}
function rollDmg(notation, crit) {
  const p = parseDice(notation);
  if (!p) {
    const f = Number(String(notation).trim());
    return Number.isFinite(f) ? Math.max(0, f) : 0;
  }
  const n = crit ? p.count * 2 : p.count;
  let s = 0;
  for (let i = 0; i < n; i++) s += rng(1, p.sides);
  return Math.max(0, s + p.modifier);
}

/**
 * Application d'un résultat de jet aux cibles courantes (façon Foundry :
 * Dégâts / Moitié / Double / Soin). Les cibles = `store.targets` (jetons
 * ciblés sur la carte). Le MJ applique directement ; un joueur diffuse au MJ.
 */

function tokenName(tok) {
  if (!tok) return t('applyroll.target');
  const ch = tok.charId ? store.get().characters.find((c) => c.id === tok.charId) : null;
  return tok.label || ch?.name || t('applyroll.target');
}
function combatantForToken(t) {
  const init = store.get().initiative;
  if (t?.entityId) {
    const c = init.find((x) => x.entity_id === t.entityId);
    if (c) return c;
  }
  return t?.charId ? init.find((x) => x.char_id === t.charId) || null : null;
}

/** Applique un delta de PV (négatif = dégâts, positif = soin) à un jeton (MJ). */
function applyDeltaDM(tok, delta) {
  const comb = combatantForToken(tok);
  if (comb) {
    adjustHp(comb.entity_id, delta); // gère PV temp / soin / journal
    return;
  }
  const ch = tok.charId ? store.get().characters.find((c) => c.id === tok.charId) : null;
  if (ch && ch.data?.hp != null) {
    const before = Number(ch.data.hp) || 0;
    let hp = before + delta;
    if (ch.data.hpMax != null) hp = Math.min(Number(ch.data.hpMax), hp);
    hp = Math.max(0, hp);
    updateCharacter(ch.id, { hp });
    logCombat(`${delta < 0 ? '💥' : '💚'} ${t('applyroll.log.hp', { name: tokenName(tok), before, after: hp })}`);
    return;
  }
  if (tok.hp != null || tok.hpMax != null) {
    const before = Number(tok.hp) || 0;
    let hp = before + delta;
    if (tok.hpMax != null) hp = Math.min(Number(tok.hpMax), hp);
    hp = Math.max(0, hp);
    updateToken(tok.id, { hp });
    logCombat(`${delta < 0 ? '💥' : '💚'} ${t('applyroll.log.hp', { name: tokenName(tok), before, after: hp })}`);
  }
}

/** kind : 'damage' | 'half' | 'double' | 'heal'. */
export function applyToTargets(rawAmount, kind) {
  let amt = Math.abs(Number(rawAmount) || 0);
  if (kind === 'half') amt = Math.floor(amt / 2);
  else if (kind === 'double') amt *= 2;
  if (amt <= 0) return;
  const heal = kind === 'heal';
  const isDM = store.get().isDM;
  const targets = store.get().targets || [];
  if (!targets.length) {
    // Pas de cible sélectionnée : le MJ choisit à la volée (pas besoin de cibler
    // sur la carte). Un joueur est invité à cibler (il ne peut pas appliquer).
    if (isDM) {
      openApplyPicker({ amount: amt, heal, onApply: (combs) => combs.forEach((c) => adjustHp(c.entity_id, heal ? amt : -amt)) });
    } else {
      showToast(t('applyroll.toast.targetFirstMap'), { timeout: 2800 });
    }
    return;
  }
  const delta = heal ? amt : -amt;
  const tokens = store.get().map?.tokens || [];
  let n = 0;
  for (const tid of targets) {
    const tok = tokens.find((x) => x.id === tid);
    if (!tok) continue;
    if (isDM) {
      applyDeltaDM(tok, delta);
    } else {
      // Joueur : délégué au MJ (montant signé : négatif = soin).
      sendPlayerRequest({ kind: 'dmg', target: { entityId: tok.entityId || null, charId: tok.charId || null, tokenId: tok.id, name: tokenName(tok) }, amount: heal ? -amt : amt });
    }
    n++;
  }
  showToast(`${heal ? t('applyroll.heal') : t('applyroll.dmg')} ${amt} → ${t('ac.targets', { n })}`, { timeout: 2200 });
}

/** Résout une attaque sur chaque cible courante (d20+bon vs CA → dégâts). */
export function attackTargets(bon, dmgNotation, mode = 'normal') {
  const targets = store.get().targets || [];
  if (!targets.length) {
    showToast(t('applyroll.toast.targetFirst'), { timeout: 2800 });
    return;
  }
  const tokens = store.get().map?.tokens || [];
  const isDM = store.get().isDM;
  let touched = 0;
  let count = 0;
  for (const tid of targets) {
    const tok = tokens.find((x) => x.id === tid);
    if (!tok) continue;
    count++;
    let nat;
    if (mode === 'adv' || mode === 'dis') {
      const a = rng(1, 20);
      const b = rng(1, 20);
      nat = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    } else nat = rng(1, 20);
    const ac = acOf(tok);
    const total = nat + (Number(bon) || 0);
    const crit = nat === 20;
    const fumble = nat === 1;
    const hit = crit || (!fumble && (ac == null || total >= ac));
    let dmg = 0;
    if (hit && dmgNotation) {
      dmg = rollDmg(dmgNotation, crit);
      if (dmg > 0) {
        if (isDM) applyDeltaDM(tok, -dmg);
        else sendPlayerRequest({ kind: 'dmg', target: { entityId: tok.entityId || null, charId: tok.charId || null, tokenId: tok.id, name: tokenName(tok) }, amount: dmg });
      }
    }
    if (hit) touched++;
    const verdict = crit ? t('applyroll.v.crit') : fumble ? t('applyroll.v.fumble') : hit ? t('applyroll.v.hit') : t('applyroll.v.miss');
    logCombat(`⚔ → ${tokenName(tok)} : ${total}${ac != null ? ` ${t('applyroll.vsAc', { ac })}` : ''} → ${verdict}${hit && dmg ? t('applyroll.dmgSuffix', { dmg }) : ''}.`);
  }
  showToast(t('applyroll.toast.attackResult', { count, touched }), { timeout: 3200 });
}

/**
 * Résout un jet d'attaque DÉJÀ lancé (le même d20 que le flux des dés) contre
 * des cibles. À utiliser CÔTÉ MJ uniquement : le dé + le résultat sont inscrits
 * publiquement dans le journal, mais le verdict (touché/raté) et la CA restent
 * MJ-only — c'est le MJ qui décide si ça touche. Renvoie un récap pour la carte.
 * @param {{kept:number,total:number,mode?}} d20  résultat de sendD20Check
 * @param {Array<object>} [listOverride]  jetons cibles (sinon store.targets)
 */
export function resolveAttackVsTargets(d20, who, nm, listOverride) {
  const tokens = store.get().map?.tokens || [];
  const raw = listOverride || (store.get().targets || []).map((tid) => tokens.find((x) => x.id === tid)).filter(Boolean);
  // Dédoublonnage défensif (un même jeton ne doit pas être résolu deux fois).
  const seen = new Set();
  const list = raw.filter((x) => x && !seen.has(x.id) && seen.add(x.id));
  if (!list.length) return { any: false };
  const nat = Number(d20?.kept) || 0;
  const total = Number(d20?.total) || nat;
  const sys = getSystem(activeCampaign()?.system);
  const fmtSigned = (n) => (n >= 0 ? `+${n}` : `${n}`);
  let anyCrit = false;
  let anyHit = false;
  let anyUnknownAc = false;
  let first = null; // 1re cible à CA connue → degré/marge/CA pour le bandeau du MJ
  for (const tok of list) {
    const ac = acOf(tok);
    // Si la CA est inconnue, l'app ne tranche PAS : c'est le MJ qui juge.
    if (ac == null) {
      anyUnknownAc = true;
      logAction(t('applyroll.log.unknownAc', { who, name: tokenName(tok), total }), true);
      continue;
    }
    // Degré de succès piloté par le système : 4 paliers PF2e (marge ±10, décalage
    // nat 1/20), touche/rate + crit nat 20 en 5e.
    const { degree, margin } = (sys?.degreeOfSuccess || d20Degree)(total, ac, nat);
    if (degree === 'success' || degree === 'critSuccess') anyHit = true;
    if (degree === 'critSuccess') anyCrit = true;
    if (!first) first = { degree, margin, ac };
    // Le dé est déjà affiché par la carte de jet ; ici on journalise le verdict
    // (MJ-only : c'est le MJ qui décide) avec la marge, façon Foundry.
    logAction(t('applyroll.log.resolveDeg', { who, name: tokenName(tok), total, ac, verdict: t('deg.' + degree), margin: fmtSigned(margin) }), true);
  }
  return { any: true, anyHit, anyCrit, anyUnknownAc, ...(first || {}) };
}

/**
 * Ouvre la modale MJ d'application de dégâts (avec réduction résistance/immunité)
 * pour un total de dégâts déjà lancé, sur les cibles courantes (ou `tokens`).
 * MJ uniquement.
 */
/** Ouvre la fenêtre MJ de réduction (plein/résistance/immunité) sur des cibles. */
function openReduction(amount, descriptors, ctx = {}) {
  openDamageApply({
    amount,
    targets: descriptors,
    who: ctx.who,
    nm: ctx.nm,
    crit: ctx.crit,
    apply: (tok, amt) => {
      if (amt > 0) applyDmgToTarget({ target: tok, amount: amt });
      else logCombat(t('applyroll.log.immune', { name: tok.name || t('applyroll.target') }), true);
    },
  });
}

export function applyDamageRollToTargets({ amount, who, nm, crit, tokens: override }) {
  if (!store.get().isDM) return;
  const all = store.get().map?.tokens || [];
  const toks = override || (store.get().targets || []).map((tid) => all.find((t) => t.id === tid)).filter(Boolean);
  if (toks.length) {
    openReduction(amount, toks.map((t) => ({ entityId: t.entityId || null, charId: t.charId || null, tokenId: t.id, name: tokenName(t) })), { who, nm, crit });
  } else {
    // Pas de cible : le MJ choisit les combattants à la volée, puis la réduction.
    openApplyPicker({ amount, heal: false, onApply: (combs) => openReduction(amount, combs.map((c) => ({ entityId: c.entity_id, charId: c.char_id || null, name: c.name })), { who, nm, crit }) });
  }
}

/** Clic sur un bouton d'application d'une carte de jet (MJ). */
export function applyFromButton(kind, amount) {
  // Les dégâts passent par la fenêtre de réduction (résistance/immunité) ;
  // le soin s'applique directement (avec sélecteur si aucune cible).
  if (kind === 'damage') return applyDamageRollToTargets({ amount });
  return applyToTargets(amount, kind);
}

/** Applique une condition aux cibles courantes (combattants liés). */
export function applyConditionToTargets(cond) {
  const targets = store.get().targets || [];
  if (!targets.length) {
    showToast(t('applyroll.toast.targetFirst'), { timeout: 2800 });
    return;
  }
  const tokens = store.get().map?.tokens || [];
  const isDM = store.get().isDM;
  if (isDM) {
    let n = 0;
    for (const tid of targets) {
      const tok = tokens.find((x) => x.id === tid);
      const comb = tok && combatantForToken(tok);
      if (comb) {
        const set = new Set(comb.conditions || []);
        set.add(cond);
        updateCombatant(comb.entity_id, { conditions: [...set] });
        n++;
      }
    }
    showToast(n ? t('applyroll.toast.cond', { cond, n }) : t('applyroll.toast.noCombatTarget'), { timeout: 2400 });
  } else {
    const list = targets.map((tid) => tokens.find((x) => x.id === tid)).filter(Boolean).map((tok) => ({ entityId: tok.entityId || null, charId: tok.charId || null }));
    sendPlayerRequest({ kind: 'tcond', targets: list, cond });
    showToast(t('applyroll.toast.reqSent'), { timeout: 1800 });
  }
}
