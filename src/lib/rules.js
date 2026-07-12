/**
 * Règles de jeu pures (sans dépendance Supabase/DOM) — testables en isolation.
 * Réexportées par features/characters.js pour conserver l'API existante.
 */

/** Modificateur de caractéristique : floor((score - 10) / 2). */
export function abilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

/** Degré de succès d20 (5e / attaque) : touche/rate vs seuil (CA/DC), crit sur 20
 *  naturel, échec critique sur 1 naturel. Renvoie { degree, margin }. */
export function d20Degree(total, dc, nat) {
  const margin = Number(total) - Number(dc);
  if (nat === 20) return { degree: 'critSuccess', margin };
  if (nat === 1) return { degree: 'critFailure', margin };
  return { degree: margin >= 0 ? 'success' : 'failure', margin };
}

/** Degré de succès Pathfinder 2e : quatre paliers selon la marge (seuils ±10),
 *  avec un décalage d'un cran sur 20 (vers le haut) ou 1 (vers le bas) naturel. */
export function pf2eDegree(total, dc, nat) {
  const margin = Number(total) - Number(dc);
  let step = margin >= 10 ? 3 : margin >= 0 ? 2 : margin <= -10 ? 0 : 1;
  if (nat === 20) step = Math.min(3, step + 1);
  else if (nat === 1) step = Math.max(0, step - 1);
  return { degree: ['critFailure', 'failure', 'success', 'critSuccess'][step], margin };
}

/**
 * Décompose un test 5e (caractéristique + maîtrise/expertise) en pastilles
 * `{ label, value }` pour l'affichage façon « Constitution +2 · Maîtrise +3 ».
 * @param mod          fonction modificateur de caractéristique
 * @param abilityOf    (key) -> clé de caractéristique du test
 * @param abilityLabel (abKey) -> libellé affichable
 * @param labels       { prof, exp } libellés de maîtrise / expertise
 */
export function d5eCheckParts(data, kind, key, mod, abilityOf, abilityLabel, labels) {
  const ab = kind === 'ability' ? key : abilityOf(key);
  const parts = [{ label: abilityLabel(ab), value: mod(data[ab]) }];
  if (kind === 'ability') return parts;
  const p = Number(data.prof || 0);
  if (kind === 'skill' && (data.exp || []).includes(key)) parts.push({ label: labels.exp, value: p * 2 });
  else if ((kind === 'skill' ? data.profs : data.saves || [])?.includes?.(key) && p) parts.push({ label: labels.prof, value: p });
  return parts;
}

const _ABBR = { for: 'str', str: 'str', dex: 'dex', con: 'con', int: 'int', sag: 'wis', wis: 'wis', cha: 'cha' };

/**
 * Résout une notation de dés en remplaçant les jetons par les valeurs de la fiche :
 *   MOD / SORT / INC / CARAC → modificateur de la caractéristique d'incantation (data.sc)
 *   PROF / MAITRISE          → bonus de maîtrise
 *   FOR/DEX/CON/INT/SAG/CHA  → modificateur de la caractéristique correspondante
 * Puis normalise en « NdM±K » (constantes additionnées). Ex. « 1d8+MOD » → « 1d8+3 ».
 */
export function resolveNotation(notation, data) {
  let s = String(notation || '').trim();
  if (!s) return s;
  const d = data || {};
  const safeMod = (key) => {
    const v = abilityMod(d[key]);
    return Number.isFinite(v) ? v : 0;
  };
  const castMod = d.sc ? safeMod(d.sc) : 0;
  s = s.replace(/\b(mod|sort|inc|incantation|carac)\b/gi, String(castMod));
  s = s.replace(/\b(prof|maitrise|maîtrise)\b/gi, String(Number(d.prof) || 0));
  s = s.replace(/\b(for|str|dex|con|int|sag|wis|cha)\b/gi, (m) => String(safeMod(_ABBR[m.toLowerCase()])));
  s = s.replace(/\s+/g, '');
  const dice = s.match(/\d*d\d+/i);
  if (!dice) {
    let total = 0;
    (s.match(/[+-]?\d+/g) || []).forEach((n) => (total += Number(n)));
    return String(total);
  }
  const diceStr = dice[0];
  const rest = s.replace(diceStr, '');
  let total = 0;
  (rest.match(/[+-]?\d+/g) || []).forEach((n) => (total += Number(n)));
  return diceStr + (total > 0 ? `+${total}` : total < 0 ? `${total}` : '');
}

/**
 * Résout un jet de sauvegarde contre la mort (D&D 5e 2014).
 * @param {{s:number,f:number}} ds  état courant (réussites/échecs).
 * @param {number} roll  résultat d'un d20 (1-20).
 * @returns {{ds:{s:number,f:number}|null, revived:boolean, stable:boolean, dead:boolean}}
 *   - 20 → réanimé à 1 PV (revived, ds=null).
 *   - 1  → 2 échecs ; 10+ → 1 réussite ; <10 → 1 échec.
 *   - 3 réussites → stabilisé ; 3 échecs → mort.
 */
export function resolveDeathSave(ds, roll) {
  const cur = { s: Math.max(0, Number(ds?.s) || 0), f: Math.max(0, Number(ds?.f) || 0) };
  const r = Number(roll);
  if (r === 20) return { ds: null, revived: true, stable: false, dead: false };
  if (r === 1) cur.f = Math.min(3, cur.f + 2);
  else if (r >= 10) cur.s = Math.min(3, cur.s + 1);
  else cur.f = Math.min(3, cur.f + 1);
  return { ds: cur, revived: false, stable: cur.s >= 3, dead: cur.f >= 3 };
}

/**
 * Nom de base d'un combattant, sans suffixe numérique de groupe.
 * « Gobelin 3 » → « Gobelin » ; « Loup » → « Loup ». Sert à regrouper les
 * monstres identiques pour une initiative partagée.
 */
export function baseName(name) {
  const s = String(name || '').trim();
  return s.replace(/\s+\d+$/, '').trim() || s;
}

/** Dés de vie regagnés lors d'un repos long : moitié du max, au moins 1. */
export function longRestHitDiceRegain(hdMax) {
  return Math.max(1, Math.floor((Number(hdMax) || 1) / 2));
}

/**
 * Applique des dégâts (amt>0) ou un soin (amt<0) en gérant les PV temporaires
 * et le plafond de PV max. Règle pure réutilisable (fiche, jeton, combattant).
 * @returns {{hp:number, temp:number}}
 */
export function hpAfter(before, max, temp, amt) {
  const b = Number(before) || 0;
  const t = Math.max(0, Number(temp) || 0);
  const a = Number(amt) || 0;
  if (a > 0) {
    const fromTemp = Math.min(t, a);
    return { hp: Math.max(0, b - (a - fromTemp)), temp: t - fromTemp };
  }
  const healed = b + -a;
  return { hp: max != null ? Math.min(Number(max), healed) : healed, temp: t };
}

/**
 * Ressources de classe suggérées d'après la classe + le niveau (valeurs de règles).
 * Renvoie [{ name, max, used, reset }]. Sert au bouton « ⚙ Depuis la classe ».
 */
export function classResources(data) {
  const lvl = Number(data?.lvl) || 1;
  const cls = String(data?.cls || '').normalize('NFC').trim().toLowerCase();
  const cha = abilityMod(data?.cha);
  const out = [];
  const add = (name, max, reset) => {
    if (max > 0) out.push({ name, max, used: 0, reset });
  };
  if (/moine/.test(cls)) add('Ki', lvl >= 2 ? lvl : 0, 'short');
  else if (/barbare/.test(cls)) add('Rage', lvl >= 20 ? 99 : lvl >= 17 ? 6 : lvl >= 12 ? 5 : lvl >= 6 ? 4 : lvl >= 3 ? 3 : 2, 'long');
  else if (/barde/.test(cls)) add('Inspiration bardique', Math.max(1, cha), lvl >= 5 ? 'short' : 'long');
  else if (/(ensorceleur|sorcier)/.test(cls)) add('Points de sorcellerie', lvl >= 2 ? lvl : 0, 'long');
  else if (/paladin/.test(cls)) add('Imposition des mains', lvl * 5, 'long');
  else if (/guerrier/.test(cls)) add('Second souffle', 1, 'short');
  else if (/druide/.test(cls)) add('Forme sauvage', 2, 'short');
  else if (/clerc|prêtre|pretre/.test(cls)) add('Conduit divin', 1, 'short');
  return out;
}
