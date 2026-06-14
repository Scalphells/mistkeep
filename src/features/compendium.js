import { backend } from '../lib/backend.js';
import { campaignId, sameCampaign } from '../lib/campaigns.js';
import { store } from '../state.js';
import { addCombatant } from './initiative.js';
import { showToast } from '../lib/toast.js';
import { t } from '../lib/i18n.js';

/**
 * Compendium : bibliothèque de contenu réutilisable du MJ (façon Foundry).
 *
 * Source de vérité : table `compendium` (RLS : MJ uniquement). Cinq types
 * (`kind`) : monstre, sort, objet, PNJ, table. Le champ `data` (jsonb) varie
 * selon le type. Diffusion Realtime.
 */

// `label`/`plural` = repli français ; en pratique l'UI passe par kindLabel /
// kindPlural ci-dessous, qui traduisent via i18n (clés kind.*).
export const KINDS = {
  monster: { icon: '👹', label: 'Monstre', plural: 'Monstres' },
  spell: { icon: '✨', label: 'Sort', plural: 'Sorts' },
  class: { icon: '🎓', label: 'Classe', plural: 'Classes' },
  race: { icon: '🧝', label: 'Race', plural: 'Races' },
  background: { icon: '📜', label: 'Historique', plural: 'Historiques' },
  item: { icon: '🎒', label: 'Objet', plural: 'Objets' },
  npc: { icon: '🧑‍🌾', label: 'PNJ', plural: 'PNJ' },
  place: { icon: '📍', label: 'Lieu', plural: 'Lieux' },
  table: { icon: '🎲', label: 'Table', plural: 'Tables' },
};

/** Nom traduit d'un type de compendium (singulier / pluriel). */
export const kindLabel = (k) => t(`kind.${k}`);
export const kindPlural = (k) => t(`kind.${k}.pl`);

export async function loadCompendium() {
  // Les joueurs ne reçoivent que les sorts (RLS) ; le MJ reçoit tout.
  const { data, error } = await backend.db
    .from('compendium')
    .select('*')
    .eq('campaign_id', campaignId())
    .order('name', { ascending: true });
  if (error) {
    console.warn('[compendium] chargement impossible:', error.message);
    return;
  }
  store.set({ compendium: data });
}

export async function createEntry(kind, name) {
  if (!store.get().isDM) return null;
  const row = {
    kind,
    name: String(name).trim() || 'Sans nom',
    data: kind === 'table' ? { desc: '', entries: [] } : { desc: '' },
    created_by: store.get().user?.id ?? null,
    campaign_id: campaignId(),
  };
  const { data, error } = await backend.db.from('compendium').insert(row).select().single();
  if (error) {
    console.error('[compendium] création échouée:', error.message);
    showToast(t('cmp.err.create'), { type: 'warn', icon: '⚠️' });
    return null;
  }
  store.set({ compendium: [...store.get().compendium, data] });
  return data.id;
}

export async function updateEntry(id, patch) {
  if (!store.get().isDM) return;
  // Optimiste.
  store.set({
    compendium: store.get().compendium.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  });
  const { error } = await backend.db
    .from('compendium')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[compendium] mise à jour échouée:', error.message);
    showToast(t('cmp.err.save'), { type: 'warn', icon: '⚠️' });
  }
}

export async function deleteEntry(id) {
  if (!store.get().isDM) return;
  const { error } = await backend.db.from('compendium').delete().eq('id', id);
  if (error) {
    console.error('[compendium] suppression échouée:', error.message);
    showToast(t('cmp.err.del'), { type: 'warn', icon: '⚠️' });
    return;
  }
  store.set({ compendium: store.get().compendium.filter((e) => e.id !== id) });
}

/** Ajoute un monstre du compendium au tracker de combat. */
export function monsterToCombat(entry) {
  const d = entry.data || {};
  addCombatant({
    name: entry.name,
    initiative: 0,
    hp: d.hp ?? '',
    hpMax: d.hpMax ?? d.hp ?? '',
    hpTemp: 0,
  });
}

/** Tire un résultat pondéré d'une table et le poste dans le chat/dés. */
export function rollTable(entry) {
  const entries = (entry.data?.entries || []).filter((r) => r && r.text);
  if (!entries.length) return null;
  const total = entries.reduce((s, r) => s + (Number(r.weight) || 1), 0);
  // RNG cryptographique (rejection sampling) pour l'uniformité.
  const buf = new Uint32Array(1);
  let pick;
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= Math.floor(0xffffffff / total) * total);
  let roll = (buf[0] % total) + 1;
  let chosen = entries[0];
  for (const r of entries) {
    roll -= Number(r.weight) || 1;
    if (roll <= 0) {
      chosen = r;
      break;
    }
  }
  return chosen.text;
}

/* ── Import SRD (dnd5eapi.co — SRD 5.1, règles 2014) ──────── */

const SRD_BASES = ['https://www.dnd5eapi.co/api/2014', 'https://www.dnd5eapi.co/api'];
let _srdBase = null;
const _srdCache = {};

async function srdFetch(path) {
  if (_srdBase) {
    const r = await fetch(_srdBase + path);
    if (!r.ok) throw new Error(`SRD ${r.status}`);
    return r.json();
  }
  let lastErr;
  for (const b of SRD_BASES) {
    try {
      const r = await fetch(b + path);
      if (r.ok) {
        _srdBase = b;
        return r.json();
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(t('cmp.err.srdUnavailable'));
}

/* Points d'entrée SRD par type. Le SRD 5.1 ne contient que les 9 races de base
 * et un seul historique (Acolyte) — les autres ne sont pas en contenu ouvert. */
const SRD_EP = { monster: '/monsters', spell: '/spells', class: '/classes', race: '/races', background: '/backgrounds' };

/** Liste (index+nom) d'un type SRD, mise en cache. */
export async function srdList(kind) {
  const ep = SRD_EP[kind] || '/spells';
  if (_srdCache[ep]) return _srdCache[ep];
  const data = await srdFetch(ep);
  _srdCache[ep] = data.results || [];
  return _srdCache[ep];
}

/* Squelette i18n du rendu SRD (la prose des entrées reste EN — source dnd5eapi).
 * Les libellés suivent toujours la locale ; le glossaire (taille/type/alignement/
 * vitesse) n'est localisé que si `fr` (sinon vocabulaire brut de l'API). */
const SIZE_KEY = { Tiny: 'tiny', Small: 'small', Medium: 'medium', Large: 'large', Huge: 'huge', Gargantuan: 'gargantuan' };
const loc = (ns, k) => { const key = `${ns}.${k}`; const v = t(key); return v === key ? k : v; };
const locSize = (s) => (SIZE_KEY[s] ? t('srd.size.' + SIZE_KEY[s]) : s || '');
const locType = (ty) => loc('srd.type', String(ty || '').toLowerCase()) || '';
const locSpeed = (k) => loc('srd.speed', k);
const locAlign = (a) => String(a || '').replace(/[a-z]+/gi, (w) => loc('srd.align', w.toLowerCase()));

function monsterFromSRD(d, fr = false) {
  const ac = Array.isArray(d.armor_class) ? d.armor_class[0]?.value : d.armor_class;
  const speed = Object.entries(d.speed || {})
    .map(([k, v]) => `${fr ? locSpeed(k) : k} ${v}`)
    .join(', ');
  const mod = (s) => Math.floor((s - 10) / 2);
  const sm = (s) => `${s} (${mod(s) >= 0 ? '+' : ''}${mod(s)})`;
  const md = [];
  const sz = fr ? locSize(d.size) : d.size || '';
  const ty = fr ? locType(d.type) : d.type || '';
  const al = fr ? locAlign(d.alignment) : d.alignment || '';
  md.push(`*${sz} ${ty}, ${al}*`);
  md.push(`**${t('srd.r.ac')}** ${ac} · **${t('srd.r.hp')}** ${d.hit_points} (${d.hit_dice || ''}) · **${t('srd.r.speed')}** ${speed}`);
  md.push(`**${t('srd.r.cr')}** ${d.challenge_rating}`);
  md.push(`${t('srd.r.str')} ${sm(d.strength)} · ${t('srd.r.dex')} ${sm(d.dexterity)} · ${t('srd.r.con')} ${sm(d.constitution)} · ${t('srd.r.int')} ${sm(d.intelligence)} · ${t('srd.r.wis')} ${sm(d.wisdom)} · ${t('srd.r.cha')} ${sm(d.charisma)}`);
  const section = (title, arr) => {
    if (!arr || !arr.length) return;
    md.push('', `### ${title}`);
    for (const a of arr) md.push(`**${a.name}.** ${a.desc || ''}`);
  };
  section(t('srd.r.traits'), d.special_abilities);
  section(t('srd.r.actions'), d.actions);
  section(t('srd.r.legendaryActions'), d.legendary_actions);
  return { name: d.name, data: { ac, hp: d.hit_points, hpMax: d.hit_points, cr: String(d.challenge_rating), desc: md.join('\n\n') } };
}

function spellFromSRD(d, fr = false) {
  const md = [];
  const school = d.school?.name ? (fr ? loc('srd.school', d.school.name.toLowerCase()) : d.school.name) : '';
  md.push(`*${t('srd.r.level')} ${d.level}${school ? ` — ${school}` : ''}${d.ritual ? ` (${t('srd.r.ritual')})` : ''}*`);
  md.push(`**${t('srd.r.castingTime')}** : ${d.casting_time} · **${t('srd.r.range')}** : ${d.range}`);
  md.push(`**${t('srd.r.components')}** : ${(d.components || []).join(', ')}${d.material ? ` (${d.material})` : ''}`);
  md.push(`**${t('srd.r.duration')}** : ${d.duration}${d.concentration ? ` (${t('srd.r.concentration')})` : ''}`);
  md.push('', ...(d.desc || []));
  if (d.higher_level?.length) md.push('', `**${t('srd.r.higherLevels')}** ${d.higher_level.join(' ')}`);
  const classes = (d.classes || []).map((c) => c.name).filter(Boolean);
  return { name: d.name, data: { desc: md.join('\n\n'), level: d.level, classes } };
}

function classFromSRD(d, levels = []) {
  const md = [];
  md.push(`**${t('srd.r.hitDie')}** : d${d.hit_die}`);
  const saves = (d.saving_throws || []).map((s) => s.name).join(', ');
  if (saves) md.push(`**${t('srd.r.saves')}** : ${saves}`);
  const profs = (d.proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**${t('srd.r.profs')}** : ${profs}`);
  if (d.spellcasting?.spellcasting_ability?.name) md.push(`**${t('srd.r.spellAbility')}** : ${d.spellcasting.spellcasting_ability.name}`);
  const subs = (d.subclasses || []).map((s) => s.name).join(', ');
  if (subs) md.push(`**${t('srd.r.subclasses')}** : ${subs}`);
  if (d.spellcasting?.info?.length) {
    md.push('', `### ${t('srd.r.spellcasting')}`);
    for (const i of d.spellcasting.info) md.push(`**${i.name}.** ${(i.desc || []).join(' ')}`);
  }
  // Aptitudes par niveau (noms uniquement, depuis /classes/{}/levels).
  const byLevel = (Array.isArray(levels) ? levels : [])
    .filter((l) => l && l.level && (l.features || []).length)
    .map((l) => `**${t('srd.r.levelN', { n: l.level })}** : ${l.features.map((f) => f.name).join(', ')}`);
  if (byLevel.length) {
    md.push('', `### ${t('srd.r.featuresByLevel')}`);
    md.push(...byLevel);
  }
  return { name: d.name, data: { desc: md.join('\n\n'), hitDie: d.hit_die } };
}

function raceFromSRD(d, traits = []) {
  const md = [];
  const ab = (d.ability_bonuses || []).map((b) => `${b.ability_score?.name || ''} +${b.bonus}`).join(' · ');
  md.push(`**${t('srd.r.abilityBonuses')}** : ${ab || '—'}`);
  md.push(`**${t('srd.r.size')}** : ${d.size || ''} · **${t('srd.r.speed')}** : ${d.speed} ft`);
  const langs = (d.languages || []).map((l) => l.name).join(', ');
  if (langs) md.push(`**${t('srd.r.languages')}** : ${langs}`);
  const profs = (d.starting_proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**${t('srd.r.profs')}** : ${profs}`);
  if (d.size_description) md.push('', d.size_description);
  if (d.age) md.push('', `**${t('srd.r.age')}.** ${d.age}`);
  if (d.alignment) md.push('', `**${t('srd.r.alignment')}.** ${d.alignment}`);
  if (d.language_desc) md.push('', `**${t('srd.r.languages')}.** ${d.language_desc}`);
  const tr = (traits || []).filter((tt) => tt && tt.name);
  if (tr.length) {
    md.push('', `### ${t('srd.r.racialTraits')}`);
    for (const tt of tr) md.push(`**${tt.name}.** ${(tt.desc || []).join(' ')}`);
  } else if ((d.traits || []).length) {
    md.push('', `### ${t('srd.r.racialTraits')}`, (d.traits || []).map((tt) => tt.name).join(', '));
  }
  const subs = (d.subraces || []).map((s) => s.name).join(', ');
  if (subs) md.push('', `**${t('srd.r.subraces')}** : ${subs}`);
  return { name: d.name, data: { desc: md.join('\n\n'), speed: d.speed } };
}

function backgroundFromSRD(d) {
  const md = [];
  const profs = (d.starting_proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**${t('srd.r.profs')}** : ${profs}`);
  if (d.language_options?.choose) md.push(`**${t('srd.r.languages')}** : ${t('srd.r.langChoose', { n: d.language_options.choose })}`);
  const equip = (d.starting_equipment || [])
    .map((e) => `${e.equipment?.name || ''}${e.quantity > 1 ? ` ×${e.quantity}` : ''}`)
    .filter(Boolean)
    .join(', ');
  if (equip) md.push(`**${t('srd.r.equipment')}** : ${equip}`);
  if (d.feature?.name) {
    md.push('', `### ${d.feature.name}`);
    md.push(...(d.feature.desc || []));
  }
  return { name: d.name, data: { desc: md.join('\n\n') } };
}

/** Récupère + mappe une entrée SRD en { name, data } (sans insertion). */
async function srdMapped(kind, index, opts = {}) {
  const ep = SRD_EP[kind] || '/spells';
  const d = await srdFetch(`${ep}/${index}`);
  if (kind === 'monster') return monsterFromSRD(d, opts.fr);
  if (kind === 'class') {
    let levels = [];
    try {
      levels = await srdFetch(`/classes/${index}/levels`);
    } catch {
      /* niveaux indisponibles : on garde le résumé de base */
    }
    return classFromSRD(d, levels);
  }
  if (kind === 'race') {
    // Descriptions complètes des traits raciaux (contenu SRD ouvert).
    let traits = [];
    try {
      traits = await Promise.all(
        (d.traits || []).map((t) => srdFetch(`/traits/${t.index}`).catch(() => ({ name: t.name })))
      );
    } catch {
      traits = (d.traits || []).map((t) => ({ name: t.name }));
    }
    return raceFromSRD(d, traits);
  }
  if (kind === 'background') return backgroundFromSRD(d);
  return spellFromSRD(d, opts.fr);
}

/** Importe une entrée SRD dans le compendium (MJ). opts.fr = vocabulaire localisé (sinon brut EN). */
export async function srdImport(kind, index, opts = {}) {
  if (!store.get().isDM) return null;
  const { name, data } = await srdMapped(kind, index, opts);
  const row = { kind, name, data, created_by: store.get().user?.id ?? null, campaign_id: campaignId() };
  const { data: ins, error } = await backend.db.from('compendium').insert(row).select().single();
  if (error) throw new Error(error.message);
  store.set({ compendium: [...store.get().compendium, ins] });
  return ins.id;
}

/**
 * Importe une liste d'entrées SRD en lot. Les entrées existantes (même nom +
 * type) sont **mises à jour** (niveau/classes/description rafraîchis) plutôt que
 * sautées. `onProgress(done, total, name)` est appelé après chacune.
 */
export async function srdImportMany(kind, items, opts = {}, onProgress) {
  if (!store.get().isDM) return { imported: 0, updated: 0, skipped: 0 };
  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const byName = new Map(
    store.get().compendium.filter((e) => e.kind === kind).map((e) => [e.name.toLowerCase(), e.id])
  );
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    try {
      const existingId = byName.get(it.name.toLowerCase());
      if (existingId) {
        const { data } = await srdMapped(kind, it.index, opts);
        await updateEntry(existingId, { data });
        updated++;
      } else {
        const id = await srdImport(kind, it.index, opts);
        if (id) byName.set(it.name.toLowerCase(), id);
        imported++;
      }
    } catch {
      skipped++;
    }
    onProgress?.(i + 1, items.length, it.name);
  }
  return { imported, updated, skipped };
}

let _cmpSubbed = false;
export function subscribeCompendium() {
  if (_cmpSubbed) return () => {}; // abonnement unique pour la session
  _cmpSubbed = true;
  const channel = backend.realtime
    .channel('compendium_feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'compendium' },
      (payload) => {
        if (!sameCampaign(payload)) return;
        const cur = store.get().compendium;
        if (payload.eventType === 'DELETE') {
          store.set({ compendium: cur.filter((e) => e.id !== payload.old.id) });
          return;
        }
        const row = payload.new;
        const existing = cur.find((e) => e.id === row.id);
        // Realtime peut renvoyer le jsonb `data` sous forme de chaîne (ou partiel) :
        // on le reparse, et à défaut on conserve les données déjà chargées pour ne
        // pas « vider » la fiche (desc, etc.) après une simple mise à jour de champ.
        let data = row.data;
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            data = null;
          }
        }
        const merged = { ...row, data: data ?? existing?.data ?? {} };
        store.set({
          compendium: existing ? cur.map((e) => (e.id === row.id ? merged : e)) : [...cur, merged],
        });
      }
    )
    .subscribe();
  return () => backend.realtime.removeChannel(channel);
}
