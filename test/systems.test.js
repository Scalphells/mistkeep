import { describe, it, expect } from 'vitest';
import { getSystem, listSystems, DEFAULT_SYSTEM } from '../src/lib/systems/index.js';
import { dnd5e2014 } from '../src/lib/systems/dnd5e2014.js';
import { custom, setCustomConfig, normalizeConfig, normalizeTestDie, slugKey } from '../src/lib/systems/custom.js';
import { dnd5e2024 } from '../src/lib/systems/dnd5e2024.js';
import { pf2e } from '../src/lib/systems/pf2e.js';

describe('registre de systèmes', () => {
  it('expose D&D 5e 2014 comme système par défaut', () => {
    expect(DEFAULT_SYSTEM).toBe('dnd5e-2014');
    expect(getSystem('dnd5e-2014')).toBe(dnd5e2014);
  });

  it('retombe sur le système par défaut si inconnu ou vide', () => {
    expect(getSystem(undefined)).toBe(dnd5e2014);
    expect(getSystem('systeme-inconnu')).toBe(dnd5e2014);
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

describe('descripteur dnd5e-2024', () => {
  it('est enregistré et réutilise les maths 2014', () => {
    expect(getSystem('dnd5e-2024')).toBe(dnd5e2024);
    expect(dnd5e2024.abilities).toBe(dnd5e2014.abilities);
    expect(dnd5e2024.skills).toBe(dnd5e2014.skills);
    expect(dnd5e2024.sheet).toBe(dnd5e2014.sheet);
    expect(dnd5e2024.createDefaults().system).toBe('dnd5e-2024');
  });

  it('espèces 2024 : neuf, sans bonus de caractéristiques', () => {
    expect(dnd5e2024.srd.races).toHaveLength(9);
    expect(dnd5e2024.srd.races.every((r) => Object.keys(r.ability).length === 0)).toBe(true);
    expect(dnd5e2024.srd.races.map((r) => r.key)).toEqual(
      expect.arrayContaining(['goliath', 'orc', 'humain', 'drakeide'])
    );
    expect(dnd5e2024.srd.racesLabel).toBe('Espèce');
  });

  it('historiques 2024 : quatre, porteurs des +2/+1 et du don d’origine', () => {
    expect(dnd5e2024.srd.backgrounds.map((b) => b.key)).toEqual(['acolyte', 'criminel', 'erudit', 'soldat']);
    expect(dnd5e2024.srd.backgrounds.every((b) => b.feature.desc.includes('+2/+1'))).toBe(true);
  });

  it('douze classes, une sous-classe SRD 5.2 chacune', () => {
    expect(dnd5e2024.srd.classes).toHaveLength(12);
    expect(dnd5e2024.srd.classes.every((c) => c.subclasses.length === 1)).toBe(true);
    expect(dnd5e2024.srd.subclasses['Champion'].classKey).toBe('guerrier');
    expect(dnd5e2024.srd.subclasses['Évocateur'].classKey).toBe('magicien');
    expect(Object.keys(dnd5e2024.srd.subclasses)).toHaveLength(12);
    // Les stats de base (DV, sauvegardes, incantation) restent celles de 2014.
    const barb = dnd5e2024.srd.classes.find((c) => c.key === 'barbare');
    expect(barb.hd).toBe(12);
    expect(barb.saves).toEqual(['str', 'con']);
  });

  it('aptitudes de classe 2024 : niveau 1 rempli, dont les nouveautés 2024', () => {
    const byKey = Object.fromEntries(dnd5e2024.srd.classes.map((c) => [c.key, c]));
    // Toutes les classes ont des aptitudes de niveau 1.
    expect(dnd5e2024.srd.classes.every((c) => c.features.length > 0)).toBe(true);
    // Maîtrise d'armes : nouveauté 2024 des classes martiales.
    const names = (k) => byKey[k].features.map((f) => f.name).join(' | ');
    expect(names('barbare')).toMatch(/Maîtrise d’armes/);
    expect(names('guerrier')).toMatch(/Maîtrise d’armes/);
    // Incantation avancée au niveau 1 en 2024 pour paladin et rôdeur.
    expect(names('paladin')).toMatch(/Incantation/);
    expect(names('rodeur')).toMatch(/Incantation/);
    // Un non-martial n'a pas la Maîtrise d'armes.
    expect(names('magicien')).not.toMatch(/Maîtrise d’armes/);
  });

  it('aptitudes de sous-classe 2024 : remplies, débloquées au niveau 3', () => {
    const subs = Object.values(dnd5e2024.srd.subclasses);
    expect(subs.every((s) => s.features.length > 0)).toBe(true);
    // Toutes les sous-classes 2024 ouvrent au niveau 3.
    expect(subs.every((s) => s.features.some((f) => f.level === 3))).toBe(true);
    expect(subs.every((s) => s.features.every((f) => f.level >= 3))).toBe(true);
    expect(dnd5e2024.srd.subclasses['Champion'].features.find((f) => f.name === 'Critique amélioré').level).toBe(3);
  });
});

describe('descripteur pf2e', () => {
  it('est enregistré : 16 compétences, sauvegardes nommées, 5 rangs, fiche sans sorts', () => {
    expect(getSystem('pf2e')).toBe(pf2e);
    expect(Object.keys(pf2e.skills)).toHaveLength(16);
    expect(pf2e.saves.map((s) => s.key)).toEqual(['fort', 'ref', 'will', 'per']);
    expect(pf2e.profRanks).toHaveLength(5);
    expect(pf2e.sheet.tabs).not.toContain('spells');
    expect(pf2e.sheet.rail).not.toContain('hitdice');
  });

  it('maîtrise pf2e : +2 par rang, plus le niveau si entraîné', () => {
    const d = { dex: 14, lvl: 5, ranks: { acrobaties: 2 } }; // Expert
    expect(pf2e.skillBonus(d, 'acrobaties')).toBe(2 + 4 + 5); // mod + rang + niveau
    expect(pf2e.skillBonus({ ...d, ranks: {} }, 'acrobaties')).toBe(2); // inexpérimenté : mod seul
    expect(pf2e.saveBonus({ con: 12, lvl: 3, ranks: { fort: 3 } }, 'fort')).toBe(1 + 6 + 3); // Maître
    expect(pf2e.saveBonus({ wis: 10, lvl: 1, ranks: {} }, 'will')).toBe(0);
    expect(pf2e.skillBonus({}, 'stealth')).toBe(0); // clé 5e inconnue ici
  });

  it('createDefaults : Qualifié aux sauvegardes et en Perception', () => {
    const d = pf2e.createDefaults();
    expect(d.system).toBe('pf2e');
    expect(d.ranks).toEqual({ fort: 1, ref: 1, will: 1, per: 1 });
    expect(d.slots).toBeUndefined();
    expect(pf2e.saveBonus(d, 'fort')).toBe(0 + 2 + 1); // Qualifié niveau 1
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

  it('normalizeTestDie : normalise les formules valides, rejette le reste', () => {
    expect(normalizeTestDie('1d20')).toBe('1d20');
    expect(normalizeTestDie('d100')).toBe('1d100'); // count implicite
    expect(normalizeTestDie(' 2D6 ')).toBe('2d6'); // casse + espaces
    expect(normalizeTestDie('3d6')).toBe('3d6');
    expect(normalizeTestDie('0d6')).toBe(''); // bornes
    expect(normalizeTestDie('11d6')).toBe('');
    expect(normalizeTestDie('1d1')).toBe('');
    expect(normalizeTestDie('1d2000')).toBe('');
    expect(normalizeTestDie('1d20+5')).toBe(''); // pas de modificateur ici
    expect(normalizeTestDie('patate')).toBe('');
    expect(normalizeTestDie('')).toBe('');
  });

  it('testDie : configurable par campagne, d20 par défaut', () => {
    expect(custom.testDie).toBe('1d20'); // sans config
    setCustomConfig({ abilities: [{ key: 'force', label: 'FOR' }], skills: {}, testDie: 'd100' });
    expect(custom.testDie).toBe('1d100');
    setCustomConfig({ abilities: [{ key: 'force', label: 'FOR' }], skills: {}, testDie: 'n importe quoi' });
    expect(custom.testDie).toBe('1d20'); // invalide → repli d20
    setCustomConfig(null);
    expect(custom.testDie).toBe('1d20');
    // Les autres systèmes n'exposent pas de testDie : le d20 reste implicite.
    expect(dnd5e2014.testDie).toBeUndefined();
  });
});

describe('jets & combat multi-système (saveOptions / initBonus / encounterBudget)', () => {
  it('saveOptions : caractéristiques en 5e/Libre, sauvegardes nommées en pf2e', () => {
    // 5e (2014/2024) : un jet de sauvegarde par caractéristique.
    expect(dnd5e2014.saveOptions).toBe(dnd5e2014.abilities);
    expect(dnd5e2024.saveOptions).toBe(dnd5e2024.abilities);
    expect(dnd5e2014.saveOptions.map((o) => o.key)).toEqual(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    // pf2e : Vigueur / Réflexes / Volonté / Perception.
    expect(pf2e.saveOptions).toBe(pf2e.saves);
    expect(pf2e.saveOptions.map((o) => o.key)).toEqual(['fort', 'ref', 'will', 'per']);
    // Libre : suit les caractéristiques configurées de la campagne.
    expect(custom.saveOptions).toHaveLength(6); // défauts
    setCustomConfig({ abilities: [{ key: 'force', label: 'FOR' }, { key: 'ruse', label: 'RUSE' }], skills: {} });
    expect(custom.saveOptions.map((o) => o.key)).toEqual(['force', 'ruse']);
    setCustomConfig(null);
  });

  it('initBonus : Dex en 5e, Perception en pf2e, bonus de fiche en Libre', () => {
    // 5e : modificateur de Dextérité ; carac absente → 0 (pas de NaN).
    expect(dnd5e2014.initBonus({ dex: 16 })).toBe(3);
    expect(dnd5e2014.initBonus({ dex: 7 })).toBe(-2);
    expect(dnd5e2014.initBonus({})).toBe(0);
    expect(dnd5e2024.initBonus({ dex: 14 })).toBe(2);
    // pf2e : Perception (mod. de Sagesse + rang + niveau si entraîné).
    expect(pf2e.initBonus({ wis: 14, lvl: 3, ranks: { per: 1 } })).toBe(2 + 2 + 3);
    expect(pf2e.initBonus(pf2e.createDefaults())).toBe(0 + 2 + 1); // Qualifié niveau 1
    // Libre : le bonus saisi sur la fiche, rien d'imposé.
    expect(custom.initBonus({ initB: 3 })).toBe(3);
    expect(custom.initBonus({})).toBe(0);
  });

  it('encounterBudget : chiffrage réservé à D&D 5e', () => {
    expect(dnd5e2014.encounterBudget).toBe(true);
    expect(dnd5e2024.encounterBudget).toBe(true);
    expect(pf2e.encounterBudget).toBeFalsy();
    expect(custom.encounterBudget).toBeFalsy();
  });
});
