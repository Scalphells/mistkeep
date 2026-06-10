import { backend } from '../lib/backend.js';
import { store } from '../state.js';
import { debounce } from '../lib/utils.js';
import { abilityMod, resolveNotation, classResources } from '../lib/rules.js';
import { showToast } from '../lib/toast.js';

// Réexport pour conserver l'API publique historique (de nombreux modules
// importent ces règles depuis features/characters.js).
export { abilityMod, resolveNotation, classResources };

/**
 * Fiches de personnage D&D 5e.
 *
 * Source de vérité : table `characters` (RLS : lecture groupe, écriture
 * MJ ou propriétaire). Écritures debouncées + granulaires (une fiche à la
 * fois), comme le vault. Realtime pour refléter PV/état en combat.
 */

const pendingSaves = new Map(); // id -> debounced fn

/* ── Constantes 5e ────────────────────────────────────────── */

export const ABILITIES = [
  { key: 'str', label: 'FOR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'SAG' },
  { key: 'cha', label: 'CHA' },
];

// Compétence -> { label, caractéristique }
export const SKILLS = {
  acrobatics:   { label: 'Acrobaties', ability: 'dex' },
  animal:       { label: 'Dressage', ability: 'wis' },
  arcana:       { label: 'Arcanes', ability: 'int' },
  athletics:    { label: 'Athlétisme', ability: 'str' },
  deception:    { label: 'Tromperie', ability: 'cha' },
  history:      { label: 'Histoire', ability: 'int' },
  insight:      { label: 'Perspicacité', ability: 'wis' },
  intimidation: { label: 'Intimidation', ability: 'cha' },
  investigation:{ label: 'Investigation', ability: 'int' },
  medicine:     { label: 'Médecine', ability: 'wis' },
  nature:       { label: 'Nature', ability: 'int' },
  perception:   { label: 'Perception', ability: 'wis' },
  performance:  { label: 'Représentation', ability: 'cha' },
  persuasion:   { label: 'Persuasion', ability: 'cha' },
  religion:     { label: 'Religion', ability: 'int' },
  sleight:      { label: 'Escamotage', ability: 'dex' },
  stealth:      { label: 'Discrétion', ability: 'dex' },
  survival:     { label: 'Survie', ability: 'wis' },
};

/* ── Calculs ──────────────────────────────────────────────── */

/** Formate un modificateur signé (+3 / -1 / +0). */
export function fmtMod(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Bonus d'un jet de sauvegarde (mod + maîtrise si applicable). */
export function saveBonus(data, abilityKey) {
  const mod = abilityMod(data[abilityKey]);
  const prof = (data.saves || []).includes(abilityKey) ? Number(data.prof || 0) : 0;
  return mod + prof;
}

/** Bonus d'une compétence (mod + maîtrise, + expertise si listée). */
export function skillBonus(data, skillKey) {
  const sk = SKILLS[skillKey];
  if (!sk) return 0;
  const mod = abilityMod(data[sk.ability]);
  const p = Number(data.prof || 0);
  if ((data.exp || []).includes(skillKey)) return mod + p * 2;
  if ((data.profs || []).includes(skillKey)) return mod + p;
  return mod;
}

/* ── Chargement ───────────────────────────────────────────── */

export async function loadCharacters() {
  const { data, error } = await backend.db
    .from('characters')
    .select('id, owner_id, name, data')
    .order('name', { ascending: true });

  if (error) {
    console.warn('[characters] chargement impossible:', error.message);
    return;
  }
  store.set({ characters: data });
  resolvePortraitUrls();

  // Sélectionne par défaut : sa propre fiche (joueur) ou la première (MJ).
  const { user, activeChar } = store.get();
  if (!activeChar) {
    const mine = data.find((c) => c.owner_id === user?.id);
    store.set({ activeChar: (mine || data[0])?.id ?? null });
  }

  // Le MJ a besoin de la liste des joueurs pour attribuer les fiches.
  if (store.get().isDM) await loadPlayers();
}

/** Charge la liste des comptes (pour l'attribution de fiches — MJ). */
export async function loadPlayers() {
  const { data, error } = await backend.db
    .from('profiles')
    .select('id, display_name, email, role, color')
    .order('display_name', { ascending: true });
  if (error) {
    console.warn('[characters] liste joueurs impossible:', error.message);
    return;
  }
  store.set({ players: data });
}

/* ── Portraits (bucket battlemap, prefix portraits/) ──────── */

const PORTRAIT_BUCKET = 'battlemap';
const _portraitCache = new Map();

export function portraitUrl(path) {
  return path ? _portraitCache.get(path) || null : null;
}

/** Résout les URL signées des portraits, puis re-render si nouveauté. */
export async function resolvePortraitUrls() {
  let changed = false;
  for (const c of store.get().characters) {
    const p = c.data?.portrait;
    if (p && !_portraitCache.has(p)) {
      const key = p.startsWith(`${PORTRAIT_BUCKET}/`) ? p.slice(PORTRAIT_BUCKET.length + 1) : p;
      const { data, error } = await backend.storage.from(PORTRAIT_BUCKET).createSignedUrl(key, 60 * 60 * 6);
      if (!error && data) {
        _portraitCache.set(p, data.signedUrl);
        changed = true;
      }
    }
  }
  if (changed) store.set({ characters: [...store.get().characters] });
}

/** Téléverse un portrait et l'associe à la fiche (MJ — RLS battlemap). */
export async function uploadPortrait(id, file) {
  if (!store.get().isDM) return;
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const key = `portraits/${id}_${Date.now()}.${ext}`;
  const { error } = await backend.storage.from(PORTRAIT_BUCKET).upload(key, file, {
    upsert: true,
    contentType: file.type || 'image/png',
  });
  if (error) throw new Error(error.message);
  const path = `${PORTRAIT_BUCKET}/${key}`;
  updateCharacter(id, { portrait: path });
  await resolvePortraitUrls();
}

/* ── Permissions ──────────────────────────────────────────── */

/** Le joueur courant peut-il éditer cette fiche ? */
export function canEdit(character) {
  const { isDM, user } = store.get();
  return isDM || character?.owner_id === user?.id;
}

/* ── Écriture ─────────────────────────────────────────────── */

/**
 * Met à jour un champ de la fiche `data` et programme une sauvegarde.
 * Optimiste : applique en local immédiatement, puis upsert debouncé.
 */
export function updateCharacter(id, patch) {
  const characters = store.get().characters.map((c) =>
    c.id === id ? { ...c, data: { ...c.data, ...patch } } : c
  );
  store.set({ characters });

  // Synchronise les PV vers le combattant lié dans le tracker d'initiative.
  if ('hp' in patch || 'hpMax' in patch || 'hpTmp' in patch) {
    syncHpToInitiative(id, patch);
  }

  const target = characters.find((c) => c.id === id);
  if (!target || !canEdit(target)) return;

  if (!pendingSaves.has(id)) {
    pendingSaves.set(
      id,
      debounce(async (charId) => {
        const cur = store.get().characters.find((c) => c.id === charId);
        if (!cur) return;
        const { error } = await backend.db
          .from('characters')
          .update({
            data: cur.data,
            updated_at: new Date().toISOString(),
            updated_by: store.get().user?.id ?? null,
          })
          .eq('id', charId);
        if (error) {
          console.error('[characters] save échouée:', error.message);
          showToast('Échec de l’enregistrement de la fiche — vérifie ta connexion.', { type: 'warn', icon: '⚠️' });
        }
      }, 900)
    );
  }
  pendingSaves.get(id)(id);
}

/** Répercute les PV d'une fiche sur le combattant lié (MJ uniquement pour la persistance). */
function syncHpToInitiative(charId, patch) {
  const list = store.get().initiative;
  if (!list.length || !list.some((c) => c.char_id === charId)) return;

  const cp = {};
  if ('hp' in patch) cp.hp = Number(patch.hp) || 0;
  if ('hpMax' in patch) cp.hp_max = Number(patch.hpMax) || 0;
  if ('hpTmp' in patch) cp.hp_temp = Math.max(0, Number(patch.hpTmp) || 0);
  if (!Object.keys(cp).length) return;

  store.set({
    initiative: list.map((c) => (c.char_id === charId ? { ...c, ...cp } : c)),
  });

  // Seul le MJ peut écrire dans `initiative` (RLS).
  if (!store.get().isDM) return;
  backend.db
    .from('initiative')
    .update({ ...cp, updated_at: new Date().toISOString() })
    .eq('char_id', charId)
    .then(({ error }) => {
      if (error) console.warn('[sync] combat:', error.message);
    });
}

/** Crée une fiche vierge (MJ uniquement). */
export async function createCharacter(name) {
  if (!store.get().isDM) return null;
  const id = `c_${crypto.randomUUID().slice(0, 8)}`;
  const data = {
    cls: '', sub: '', lvl: 1, race: '', bg: '', align: '',
    hp: 10, hpMax: 10, hpTmp: 0, ac: 10, spd: 9, initB: 0, prof: 2, insp: false,
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    saves: [], profs: [], exp: [], atks: [], sc: null, slots: {}, spells: [],
    feats: '', equip: '', notes: '', ds: { s: 0, f: 0 }, xp: 0,
  };
  const { error } = await backend.db.from('characters').insert({ id, name, data });
  if (error) {
    console.error('[characters] création échouée:', error.message);
    return null;
  }
  await loadCharacters();
  store.set({ activeChar: id });
  return id;
}

/** Crée une fiche puis applique un lot de données analysées (import). MJ. */
export async function importCharacter(name, dataPatch) {
  const id = await createCharacter(name);
  if (id && dataPatch && Object.keys(dataPatch).length) updateCharacter(id, dataPatch);
  return id;
}

/** Renomme une fiche (colonne `name`, hors `data`). */
export async function renameCharacter(id, name) {
  const nm = String(name || '').trim().slice(0, 40);
  if (!nm) return;
  const characters = store.get().characters.map((c) => (c.id === id ? { ...c, name: nm } : c));
  store.set({ characters });
  const target = characters.find((c) => c.id === id);
  if (!target || !canEdit(target)) return;
  const { error } = await backend.db.from('characters').update({ name: nm, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('[characters] renommage échoué:', error.message);
}

/** Remplace intégralement les données d'une fiche (ré-import JSON). */
export function replaceCharacterData(id, data) {
  const characters = store.get().characters.map((c) => (c.id === id ? { ...c, data: { ...(data || {}) } } : c));
  store.set({ characters });
  const target = characters.find((c) => c.id === id);
  if (!target || !canEdit(target)) return;
  const cur = characters.find((c) => c.id === id);
  syncHpToInitiative(id, cur.data);
  backend.db
    .from('characters')
    .update({ data: cur.data, updated_at: new Date().toISOString(), updated_by: store.get().user?.id ?? null })
    .eq('id', id)
    .then(({ error }) => {
      if (error) console.error('[characters] remplacement échoué:', error.message);
    });
}

/** Supprime une fiche (MJ uniquement). */
export async function deleteCharacter(id) {
  if (!store.get().isDM) return;
  const { error } = await backend.db.from('characters').delete().eq('id', id);
  if (error) {
    console.error('[characters] suppression échouée:', error.message);
    return;
  }
  const remaining = store.get().characters.filter((c) => c.id !== id);
  store.set({
    characters: remaining,
    activeChar: store.get().activeChar === id ? remaining[0]?.id ?? null : store.get().activeChar,
  });
}

/** Attribue une fiche à un joueur (MJ uniquement). */
export async function assignOwner(id, ownerId) {
  if (!store.get().isDM) return;
  const { error } = await backend.db
    .from('characters')
    .update({ owner_id: ownerId || null })
    .eq('id', id);
  if (error) {
    console.error('[characters] attribution échouée:', error.message);
    return;
  }
  const characters = store.get().characters.map((c) =>
    c.id === id ? { ...c, owner_id: ownerId || null } : c
  );
  store.set({ characters });
}

/* ── Realtime ─────────────────────────────────────────────── */

let _charSubbed = false;
export function subscribeCharacters() {
  if (_charSubbed) return () => {}; // abonnement unique pour la session
  _charSubbed = true;
  const channel = backend.realtime
    .channel('characters_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'characters' },
      (payload) => {
        const cur = store.get().characters;
        if (payload.eventType === 'DELETE') {
          store.set({ characters: cur.filter((c) => c.id !== payload.old.id) });
          return;
        }
        const row = payload.new;
        const exists = cur.some((c) => c.id === row.id);
        const next = exists
          ? cur.map((c) => (c.id === row.id ? { ...c, ...row } : c))
          : [...cur, row];
        store.set({ characters: next });
      }
    )
    .subscribe();

  return () => {}; // canal conservé pour la session (dock + onglet partagés)
}
