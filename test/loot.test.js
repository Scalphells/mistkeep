import { describe, it, expect } from 'vitest';
import { parseLoot, hasLoot } from '../src/lib/loot.js';

describe('parseLoot', () => {
  it('extrait pièces et objets d’une ligne « Butin : … »', () => {
    const r = parseLoot('Un gobelin.\nButin : 15 po, Épée courte, 2 Torches\nAutre texte.');
    expect(r.coins).toEqual({ gp: 15 });
    expect(r.items).toEqual([
      { nm: 'Épée courte', qty: 1 },
      { nm: 'Torches', qty: 2 },
    ]);
  });
  it('reconnaît « Trésor » et plusieurs types de pièces', () => {
    const r = parseLoot('Trésor : 30 gp; 12 pa; 5 pc');
    expect(r.coins).toEqual({ gp: 30, sp: 12, cp: 5 });
    expect(r.items).toEqual([]);
  });
  it('renvoie un butin vide sans ligne dédiée', () => {
    const r = parseLoot('Description sans butin.');
    expect(hasLoot(r)).toBe(false);
  });
  it('ne capture pas au-delà de la ligne', () => {
    const r = parseLoot('Butin : 1 po\nÉpée magique cachée');
    expect(r.coins).toEqual({ gp: 1 });
    expect(r.items).toEqual([]);
  });
});
