/**
 * Analyse du butin d'un monstre (logique pure, testable).
 *
 * Cherche dans la description une ligne « Butin : … » / « Trésor : … » / « Loot: … »
 * et la décompose en pièces et objets. Aucune donnée propriétaire embarquée :
 * on lit la prose saisie/importée par le MJ.
 *
 * Exemples reconnus (séparateurs , ou ;) :
 *   « Butin : 15 po, 2d6 pa, Épée courte, 2 Torches »
 *   → coins {gp:15}, items [{nm:'Épée courte',qty:1},{nm:'Torches',qty:2}]
 *   (les montants en dés « 2d6 pa » sont ignorés pour les pièces — non déterministes).
 */

const COIN_KEYS = {
  po: 'gp', or: 'gp', gp: 'gp', gold: 'gp',
  pa: 'sp', argent: 'sp', sp: 'sp', silver: 'sp',
  pc: 'cp', cuivre: 'cp', cp: 'cp', copper: 'cp',
  pe: 'ep', ep: 'ep', electrum: 'ep',
  pp: 'pp', platine: 'pp', platinum: 'pp',
};

export function parseLoot(desc) {
  const out = { coins: {}, items: [] };
  const m = String(desc || '').match(/(?:butin|tr[ée]sor|loot)\s*[:：]\s*([^\n\r]+)/i);
  if (!m) return out;

  for (const raw of m[1].split(/[,;]/)) {
    const p = raw.trim().replace(/\.$/, '');
    if (!p) continue;
    // Pièces : « 15 po », « 30 gp »… (un nombre entier suivi d'une unité connue).
    const cm = p.match(/^(\d+)\s*(po|or|gp|gold|pa|argent|sp|silver|pc|cuivre|cp|copper|pe|ep|electrum|pp|platine|platinum)\b/i);
    if (cm) {
      const k = COIN_KEYS[cm[2].toLowerCase()];
      if (k) out.coins[k] = (out.coins[k] || 0) + Number(cm[1]);
      continue;
    }
    // Objet éventuellement préfixé d'une quantité : « 2 Torches ».
    const im = p.match(/^(\d+)\s+(.+)$/);
    if (im) out.items.push({ nm: im[2].trim(), qty: Math.max(1, Number(im[1]) || 1) });
    else out.items.push({ nm: p, qty: 1 });
  }
  return out;
}

/** Le butin contient-il quelque chose ? */
export function hasLoot(loot) {
  return !!loot && (Object.keys(loot.coins || {}).length > 0 || (loot.items || []).length > 0);
}
