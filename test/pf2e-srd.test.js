import { describe, it, expect } from 'vitest';
import {
  ANCESTRIES, BACKGROUNDS_PF2E, CLASSES_PF2E,
  ancestryByLabel, classByLabelPf2e, backgroundByLabelPf2e,
  deriveAncestryPatch, deriveClassPatchPf2e, deriveBackgroundPatchPf2e, pf2eHpMax,
  pf2eManagedLines,
} from '../src/lib/pf2e-srd.js';
import { pf2e } from '../src/lib/systems/pf2e.js';

describe('contenu pf2e (Player Core)', () => {
  it('8 ascendances bien formées', () => {
    expect(ANCESTRIES).toHaveLength(8);
    for (const a of ANCESTRIES) {
      expect(typeof a.hp).toBe('number');
      expect(['P', 'M']).toContain(a.size);
      expect(a.speed).toBeGreaterThan(0);
      expect(Array.isArray(a.boosts)).toBe(true);
    }
    const nain = ancestryByLabel('Nain');
    expect(nain.hp).toBe(10);
    expect(nain.size).toBe('M');
    expect(nain.speed).toBe(6); // 20 ft
    expect(nain.darkvision).toBe(18);
    expect(nain.boosts).toEqual(['con', 'wis']);
    // Humain et Orc (Player Core) : deux boosts libres, aucun fixe.
    expect(ancestryByLabel('Humain').boosts).toEqual([]);
    expect(ancestryByLabel('Humain').free).toBe(2);
    expect(ancestryByLabel('Orc').boosts).toEqual([]);
    expect(ancestryByLabel('Orc').free).toBe(2);
  });

  it('12 classes avec attribut clé, PV et rangs de départ', () => {
    expect(CLASSES_PF2E).toHaveLength(12);
    const f = classByLabelPf2e('Guerrier');
    expect(f.hp).toBe(10);
    expect(f.keyAbility).toEqual(['str', 'dex']);
    expect(f.saves).toEqual({ fort: 2, ref: 2, will: 1 }); // Fort/Réf experts, Vol qualifié
    expect(f.perception).toBe(2); // Expert
    const w = classByLabelPf2e('Magicien');
    expect(w.hp).toBe(6);
    expect(w.keyAbility).toEqual(['int']);
    const b = classByLabelPf2e('Barbare');
    expect(b.hp).toBe(12);
  });

  it('historiques : boosts + compétence entraînée', () => {
    const sold = backgroundByLabelPf2e('Soldat');
    expect(sold.boosts).toEqual(['str', 'con']);
    expect(sold.skills).toContain('athletisme');
  });
});

describe('dérivations pf2e (pures)', () => {
  it('deriveAncestryPatch : taille/vitesse/vision + PV d’ascendance', () => {
    const r = deriveAncestryPatch({}, ancestryByLabel('Elfe'));
    expect(r.patch).toEqual({ size: 'M', spd: 9, darkvision: 0 });
    expect(r.ancestryHp).toBe(6);
    expect(r.boosts).toEqual(['dex', 'int']);
    expect(r.traitsText.length).toBeGreaterThan(0);
    expect(deriveAncestryPatch({}, null)).toBeNull();
  });

  it('deriveClassPatchPf2e : PV de classe, rangs, compétences, attribut clé', () => {
    const r = deriveClassPatchPf2e({}, classByLabelPf2e('Roublard'));
    expect(r.classHp).toBe(8);
    expect(r.ranks).toEqual({ per: 2, fort: 1, ref: 2, will: 2 });
    expect(r.skillsTrained).toBe(7);
    expect(r.keyAbility).toEqual(['dex']);
    expect(deriveClassPatchPf2e({}, null)).toBeNull();
  });

  it('deriveBackgroundPatchPf2e : boosts + compétences entraînées', () => {
    const r = deriveBackgroundPatchPf2e({}, backgroundByLabelPf2e('Érudit'));
    expect(r.boosts).toEqual(['int', 'wis']);
    expect(r.trainedSkills).toEqual(['arcanes']);
  });

  it('pf2eHpMax : ascendance + (classe + mod. CON) × niveau', () => {
    // Nain (10) + Guerrier (10) + CON 14 (+2), niveau 1 puis 3.
    expect(pf2eHpMax(10, 10, 1, 14)).toBe(22);
    expect(pf2eHpMax(10, 10, 3, 14)).toBe(46);
    // CON faible : le « par niveau » ne descend pas sous 0, total au moins 1.
    expect(pf2eHpMax(6, 6, 1, 1)).toBe(6 + Math.max(0, 6 - 5)); // CON 1 → mod −5, perLvl=1
    expect(pf2eHpMax(0, 0, 1, 1)).toBe(1);
  });
});

describe('pf2eManagedLines (bloc d’aptitudes idempotent)', () => {
  const lk = { ancestryByLabel, classByLabel: classByLabelPf2e, backgroundByLabel: backgroundByLabelPf2e };

  it('compose traits d’ascendance, aptitudes de classe, historique et boosts', () => {
    const lines = pf2eManagedLines({ race: 'Nain', cls: 'Guerrier', bg: 'Soldat' }, lk).join('\n');
    expect(lines).toMatch(/Vision dans le noir/); // trait du nain
    expect(lines).toMatch(/Boosts d'ascendance : \+2 CON, SAG/);
    expect(lines).toMatch(/Maîtrise d’arme/); // aptitude du guerrier
    expect(lines).toMatch(/Attribut clé : FOR, DEX \(au choix\)/);
    expect(lines).toMatch(/Historique —/);
  });

  it('ne renvoie rien pour des entrées inconnues', () => {
    expect(pf2eManagedLines({ race: 'Inconnu', cls: 'Xyz' }, lk)).toEqual([]);
  });
});

describe('descripteur pf2e : contenu exposé', () => {
  it('expose ascendances/classes/historiques et dérivations', () => {
    expect(pf2e.content.ancestries).toBe(ANCESTRIES);
    expect(pf2e.content.classes).toHaveLength(12);
    expect(pf2e.content.ancestryByLabel('Orc').hp).toBe(10);
    expect(pf2e.content.hpMax(10, 10, 1, 10)).toBe(20); // CON 10 → +0
    expect(pf2e.content.ancestriesLabel).toBe('Ascendance');
  });
});
