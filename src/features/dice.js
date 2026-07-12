import { backend } from '../lib/backend.js';
import { campaignId, activeCampaign, sameCampaign } from '../lib/campaigns.js';
import { getSystem } from '../lib/systems/index.js';
import { store } from '../state.js';
import { insertWithOutbox } from '../lib/outbox.js';
import { t as tr } from '../lib/i18n.js';

/**
 * Dés partagés temps réel.
 *
 * Source de vérité : table `dice_rolls`.
 * Diffusion : Supabase Realtime (INSERT) → tous les clients connectés voient
 * les jets apparaître instantanément. Pas de cache local : un jet de dé est
 * éphémère et n'a de sens qu'en ligne.
 */

const MAX_HISTORY = 40;
const MAX_DICE = 100; // garde-fou anti-abus (pas de 9999d20)
const MAX_SIDES = 1000;

/**
 * Parse une notation de dés type "2d6+3", "1d20-1", "d100", "4d8".
 * Renvoie { count, sides, modifier } ou null si invalide.
 */
export function parseDice(notation) {
  const m = String(notation)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!m) return null;

  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2], 10);
  const modifier = m[3] ? parseInt(m[3], 10) : 0;

  if (count < 1 || count > MAX_DICE) return null;
  if (sides < 2 || sides > MAX_SIDES) return null;

  return { count, sides, modifier };
}

/** Effectue un jet localement et renvoie le détail. */
export function rollDice(notation) {
  const parsed = parseDice(notation);
  if (!parsed) return null;

  const { count, sides, modifier } = parsed;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(randomInt(1, sides));
  }
  const sum = rolls.reduce((a, b) => a + b, 0);
  const total = sum + modifier;

  return {
    notation: normalizeNotation(count, sides, modifier),
    rolls,
    modifier,
    total,
  };
}

function normalizeNotation(count, sides, modifier) {
  let s = `${count}d${sides}`;
  if (modifier > 0) s += `+${modifier}`;
  else if (modifier < 0) s += `${modifier}`;
  return s;
}

/** Entier aléatoire cryptographiquement sûr dans [min, max]. */
function randomInt(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  // Rejection sampling pour éviter le biais modulo.
  const limit = Math.floor(0xffffffff / range) * range;
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return min + (x % range);
}

/**
 * Lance un dé et le publie dans `dice_rolls`.
 * @param {string} notation  ex: "1d20+5"
 * @param {string} rollType  'public' | 'dm' (jet caché visible MJ uniquement)
 * @param {string} [label]   nom optionnel du jet (ex: "Attaque épée")
 */
export async function sendRoll(notation, rollType = 'public', label = '', vis = null) {
  const outcome = rollDice(notation);
  if (!outcome) throw new Error(tr('dice.err.notation'));

  const { user, profile } = store.get();
  const row = {
    roll_name: label || outcome.notation,
    dice: outcome.notation,
    result: outcome.total,
    details: { rolls: outcome.rolls, modifier: outcome.modifier, vis: vis || undefined, owner: vis === 'self' ? user?.id : undefined },
    roll_type: rollType,
    roller_id: user?.id ?? null,
    roller_name: profile?.display_name || 'Anonyme',
    campaign_id: campaignId(),
  };

  const res = await insertWithOutbox('dice_rolls', row);
  if (!res.ok) throw new Error(res.error?.message || 'Échec du jet.');
  // Hors-ligne : affichage optimiste (resynchronisé au retour réseau).
  if (res.queued) {
    const hist = [...store.get().diceHist, { ...res.row, created_at: new Date().toISOString() }].slice(-MAX_HISTORY);
    store.set({ diceHist: hist });
  }
  return outcome; // { notation, rolls, modifier, total }
}

/**
 * Test de carac/sauvegarde/compétence/attaque avec avantage/désavantage.
 * Le dé lancé est celui du système de la campagne (`testDie` du descripteur —
 * configurable sur le système « Libre » : 1d100, 2d6…) ; d20 partout ailleurs.
 * Avantage/désavantage généralisés : la formule est lancée deux fois, on garde
 * le meilleur/pire TOTAL (équivalent au d20 classique pour 1d20).
 * @param {number} modifier  bonus à ajouter
 * @param {string} label     libellé du jet
 * @param {{mode?: 'normal'|'adv'|'dis', rollType?: string}} opts
 */
export async function sendD20Check(modifier = 0, label = '', opts = {}) {
  const mode = opts.mode || 'normal';
  const rollType = opts.rollType || 'public';
  const vis = opts.vis || null;
  const m = Number(modifier) || 0;
  const td = parseDice(getSystem(activeCampaign()?.system)?.testDie || '1d20') || { count: 1, sides: 20 };
  const formula = normalizeNotation(td.count, td.sides, 0);
  const rollSum = () => {
    let s = 0;
    for (let i = 0; i < td.count; i++) s += randomInt(1, td.sides);
    return s;
  };
  let rolls;
  let kept;
  if (mode === 'adv' || mode === 'dis') {
    const a = rollSum();
    const b = rollSum();
    kept = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    rolls = [a, b];
  } else {
    kept = rollSum();
    rolls = [kept];
  }
  const tag = mode === 'adv' ? ' (avantage)' : mode === 'dis' ? ' (désavantage)' : '';
  const { user, profile } = store.get();
  const row = {
    roll_name: (label || (formula === '1d20' ? 'd20' : formula)) + tag,
    dice: `${formula}${m > 0 ? `+${m}` : m < 0 ? `${m}` : ''}`,
    result: kept + m,
    details: { rolls, kept, modifier: m, mode, vis: vis || undefined, owner: vis === 'self' ? user?.id : undefined, parts: opts.parts?.length ? opts.parts : undefined },
    roll_type: rollType,
    roller_id: user?.id ?? null,
    roller_name: profile?.display_name || 'Anonyme',
    campaign_id: campaignId(),
  };
  const res = await insertWithOutbox('dice_rolls', row);
  if (!res.ok) throw new Error(res.error?.message || 'Échec du jet.');
  if (res.queued) {
    const hist = [...store.get().diceHist, { ...res.row, created_at: new Date().toISOString() }].slice(-MAX_HISTORY);
    store.set({ diceHist: hist });
  }
  return { rolls, kept, modifier: m, total: kept + m, mode };
}

/** Charge les derniers jets visibles (RLS filtre les jets MJ). */
export async function loadRecentRolls() {
  const { data, error } = await backend.db
    .from('dice_rolls')
    .select('*')
    .eq('campaign_id', campaignId())
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY);

  if (error) {
    console.warn('[dice] chargement impossible:', error.message);
    return;
  }
  store.set({ diceHist: data.reverse() });
}

/**
 * S'abonne aux nouveaux jets en temps réel.
 * Renvoie une fonction de désinscription.
 */
let _rollChannel = null;
export function subscribeRolls() {
  if (_rollChannel) return () => {}; // abonnement unique pour la session
  const channel = backend.realtime
    .channel('dice_rolls_feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dice_rolls' },
      (payload) => {
        if (!sameCampaign(payload)) return;
        const hist = [...store.get().diceHist, payload.new].slice(-MAX_HISTORY);
        store.set({ diceHist: hist });
      }
    )
    .subscribe();
  _rollChannel = channel;

  return () => {}; // canal conservé pour la session (dock + onglet partagés)
}
