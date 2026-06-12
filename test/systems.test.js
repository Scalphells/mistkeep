import { describe, it, expect } from 'vitest';
import { getSystem, listSystems, DEFAULT_SYSTEM } from '../src/lib/systems/index.js';
import { dnd5e2014 } from '../src/lib/systems/dnd5e2014.js';
import { custom, setCustomConfig, normalizeConfig, slugKey } from '../src/lib/systems/custom.js';

describe('registre de systèmes', () => {
  it('expose D&D 5e 2014 comme système par défaut', () => {
    expect(DEFAULT_SYSTEM).toBe('dnd5e-2014');
    expect(getSystem('dnd5e-2014')).toBe(dnd5e2014);
  });

  it('retombe sur le système par défaut si inconnu ou vide', () => {
    expect(getSystem(undefined)).toBe(dnd5e2014);
    expect(getSystem('pf2e')).toBe(dnd5e2014); // pas encore implémenté
  });

  it('expose le système Libre (custom)', () => {
    expect(getSystem('custom')).toBe(custom);
    expect(listSystems().map((s) => s.id)).toContain('custom');
  });

  it('listSystems renvoie { id, label }', () => {
    expect(listSystems()).toContainEqual({ id: 'dnd5e-2014', label: 'D&D 5e (2014)' });
  });
});

describe('descripteur dnd5e-2014', () => {
  it('caractéristiques et compétences', () => {
    expect(dnd5e2014.abilities.map((a) => a.key)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    expect(Object.keys(dnd5e2014.skills)).toHaveLength(18);
    expect(dnd5e2014.skills.stealth).toEqual({ label: 'Discrétion', ability: 'dex' });
  });

  it('calculs dérivés (mod, sauvegarde, compétence)', () => {
    expect(dnd5e2014.abilityMod(14)).toBe(2);
    expect(dnd5e2014.fmtMod(2)).toBe('+2');
    expect(dnd5e2014.fmtMod(-1)).toBe('-1');
    // Sauvegarde : mod (+ maîtrise si la carac est maîtrisée).
    expect(dnd5e2014.saveBonus({ con: 14, prof: 2, saves: ['con'] }, 'con')).toBe(4);
    expect(dnd5e2014.saveBonus({ con: 14, prof: 2, saves: [] }, 'con')).toBe(2);
    // Compétence : mod + maîtrise, doublée si expertise.
    expect(dnd5e2014.skillBonus({ dex: 14, prof: 2, profs: ['stealth'] }, 'stealth')).toBe(4);
    expect(dnd5e2014.skillBonus({ dex: 14, prof: 2, exp: ['stealth'], profs: [] }, 'stealth')).toBe(6);
  });

  it('déclare le schéma de sections de sa fiche', () => {
    expect(dnd5e2014.sheet.tabs).toEqual(['stats', 'combat', 'spells', 'feats', 'inv', 'story', 'notes']);
    expect(dnd5e2014.sheet.rail).toEqual(['hp', 'hitdice', 'stats', 'extras', 'saves']);
    expect(dnd5e2014.sheet.identity).toBe('srd5e');
  });

  it('createDefaults : fiche 5e neuve cohérente', () => {
    const d = dnd5e2014.createDefaults();
    expect(d.lvl).toBe(1);
    expect(d.system).toBe('dnd5e-2014');
    expect(d.hdSize).toBe(8);
    expect(d.size).toBe('M');
    expect(d.str).toBe(10);
    expect(Array.isArray(d.saves)).toBe(true);
    // Instances indépendantes (pas de partage de référence entre fiches).
    expect(dnd5e2014.createDefaults()).not.toBe(d);
  });
});

describe('descripteur custom (Libre)', () => {
  it('déclare une fiche générique : pas de sorts, pas de dés de vie, identité libre', () => {
    expect(custom.sheet.tabs).not.toContain('spells');
    expect(custom.sheet.tabs).toContain('stats');
    expect(custom.sheet.rail).not.toContain('hitdice');
    expect(custom.sheet.identity).toBe('free');
  });

  it('createDefaults : blob Libre cohérent (sans bagage 5e)', () => {
    const d = custom.createDefaults();
    expect(d.system).toBe('custom');
    expect(d.phy).toBe(10);
    expect(d.slots).toBeUndefined();
    expect(d.sc).toBeUndefined();
  });

  it('calculs dérivés sur ses propres caractéristiques/compétences', () => {
    expect(custom.abilityMod(14)).toBe(2);
    expect(custom.abilityMod(undefined)).toBe(0); // score absent = 10
    expect(custom.saveBonus({ vol: 12, prof: 3, saves: ['vol'] }, 'vol')).toBe(4);
    expect(custom.skillBonus({ agi: 14, prof: 2, profs: ['discretion'] }, 'discretion')).toBe(4);
    expect(custom.skillBonus({ per: 14, prof: 2, exp: ['observation'], profs: [] }, 'observation')).toBe(6);
    expect(custom.skillBonus({}, 'stealth')).toBe(0); // compétence 5e inconnue ici
  });
});

describe('config par campagne du système Libre', () => {
  it('slugKey : translittère et borne les libellés', () => {
    expect(slugKey('Émotion !')).toBe('emotion');
    expect(slugKey('hp')).toBe(''); // clé de fiche réservée
    expect(slugKey('<script>')).toBe('script');
  });

  it('normalizeConfig : assainit libellés, rejette réservées/doublons/orphelines', () => {
    const cfg = normalizeConfig({
      abilities: [
        { key: 'Émotion!', label: '<b>ÉMO</b>' },
        { key: 'hp', label: 'PV' }, // clé réservée → rejetée
        { key: 'emotion', label: 'DOUBLE' }, // doublon → rejeté
      ],
      skills: {
        'Vol à la tire': { label: 'Vol à la tire', ability: 'emotion' },
        cassee: { label: 'X', ability: 'inconnue' }, // caractéristique inconnue → rejetée
      },
    });
    expect(cfg.abilities).toHaveLength(1);
    expect(cfg.abilities[0].key).toBe('emotion');
    expect(cfg.abilities[0].label).not.toContain('<');
    expect(Object.keys(cfg.skills)).toEqual(['volalatire']);
    expect(normalizeConfig({ abilities: [] })).toBeNull();
  });

  it('setCustomConfig pilote les accesseurs du descripteur et createDefaults', () => {
    setCustomConfig({
      abilities: [{ key: 'force', label: 'FOR' }, { key: 'ruse', label: 'RUSE' }],
      skills: { epee: { label: 'Épée', ability: 'force' } },
    });
    expect(custom.abilities.map((a) => a.key)).toEqual(['force', 'ruse']);
    expect(Object.keys(custom.skills)).toEqual(['epee']);
    expect(custom.createDefaults().force).toBe(10);
    expect(custom.skillBonus({ force: 14, prof: 2, profs: ['epee'] }, 'epee')).toBe(4);
    setCustomConfig(null); // retour aux défauts génériques
    expect(custom.abilities).toHaveLength(6);
    expect(Object.keys(custom.skills)).toContain('discretion');
  });
});
