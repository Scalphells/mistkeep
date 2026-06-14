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
    showToast('Échec de la création de l’entrée — vérifie ta connexion.', { type: 'warn', icon: '⚠️' });
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
    showToast('Échec de l’enregistrement de l’entrée — vérifie ta connexion.', { type: 'warn', icon: '⚠️' });
  }
}

export async function deleteEntry(id) {
  if (!store.get().isDM) return;
  const { error } = await backend.db.from('compendium').delete().eq('id', id);
  if (error) {
    console.error('[compendium] suppression échouée:', error.message);
    showToast('Échec de la suppression de l’entrée.', { type: 'warn', icon: '⚠️' });
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
  throw lastErr || new Error('SRD indisponible');
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

/* Glossaire FR pour traduire le squelette des fiches SRD (la prose reste EN). */
const FR = {
  size: { Tiny: 'Très petit', Small: 'Petit', Medium: 'Moyen', Large: 'Grand', Huge: 'Très grand', Gargantuan: 'Gigantesque' },
  speed: { walk: 'marche', fly: 'vol', swim: 'nage', climb: 'escalade', burrow: 'fouissement', hover: 'vol stationnaire' },
  school: { Abjuration: 'Abjuration', Conjuration: 'Invocation', Divination: 'Divination', Enchantment: 'Enchantement', Evocation: 'Évocation', Illusion: 'Illusion', Necromancy: 'Nécromancie', Transmutation: 'Transmutation' },
  type: { aberration: 'aberration', beast: 'bête', celestial: 'céleste', construct: 'créature artificielle', dragon: 'dragon', elemental: 'élémentaire', fey: 'fée', fiend: 'fiélon', giant: 'géant', humanoid: 'humanoïde', monstrosity: 'monstruosité', ooze: 'vase', plant: 'plante', undead: 'mort-vivant' },
  align: { lawful: 'loyal', chaotic: 'chaotique', neutral: 'neutre', good: 'bon', evil: 'mauvais', any: 'quelconque', alignment: 'alignement', unaligned: 'sans alignement' },
};
const frType = (t) => FR.type[String(t || '').toLowerCase()] || t || '';
const frSize = (s) => FR.size[s] || s || '';
const frAlign = (a) => String(a || '').replace(/[a-z]+/gi, (w) => FR.align[w.toLowerCase()] || w);

function monsterFromSRD(d, fr = false) {
  const ac = Array.isArray(d.armor_class) ? d.armor_class[0]?.value : d.armor_class;
  const speed = Object.entries(d.speed || {})
    .map(([k, v]) => `${fr ? FR.speed[k] || k : k} ${v}`)
    .join(', ');
  const mod = (s) => Math.floor((s - 10) / 2);
  const sm = (s) => `${s} (${mod(s) >= 0 ? '+' : ''}${mod(s)})`;
  const md = [];
  const sz = fr ? frSize(d.size) : d.size || '';
  const ty = fr ? frType(d.type) : d.type || '';
  const al = fr ? frAlign(d.alignment) : d.alignment || '';
  md.push(`*${sz} ${ty}, ${al}*`);
  md.push(`**CA** ${ac} · **PV** ${d.hit_points} (${d.hit_dice || ''}) · **Vitesse** ${speed}`);
  md.push(`**FP** ${d.challenge_rating}`);
  md.push(`FOR ${sm(d.strength)} · DEX ${sm(d.dexterity)} · CON ${sm(d.constitution)} · INT ${sm(d.intelligence)} · SAG ${sm(d.wisdom)} · CHA ${sm(d.charisma)}`);
  const section = (title, arr) => {
    if (!arr || !arr.length) return;
    md.push('', `### ${title}`);
    for (const a of arr) md.push(`**${a.name}.** ${a.desc || ''}`);
  };
  section('Capacités', d.special_abilities);
  section('Actions', d.actions);
  section('Actions légendaires', d.legendary_actions);
  return { name: d.name, data: { ac, hp: d.hit_points, hpMax: d.hit_points, cr: String(d.challenge_rating), desc: md.join('\n\n') } };
}

function spellFromSRD(d, fr = false) {
  const md = [];
  const school = d.school?.name ? (fr ? FR.school[d.school.name] || d.school.name : d.school.name) : '';
  md.push(`*Niveau ${d.level}${school ? ` — ${school}` : ''}${d.ritual ? ' (rituel)' : ''}*`);
  md.push(`**Incantation** : ${d.casting_time} · **Portée** : ${d.range}`);
  md.push(`**Composantes** : ${(d.components || []).join(', ')}${d.material ? ` (${d.material})` : ''}`);
  md.push(`**Durée** : ${d.duration}${d.concentration ? ' (concentration)' : ''}`);
  md.push('', ...(d.desc || []));
  if (d.higher_level?.length) md.push('', `**Aux niveaux supérieurs.** ${d.higher_level.join(' ')}`);
  const classes = (d.classes || []).map((c) => c.name).filter(Boolean);
  return { name: d.name, data: { desc: md.join('\n\n'), level: d.level, classes } };
}

function classFromSRD(d, levels = []) {
  const md = [];
  md.push(`**Dé de vie** : d${d.hit_die}`);
  const saves = (d.saving_throws || []).map((s) => s.name).join(', ');
  if (saves) md.push(`**Jets de sauvegarde** : ${saves}`);
  const profs = (d.proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**Maîtrises** : ${profs}`);
  if (d.spellcasting?.spellcasting_ability?.name) md.push(`**Caractéristique d'incantation** : ${d.spellcasting.spellcasting_ability.name}`);
  const subs = (d.subclasses || []).map((s) => s.name).join(', ');
  if (subs) md.push(`**Sous-classes** : ${subs}`);
  if (d.spellcasting?.info?.length) {
    md.push('', '### Incantation');
    for (const i of d.spellcasting.info) md.push(`**${i.name}.** ${(i.desc || []).join(' ')}`);
  }
  // Aptitudes par niveau (noms uniquement, depuis /classes/{}/levels).
  const byLevel = (Array.isArray(levels) ? levels : [])
    .filter((l) => l && l.level && (l.features || []).length)
    .map((l) => `**Niv. ${l.level}** : ${l.features.map((f) => f.name).join(', ')}`);
  if (byLevel.length) {
    md.push('', '### Aptitudes par niveau');
    md.push(...byLevel);
  }
  return { name: d.name, data: { desc: md.join('\n\n'), hitDie: d.hit_die } };
}

function raceFromSRD(d, traits = []) {
  const md = [];
  const ab = (d.ability_bonuses || []).map((b) => `${b.ability_score?.name || ''} +${b.bonus}`).join(' · ');
  md.push(`**Bonus de caractéristiques** : ${ab || '—'}`);
  md.push(`**Taille** : ${d.size || ''} · **Vitesse** : ${d.speed} ft`);
  const langs = (d.languages || []).map((l) => l.name).join(', ');
  if (langs) md.push(`**Langues** : ${langs}`);
  const profs = (d.starting_proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**Maîtrises** : ${profs}`);
  if (d.size_description) md.push('', d.size_description);
  if (d.age) md.push('', `**Âge.** ${d.age}`);
  if (d.alignment) md.push('', `**Alignement.** ${d.alignment}`);
  if (d.language_desc) md.push('', `**Langues.** ${d.language_desc}`);
  const tr = (traits || []).filter((t) => t && t.name);
  if (tr.length) {
    md.push('', '### Traits raciaux');
    for (const t of tr) md.push(`**${t.name}.** ${(t.desc || []).join(' ')}`);
  } else if ((d.traits || []).length) {
    md.push('', '### Traits raciaux', (d.traits || []).map((t) => t.name).join(', '));
  }
  const subs = (d.subraces || []).map((s) => s.name).join(', ');
  if (subs) md.push('', `**Sous-races** : ${subs}`);
  return { name: d.name, data: { desc: md.join('\n\n'), speed: d.speed } };
}

function backgroundFromSRD(d) {
  const md = [];
  const profs = (d.starting_proficiencies || []).map((p) => p.name).join(', ');
  if (profs) md.push(`**Maîtrises** : ${profs}`);
  if (d.language_options?.choose) md.push(`**Langues** : ${d.language_options.choose} au choix`);
  const equip = (d.starting_equipment || [])
    .map((e) => `${e.equipment?.name || ''}${e.quantity > 1 ? ` ×${e.quantity}` : ''}`)
    .filter(Boolean)
    .join(', ');
  if (equip) md.push(`**Équipement** : ${equip}`);
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

/** Importe une entrée SRD dans le compendium (MJ). opts.fr = libellés en FR. */
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
