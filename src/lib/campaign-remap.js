/**
 * Cœur PUR de l'export/import de campagne (aucune E/S — testable) :
 * régénération des identifiants, réécriture des références croisées,
 * neutralisation des références aux comptes de l'instance d'origine.
 * L'enveloppe E/S (lecture/écriture backend, fichier) vit dans
 * campaign-transfer.js.
 */

export const TRANSFER_TYPE = 'vtt-campaign';
export const TRANSFER_VERSION = 1;

/** Tables embarquées dans l'export (l'ordre est celui de l'import). */
export const TRANSFER_TABLES = [
  'characters',
  'character_private',
  'scenes',
  'session_state',
  'initiative',
  'compendium',
  'handouts',
  'session_notes',
  'vault_notes',
  'messages',
];

function defaultCharId() {
  return `c_${crypto.randomUUID().slice(0, 8)}`;
}

/** Réécrit récursivement sceneId/entryIds dans l'arbre du classeur. */
function remapBinderNodes(nodes, sceneMap, entryMap) {
  if (!Array.isArray(nodes)) return nodes;
  return nodes.map((n) => ({
    ...n,
    sceneId: n.sceneId ? sceneMap[n.sceneId] || null : null,
    entryIds: Array.isArray(n.entryIds) ? n.entryIds.map((id) => entryMap[id]).filter(Boolean) : [],
    children: remapBinderNodes(n.children, sceneMap, entryMap),
  }));
}

/**
 * Régénère les identifiants d'un export et réécrit toutes les références
 * croisées : jetons→fiche (charId), combat→fiche (char_id), histoires
 * privées (char_id), pointeur de scène active, classeur (sceneId/entryIds).
 * Pur : reçoit `tables`, renvoie { tables, maps }. `uid`/`charId` sont
 * injectables pour les tests.
 */
export function remapForImport(tables, { uid = () => crypto.randomUUID(), charId = defaultCharId } = {}) {
  const t = {};
  for (const name of TRANSFER_TABLES) t[name] = (tables[name] || []).map((r) => ({ ...r }));

  // 1. Nouveaux identifiants pour tout ce qui est référencé ailleurs.
  const charMap = {};
  for (const c of t.characters) {
    charMap[c.id] = charId();
    c.id = charMap[c.id];
  }
  const sceneMap = {};
  for (const s of t.scenes) {
    sceneMap[s.id] = uid();
    s.id = sceneMap[s.id];
  }
  const entryMap = {};
  for (const e of t.compendium) {
    entryMap[e.id] = uid();
    e.id = entryMap[e.id];
  }

  // 2. Réécriture des références croisées.
  t.character_private = t.character_private
    .map((p) => ({ ...p, char_id: charMap[p.char_id] }))
    .filter((p) => p.char_id);
  for (const row of t.initiative) {
    if (row.char_id) row.char_id = charMap[row.char_id] || null;
  }
  for (const s of t.scenes) {
    const st = s.state;
    if (st && Array.isArray(st.tokens)) {
      st.tokens = st.tokens.map((tok) => (tok.charId ? { ...tok, charId: charMap[tok.charId] || null } : tok));
    }
  }
  for (const row of t.session_state) {
    if (row.key === 'active_scene' && row.value?.id) {
      row.value = { ...row.value, id: sceneMap[row.value.id] || null };
    }
    if (row.key === 'campaign' && Array.isArray(row.value)) {
      row.value = remapBinderNodes(row.value, sceneMap, entryMap);
    }
  }

  return { tables: t, maps: { charMap, sceneMap, entryMap } };
}

/** Colonnes liées aux comptes de l'instance d'origine : neutralisées ou
 *  réattribuées à l'importateur (exigé par les RLS d'insertion). */
export function sanitizeForImport(tables, importerId) {
  const t = tables;
  for (const c of t.characters) c.owner_id = null; // le MJ réattribue
  for (const r of t.initiative) delete r.updated_by;
  for (const s of t.scenes) delete s.created_by;
  for (const r of t.session_state) delete r.updated_by;
  for (const h of t.handouts) {
    h.target_player = null; // cible d'un autre annuaire de comptes
    delete h.pushed_by;
  }
  for (const n of t.session_notes) n.created_by = importerId;
  for (const e of t.compendium) delete e.created_by;
  for (const v of t.vault_notes) delete v.updated_by;
  for (const m of t.messages) {
    m.sender_id = importerId; // sender_name d'origine conservé
    m.recipient_id = null;
  }
  return t;
}
