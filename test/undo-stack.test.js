import { describe, it, expect } from 'vitest';
import { createUndoStack } from '../src/lib/undo-stack.js';

// Contrat de la pile d'annulation de la carte (Ctrl+Z MJ) : restitution des
// valeurs précédentes, scoping par scène, plafond, clés absentes.

describe('createUndoStack', () => {
  it('restitue les valeurs précédentes des clés touchées, en ordre LIFO', () => {
    const u = createUndoStack();
    let map = { tokens: ['a'], fog: { on: false } };

    u.record('s1', map, { tokens: ['a', 'b'] });
    map = { ...map, tokens: ['a', 'b'] };
    u.record('s1', map, { fog: { on: true } });
    map = { ...map, fog: { on: true } };

    const undo1 = u.pop('s1');
    expect(undo1).toEqual({ fog: { on: false } });
    map = { ...map, ...undo1 };
    const undo2 = u.pop('s1');
    expect(undo2).toEqual({ tokens: ['a'] });
    map = { ...map, ...undo2 };
    expect(map).toEqual({ tokens: ['a'], fog: { on: false } });
  });

  it('ne touche qu’aux clés du patch (les autres clés restent intactes)', () => {
    const u = createUndoStack();
    const map = { bg: 'x.jpg', tokens: [1], pins: [2] };
    u.record('s1', map, { tokens: [1, 3] });
    const prev = u.pop('s1');
    expect(Object.keys(prev)).toEqual(['tokens']);
  });

  it('canUndo est vrai pour le contexte de la dernière entrée seulement', () => {
    const u = createUndoStack();
    expect(u.canUndo('s1')).toBe(false);
    u.record('s1', { a: 1 }, { a: 2 });
    expect(u.canUndo('s1')).toBe(true);
    expect(u.canUndo('s2')).toBe(false);
  });

  it('vide toute la pile quand le contexte ne correspond plus (changement de scène)', () => {
    const u = createUndoStack();
    u.record('s1', { a: 1 }, { a: 2 });
    u.record('s1', { a: 2 }, { a: 3 });
    expect(u.pop('s2')).toBe(null);
    expect(u.size()).toBe(0); // les entrées de s1 sont devenues obsolètes
    expect(u.pop('s1')).toBe(null);
  });

  it('plafonne l’historique en évinçant les entrées les plus anciennes', () => {
    const u = createUndoStack(3);
    for (let i = 0; i < 5; i++) u.record('s1', { n: i }, { n: i + 1 });
    expect(u.size()).toBe(3);
    expect(u.pop('s1')).toEqual({ n: 4 }); // la plus récente d'abord
  });

  it('mémorise undefined pour une clé qui n’existait pas (annule un ajout)', () => {
    const u = createUndoStack();
    u.record('s1', { tokens: [] }, { lights: [{ id: 'l1' }] });
    const prev = u.pop('s1');
    expect('lights' in prev).toBe(true);
    expect(prev.lights).toBe(undefined);
  });
});
