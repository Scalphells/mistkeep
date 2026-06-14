import { t } from './i18n.js';

/**
 * Paliers d'état de santé (façon Foundry « hidden HP ») pour masquer les PV
 * exacts des monstres aux joueurs : on n'affiche qu'une estimation qualitative.
 */
export function hpTierLabel(pct) {
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  if (p <= 0) return t('hp.tier.down');
  if (p <= 12) return t('hp.tier.dying');
  if (p <= 30) return t('hp.tier.bad');
  if (p <= 55) return t('hp.tier.hurt');
  if (p <= 85) return t('hp.tier.light');
  return t('hp.tier.full');
}
