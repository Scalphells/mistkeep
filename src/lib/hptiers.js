/**
 * Paliers d'état de santé (façon Foundry « hidden HP ») pour masquer les PV
 * exacts des monstres aux joueurs : on n'affiche qu'une estimation qualitative.
 */
export function hpTierLabel(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  if (p <= 0) return 'Hors de combat';
  if (p <= 12) return 'À l’agonie';
  if (p <= 30) return 'Mal en point';
  if (p <= 55) return 'Blessé';
  if (p <= 85) return 'Légèrement blessé';
  return 'Indemne';
}
