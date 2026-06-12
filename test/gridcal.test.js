import { describe, it, expect } from 'vitest';
import { gridFromCorners } from '../src/lib/gridcal.js';

// Contrat du calage de grille en deux clics (assistant 📐 de la carte).

describe('gridFromCorners', () => {
  it('diagonale franche : taille = moyenne des axes, décalage = coin haut-gauche mod taille', () => {
    // Case de 70 px dont le coin haut-gauche est à (140, 210) : déjà alignée.
    expect(gridFromCorners({ x: 140, y: 210 }, { x: 210, y: 280 })).toEqual({ size: 70, ox: 0, oy: 0 });
    // Grille décalée de (15, 8) : case [15..85] × [8..78].
    expect(gridFromCorners({ x: 15, y: 8 }, { x: 85, y: 78 })).toEqual({ size: 70, ox: 15, oy: 8 });
  });

  it('ordre des clics et sens du geste indifférents', () => {
    const a = gridFromCorners({ x: 85, y: 78 }, { x: 15, y: 8 });
    const b = gridFromCorners({ x: 15, y: 78 }, { x: 85, y: 8 }); // l'autre diagonale
    expect(a).toEqual({ size: 70, ox: 15, oy: 8 });
    expect(b).toEqual({ size: 70, ox: 15, oy: 8 });
  });

  it('clics imprécis : moyenne les deux axes', () => {
    const r = gridFromCorners({ x: 100, y: 100 }, { x: 168, y: 172 }); // dx=68, dy=72
    expect(r.size).toBe(70);
  });

  it('geste le long d’une arête (un axe quasi nul) : l’axe dominant fait foi', () => {
    const r = gridFromCorners({ x: 140, y: 211 }, { x: 210, y: 213 }); // dy≈0
    expect(r.size).toBe(70);
    expect(r.ox).toBe(0);
  });

  it('rejette les cases trop petites ou trop grandes', () => {
    expect(gridFromCorners({ x: 0, y: 0 }, { x: 4, y: 5 })).toBeNull();
    expect(gridFromCorners({ x: 0, y: 0 }, { x: 900, y: 880 })).toBeNull();
    expect(gridFromCorners({ x: 0, y: 0 }, { x: NaN, y: 10 })).toBeNull();
  });
});
