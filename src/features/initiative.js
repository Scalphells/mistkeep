import { supabase } from '../lib/supabase.js';
import { store } from '../state.js';
import { loadCharacters, abilityMod, updateCharacter, saveBonus, ABILITIES } from './characters.js';
import { addPin, updatePin, updateToken, toggleDoor } from './map.js';
import { showToast } from '../lib/toast.js';
import { resolveAttackVsTargets, applyDamageRollToTargets } from '../lib/applyroll.js';
import { resolveDeathSave, baseName } from '../lib/rules.js';
import { parseLoot, hasLoot } from '../lib/loot.js';
import { getPartyLoot, setPartyLoot, updateLootItem } from '../lib/partyloot.js';

/**
 * Tracker d'initiative (combat).
 *
 * Source de vérité :
 *   - `initiative` : une ligne par combattant.
 *   - `session_state` (clé `init_meta`) : tour courant + numéro de round.
 *
 * Écriture MJ uniquement (RLS). Les joueurs voient le combat en temps réel.
 * Écritures granulaires : on ne réécrit jamais toute la liste d'un coup.
 */

const META_KEY = 'init_meta';
const LOG_KEY = 'combat_log';
const MAX_LOG = 200;

/** Charge le journal de combat partagé. */
export async function loadCombatLog() {
  const { data } = await supabase.from('session_state').select('value').eq('key', LOG_KEY).maybeSingle();
  store.set({ combatLog: Array.isArray(data?.value) ? data.value : [] });
}

/** Ajoute une entrée au journal de combat (MJ, persisté + diffusé). */
export function logCombat(text, dm = false) {
  if (!store.get().isDM) return;
  const log = [...store.get().combatLog, { t: Date.now(), text, dm }].slice(-MAX_LOG);
  store.set({ combatLog: log });
  supabase
    .from('session_state')
    .upsert({ key: LOG_KEY, value: log, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null }, { onConflict: 'key' })
    .then(({ error }) => {
      if (error) console.warn('[combat log]', error.message);
    });
}

/**
 * Journalise une action de combat quel que soit le rôle.
 * - MJ : écrit directement (gère le drapeau `dm` pour les lignes chiffrées).
 * - Joueur : diffuse la ligne publique au MJ qui l'inscrit (les lignes `dm`
 *   sont ignorées côté joueur car réservées au MJ).
 */
export function logAction(text, dm = false) {
  if (store.get().isDM) {
    logCombat(text, dm);
  } else if (!dm) {
    sendTurnAction(text);
  }
}

/** Vide le journal de combat (MJ). */
export async function clearCombatLog() {
  if (!store.get().isDM) return;
  store.set({ combatLog: [] });
  await supabase
    .from('session_state')
    .upsert({ key: LOG_KEY, value: [], updated_at: new Date().toISOString() }, { onConflict: 'key' });
}

/** Normalise `conditions` en tableau (jsonb peut revenir en chaîne via Realtime). */
function normRow(c) {
  let conds = c.conditions;
  if (typeof conds === 'string') {
    try {
      conds = JSON.parse(conds);
    } catch {
      conds = [];
    }
  }
  let ds = c.death_saves;
  if (typeof ds === 'string') {
    try {
      ds = JSON.parse(ds);
    } catch {
      ds = null;
    }
  }
  return {
    ...c,
    conditions: Array.isArray(conds) ? conds : [],
    hp_temp: c.hp_temp ?? 0,
    char_id: c.char_id ?? null,
    death_saves: ds && typeof ds === 'object' ? ds : null,
    status: c.status ?? null,
  };
}

/* ── Chargement ───────────────────────────────────────────── */

export async function loadInitiative() {
  const [list, meta] = await Promise.all([
    supabase
      .from('initiative')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase.from('session_state').select('value').eq('key', META_KEY).maybeSingle(),
  ]);

  if (list.error) {
    console.warn('[init] chargement impossible:', list.error.message);
  } else {
    store.set({ initiative: (list.data || []).map(normRow) });
  }
  const m = meta.data?.value || {};
  store.set({ initTurn: m.turn ?? 0, initRound: m.round ?? 1 });
}

/* ── Combattants ──────────────────────────────────────────── */

/** Ajoute un combattant (MJ). */
export async function addCombatant({ name, initiative, hp, hpMax, hpTemp, charId }) {
  if (!store.get().isDM) return;
  const list = store.get().initiative;
  const entity_id = `e_${crypto.randomUUID().slice(0, 8)}`;
  const sort_order = nextSortOrder(initiative, list);

  const row = {
    entity_id,
    name,
    initiative: Number(initiative) || 0,
    hp: hp === '' || hp === undefined ? null : Number(hp),
    hp_max: hpMax === '' || hpMax === undefined ? null : Number(hpMax),
    hp_temp: Number(hpTemp) || 0,
    sort_order,
    conditions: [],
    char_id: charId ?? null,
    updated_by: store.get().user?.id ?? null,
  };
  // Affichage optimiste immédiat (sans attendre l'écho realtime).
  store.set({ initiative: [...list, normRow(row)] });
  const { error } = await supabase.from('initiative').insert(row);
  if (error) console.error('[init] ajout échoué:', error.message);
  await resequence();
  return entity_id;
}

/** Importe les PJ depuis leurs fiches (MJ). */
export async function addPartyFromCharacters() {
  if (!store.get().isDM) return;
  // Les fiches ne sont pas forcément chargées dans la vue Combat.
  if (!store.get().characters.length) {
    await loadCharacters();
  }
  const chars = store.get().characters;
  const existing = new Set(store.get().initiative.map((c) => c.name));
  for (const c of chars) {
    if (existing.has(c.name)) continue;
    const d = c.data || {};
    await addCombatant({
      name: c.name,
      initiative: 0,
      hp: d.hp ?? null,
      hpMax: d.hpMax ?? null,
      hpTemp: d.hpTmp ?? 0,
      charId: c.id,
    });
  }
}

/** Met à jour un champ d'un combattant (MJ). */
export async function updateCombatant(entityId, patch) {
  if (!store.get().isDM) return;
  const initiative = store.get().initiative.map((c) =>
    c.entity_id === entityId ? { ...c, ...patch } : c
  );
  store.set({ initiative });

  const { error } = await supabase
    .from('initiative')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('entity_id', entityId);
  if (error) console.error('[init] maj échouée:', error.message);

  // Synchronise les PV vers la fiche liée.
  if ('hp' in patch || 'hp_max' in patch || 'hp_temp' in patch) {
    const comb = initiative.find((c) => c.entity_id === entityId);
    if (comb?.char_id) syncHpToCharacter(comb.char_id, patch);
  }
}

/** Répercute les PV d'un combattant sur sa fiche de personnage. */
function syncHpToCharacter(charId, patch) {
  const dp = {};
  if ('hp' in patch) dp.hp = patch.hp;
  if ('hp_max' in patch) dp.hpMax = patch.hp_max;
  if ('hp_temp' in patch) dp.hpTmp = patch.hp_temp;
  if (!Object.keys(dp).length) return;

  const characters = store.get().characters.map((c) =>
    c.id === charId ? { ...c, data: { ...c.data, ...dp } } : c
  );
  store.set({ characters });

  const cur = characters.find((c) => c.id === charId);
  if (cur) {
    supabase
      .from('characters')
      .update({ data: cur.data, updated_at: new Date().toISOString() })
      .eq('id', charId)
      .then(({ error }) => {
        if (error) console.warn('[sync] fiche:', error.message);
      });
  }
}

/** Ajuste les PV (delta) d'un combattant (MJ). Les dégâts entament d'abord les PV temporaires. */
export async function adjustHp(entityId, delta) {
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c || c.hp === null) return;

  let hp = c.hp;
  let hpTemp = c.hp_temp ?? 0;

  if (delta < 0) {
    // Les dégâts retirent d'abord les PV temporaires.
    let dmg = -delta;
    const fromTemp = Math.min(hpTemp, dmg);
    hpTemp -= fromTemp;
    dmg -= fromTemp;
    hp = Math.max(0, hp - dmg);
  } else {
    // Les soins ne touchent que les PV réels.
    hp = hp + delta;
  }
  const wasUp = c.hp > 0;
  // Montant public (l'action du PJ reste visible) ; le PV absolu n'est plus
  // journalisé pour ne pas révéler les PV chiffrés des monstres. Détail chiffré
  // en plus pour le MJ uniquement.
  if (delta < 0) {
    logCombat(`💥 ${c.name} subit ${-delta} dégâts.`, true);
    logCombat(`   ${c.name} : ${c.hp}→${hp} PV.`, true);
  } else if (delta > 0) {
    logCombat(`💚 ${c.name} récupère ${delta} PV.`, true);
    logCombat(`   ${c.name} : ${c.hp}→${hp} PV.`, true);
  }
  if (wasUp && hp === 0) logCombat(`☠️ ${c.name} tombe à 0 PV !`);
  // Rappel de Concentration : si le combattant maintient un effet de concentration
  // et subit des dégâts, jet de CON DD max(10, moitié des dégâts).
  if (delta < 0 && hp > 0 && (c.effects || []).some((e) => e.concentration)) {
    const dc = Math.max(10, Math.floor(-delta / 2));
    logCombat(`🧠 ${c.name} : jet de Concentration — DD ${dc} (Constitution).`);
  }

  // Jets de sauvegarde contre la mort (uniquement pour les PJ liés à une fiche).
  const patch = { hp, hp_temp: hpTemp };
  if (c.char_id) {
    const overkill = delta < 0 ? -delta - c.hp : 0; // dégâts au-delà de 0 PV
    if (wasUp && hp === 0) {
      // Dégâts massifs (excédent ≥ PV max) = mort instantanée (règle 2014).
      if (c.hp_max && overkill >= c.hp_max) {
        patch.death_saves = { s: 0, f: 3 };
        logCombat(`☠️ ${c.name} subit des dégâts massifs et meurt sur le coup.`);
      } else {
        patch.death_saves = { s: 0, f: 0 };
        logCombat(`🩸 ${c.name} tombe inconscient — jets de sauvegarde contre la mort.`);
      }
    } else if (c.hp === 0 && hp === 0 && delta < 0) {
      // Dégâts subis alors qu'on est déjà à 0 PV = un échec automatique (deux si critique géré ailleurs).
      const ds = { ...(c.death_saves || { s: 0, f: 0 }) };
      ds.f = Math.min(3, ds.f + 1);
      patch.death_saves = ds;
      logCombat(`💀 ${c.name} subit des dégâts à 0 PV : un échec (✘${ds.f}).`);
    } else if (hp > 0 && c.death_saves) {
      patch.death_saves = null; // soigné/relevé : fin des jets
    }
  }

  // À 0 PV, la concentration est automatiquement brisée (pas de jet).
  if (hp === 0 && wasUp && (c.effects || []).some((e) => e.concentration)) {
    patch.effects = (c.effects || []).filter((e) => !e.concentration);
    logCombat(`🧠💥 Concentration de ${c.name} brisée (tombe à 0 PV).`);
  }

  // Auto-butin : un monstre/PNJ qui meurt verse son butin (ligne « Butin : … » de
  // sa fiche de compendium) dans le trésor de groupe.
  if (hp === 0 && wasUp && !c.char_id) dropLoot(c);

  await updateCombatant(entityId, patch);
}

/** Verse le butin d'un monstre mort dans le trésor de groupe (MJ). */
function dropLoot(c) {
  if (!store.get().isDM) return;
  const bn = baseName(c.name).toLowerCase();
  const entry = (store.get().compendium || []).find(
    (e) => (e.kind === 'monster' || e.kind === 'npc') && baseName(e.name).toLowerCase() === bn
  );
  if (!entry) return;
  const loot = parseLoot(entry.data?.desc);
  if (!hasLoot(loot)) return;
  const pool = getPartyLoot();
  const coins = { ...pool.coins };
  for (const [k, v] of Object.entries(loot.coins)) coins[k] = (Number(coins[k]) || 0) + v;
  const items = [
    ...pool.items,
    ...loot.items.map((it) => ({ id: `l_${crypto.randomUUID().slice(0, 8)}`, nm: it.nm, qty: it.qty, note: `Butin · ${c.name}` })),
  ];
  setPartyLoot({ coins, items });
  logCombat(`💰 Butin de ${c.name} ajouté au trésor de groupe.`);
}

/** Lance un jet de sauvegarde contre la mort pour un combattant (MJ). */
export async function rollDeathSave(entityId) {
  if (!store.get().isDM) return;
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c || c.hp !== 0 || !c.char_id) return;
  const cur = c.death_saves || { s: 0, f: 0 };
  if (cur.s >= 3 || cur.f >= 3) return; // déjà stabilisé ou mort

  const r = d20roll();
  const res = resolveDeathSave(cur, r);
  if (res.revived) {
    logCombat(`🎲 ${c.name} — sauvegarde contre la mort : 20 ! Reprend connaissance avec 1 PV.`);
    await updateCombatant(entityId, { hp: 1, death_saves: null });
    return;
  }
  const tag = r === 1 ? 'échec critique, 2 échecs' : r >= 10 ? 'réussite' : 'échec';
  logCombat(`🎲 ${c.name} — sauvegarde contre la mort : ${r} (${tag} · ✔${res.ds.s}/✘${res.ds.f}).`);
  if (res.stable) logCombat(`🟢 ${c.name} est stabilisé.`);
  else if (res.dead) logCombat(`☠️ ${c.name} succombe à ses blessures.`);
  await updateCombatant(entityId, { death_saves: res.ds });
}

/** Ajuste manuellement les pastilles de jets de mort (MJ). */
export async function setDeathSave(entityId, kind, n) {
  if (!store.get().isDM) return;
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c || c.hp !== 0 || !c.char_id) return;
  const ds = { ...(c.death_saves || { s: 0, f: 0 }) };
  // Clic sur une pastille déjà allumée → on la décoche (revient à n-1) ; sinon n.
  if (kind === 's') ds.s = ds.s >= n ? n - 1 : n;
  else ds.f = ds.f >= n ? n - 1 : n;
  if (ds.s >= 3) logCombat(`🟢 ${c.name} est stabilisé.`);
  else if (ds.f >= 3) logCombat(`☠️ ${c.name} succombe à ses blessures.`);
  await updateCombatant(entityId, { death_saves: ds });
}

/**
 * Jet de sauvegarde de groupe (AoE — boule de feu, souffle…). Le MJ choisit la
 * caractéristique, le DD, les dégâts et qui est touché ; l'app lance la sauvegarde
 * de chaque combattant (bonus de la fiche pour les PJ, +0 sinon), puis applique
 * les dégâts pleins en cas d'échec et la moitié (ou rien) en cas de réussite. MJ.
 */
export async function resolveGroupSave({ ability, dc, amount, halfOnSuccess = true, type = '', entityIds = [] }) {
  if (!store.get().isDM) return;
  const list = store.get().initiative;
  const ablabel = (ABILITIES.find((a) => a.key === ability) || {}).label || ability;
  const DC = Number(dc) || 10;
  const amt = Math.max(0, Number(amount) || 0);
  let nSucc = 0;
  let nFail = 0;
  logCombat(`💥 Jet de sauvegarde de groupe — ${ablabel} DD ${DC}${type ? ` (${type})` : ''}.`);
  for (const eid of entityIds) {
    const c = list.find((x) => x.entity_id === eid);
    if (!c) continue;
    let bonus = 0;
    if (c.char_id) {
      const ch = store.get().characters.find((x) => x.id === c.char_id);
      if (ch) bonus = saveBonus(ch.data || {}, ability);
    }
    const die = d20roll();
    const total = die + bonus;
    const success = total >= DC;
    if (success) nSucc++;
    else nFail++;
    const bstr = bonus ? (bonus > 0 ? `+${bonus}` : `${bonus}`) : '';
    logCombat(`   ${c.name} : ${total} (d20 ${die}${bstr}) → ${success ? 'réussite' : 'échec'}.`, true);
    const dmg = amt === 0 ? 0 : success ? (halfOnSuccess ? Math.floor(amt / 2) : 0) : amt;
    if (dmg > 0) await adjustHp(eid, -dmg); // adjustHp journalise le détail des PV
  }
  logCombat(`   Résultat : ${nSucc} réussite(s), ${nFail} échec(s).`);
}

/** Bascule un état (condition) sur un combattant (MJ). */
export async function toggleCondition(entityId, cond) {
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c) return;
  const set = new Set(c.conditions || []);
  if (set.has(cond)) set.delete(cond);
  else set.add(cond);
  await updateCombatant(entityId, { conditions: [...set] });
}

/** Ajoute un effet à durée à un combattant (MJ). `rounds` vide = indéfini. */
export function addEffect(entityId, { name, rounds, concentration = false }) {
  if (!store.get().isDM) return;
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c) return;
  const until = rounds ? store.get().initRound + Number(rounds) : null;
  let effects = [...(c.effects || [])];
  if (concentration) effects = effects.filter((e) => !e.concentration);
  effects.push({ name: String(name).trim() || 'Effet', until, concentration });
  updateCombatant(entityId, { effects });
}

/** Retire l'effet à l'index donné (MJ). */
export function removeEffect(entityId, index) {
  if (!store.get().isDM) return;
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c) return;
  const effects = (c.effects || []).filter((_, i) => i !== index);
  updateCombatant(entityId, { effects });
}

/** Supprime un combattant (MJ). */
export async function removeCombatant(entityId) {
  if (!store.get().isDM) return;
  const { error } = await supabase.from('initiative').delete().eq('entity_id', entityId);
  if (error) {
    console.error('[init] suppression échouée:', error.message);
    return;
  }
  store.set({
    initiative: store.get().initiative.filter((c) => c.entity_id !== entityId),
  });
  await resequence();
}

/** Lance l'initiative pour tous : d20 + mod. Dex (PJ liés), d20 sinon ; tri (MJ). */
export async function rollAllInitiative() {
  if (!store.get().isDM) return;
  const list = store.get().initiative;
  if (!list.length) return;
  const chars = store.get().characters;
  const d20 = () => {
    const b = new Uint32Array(1);
    const max = Math.floor(0xffffffff / 20) * 20;
    do {
      crypto.getRandomValues(b);
    } while (b[0] >= max);
    return (b[0] % 20) + 1;
  };
  // Initiative de groupe : les monstres d'un même groupe (« Gobelin 1…5 »,
  // ou plusieurs « Loup ») partagent un seul jet ; chaque PJ lance le sien.
  const groupRoll = new Map();
  const keyOf = (c) => (c.char_id ? `pj:${c.entity_id}` : `grp:${baseName(c.name)}`);
  const rolled = list.map((c) => {
    const k = keyOf(c);
    let mod = 0;
    if (c.char_id) {
      const ch = chars.find((x) => x.id === c.char_id);
      if (ch) mod = abilityMod(ch.data?.dex);
    }
    if (!groupRoll.has(k)) groupRoll.set(k, d20());
    return { ...c, initiative: groupRoll.get(k) + mod };
  });
  store.set({ initiative: rolled });
  for (const c of rolled) {
    await supabase
      .from('initiative')
      .update({ initiative: c.initiative, updated_at: new Date().toISOString() })
      .eq('entity_id', c.entity_id);
  }
  await reorderByInitiative();
  await setMeta(0, store.get().initRound || 1);
}

/** Vide le combat (MJ). */
export async function clearCombat() {
  if (!store.get().isDM) return;
  const { error } = await supabase.from('initiative').delete().neq('entity_id', '');
  if (error) console.error('[init] reset échoué:', error.message);
  store.set({ initiative: [] });
  await setMeta(0, 1);
}

/* ── Tour / round ─────────────────────────────────────────── */

export async function nextTurn() {
  if (!store.get().isDM) return;
  const { initiative, initTurn, initRound } = store.get();
  if (!initiative.length) return;
  let turn = initTurn + 1;
  let round = initRound;
  if (turn >= initiative.length) {
    turn = 0;
    round += 1;
    logCombat(`— Round ${round} —`);
  }
  const next = initiative[turn];
  if (next) logCombat(`▶ Tour de ${next.name}.`);
  await setMeta(turn, round);
  await expireEffects(round);
}

/** Retire les effets à durée arrivés à expiration au round donné (MJ, persisté). */
async function expireEffects(round) {
  if (!store.get().isDM) return;
  for (const c of store.get().initiative) {
    const eff = c.effects || [];
    if (!eff.length) continue;
    const kept = eff.filter((e) => e.until == null || e.until > round);
    if (kept.length === eff.length) continue;
    for (const e of eff) {
      if (!(e.until == null || e.until > round)) {
        logCombat(`⏳ Effet expiré sur ${c.name} : ${e.name}.`);
      }
    }
    await updateCombatant(c.entity_id, { effects: kept });
  }
}

export async function prevTurn() {
  if (!store.get().isDM) return;
  const { initiative, initTurn, initRound } = store.get();
  if (!initiative.length) return;
  let turn = initTurn - 1;
  let round = initRound;
  if (turn < 0) {
    turn = initiative.length - 1;
    round = Math.max(1, round - 1);
  }
  await setMeta(turn, round);
}

async function setMeta(turn, round) {
  store.set({ initTurn: turn, initRound: round });
  const { error } = await supabase.from('session_state').upsert(
    {
      key: META_KEY,
      value: { turn, round },
      updated_at: new Date().toISOString(),
      updated_by: store.get().user?.id ?? null,
    },
    { onConflict: 'key' }
  );
  if (error) console.error('[init] meta échouée:', error.message);
}

/* ── Tri / ordre ──────────────────────────────────────────── */

function nextSortOrder(initiative, list) {
  // Insère selon l'initiative décroissante ; renvoie un sort_order temporaire.
  const init = Number(initiative) || 0;
  const below = list.filter((c) => c.initiative > init).length;
  return below;
}

/** Recalcule sort_order par initiative décroissante et persiste (MJ). */
async function resequence() {
  const sorted = [...store.get().initiative].sort(
    (a, b) => b.initiative - a.initiative
  );
  const updates = [];
  sorted.forEach((c, i) => {
    if (c.sort_order !== i) {
      updates.push({ entity_id: c.entity_id, sort_order: i });
    }
  });
  store.set({ initiative: sorted.map((c, i) => ({ ...c, sort_order: i })) });
  for (const u of updates) {
    await supabase.from('initiative').update({ sort_order: u.sort_order }).eq('entity_id', u.entity_id);
  }
}

/** À appeler après édition manuelle d'une initiative pour re-trier. */
export async function reorderByInitiative() {
  if (!store.get().isDM) return;
  await resequence();
}

/** Fixe l'ordre manuel du tracker (glisser-déposer) sans re-trier par initiative. */
export async function setManualOrder(orderedIds) {
  if (!store.get().isDM) return;
  const byId = new Map(store.get().initiative.map((c) => [c.entity_id, c]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  if (reordered.length !== byId.size) return; // garde-fou : liste incohérente
  store.set({ initiative: reordered.map((c, i) => ({ ...c, sort_order: i })) });
  for (let i = 0; i < reordered.length; i++) {
    await supabase.from('initiative').update({ sort_order: i }).eq('entity_id', reordered[i].entity_id);
  }
}

/** Statut tactique d'un combattant : null / 'ready' / 'delayed' (MJ). */
export async function setCombatantStatus(entityId, status) {
  if (!store.get().isDM) return;
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c) return;
  const next = c.status === status ? null : status; // re-cliquer = annuler
  await updateCombatant(entityId, { status: next });
  if (next === 'ready') logCombat(`⏳ ${c.name} prépare une action.`);
  else if (next === 'delayed') logCombat(`⏸ ${c.name} retarde son tour.`);
}

/* ── Realtime ─────────────────────────────────────────────── */

let _initSubbed = false;
export function subscribeInitiative() {
  if (_initSubbed) return () => {}; // abonnement unique pour la session
  _initSubbed = true;
  const chInit = supabase
    .channel('initiative_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'initiative' },
      () => refreshList()
    )
    .subscribe();

  const chMeta = supabase
    .channel('init_meta_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${META_KEY}` },
      (payload) => {
        const v = payload.new?.value || {};
        store.set({ initTurn: v.turn ?? 0, initRound: v.round ?? 1 });
        // Notifie le joueur dont c'est le tour (jeton/combattant lié à sa fiche).
        const active = store.get().initiative[v.turn ?? 0];
        if (active?.char_id && !store.get().isDM) {
          const ch = store.get().characters.find((c) => c.id === active.char_id);
          if (ch?.owner_id === store.get().user?.id) {
            showToast('🗡 À toi de jouer !', { type: 'info', icon: '⚔️', timeout: 6000 });
          }
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'session_state', filter: `key=eq.${LOG_KEY}` },
      (payload) => {
        store.set({ combatLog: Array.isArray(payload.new?.value) ? payload.new.value : [] });
      }
    )
    .subscribe();

  return () => {}; // canaux conservés pour la session (dock + onglet partagés)
}

async function refreshList() {
  const { data, error } = await supabase
    .from('initiative')
    .select('*')
    .order('sort_order', { ascending: true });
  if (!error) store.set({ initiative: (data || []).map(normRow) });
}

/* ── Canal combat : actions des joueurs déléguées au MJ (broadcast) ──── */
let _combatRt = null;
export function initCombatChannel() {
  if (_combatRt) return;
  _combatRt = supabase.channel('combat_rt', { config: { broadcast: { self: false } } });
  _combatRt
    .on('broadcast', { event: 'action' }, ({ payload }) => {
      if (store.get().isDM && payload?.text) logCombat(payload.text);
    })
    .on('broadcast', { event: 'endturn' }, ({ payload }) => {
      // Seul le MJ avance le tour, et seulement si c'est bien le tour du demandeur.
      if (!store.get().isDM) return;
      const active = store.get().initiative[store.get().initTurn];
      const ch = active?.char_id ? store.get().characters.find((c) => c.id === active.char_id) : null;
      if (ch && ch.owner_id === payload?.by) nextTurn();
    })
    // Requêtes joueur appliquées par le MJ (vérification de propriété).
    .on('broadcast', { event: 'preq' }, ({ payload }) => applyPlayerRequest(payload))
    .subscribe();
}

/** Le compte `by` possède-t-il bien la fiche `charId` ? (contrôle côté MJ) */
function ownsChar(by, charId) {
  const c = store.get().characters.find((x) => x.id === charId);
  return !!c && c.owner_id === by;
}
function d20roll() {
  const b = new Uint32Array(1);
  const max = Math.floor(0xffffffff / 20) * 20;
  do {
    crypto.getRandomValues(b);
  } while (b[0] >= max);
  return (b[0] % 20) + 1;
}

/** Calcule les PV après un delta (amt>0 = dégâts ; amt<0 = soin). */
function _hpAfter(before, max, temp, amt) {
  if (amt > 0) {
    const ft = Math.min(temp, amt);
    return { hp: Math.max(0, before - (amt - ft)), temp: temp - ft };
  }
  const healed = before + -amt;
  return { hp: Math.max(0, max != null ? Math.min(Number(max), healed) : healed), temp };
}

/** Applique des dégâts (amt>0) ou un soin (amt<0) à une cible (combattant > fiche > jeton). MJ. */
export function applyDmgToTarget(p) {
  const amt = Number(p.amount) || 0;
  if (amt === 0) return;
  const init = store.get().initiative;
  let comb = null;
  if (p.target?.entityId) comb = init.find((c) => c.entity_id === p.target.entityId);
  if (!comb && p.target?.charId) comb = init.find((c) => c.char_id === p.target.charId);
  const name = p.target?.name || 'la cible';
  const verb = amt > 0 ? `💥 subit ${amt} dégâts` : `💚 récupère ${-amt} PV`;
  if (comb) {
    adjustHp(comb.entity_id, -amt); // -amt : dégâts si amt>0, soin si amt<0
    return;
  }
  const ch = p.target?.charId ? store.get().characters.find((c) => c.id === p.target.charId) : null;
  if (ch && ch.data?.hp != null) {
    const r = _hpAfter(Number(ch.data.hp) || 0, ch.data.hpMax, Number(ch.data.hpTmp) || 0, amt);
    updateCharacter(ch.id, { hp: r.hp, hpTmp: r.temp });
    logCombat(`${name} ${verb}.`, true);
    return;
  }
  const tok = p.target?.tokenId ? (store.get().map?.tokens || []).find((t) => t.id === p.target.tokenId) : null;
  if (tok && (tok.hp != null || tok.hpMax != null)) {
    const r = _hpAfter(Number(tok.hp) || 0, tok.hpMax, Number(tok.hpTemp) || 0, amt);
    updateToken(tok.id, { hp: r.hp, hpTemp: r.temp });
    logCombat(`${name} ${verb}.`, true);
  }
}

/** Applique une condition à des cibles (combattants liés). MJ. */
function applyCondToTargets(p) {
  const cond = String(p.cond || '').trim();
  if (!cond) return;
  const init = store.get().initiative;
  for (const t of p.targets || []) {
    let comb = null;
    if (t.entityId) comb = init.find((c) => c.entity_id === t.entityId);
    if (!comb && t.charId) comb = init.find((c) => c.char_id === t.charId);
    if (comb) {
      const set = new Set(comb.conditions || []);
      set.add(cond);
      updateCombatant(comb.entity_id, { conditions: [...set] });
    }
  }
  logCombat(`🩹 ${cond} appliqué à ${(p.targets || []).length} cible(s).`);
}

/* Anti‑spam : limite le débit des requêtes appliquées par le MJ, par expéditeur.
 * Empêche un client malveillant/buggé d'inonder le poste du MJ. */
const _preqTimes = new Map();
function preqAllowed(by, minMs = 250) {
  const now = Date.now();
  const last = _preqTimes.get(by) || 0;
  if (now - last < minMs) return false;
  _preqTimes.set(by, now);
  if (_preqTimes.size > 100) _preqTimes.clear(); // garde-fou mémoire
  return true;
}

/** Applique une requête joueur (MJ uniquement). */
async function applyPlayerRequest(p) {
  if (!store.get().isDM || !p) return;
  if (!preqAllowed(p.by || 'anon')) return; // limite de débit par expéditeur
  if (p.kind === 'pin') {
    const id = addPin({ x: p.x, y: p.y });
    if (id) updatePin(id, { revealed: true, note: p.note || '' });
    return;
  }
  if (p.kind === 'door') {
    toggleDoor(Number(p.index)); // ouvrir/fermer une porte (demandé par un joueur)
    return;
  }
  if (p.kind === 'tcond') {
    applyCondToTargets(p);
    return;
  }
  if (p.kind === 'dmg') {
    if (p.text) logCombat(p.text);
    applyDmgToTarget(p);
    return;
  }
  if (p.kind === 'lootclaim') {
    // Un joueur demande un objet du trésor : on le marque pour le MJ.
    const ch = store.get().characters.find((c) => c.id === p.charId);
    if (!ch || ch.owner_id !== p.by) return; // contrôle de propriété
    updateLootItem(p.itemId, { reqBy: ch.name, reqCharId: ch.id });
    showToast(`✋ ${ch.name} demande un objet du trésor.`, { icon: '🪙', timeout: 4000 });
    return;
  }
  if (p.kind === 'atkask') {
    // Jet d'attaque d'un joueur : le MJ résout (CA réelle) et journalise.
    const all = store.get().map?.tokens || [];
    const toks = (p.tokenIds || []).map((id) => all.find((t) => t.id === id)).filter(Boolean);
    resolveAttackVsTargets(p.d20, p.who, p.nm, toks);
    return;
  }
  if (p.kind === 'dmgask') {
    // Dégâts lancés par un joueur : le MJ valide le montant appliqué (résistances).
    const all = store.get().map?.tokens || [];
    let ids = p.tokenIds || [];
    if (!ids.length) ids = store.get().targets || []; // repli sur les cibles du MJ
    const toks = ids.map((id) => all.find((t) => t.id === id)).filter(Boolean);
    if (toks.length) applyDamageRollToTargets({ amount: p.amount, who: p.who, nm: p.nm, crit: p.crit, tokens: toks });
    else showToast(`💥 ${p.who || 'Un joueur'} inflige ${p.amount} dégâts — sélectionne une cible (🎯) pour l'appliquer.`, { timeout: 4500 });
    return;
  }
  // Actions liées au personnage du joueur : contrôle de propriété.
  if (!ownsChar(p.by, p.charId)) return;
  const ch = store.get().characters.find((c) => c.id === p.charId);
  const comb = store.get().initiative.find((c) => c.char_id === p.charId);
  if (p.kind === 'join') {
    if (!comb) {
      const d = ch.data || {};
      await addCombatant({ name: ch.name, initiative: 0, hp: d.hp ?? null, hpMax: d.hpMax ?? null, hpTemp: d.hpTmp ?? 0, charId: ch.id });
    }
  } else if (p.kind === 'leave') {
    if (comb) await removeCombatant(comb.entity_id);
  } else if (p.kind === 'rollinit') {
    if (comb) {
      await updateCombatant(comb.entity_id, { initiative: d20roll() + abilityMod(ch.data?.dex) });
      await reorderByInitiative();
    }
  } else if (p.kind === 'conds') {
    if (comb) await updateCombatant(comb.entity_id, { conditions: Array.isArray(p.conditions) ? p.conditions : [] });
  } else if (p.kind === 'hp') {
    if (comb) await adjustHp(comb.entity_id, Number(p.delta) || 0);
  } else if (p.kind === 'deathsave') {
    if (comb) await rollDeathSave(comb.entity_id);
  }
}

/** Diffuse une requête joueur au MJ (initiative, combat, états, PV). */
export function sendPlayerRequest(payload) {
  if (!_combatRt) initCombatChannel();
  _combatRt.send({ type: 'broadcast', event: 'preq', payload: { ...payload, by: store.get().user?.id } });
}
export function sendTurnAction(text) {
  if (!_combatRt) initCombatChannel();
  _combatRt.send({ type: 'broadcast', event: 'action', payload: { text, by: store.get().user?.id } });
}
export function sendEndTurn() {
  if (!_combatRt) initCombatChannel();
  _combatRt.send({ type: 'broadcast', event: 'endturn', payload: { by: store.get().user?.id } });
}
