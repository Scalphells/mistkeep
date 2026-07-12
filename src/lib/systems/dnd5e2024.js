/**
 * Système de jeu : D&D 5e (2024) — règles révisées, SRD 5.2.
 *
 * Les maths sont identiques à 2014 (mêmes caractéristiques, compétences,
 * bonus, progressions d'emplacements) : tout est réutilisé du descripteur
 * 2014. La différence est le CONTENU d'identité, porté par `srd` :
 * espèces sans bonus de caracs (déplacés sur les historiques), historiques
 * +2/+1 avec don d'origine, sous-classes toutes au niveau 3 (une par classe
 * dans le SRD 5.2). La fiche (characters-ui) résout ses listes et gabarits
 * depuis `sys.srd` — à défaut elle retombe sur le SRD 5.1 (2014).
 */

import { ABILITIES, SKILLS, fmtMod, saveBonus, skillBonus, initBonus, createDefaults as createDefaults2014, SHEET } from './dnd5e2014.js';
import { abilityMod, d20Degree } from '../rules.js';
import { t } from '../i18n.js';
import {
  SPECIES, CLASSES_2024, BACKGROUNDS_2024, SUBCLASSES_2024,
  classByLabel2024, speciesByLabel2024, backgroundByLabel2024, subclassByLabel2024,
} from '../srd2024.js';

/** Blob `data` par défaut d'une nouvelle fiche 5e-2024 (même forme que 2014). */
export function createDefaults() {
  return { ...createDefaults2014(), system: 'dnd5e-2024' };
}

/** Descripteur du système D&D 5e (2024). */
export const dnd5e2024 = {
  id: 'dnd5e-2024',
  label: 'D&D 5e (2024)',
  abilities: ABILITIES,
  skills: SKILLS,
  saveOptions: ABILITIES,
  abilityMod,
  fmtMod,
  saveBonus,
  skillBonus,
  initBonus,
  degreeOfSuccess: d20Degree, // touche/rate vs CA, crit nat 20 / échec nat 1
  encounterBudget: true, // mêmes maths de rencontre que 2014
  createDefaults,
  sheet: SHEET, // mêmes sections de fiche que 2014
  srd: {
    get racesLabel() {
      return t('sys.id.species');
    },
    races: SPECIES,
    classes: CLASSES_2024,
    backgrounds: BACKGROUNDS_2024,
    subclasses: SUBCLASSES_2024,
    classByLabel: classByLabel2024,
    raceByLabel: speciesByLabel2024,
    backgroundByLabel: backgroundByLabel2024,
    subclassByLabel: subclassByLabel2024,
  },
};
