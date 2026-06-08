import { store } from '../state.js';
import { adjustHp, logCombat, logAction, sendPlayerRequest, updateCombatant, applyDmgToTarget } from '../features/initiative.js';
import { updateCharacter } from '../features/characters.js';
import { updateToken } from '../features/map.js';
import { parseDice } from '../features/dice.js';
import { showToast } from './toast.js';
import { openDamageApply } from './dmgapply.js';
import { openApplyPicker } from './applypicker.js';

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

function tokenName(t) {
  if (!t) return 'cible';
  const ch = t.charId ? store.get().characters.find((c) => c.id === t.charId) : null;
  return t.label || ch?.name || 'cible';
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
function applyDeltaDM(t, delta) {
  const comb = combatantForToken(t);
  if (comb) {
    adjustHp(comb.entity_id, delta); // gère PV temp / soin / journal
    return;
  }
  const ch = t.charId ? store.get().characters.find((c) => c.id === t.charId) : null;
  if (ch && ch.data?.hp != null) {
    const before = Number(ch.data.hp) || 0;
    let hp = before + delta;
    if (ch.data.hpMax != null) hp = Math.min(Number(ch.data.hpMax), hp);
    hp = Math.max(0, hp);
    updateCharacter(ch.id, { hp });
    logCombat(`${delta < 0 ? '💥' : '💚'} ${tokenName(t)} : PV ${before}→${hp}.`);
    return;
  }
  if (t.hp != null || t.hpMax != null) {
    const before = Number(t.hp) || 0;
    let hp = before + delta;
    if (t.hpMax != null) hp = Math.min(Number(t.hpMax), hp);
    hp = Math.max(0, hp);
    updateToken(t.id, { hp });
    logCombat(`${delta < 0 ? '💥' : '💚'} ${tokenName(t)} : PV ${before}→${hp}.`);
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
      showToast('Cible d’abord un ou des jetons (clic droit → 🎯) sur la carte.', { timeout: 2800 });
    }
    return;
  }
  const delta = heal ? amt : -amt;
  const tokens = store.get().map?.tokens || [];
  let n = 0;
  for (const tid of targets) {
    const t = tokens.find((x) => x.id === tid);
    if (!t) continue;
    if (isDM) {
      applyDeltaDM(t, delta);
    } else {
      // Joueur : délégué au MJ (montant signé : négatif = soin).
      sendPlayerRequest({ kind: 'dmg', target: { entityId: t.entityId || null, charId: t.charId || null, tokenId: t.id, name: tokenName(t) }, amount: heal ? -amt : amt });
    }
    n++;
  }
  showToast(`${heal ? '💚 Soin' : '💥 Dégâts'} ${amt} → ${n} cible(s)`, { timeout: 2200 });
}

/** Résout une attaque sur chaque cible courante (d20+bon vs CA → dégâts). */
export function attackTargets(bon, dmgNotation, mode = 'normal') {
  const targets = store.get().targets || [];
  if (!targets.length) {
    showToast('Cible d’abord un ou des jetons (clic droit → 🎯).', { timeout: 2800 });
    return;
  }
  const tokens = store.get().map?.tokens || [];
  const isDM = store.get().isDM;
  let touched = 0;
  let count = 0;
  for (const tid of targets) {
    const t = tokens.find((x) => x.id === tid);
    if (!t) continue;
    count++;
    let nat;
    if (mode === 'adv' || mode === 'dis') {
      const a = rng(1, 20);
      const b = rng(1, 20);
      nat = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    } else nat = rng(1, 20);
    const ac = acOf(t);
    const total = nat + (Number(bon) || 0);
    const crit = nat === 20;
    const fumble = nat === 1;
    const hit = crit || (!fumble && (ac == null || total >= ac));
    let dmg = 0;
    if (hit && dmgNotation) {
      dmg = rollDmg(dmgNotation, crit);
      if (dmg > 0) {
        if (isDM) applyDeltaDM(t, -dmg);
        else sendPlayerRequest({ kind: 'dmg', target: { entityId: t.entityId || null, charId: t.charId || null, tokenId: t.id, name: tokenName(t) }, amount: dmg });
      }
    }
    if (hit) touched++;
    logCombat(`⚔ → ${tokenName(t)} : ${total}${ac != null ? ` vs CA ${ac}` : ''} → ${crit ? 'CRITIQUE' : fumble ? 'échec critique' : hit ? 'touché' : 'raté'}${hit && dmg ? `, ${dmg} dégâts` : ''}.`);
  }
  showToast(`⚔ ${count} cible(s) — ${touched} touchée(s)`, { timeout: 3200 });
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
  const list = raw.filter((t) => t && !seen.has(t.id) && seen.add(t.id));
  if (!list.length) return { any: false };
  const nat = Number(d20?.kept) || 0;
  const total = Number(d20?.total) || nat;
  const crit = nat === 20;
  const fumble = nat === 1;
  let anyCrit = crit;
  let anyHit = false;
  let anyUnknownAc = false;
  for (const t of list) {
    const ac = acOf(t);
    const known = ac != null;
    // Verdict : décisif sur 20/1, sinon comparé à la CA. Si la CA est inconnue,
    // l'app ne tranche PAS (on ne prétend pas « touché ») : le MJ juge.
    let hit;
    let verdict;
    if (crit) {
      hit = true;
      verdict = 'CRITIQUE ⭐';
    } else if (fumble) {
      hit = false;
      verdict = 'échec critique';
    } else if (!known) {
      hit = null;
      verdict = null;
    } else {
      hit = total >= ac;
      verdict = hit ? 'touché ✓' : 'raté ✗';
    }
    if (hit === true) anyHit = true;
    if (!known) anyUnknownAc = true;
    // Le dé + le résultat sont déjà affichés par la carte de jet dans le chat ;
    // ici on ne journalise que le verdict (MJ-only : c'est le MJ qui décide).
    if (verdict) {
      logAction(`⚔ ${who} → ${tokenName(t)} : ${total} vs CA ${known ? ac : '?'} → ${verdict}`, true);
    } else {
      logAction(`⚔ ${who} → ${tokenName(t)} : ${total} — CA inconnue, à toi de juger (définis la CA du jeton).`, true);
    }
  }
  return { any: true, anyHit, anyCrit, anyUnknownAc };
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
    apply: (t, amt) => {
      if (amt > 0) applyDmgToTarget({ target: t, amount: amt });
      else logCombat(`🛡 ${t.name || 'cible'} : aucun dégât (immunité).`, true);
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
    showToast('Cible d’abord un ou des jetons (clic droit → 🎯).', { timeout: 2800 });
    return;
  }
  const tokens = store.get().map?.tokens || [];
  const isDM = store.get().isDM;
  if (isDM) {
    let n = 0;
    for (const tid of targets) {
      const t = tokens.find((x) => x.id === tid);
      const comb = t && combatantForToken(t);
      if (comb) {
        const set = new Set(comb.conditions || []);
        set.add(cond);
        updateCombatant(comb.entity_id, { conditions: [...set] });
        n++;
      }
    }
    showToast(n ? `🩹 ${cond} → ${n} cible(s)` : 'Aucune cible en combat.', { timeout: 2400 });
  } else {
    const list = targets.map((tid) => tokens.find((x) => x.id === tid)).filter(Boolean).map((t) => ({ entityId: t.entityId || null, charId: t.charId || null }));
    sendPlayerRequest({ kind: 'tcond', targets: list, cond });
    showToast('🩹 Demande envoyée au MJ.', { timeout: 1800 });
  }
}
