import { describe, it, expect } from 'vitest';
import { buildSessionRecap } from '../src/lib/recap.js';

// Contrat du brouillon de résumé de séance (bouton 🪄 des notes de session).

const NOW = Date.parse('2026-06-12T22:00:00Z');
const T0 = NOW - 2 * 3600e3; // début de séance il y a 2 h

describe('buildSessionRecap', () => {
  it('reprend le journal de combat public, exclut les entrées MJ et les anciennes', () => {
    const md = buildSessionRecap({
      now: NOW,
      sinceMs: T0,
      combatLog: [
        { t: T0 - 1000, text: '⚔️ Vieux combat oublié.' },
        { t: T0 + 1000, text: '☠️ Gobelin tombe à 0 PV !' },
        { t: T0 + 2000, text: 'Gobelin : 7→0 PV.', dm: true }, // détail MJ : exclu
      ],
    });
    expect(md).toContain('- ☠️ Gobelin tombe à 0 PV !');
    expect(md).not.toContain('Vieux combat');
    expect(md).not.toContain('7→0');
  });

  it('liste les 20/1 naturels publics du d20, ignore jets cachés et autres dés', () => {
    const iso = (ms) => new Date(ms).toISOString();
    const md = buildSessionRecap({
      now: NOW,
      sinceMs: T0,
      rolls: [
        { created_at: iso(T0 + 1), roller_name: 'Alice', roll_name: 'Attaque épée', dice: '1d20+5', details: { kept: 20, mode: 'normal' } },
        { created_at: iso(T0 + 2), roller_name: 'Bob', roll_name: 'Discrétion', dice: '1d20+2', details: { kept: 1, mode: 'normal' } },
        { created_at: iso(T0 + 3), roller_name: 'MJ', roll_name: 'Perception', dice: '1d20', details: { kept: 20, mode: 'normal' }, roll_type: 'dm' }, // caché
        { created_at: iso(T0 + 4), roller_name: 'Eve', roll_name: 'Test', dice: '1d100', details: { kept: 20, mode: 'normal' } }, // pas un d20
        { created_at: iso(T0 + 5), roller_name: 'Zoe', roll_name: 'Dégâts', dice: '2d6', details: {} }, // pas un test
      ],
    });
    expect(md).toContain('**Alice** — Attaque épée : 20 naturel !');
    expect(md).toContain('**Bob** — Discrétion : 1 naturel…');
    expect(md).not.toContain('MJ');
    expect(md).not.toContain('Eve');
    expect(md).not.toContain('Zoe');
  });

  it('sections vides : phrases de repli, et compte des messages publics', () => {
    const md = buildSessionRecap({
      now: NOW,
      sinceMs: T0,
      messages: [
        { created_at: new Date(T0 + 1).toISOString(), channel: 'public', content: 'salut' },
        { created_at: new Date(T0 + 2).toISOString(), channel: 'dm', content: 'secret' },
        { created_at: new Date(T0 - 9999).toISOString(), channel: 'public', content: 'vieux' },
      ],
    });
    expect(md).toContain('Aucun événement de combat');
    expect(md).toContain('Ni critique ni échec critique');
    expect(md).toContain('1 message(s) échangés dans le chat public');
    expect(md).toContain('# Résumé de séance —');
    expect(md).toContain('Brouillon généré automatiquement');
  });

  it('plafonne le journal de combat et signale les lignes omises', () => {
    const combatLog = Array.from({ length: 40 }, (_, i) => ({ t: T0 + i, text: `Événement ${i}` }));
    const md = buildSessionRecap({ now: NOW, sinceMs: T0, combatLog });
    expect(md).toContain('10 événement(s) plus ancien(s) omis');
    expect(md).not.toContain('- Événement 9\n'); // les plus anciens sautent
    expect(md).toContain('- Événement 39');
  });
});
