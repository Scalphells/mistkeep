import { supabase } from '../lib/supabase.js';
import { store } from '../state.js';
import { insertWithOutbox } from '../lib/outbox.js';

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
  if (!outcome) throw new Error('Notation de dés invalide.');

  const { user, profile } = store.get();
  const row = {
    roll_name: label || outcome.notation,
    dice: outcome.notation,
    result: outcome.total,
    details: { rolls: outcome.rolls, modifier: outcome.modifier, vis: vis || undefined, owner: vis === 'self' ? user?.id : undefined },
    roll_type: rollType,
    roller_id: user?.id ?? null,
    roller_name: profile?.display_name || 'Anonyme',
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
 * Test de d20 (carac/sauvegarde/compétence/attaque) avec avantage/désavantage.
 * @param {number} modifier  bonus à ajouter
 * @param {string} label     libellé du jet
 * @param {{mode?: 'normal'|'adv'|'dis', rollType?: string}} opts
 */
export async function sendD20Check(modifier = 0, label = '', opts = {}) {
  const mode = opts.mode || 'normal';
  const rollType = opts.rollType || 'public';
  const vis = opts.vis || null;
  const m = Number(modifier) || 0;
  let rolls;
  let kept;
  if (mode === 'adv' || mode === 'dis') {
    const a = randomInt(1, 20);
    const b = randomInt(1, 20);
    kept = mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
    rolls = [a, b];
  } else {
    kept = randomInt(1, 20);
    rolls = [kept];
  }
  const tag = mode === 'adv' ? ' (avantage)' : mode === 'dis' ? ' (désavantage)' : '';
  const { user, profile } = store.get();
  const row = {
    roll_name: (label || 'd20') + tag,
    dice: `1d20${m > 0 ? `+${m}` : m < 0 ? `${m}` : ''}`,
    result: kept + m,
    details: { rolls, kept, modifier: m, mode, vis: vis || undefined, owner: vis === 'self' ? user?.id : undefined },
    roll_type: rollType,
    roller_id: user?.id ?? null,
    roller_name: profile?.display_name || 'Anonyme',
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
  const { data, error } = await supabase
    .from('dice_rolls')
    .select('*')
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
  const channel = supabase
    .channel('dice_rolls_feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'dice_rolls' },
      (payload) => {
        const hist = [...store.get().diceHist, payload.new].slice(-MAX_HISTORY);
        store.set({ diceHist: hist });
      }
    )
    .subscribe();
  _rollChannel = channel;

  return () => {}; // canal conservé pour la session (dock + onglet partagés)
}
