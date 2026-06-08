import { describe, it, expect } from 'vitest';
import {
  abilityMod,
  resolveNotation,
  classResources,
  resolveDeathSave,
  longRestHitDiceRegain,
  hpAfter,
  baseName,
} from '../src/lib/rules.js';

describe('abilityMod', () => {
  it('calcule floor((score-10)/2)', () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(16)).toBe(3);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(15)).toBe(2);
  });
});

describe('resolveNotation', () => {
  const data = { sc: 'wis', wis: 16, prof: 3, str: 14, dex: 10 }; // MOD=+3, PROF=3, FOR=+2

  it('remplace MOD (caractéristique d’incantation) dans un dé', () => {
    expect(resolveNotation('1d8+MOD', data)).toBe('1d8+3');
  });
  it('combine plusieurs constantes', () => {
    expect(resolveNotation('2d6+MOD+1', data)).toBe('2d6+4');
  });
  it('gère PROF et les caractéristiques explicites', () => {
    expect(resolveNotation('MOD+PROF', data)).toBe('6'); // 3+3, sans dé → somme
    expect(resolveNotation('1d4+FOR', data)).toBe('1d4+2');
  });
  it('laisse une notation sans jeton inchangée', () => {
    expect(resolveNotation('3d6', data)).toBe('3d6');
    expect(resolveNotation('2d8-1', data)).toBe('2d8-1');
  });
  it('MOD vaut 0 si aucune caractéristique d’incantation', () => {
    expect(resolveNotation('1d8+MOD', {})).toBe('1d8');
  });
});

describe('classResources', () => {
  it('Moine → Ki = niveau', () => {
    const r = classResources({ cls: 'Moine', lvl: 3 });
    expect(r).toEqual([{ name: 'Ki', max: 3, used: 0, reset: 'short' }]);
  });
  it('Barbare → Rage selon le niveau', () => {
    expect(classResources({ cls: 'Barbare', lvl: 1 })[0].max).toBe(2);
    expect(classResources({ cls: 'Barbare', lvl: 6 })[0].max).toBe(4);
  });
  it('Classe sans ressource type → vide', () => {
    expect(classResources({ cls: 'Roublard', lvl: 5 })).toEqual([]);
  });
});

describe('resolveDeathSave', () => {
  it('10+ ajoute une réussite', () => {
    expect(resolveDeathSave({ s: 0, f: 0 }, 12)).toMatchObject({ ds: { s: 1, f: 0 }, stable: false, dead: false });
  });
  it('<10 ajoute un échec', () => {
    expect(resolveDeathSave({ s: 1, f: 1 }, 7)).toMatchObject({ ds: { s: 1, f: 2 } });
  });
  it('1 ajoute deux échecs et peut tuer', () => {
    expect(resolveDeathSave({ s: 0, f: 1 }, 1)).toMatchObject({ ds: { s: 0, f: 3 }, dead: true });
  });
  it('20 réanime à 1 PV (ds remis à zéro)', () => {
    expect(resolveDeathSave({ s: 2, f: 2 }, 20)).toEqual({ ds: null, revived: true, stable: false, dead: false });
  });
  it('3e réussite = stabilisé', () => {
    expect(resolveDeathSave({ s: 2, f: 0 }, 15)).toMatchObject({ stable: true, dead: false });
  });
  it('plafonne à 3 (pas de débordement)', () => {
    expect(resolveDeathSave({ s: 0, f: 2 }, 1).ds.f).toBe(3);
  });
});

describe('longRestHitDiceRegain', () => {
  it('moitié du max, au moins 1', () => {
    expect(longRestHitDiceRegain(1)).toBe(1);
    expect(longRestHitDiceRegain(2)).toBe(1);
    expect(longRestHitDiceRegain(10)).toBe(5);
    expect(longRestHitDiceRegain(9)).toBe(4);
  });
});

describe('baseName', () => {
  it('retire un suffixe numérique de groupe', () => {
    expect(baseName('Gobelin 3')).toBe('Gobelin');
    expect(baseName('Gobelin 12')).toBe('Gobelin');
  });
  it('laisse un nom sans numéro intact', () => {
    expect(baseName('Loup')).toBe('Loup');
    expect(baseName('Strahd von Zarovich')).toBe('Strahd von Zarovich');
  });
  it('ne vide pas un nom purement numérique', () => {
    expect(baseName('42')).toBe('42');
  });
});

describe('hpAfter', () => {
  it('les dégâts entament d’abord les PV temporaires', () => {
    expect(hpAfter(20, 20, 5, 8)).toEqual({ hp: 17, temp: 0 }); // 5 temp + 3 réels
  });
  it('ne descend pas sous 0', () => {
    expect(hpAfter(4, 20, 0, 10)).toEqual({ hp: 0, temp: 0 });
  });
  it('le soin plafonne au max et ne touche pas les PV temp', () => {
    expect(hpAfter(15, 20, 3, -10)).toEqual({ hp: 20, temp: 3 });
  });
  it('soin sans max ne plafonne pas', () => {
    expect(hpAfter(15, null, 0, -10)).toEqual({ hp: 25, temp: 0 });
  });
});
