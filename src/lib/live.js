import { loadMessages, subscribeMessages } from '../features/chat.js';
import { loadInitiative, subscribeInitiative, loadCombatLog, initCombatChannel } from '../features/initiative.js';
import { loadRecentRolls, subscribeRolls } from '../features/dice.js';
import { loadCharacters, subscribeCharacters } from '../features/characters.js';
import { loadCompendium, subscribeCompendium } from '../features/compendium.js';

/**
 * Abonnements temps réel globaux (session entière), pour que le dock latéral
 * affiche chat / combat / dés en direct même quand l'onglet correspondant n'est
 * pas ouvert. Les `subscribeX` sont idempotents → les onglets qui les rappellent
 * obtiennent un no-op (un seul canal par table).
 */
export function initLive() {
  loadMessages();
  subscribeMessages();
  loadInitiative();
  subscribeInitiative();
  loadCombatLog();
  loadRecentRolls();
  subscribeRolls();
  loadCharacters();
  subscribeCharacters();
  // Le compendium alimente la fiche perso (descriptions de sorts/objets reflétées
  // via la carte d'action) et le dock, d'où le chargement global.
  loadCompendium();
  subscribeCompendium();
  initCombatChannel();
}
