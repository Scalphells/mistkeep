/**
 * Registre des systèmes de jeu.
 *
 * Ouvre l'app à d'autres systèmes que D&D 5e 2014 (pf2e, D&D 5e 2024, custom…) :
 * chaque système fournit le même descripteur (cf. dnd5e2014.js). À terme une
 * campagne porte un `system` ; la fiche et les jets passent par getSystem(id)
 * plutôt que de coder le 5e en dur. Rétro-compat : tout l'existant est 5e-2014.
 */

import { dnd5e2014 } from './dnd5e2014.js';

const SYSTEMS = {
  [dnd5e2014.id]: dnd5e2014,
};

/** Identifiant du système par défaut. */
export const DEFAULT_SYSTEM = dnd5e2014.id;

/** Descripteur d'un système (retombe sur le système par défaut si inconnu/vide). */
export function getSystem(id) {
  return SYSTEMS[id] || SYSTEMS[DEFAULT_SYSTEM];
}

/** Liste { id, label } des systèmes disponibles (pour un sélecteur de campagne). */
export function listSystems() {
  return Object.values(SYSTEMS).map((s) => ({ id: s.id, label: s.label }));
}
