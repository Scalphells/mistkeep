/**
 * Export / import de campagne complète (fichier JSON autonome) — E/S.
 *
 * Export : toutes les données de la campagne ACTIVE (fiches + histoires
 * privées, scènes, combat, état de session, handouts, notes, compendium,
 * vault MJ, chat) dans un fichier portable — sauvegarde indépendante du
 * backend, archivage, ou transfert vers une autre instance/édition.
 * Les FICHIERS médias ne sont pas embarqués : les références (URLs R2
 * absolues ou chemins du storage backend) sont conservées telles quelles.
 *
 * Import : crée une NOUVELLE campagne et y rejoue le fichier (identifiants
 * régénérés, références réécrites, comptes d'origine neutralisés — cf. le
 * cœur pur campaign-remap.js), puis bascule dessus.
 */
import { backend } from './backend.js';
import { store } from '../state.js';
import { activeCampaign, switchCampaign } from './campaigns.js';
import { TRANSFER_TYPE, TRANSFER_VERSION, TRANSFER_TABLES, remapForImport, sanitizeForImport } from './campaign-remap.js';
import { t as tr } from './i18n.js';

/** Lit toutes les données de la campagne active et construit le fichier. */
export async function exportActiveCampaign() {
  const camp = activeCampaign();
  if (!camp) throw new Error('Aucune campagne active.');
  const tables = {};
  for (const name of TRANSFER_TABLES) {
    if (name === 'character_private') {
      // Pas de campaign_id : hérite via les fiches (déjà lues — ordre des tables).
      const ids = (tables.characters || []).map((c) => c.id);
      tables[name] = ids.length
        ? (await backend.db.from(name).select('*').in('char_id', ids)).data || []
        : [];
      continue;
    }
    const { data, error } = await backend.db.from(name).select('*').eq('campaign_id', camp.id);
    if (error) throw new Error(`${name} : ${error.message}`);
    tables[name] = (data || []).map(({ campaign_id, ...row }) => row);
  }
  return {
    type: TRANSFER_TYPE,
    version: TRANSFER_VERSION,
    exportedAt: new Date().toISOString(),
    campaign: { name: camp.name, system: camp.system },
    tables,
  };
}

/** Télécharge l'export de la campagne active en fichier JSON. */
export async function downloadActiveCampaign() {
  const payload = await exportActiveCampaign();
  const slug = (payload.campaign.name || 'campagne').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `campagne-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  return payload;
}

/** Insère les lignes une par une (le backend Go attend un objet par requête). */
async function insertRows(table, rows, cid, onProgress) {
  for (let i = 0; i < rows.length; i++) {
    const { error } = await backend.db.from(table).insert({ ...rows[i], campaign_id: cid });
    if (error) throw new Error(`${table} : ${error.message}`);
    if ((i + 1) % 10 === 0 || i + 1 === rows.length) onProgress?.(table, i + 1, rows.length);
  }
}

/**
 * Importe un fichier d'export dans une NOUVELLE campagne (l'importateur en
 * devient propriétaire + MJ), puis y bascule. `onProgress(table, done, total)`
 * permet d'afficher l'avancement.
 */
export async function importCampaignPayload(payload, onProgress) {
  if (payload?.type !== TRANSFER_TYPE || !payload.tables) {
    throw new Error('Fichier invalide : ce n’est pas un export de campagne.');
  }
  if (Number(payload.version) > TRANSFER_VERSION) {
    throw new Error(`Export d’une version plus récente (v${payload.version}).`);
  }
  const uid = store.get().user?.id;

  // 1. La campagne d'accueil + l'adhésion MJ de l'importateur.
  const { data: camp, error } = await backend.db
    .from('campaigns')
    .insert({
      name: payload.campaign?.name || tr('camptx.importedDefault'),
      system: payload.campaign?.system || 'dnd5e-2014',
      owner_id: uid,
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  const cid = (Array.isArray(camp) ? camp[0] : camp).id;
  const { error: mErr } = await backend.db
    .from('campaign_members')
    .insert({ campaign_id: cid, user_id: uid, role: 'dm' });
  if (mErr) throw new Error(mErr.message);

  // 2. Identifiants régénérés + références réécrites + comptes neutralisés.
  const { tables } = remapForImport(payload.tables);
  sanitizeForImport(tables, uid);

  // 3. Insertion dans l'ordre des dépendances (fiches avant histoires privées…).
  for (const name of TRANSFER_TABLES) {
    const rows = tables[name] || [];
    if (!rows.length) continue;
    if (name === 'character_private') {
      // Pas de colonne campaign_id : insertion telle quelle.
      for (const row of rows) {
        const { error: e } = await backend.db.from(name).insert(row);
        if (e) throw new Error(`${name} : ${e.message}`);
      }
      onProgress?.(name, rows.length, rows.length);
      continue;
    }
    await insertRows(name, rows, cid, onProgress);
  }

  // 4. Bascule sur la campagne importée (recharge l'app).
  await switchCampaign(cid);
  return cid;
}
