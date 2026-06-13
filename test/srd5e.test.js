import { describe, it, expect } from 'vitest';
import {
  CLASSES,
  RACES,
  BACKGROUNDS,
  classByLabel,
  raceByLabel,
  backgroundByLabel,
  deriveClassPatch,
  deriveRacePatch,
  deriveBackgroundPatch,
  classStartingEquipment,
  suggestHpMax,
  applyRaceMods,
  mergeFeatsBlock,
  isSrdMarker,
  spellSlotsForLevel,
  srdManagedLines,
  subclassByLabel,
  deriveSubclassPatch,
  SUBCLASSES,
  totalLevel,
  profBonusForLevel,
  combinedCasterLevel,
  multiclassSpellSlots,
  hitDiceSummary,
  deriveProficiencies,
  SRD_OPEN,
  SRD_CLOSE,
} from '../src/lib/srd5e.js';
import { dnd5e2024 } from '../src/lib/systems/dnd5e2024.js';

describe('classByLabel / raceByLabel', () => {
  it('reconnaît les noms FR du seed (accents inclus)', () => {
    expect(classByLabel('Barbare').key).toBe('barbare');
    expect(classByLabel('barde').key).toBe('barde');
    expect(classByLabel('Rôdeur').key).toBe('rodeur');
    expect(classByLabel('Occultiste').key).toBe('occultiste');
    expect(raceByLabel('Elfe Sylvestre').key).toBe('elfe-sylvestre');
    expect(raceByLabel('Humain').key).toBe('humain');
    expect(raceByLabel('Demi-Orc').key).toBe('demi-orc');
    expect(raceByLabel('Tieffelin').key).toBe('tieffelin');
  });

  it('gère les alias et un suffixe de niveau', () => {
    expect(raceByLabel('Elfe').key).toBe('elfe-haut');
    expect(raceByLabel('Nain').key).toBe('nain-collines');
    expect(classByLabel('Roublard 3 / Magicien 2').key).toBe('roublard');
  });

  it('renvoie null pour un nom inconnu ou vide', () => {
    expect(classByLabel('Inconnu')).toBeNull();
    expect(raceByLabel('')).toBeNull();
    expect(classByLabel(null)).toBeNull();
  });

  it('couvre 12 classes et au moins 9 entrées de race', () => {
    expect(CLASSES).toHaveLength(12);
    expect(RACES.length).toBeGreaterThanOrEqual(9);
  });
});

describe('deriveClassPatch', () => {
  it('Barbare : d12, sauvegardes FOR/CON, pas d’incantation, 2 compétences', () => {
    const r = deriveClassPatch({ lvl: 1 }, 'Barbare');
    expect(r.patch.hdSize).toBe(12);
    expect(r.patch.saves).toEqual(['str', 'con']);
    expect(r.patch.sc).toBeNull();
    expect(r.skillOptions.count).toBe(2);
    expect(r.skillOptions.list).toContain('athletics');
    expect(r.featuresText).toMatch(/Rage/);
  });

  it('Magicien : incantation INT et dé d6', () => {
    const r = deriveClassPatch({ lvl: 3 }, 'Magicien');
    expect(r.patch.sc).toBe('int');
    expect(r.patch.hdSize).toBe(6);
    expect(r.patch.hdMax).toBe(3);
    expect(r.patch.hd).toBe(3);
  });

  it('renvoie null pour une classe inconnue', () => {
    expect(deriveClassPatch({}, 'Truc')).toBeNull();
  });
});

describe('deriveRacePatch', () => {
  it('Elfe Sylvestre : DEX+2/SAG+1, vision 18 m, vitesse 10,5 m, Perception', () => {
    const r = deriveRacePatch({}, 'Elfe Sylvestre');
    expect(r.abilityDelta).toEqual({ dex: 2, wis: 1 });
    expect(r.patch.darkvision).toBe(18);
    expect(r.patch.spd).toBe(10.5);
    expect(r.patch.size).toBe('M');
    expect(r.fixedSkills).toEqual(['perception']);
    expect(r.abilityChoose).toBeNull();
  });

  it('Humain : +1 partout', () => {
    const r = deriveRacePatch({}, 'Humain');
    expect(r.abilityDelta).toEqual({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
    expect(r.patch.darkvision).toBe(0);
  });

  it('Demi-Elfe : CHA+2 + choix de 2 caractéristiques + 2 compétences au choix', () => {
    const r = deriveRacePatch({}, 'Demi-Elfe');
    expect(r.abilityDelta).toEqual({ cha: 2 });
    expect(r.abilityChoose).toEqual({ count: 2, from: ['str', 'dex', 'con', 'int', 'wis'], amount: 1 });
    expect(r.skillChoose).toEqual({ count: 2, from: 'all' });
  });

  it('Nain des collines : +1 PV/niveau (Robustesse naine)', () => {
    expect(deriveRacePatch({}, 'Nain des collines').hpPerLevel).toBe(1);
    expect(deriveRacePatch({}, 'Nain des montagnes').hpPerLevel).toBe(0);
  });

  it('races sans choix : skillChoose null, hpPerLevel 0', () => {
    const r = deriveRacePatch({}, 'Humain');
    expect(r.skillChoose).toBeNull();
    expect(r.hpPerLevel).toBe(0);
  });
});

describe('applyRaceMods (idempotence)', () => {
  it('applique un delta sur des scores bruts', () => {
    const { scores, _raceMods } = applyRaceMods({ str: 10, con: 10 }, { str: 2, con: 1 });
    expect(scores).toEqual({ str: 12, con: 11 });
    expect(_raceMods).toEqual({ str: 2, con: 1 });
  });

  it('A → B → A revient à la valeur de base sans empiler', () => {
    let data = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    // A = Demi-Orc (str+2, con+1)
    let res = applyRaceMods(data, { str: 2, con: 1 });
    data = { ...data, ...res.scores, _raceMods: res._raceMods };
    expect(data.str).toBe(12);
    expect(data.con).toBe(11);
    // B = Elfe Sylvestre (dex+2, wis+1)
    res = applyRaceMods(data, { dex: 2, wis: 1 });
    data = { ...data, ...res.scores, _raceMods: res._raceMods };
    expect(data.str).toBe(10); // bonus Demi-Orc retiré
    expect(data.con).toBe(10);
    expect(data.dex).toBe(12);
    expect(data.wis).toBe(11);
    // A de nouveau
    res = applyRaceMods(data, { str: 2, con: 1 });
    data = { ...data, ...res.scores, _raceMods: res._raceMods };
    expect(data.str).toBe(12);
    expect(data.con).toBe(11);
    expect(data.dex).toBe(10);
    expect(data.wis).toBe(10);
  });

  it('préserve un ajustement manuel entre deux applications', () => {
    let data = { str: 10, _raceMods: { str: 2 } }; // str=10 inclut déjà +2 (base 8)
    // le joueur monte STR à 14 manuellement (base 12)
    data.str = 14;
    const res = applyRaceMods(data, { str: 2 }); // même race ré-appliquée
    // base = 14 - 2 = 12, +2 => 14 inchangé
    expect(res.scores.str).toBeUndefined();
  });

  it('plancher à 1', () => {
    const { scores } = applyRaceMods({ str: 6, _raceMods: {} }, { str: -10 });
    expect(scores.str).toBe(1);
  });
});

describe('suggestHpMax', () => {
  it('Barbare CON 14 niveau 1 = 14', () => {
    expect(suggestHpMax({ hdSize: 12, con: 14, lvl: 1 })).toBe(14);
  });

  it('Barbare CON 14 niveau 3 = 14 + 2×9 = 32', () => {
    // perLevel = floor(12/2)+1 + mod(14)=2 => 7+2 = 9
    expect(suggestHpMax({ hdSize: 12, con: 14, lvl: 3 })).toBe(32);
  });

  it('minimum 1 PV par niveau même avec CON faible', () => {
    expect(suggestHpMax({ hdSize: 6, con: 1, lvl: 2 })).toBeGreaterThanOrEqual(2);
  });

  it('Robustesse naine : +1 PV par niveau via extraPerLevel', () => {
    const base = suggestHpMax({ hdSize: 8, con: 14, lvl: 3 });
    expect(suggestHpMax({ hdSize: 8, con: 14, lvl: 3 }, 1)).toBe(base + 3);
  });
});

describe('mergeFeatsBlock', () => {
  it('insère un bloc géré', () => {
    const out = mergeFeatsBlock('Mes notes', ['Rage — …', 'Transe — …']);
    expect(out).toContain('Mes notes');
    expect(out).toContain(SRD_OPEN);
    expect(out).toContain('Rage — …');
    expect(out).toContain(SRD_CLOSE);
  });

  it('remplace le bloc sans dupliquer à la ré-application', () => {
    const first = mergeFeatsBlock('Notes', ['Rage — a']);
    const second = mergeFeatsBlock(first, ['Inspiration — b']);
    expect(second.match(new RegExp(SRD_OPEN, 'g'))).toHaveLength(1);
    expect(second).not.toContain('Rage — a');
    expect(second).toContain('Inspiration — b');
    expect(second).toContain('Notes');
  });

  it('un bloc vide retire le bloc et conserve le texte utilisateur', () => {
    const withBlock = mergeFeatsBlock('Texte perso', ['Trait — x']);
    const removed = mergeFeatsBlock(withBlock, []);
    expect(removed).toBe('Texte perso');
  });
});

describe('backgrounds (historiques)', () => {
  it('reconnaît les historiques du seed', () => {
    expect(backgroundByLabel('Criminel').key).toBe('criminel');
    expect(backgroundByLabel('Soldat').key).toBe('soldat');
    expect(backgroundByLabel('Sage').key).toBe('sage');
    expect(backgroundByLabel('Inconnu')).toBeNull();
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(12);
  });

  it('deriveBackgroundPatch : Acolyte → 2 compétences, trait, équipement, or', () => {
    const d = deriveBackgroundPatch({}, 'Acolyte');
    expect(d.skills).toEqual(['insight', 'religion']);
    expect(d.gold).toBe(15);
    expect(d.equipment.length).toBeGreaterThan(0);
    expect(d.featureLines.join(' ')).toMatch(/Abri du fidèle/);
    expect(d.featureLines.join(' ')).toMatch(/Langues/);
  });

  it('Criminel : compétences Tromperie + Discrétion, outils notés', () => {
    const d = deriveBackgroundPatch({}, 'Criminel');
    expect(d.skills).toEqual(['deception', 'stealth']);
    expect(d.featureLines.join(' ')).toMatch(/Outils/);
  });
});

describe('classStartingEquipment', () => {
  it('Barbare : groupes de choix + items fixes', () => {
    const g = classStartingEquipment('Barbare');
    expect(g.length).toBeGreaterThan(0);
    expect(g.some((x) => x.choose)).toBe(true);
    expect(g.some((x) => x.fixed)).toBe(true);
  });

  it('classe inconnue → tableau vide', () => {
    expect(classStartingEquipment('Truc')).toEqual([]);
  });

  it('chaque classe a un équipement de départ', () => {
    for (const c of CLASSES) {
      expect(classStartingEquipment(c.key).length).toBeGreaterThan(0);
    }
  });
});

describe('isSrdMarker', () => {
  it('détecte les lignes marqueurs', () => {
    expect(isSrdMarker(SRD_OPEN)).toBe(true);
    expect(isSrdMarker(`  ${SRD_CLOSE} `)).toBe(true);
    expect(isSrdMarker('Rage — …')).toBe(false);
  });
});

describe('spellSlotsForLevel', () => {
  it('lanceur complet : Magicien niv.1 = 2 empl. de niv.1', () => {
    expect(spellSlotsForLevel('magicien', 1)).toEqual({ 1: { m: 2, u: 0 } });
  });

  it('lanceur complet : Magicien niv.5 = 4/3/2', () => {
    expect(spellSlotsForLevel('Magicien', 5)).toEqual({
      1: { m: 4, u: 0 }, 2: { m: 3, u: 0 }, 3: { m: 2, u: 0 },
    });
  });

  it('magie de pacte : Occultiste niv.1 = 1 empl. niv.1 ; niv.3 = 2 empl. niv.2', () => {
    expect(spellSlotsForLevel('occultiste', 1)).toEqual({ 1: { m: 1, u: 0 } });
    expect(spellSlotsForLevel('occultiste', 3)).toEqual({ 2: { m: 2, u: 0 } });
  });

  it('demi-lanceur : Paladin/Rôdeur niv.1 = aucun emplacement, niv.2 = 2 empl. niv.1', () => {
    expect(spellSlotsForLevel('paladin', 1)).toBeNull();
    expect(spellSlotsForLevel('rodeur', 1)).toBeNull();
    expect(spellSlotsForLevel('paladin', 2)).toEqual({ 1: { m: 2, u: 0 } });
  });

  it('non-lanceur : null', () => {
    expect(spellSlotsForLevel('barbare', 5)).toBeNull();
    expect(spellSlotsForLevel('Truc', 5)).toBeNull();
  });

  it('borne le niveau à 1..20', () => {
    expect(spellSlotsForLevel('magicien', 0)).toEqual(spellSlotsForLevel('magicien', 1));
    expect(spellSlotsForLevel('magicien', 99)).toEqual(spellSlotsForLevel('magicien', 20));
  });
});

describe('deriveClassPatch : incantation', () => {
  it('Magicien : lanceur complet, 3 sorts mineurs, emplacements niv.1', () => {
    const r = deriveClassPatch({ lvl: 1 }, 'Magicien');
    expect(r.caster).toBe('full');
    expect(r.cantrips).toBe(3);
    expect(r.casterLine).toMatch(/grimoire/);
    expect(r.spellSlots).toEqual({ 1: { m: 2, u: 0 } });
  });

  it('Barbare : aucune incantation', () => {
    const r = deriveClassPatch({ lvl: 1 }, 'Barbare');
    expect(r.caster).toBeNull();
    expect(r.cantrips).toBe(0);
    expect(r.spellSlots).toBeNull();
  });
});

describe('srdManagedLines', () => {
  it('compose maîtrises, langues et sorts pour un lanceur', () => {
    const lines = srdManagedLines({ cls: 'Magicien', race: 'Humain', bg: 'Acolyte', lvl: 1 });
    const joined = lines.join('\n');
    expect(joined).toMatch(/Maîtrises — .*Armes :/);
    expect(joined).toMatch(/Langues — .*Commun/);
    expect(joined).toMatch(/2 au choix \(historique\)/); // créneaux de langue de l'Acolyte
    expect(joined).toMatch(/Sorts \(Magicien\)/);
    expect(joined).toMatch(/Récupération arcanique/); // aptitude de classe
  });

  it('classe non-lanceuse : pas de ligne « Sorts »', () => {
    const lines = srdManagedLines({ cls: 'Barbare', race: 'Nain des collines' });
    const joined = lines.join('\n');
    expect(joined).not.toMatch(/Sorts \(/);
    expect(joined).toMatch(/Maîtrises —/);
    expect(joined).toMatch(/Langues — .*Nain/);
  });

  it('outils : combine outils de classe (Roublard) et d’historique (Criminel)', () => {
    const lines = srdManagedLines({ cls: 'Roublard', bg: 'Criminel' });
    const maitrises = lines.find((l) => l.startsWith('Maîtrises —'));
    expect(maitrises).toMatch(/Outils :/);
    expect(maitrises).toMatch(/Outils de voleur/);
    expect(maitrises).toMatch(/outils de voleur/); // côté historique (Criminel)
  });

  it('fiche vide : aucune ligne', () => {
    expect(srdManagedLines({})).toEqual([]);
  });
});

describe('sous-classes (par niveau)', () => {
  it('couvre une sous-classe par classe (12)', () => {
    expect(Object.keys(SUBCLASSES)).toHaveLength(12);
  });

  it('subclassByLabel : libellé exact, accents/apostrophes inclus', () => {
    expect(subclassByLabel('Voie du Berserker').classKey).toBe('barbare');
    expect(subclassByLabel("école d'invocation").classKey).toBe('magicien');
    expect(subclassByLabel('Voleur').classKey).toBe('roublard');
    expect(subclassByLabel('Inconnue')).toBeNull();
    expect(subclassByLabel('')).toBeNull();
  });

  it('deriveSubclassPatch : ne débloque que les aptitudes du niveau atteint', () => {
    const r3 = deriveSubclassPatch({ sub: 'Champion', lvl: 3 });
    expect(r3.featureLines.join(' ')).toMatch(/Critique amélioré/);
    expect(r3.featureLines.join(' ')).not.toMatch(/Athlète remarquable/); // niv.7
    expect(r3.upcoming.some((f) => f.level === 7)).toBe(true);

    const r7 = deriveSubclassPatch({ sub: 'Champion', lvl: 7 });
    expect(r7.featureLines.join(' ')).toMatch(/Athlète remarquable/);
  });

  it('deriveSubclassPatch : sous-classe inconnue → null', () => {
    expect(deriveSubclassPatch({ sub: 'Truc', lvl: 5 })).toBeNull();
    expect(deriveSubclassPatch({ lvl: 5 })).toBeNull();
  });

  it('srdManagedLines : insère les aptitudes de sous-classe selon le niveau', () => {
    const l3 = srdManagedLines({ cls: 'Guerrier', sub: 'Champion', lvl: 3 }).join('\n');
    expect(l3).toMatch(/Critique amélioré \(niv\.3\)/);
    expect(l3).not.toMatch(/Critique supérieur/); // niv.15

    const l15 = srdManagedLines({ cls: 'Guerrier', sub: 'Champion', lvl: 15 }).join('\n');
    expect(l15).toMatch(/Critique supérieur \(niv\.15\)/);
  });
});

describe('multiclassage', () => {
  it('totalLevel : principal + secondaires', () => {
    expect(totalLevel({ lvl: 3, mc: [{ cls: 'Guerrier', lvl: 2 }] })).toBe(5);
    expect(totalLevel({ lvl: 5 })).toBe(5);
    expect(totalLevel({})).toBe(1);
  });

  it('profBonusForLevel : paliers +2..+6', () => {
    expect(profBonusForLevel(1)).toBe(2);
    expect(profBonusForLevel(5)).toBe(3);
    expect(profBonusForLevel(9)).toBe(4);
    expect(profBonusForLevel(17)).toBe(6);
  });

  it('combinedCasterLevel : pleins + demi (arrondi inf.), pacte exclu', () => {
    expect(combinedCasterLevel({ cls: 'Magicien', lvl: 3, mc: [{ cls: 'Clerc', lvl: 2 }] })).toBe(5);
    // Paladin 4 (demi → 2) + Magicien 2 (plein) = 4
    expect(combinedCasterLevel({ cls: 'Paladin', lvl: 4, mc: [{ cls: 'Magicien', lvl: 2 }] })).toBe(4);
    // Occultiste seul : pacte non compté ici
    expect(combinedCasterLevel({ cls: 'Occultiste', lvl: 3 })).toBe(0);
    expect(combinedCasterLevel({ cls: 'Barbare', lvl: 5 })).toBe(0);
  });

  it('multiclassSpellSlots : table multiclasse + pacte fusionné', () => {
    // Magicien 3 / Clerc 2 → niveau de lanceur 5 → 4/3/2
    expect(multiclassSpellSlots({ cls: 'Magicien', lvl: 3, mc: [{ cls: 'Clerc', lvl: 2 }] })).toEqual({
      1: { m: 4, u: 0 }, 2: { m: 3, u: 0 }, 3: { m: 2, u: 0 },
    });
    // Occultiste seul niv.3 : pacte uniquement → 2 empl. de niv.2
    expect(multiclassSpellSlots({ cls: 'Occultiste', lvl: 3 })).toEqual({ 2: { m: 2, u: 0 } });
    // Non-lanceur pur
    expect(multiclassSpellSlots({ cls: 'Barbare', lvl: 5 })).toBeNull();
  });

  it('hitDiceSummary : dés mixtes triés', () => {
    expect(hitDiceSummary({ cls: 'Guerrier', lvl: 3, mc: [{ cls: 'Magicien', lvl: 2 }] })).toBe('3d10 + 2d6');
    expect(hitDiceSummary({ cls: 'Barbare', lvl: 1 })).toBe('1d12');
    expect(hitDiceSummary({})).toBe('');
  });

  it('srdManagedLines : intègre les aptitudes des classes secondaires', () => {
    const lines = srdManagedLines({ cls: 'Magicien', lvl: 3, mc: [{ cls: 'Guerrier', sub: 'Champion', lvl: 3 }] }).join('\n');
    expect(lines).toMatch(/Multiclasse : Guerrier \(niv\.3\)/);
    expect(lines).toMatch(/Second souffle/); // aptitude de Guerrier
    expect(lines).toMatch(/Critique amélioré \(niv\.3\)/); // sous-classe secondaire
  });
});

describe('deriveProficiencies', () => {
  it('Magicien/Humain/Acolyte : armes, langues et sorts structurés', () => {
    const p = deriveProficiencies({ cls: 'Magicien', race: 'Humain', bg: 'Acolyte' });
    expect(p.weapons).toMatch(/Dagues/);
    expect(p.armor).toBe('Aucune');
    expect(p.languages).toContain('Commun + 1 au choix');
    expect(p.languages.join(' ')).toMatch(/2 au choix \(historique\)/);
    expect(p.casterClass).toBe('Magicien');
    expect(p.cantrips).toBe(3);
    expect(p.spellLine).toMatch(/grimoire/);
  });

  it('Roublard/Criminel : outils de classe + historique', () => {
    const p = deriveProficiencies({ cls: 'Roublard', bg: 'Criminel' });
    expect(p.tools.join(' ; ')).toMatch(/Outils de voleur/);
    expect(p.tools.join(' ; ')).toMatch(/outils de voleur/); // côté Criminel
  });

  it('non-lanceur : pas de note de sorts', () => {
    const p = deriveProficiencies({ cls: 'Barbare' });
    expect(p.spellLine).toBe('');
    expect(p.cantrips).toBe(0);
  });

  it('fiche vide : tout neutre', () => {
    const p = deriveProficiencies({});
    expect(p.armor).toBe('');
    expect(p.tools).toEqual([]);
    expect(p.languages).toEqual([]);
  });
});

describe('routage du contenu par système (lookups)', () => {
  // Reconstruit les lookups d'un SRD comme le font les wrappers de characters-ui.
  const lkOf = (srd) => ({
    classByLabel: (l) => srd.classes.find((x) => x.label === l) || null,
    raceByLabel: (l) => srd.races.find((x) => x.label === l) || null,
    backgroundByLabel: (l) => srd.backgrounds.find((x) => x.label === l) || null,
    subclassByLabel: (l) => (l && srd.subclasses[l] ? { label: l, ...srd.subclasses[l] } : null),
  });

  it('lookups factices : route classe et espèce vers le contenu fourni', () => {
    const lk = {
      classByLabel: (l) => (l === 'Mage' ? { label: 'Mage', features: [{ name: 'Sort rare', desc: 'magie' }] } : null),
      raceByLabel: (l) => (l === 'Fée' ? { traits: [{ name: 'Vol féerique', desc: 'ailes' }] } : null),
      backgroundByLabel: () => null,
      subclassByLabel: () => null,
    };
    const lines = srdManagedLines({ cls: 'Mage', race: 'Fée' }, lk).join('\n');
    expect(lines).toContain('Sort rare');
    expect(lines).toContain('Vol féerique');
  });

  it('sans lookups : le SRD 5.1 reste la source (non-régression)', () => {
    expect(srdManagedLines({ cls: 'Barbare' }).join('\n')).toContain('Rage');
  });

  it('SRD 2024 : une fiche affiche le contenu 2024, pas celui du 5.1', () => {
    const lk = lkOf(dnd5e2024.srd);
    const lines = srdManagedLines({ cls: 'Barbare', race: 'Goliath', bg: 'Soldat', lvl: 1 }, lk).join('\n');
    expect(lines).toContain('Ascendance de géant'); // trait d'espèce 2024 (absent du 5.1)
    expect(lines).toContain('Origine 2024'); // don d'origine porté par l'historique 2024
    expect(lines).toContain('Maîtrise d’armes'); // aptitude de classe 2024 (absente en 2014)
  });

  it('SRD 2024 : aptitude de sous-classe débloquée selon le niveau', () => {
    const lk = lkOf(dnd5e2024.srd);
    const l2 = srdManagedLines({ cls: 'Guerrier', sub: 'Champion', lvl: 2 }, lk).join('\n');
    const l3 = srdManagedLines({ cls: 'Guerrier', sub: 'Champion', lvl: 3 }, lk).join('\n');
    expect(l2).not.toContain('Critique amélioré'); // sous-classe 2024 : rien avant le niveau 3
    expect(l3).toContain('Critique amélioré');
  });

  it('deriveProficiencies route aussi par le SRD fourni', () => {
    const lk = lkOf(dnd5e2024.srd);
    expect(deriveProficiencies({ cls: 'Magicien' }, lk).casterClass).toBe('Magicien');
  });
});
