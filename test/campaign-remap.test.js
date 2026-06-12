import { describe, it, expect } from 'vitest';
import { remapForImport, sanitizeForImport, TRANSFER_TABLES } from '../src/lib/campaign-remap.js';

/** Jeu d'essai : une campagne minimale où tout référence tout. */
function fixture() {
  return {
    characters: [{ id: 'c_old1', name: 'Khott', data: { hp: 10 }, owner_id: 'user-A' }],
    character_private: [
      { char_id: 'c_old1', notes: 'secret' },
      { char_id: 'c_disparu', notes: 'orphelin' }, // fiche absente de l'export
    ],
    scenes: [
      { id: 's_old1', name: 'Taverne', state: { tokens: [{ id: 't1', charId: 'c_old1' }, { id: 't2' }] }, created_by: 'user-A' },
    ],
    session_state: [
      { key: 'active_scene', value: { id: 's_old1' }, updated_by: 'user-A' },
      { key: 'campaign', value: [{ id: 'n1', sceneId: 's_old1', entryIds: ['e_old1', 'e_inconnu'], children: [{ id: 'n2', sceneId: null, entryIds: [], children: [] }] }] },
      { key: 'clock', value: { day: 3, min: 100 } },
    ],
    initiative: [{ entity_id: 'e_1', name: 'Khott', char_id: 'c_old1', updated_by: 'user-A' }],
    compendium: [{ id: 'e_old1', kind: 'npc', name: 'Ismark', data: {}, created_by: 'user-A' }],
    handouts: [{ title: 'Lettre', target_player: 'user-B', pushed_by: 'user-A' }],
    session_notes: [{ content: 'note', shared: true, created_by: 'user-B' }],
    vault_notes: [{ path: 'a.md', content: 'x', updated_by: 'user-A' }],
    messages: [{ channel: 'public', content: 'salut', sender_id: 'user-B', sender_name: 'Julien', recipient_id: 'user-A' }],
  };
}

describe('remapForImport', () => {
  // Générateurs déterministes pour des assertions exactes.
  const opts = () => {
    let n = 0;
    let c = 0;
    return { uid: () => `uuid-${++n}`, charId: () => `c_new${++c}` };
  };

  it('régénère les ids et réécrit TOUTES les références croisées', () => {
    const { tables, maps } = remapForImport(fixture(), opts());
    expect(maps.charMap).toEqual({ c_old1: 'c_new1' });
    expect(tables.characters[0].id).toBe('c_new1');
    expect(tables.scenes[0].id).toBe('uuid-1');
    expect(tables.compendium[0].id).toBe('uuid-2');
    // Jeton lié → nouvelle fiche ; jeton libre intact.
    expect(tables.scenes[0].state.tokens[0].charId).toBe('c_new1');
    expect(tables.scenes[0].state.tokens[1].charId).toBeUndefined();
    // Combat + histoire privée suivent la fiche ; l'orpheline est écartée.
    expect(tables.initiative[0].char_id).toBe('c_new1');
    expect(tables.character_private).toHaveLength(1);
    expect(tables.character_private[0].char_id).toBe('c_new1');
    // Pointeur de scène active + classeur (sceneId, entryIds nettoyés).
    expect(tables.session_state.find((r) => r.key === 'active_scene').value.id).toBe('uuid-1');
    const binder = tables.session_state.find((r) => r.key === 'campaign').value;
    expect(binder[0].sceneId).toBe('uuid-1');
    expect(binder[0].entryIds).toEqual(['uuid-2']); // l'entrée inconnue disparaît
    expect(binder[0].children[0].sceneId).toBeNull();
    // Les clés sans référence ne bougent pas.
    expect(tables.session_state.find((r) => r.key === 'clock').value).toEqual({ day: 3, min: 100 });
  });

  it('ne mute pas le payload source', () => {
    const src = fixture();
    remapForImport(src, opts());
    expect(src.characters[0].id).toBe('c_old1');
    expect(src.session_state[0].value.id).toBe('s_old1');
  });
});

describe('sanitizeForImport', () => {
  it('neutralise les comptes d’origine et réattribue les auteurs requis', () => {
    const { tables } = remapForImport(fixture());
    sanitizeForImport(tables, 'importeur');
    expect(tables.characters[0].owner_id).toBeNull();
    expect(tables.handouts[0].target_player).toBeNull();
    expect(tables.handouts[0].pushed_by).toBeUndefined();
    expect(tables.session_notes[0].created_by).toBe('importeur');
    expect(tables.messages[0].sender_id).toBe('importeur');
    expect(tables.messages[0].sender_name).toBe('Julien'); // le nom affiché survit
    expect(tables.messages[0].recipient_id).toBeNull();
    expect(tables.initiative[0].updated_by).toBeUndefined();
  });
});

describe('contrat de transfert', () => {
  it('les fiches précèdent les histoires privées dans l’ordre d’import', () => {
    expect(TRANSFER_TABLES.indexOf('characters')).toBeLessThan(TRANSFER_TABLES.indexOf('character_private'));
  });
});
