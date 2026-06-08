/**
 * Store applicatif central, minimal et observable.
 * Remplace l'objet global `ST` du monolithe d'origine.
 *
 * Usage :
 *   import { store } from './state.js';
 *   store.set({ role: 'dm' });
 *   const off = store.subscribe(s => render(s));
 */

const initialState = {
  // Auth / session
  user: null,
  profile: null,
  role: 'player', // 'dm' | 'player'
  isDM: false,
  isOnline: true,

  // Vault (synchronisé via table vault_notes, MJ uniquement)
  vaultFiles: {}, // { path: content }
  fileTree: null,
  openTabs: [],
  activeTab: null,
  edits: {}, // modifications non sauvegardées

  // Outils JDR
  jdr: { players: [], pnjs: [], monsters: [], tables: [] },
  initiative: [],
  initTurn: 0,
  initRound: 1,
  combatLog: [],
  diceHist: [],

  // Fiches de personnage (table `characters`)
  characters: [],
  activeChar: null,
  players: [],

  // Carte de combat (scènes : table `scenes`, pointeur session_state `active_scene`)
  map: null,  // état de la scène active (Multijoueur)
  scenes: [], // liste des scènes { id, name, sort }
  activeSceneId: null,
  targets: [], // jetons ciblés (ids) — pour appliquer les jets aux cibles
  paused: false, // partie en pause (MJ)
  clock: { day: 1, min: 480 }, // temps in-game (jour + minutes 0..1439) — MJ
  sfxboard: [], // planche de sons ponctuels (MJ) — { id, name, url }
  imagebank: [], // banque d'images réutilisables (MJ) — chemins Storage
  online: [], // ids des utilisateurs connectés (présence temps réel)
  campaign: [], // classeur de campagne (Actes/Arcs) — MJ
  messages: [],
  chatTab: 'public',
  dmPeer: null, // joueur sélectionné par le MJ dans le canal privé
  handouts: [],
  sessionNotes: [],
  compendium: [],
  compendiumOpenId: null, // entrée à ouvrir (depuis la recherche globale)
  unreadMessages: 0,
  unreadHandouts: 0,
  ambience: null, // ambiance audio partagée { url, name, playing, vol, loop }

  // UI
  sideTab: 'vault',
  toolTab: 'dice',
};

function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();

  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore(initialState);
