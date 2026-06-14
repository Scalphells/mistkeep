// AUTO-GÉNÉRÉ — miroir anglais des données SRD 5.2 (2024). NE PAS ÉDITER À LA MAIN.
// Régénéré depuis les données FR + traductions (prose seule ; mécaniques copiées du FR).

export const SPECIES = [
  {
    "key": "humain",
    "label": "Human",
    "ability": {},
    "speed": 9,
    "darkvision": 0,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Resourceful",
        "desc": "You regain Heroic Inspiration after each long rest."
      },
      {
        "name": "Skillful",
        "desc": "You gain an extra Origin feat at level 1."
      }
    ]
  },
  {
    "key": "nain",
    "label": "Dwarf",
    "ability": {},
    "hpPerLevel": 1,
    "speed": 9,
    "darkvision": 36,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Dwarven Toughness",
        "desc": "+1 HP per level."
      },
      {
        "name": "Dwarven Resilience",
        "desc": "Resistance to poison damage; advantage on saving throws against the poisoned condition."
      },
      {
        "name": "Stonecunning",
        "desc": "Tremorsense out to 18 m for 10 min, once per rest (bonus action)."
      }
    ]
  },
  {
    "key": "elfe",
    "label": "Elf",
    "ability": {},
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "skillChoose": {
      "count": 1,
      "from": [
        "insight",
        "perception",
        "survival"
      ]
    },
    "traits": [
      {
        "name": "Fey Ancestry",
        "desc": "Advantage on saving throws against the charmed condition."
      },
      {
        "name": "Trance",
        "desc": "4 hours of trance replace sleep; you remain conscious."
      },
      {
        "name": "Elven Lineage",
        "desc": "A lineage (Drow, High Elf, Wood Elf) grants a cantrip plus spells at levels 3 and 5."
      }
    ]
  },
  {
    "key": "gnome",
    "label": "Gnome",
    "ability": {},
    "speed": 9,
    "darkvision": 18,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Gnome Cunning",
        "desc": "Advantage on Intelligence, Wisdom, and Charisma saving throws."
      },
      {
        "name": "Gnomish Lineage",
        "desc": "A lineage (Forest or Rock) grants useful minor cantrips and spells."
      }
    ]
  },
  {
    "key": "goliath",
    "label": "Goliath",
    "ability": {},
    "speed": 10.5,
    "darkvision": 0,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Giant Ancestry",
        "desc": "A giant ancestry grants a power (e.g., Stone's Endurance, Cloud's Jaunt), usable Proficiency Bonus times per day."
      },
      {
        "name": "Large Form",
        "desc": "Advantage on saving throws against the Grappled condition; you count as one size larger for carrying capacity."
      }
    ]
  },
  {
    "key": "halfelin",
    "label": "Halfling",
    "ability": {},
    "speed": 9,
    "darkvision": 0,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Lucky",
        "desc": "Reroll natural 1s on attack rolls, ability checks, and saving throws."
      },
      {
        "name": "Brave",
        "desc": "Advantage on saving throws against being frightened."
      },
      {
        "name": "Halfling Nimbleness",
        "desc": "You can move through the space of creatures larger than you."
      }
    ]
  },
  {
    "key": "drakeide",
    "label": "Dragonborn",
    "ability": {},
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Draconic Ancestry",
        "desc": "Choose a dragon: it determines your breath weapon and damage resistance."
      },
      {
        "name": "Breath Weapon",
        "desc": "Replaces one attack: 4.5 m cone or 9 m line, 1d10 (increases with level), DEX saving throw."
      },
      {
        "name": "Damage Resistance",
        "desc": "Resistance to the damage type of your ancestry."
      }
    ]
  },
  {
    "key": "orc",
    "label": "Orc",
    "ability": {},
    "speed": 9,
    "darkvision": 36,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Adrenaline Rush",
        "desc": "Bonus Action: Dash plus Temporary Hit Points equal to your Proficiency Bonus."
      },
      {
        "name": "Relentless Endurance",
        "desc": "When you drop to 0 HP without being killed, you instead drop to 1 HP (1/long rest)."
      }
    ]
  },
  {
    "key": "tieffelin",
    "label": "Tiefling",
    "ability": {},
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Fiendish Legacy",
        "desc": "A legacy (Abyssal, Chthonic, Infernal) grants a resistance and spells at levels 3 and 5."
      },
      {
        "name": "Otherworldly Presence",
        "desc": "You know the Thaumaturgy cantrip."
      }
    ]
  }
];

export const BACKGROUNDS_2024 = [
  {
    "key": "acolyte",
    "label": "Acolyte",
    "skills": [
      "insight",
      "religion"
    ],
    "tools": "Calligrapher's Supplies",
    "languages": "",
    "feature": {
      "name": "2024 Background",
      "desc": "+2/+1 (or +1/+1/+1) among INT, WIS, CHA · Origin Feat: Magic Initiate (Cleric)."
    },
    "equipment": [
      [
        "Holy symbol",
        1
      ],
      [
        "Prayer book",
        1
      ],
      [
        "Calligrapher's Supplies",
        1
      ],
      [
        "Vestments",
        1
      ]
    ],
    "gold": 8
  },
  {
    "key": "criminel",
    "label": "Criminal",
    "skills": [
      "sleight",
      "stealth"
    ],
    "tools": "Thieves' tools",
    "languages": "",
    "feature": {
      "name": "2024 Background",
      "desc": "+2/+1 (or +1/+1/+1) among DEX, CON, INT · Origin Feat: Alert."
    },
    "equipment": [
      [
        "Dagger",
        2
      ],
      [
        "Thieves' tools",
        1
      ],
      [
        "Crowbar",
        1
      ],
      [
        "Traveler's clothes",
        1
      ]
    ],
    "gold": 16
  },
  {
    "key": "erudit",
    "label": "Sage",
    "skills": [
      "arcana",
      "history"
    ],
    "tools": "Calligrapher's Supplies",
    "languages": "",
    "feature": {
      "name": "2024 Background",
      "desc": "+2/+1 (or +1/+1/+1) among CON, INT, WIS · Origin Feat: Magic Initiate (Wizard)."
    },
    "equipment": [
      [
        "Calligrapher's Supplies",
        1
      ],
      [
        "Book (philosophy)",
        1
      ],
      [
        "Parchment",
        8
      ],
      [
        "Traveler's clothes",
        1
      ]
    ],
    "gold": 8
  },
  {
    "key": "soldat",
    "label": "Soldier",
    "skills": [
      "athletics",
      "intimidation"
    ],
    "tools": "A Gaming Set (dice or cards)",
    "languages": "",
    "feature": {
      "name": "2024 Background",
      "desc": "+2/+1 (or +1/+1/+1) among STR, DEX, CON · Origin Feat: Savage Attacker."
    },
    "equipment": [
      [
        "Spear",
        1
      ],
      [
        "Dagger",
        1
      ],
      [
        "Dice Set",
        1
      ],
      [
        "Traveler's clothes",
        1
      ]
    ],
    "gold": 14
  }
];

export const CLASSES_2024 = [
  {
    "key": "barbare",
    "label": "Barbarian",
    "hd": 12,
    "saves": [
      "str",
      "con"
    ],
    "sc": null,
    "skillCount": 2,
    "skillList": [
      "animal",
      "athletics",
      "intimidation",
      "nature",
      "perception",
      "survival"
    ],
    "armorProf": "Light and medium armor, shields",
    "weaponProf": "Simple and martial weapons",
    "features": [
      {
        "name": "Rage",
        "desc": "Bonus Action: +melee damage, advantage on STR checks and saving throws, resistance to bludgeoning/piercing/slashing. Several uses per rest."
      },
      {
        "name": "Unarmored Defense",
        "desc": "While unarmored, AC = 10 + DEX mod. + CON mod."
      },
      {
        "name": "Weapon Mastery",
        "desc": "Use the mastery property of two weapon types of your choice (Cleave, Topple...)."
      }
    ],
    "subclasses": [
      "Path of the Berserker"
    ]
  },
  {
    "key": "barde",
    "label": "Bard",
    "hd": 8,
    "saves": [
      "dex",
      "cha"
    ],
    "sc": "cha",
    "skillCount": 3,
    "skillList": [
      "acrobatics",
      "animal",
      "arcana",
      "athletics",
      "deception",
      "history",
      "insight",
      "intimidation",
      "investigation",
      "medicine",
      "nature",
      "perception",
      "performance",
      "persuasion",
      "religion",
      "sleight",
      "stealth",
      "survival"
    ],
    "armorProf": "Light armor",
    "weaponProf": "Simple weapons, hand crossbows, longswords/shortswords, rapiers",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Charisma); rituals."
      },
      {
        "name": "Bardic Inspiration",
        "desc": "Bonus Action: give an ally a d6 (added to a d20 roll or to damage), regained on a rest."
      }
    ],
    "subclasses": [
      "College of Lore"
    ]
  },
  {
    "key": "clerc",
    "label": "Cleric",
    "hd": 8,
    "saves": [
      "wis",
      "cha"
    ],
    "sc": "wis",
    "skillCount": 2,
    "skillList": [
      "history",
      "insight",
      "medicine",
      "persuasion",
      "religion"
    ],
    "armorProf": "Light and medium armor, shields",
    "weaponProf": "Simple weapons",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Wisdom); rituals."
      },
      {
        "name": "Divine Order",
        "desc": "Protector (Martial weapons + Heavy armor) or Thaumaturge (one cantrip + proficiency in two knowledge skills)."
      }
    ],
    "subclasses": [
      "Life Domain"
    ]
  },
  {
    "key": "druide",
    "label": "Druid",
    "hd": 8,
    "saves": [
      "int",
      "wis"
    ],
    "sc": "wis",
    "skillCount": 2,
    "skillList": [
      "arcana",
      "animal",
      "insight",
      "medicine",
      "nature",
      "perception",
      "religion",
      "survival"
    ],
    "armorProf": "Light/medium armor and shields (nonmetal)",
    "weaponProf": "Quarterstaffs, scimitars, daggers, slings, javelins, clubs, spears…",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Wisdom); rituals."
      },
      {
        "name": "Druidic",
        "desc": "Secret druidic language; you know Detect Magic as a ritual."
      },
      {
        "name": "Primal Order",
        "desc": "Warden (Martial weapon + armor) or Magician (one cantrip + bonus to Arcana/Nature checks)."
      }
    ],
    "subclasses": [
      "Circle of the Land"
    ]
  },
  {
    "key": "ensorceleur",
    "label": "Sorcerer",
    "hd": 6,
    "saves": [
      "con",
      "cha"
    ],
    "sc": "cha",
    "skillCount": 2,
    "skillList": [
      "arcana",
      "deception",
      "insight",
      "intimidation",
      "persuasion",
      "religion"
    ],
    "armorProf": "None",
    "weaponProf": "Daggers, quarterstaffs, darts, slings, light crossbows",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Charisma)."
      },
      {
        "name": "Innate Sorcery",
        "desc": "Bonus Action, 1/long rest: 1 min, +1 to your spell save DC and advantage on your spell attack rolls."
      }
    ],
    "subclasses": [
      "Draconic Sorcery"
    ]
  },
  {
    "key": "guerrier",
    "label": "Fighter",
    "hd": 10,
    "saves": [
      "str",
      "con"
    ],
    "sc": null,
    "skillCount": 2,
    "skillList": [
      "acrobatics",
      "animal",
      "athletics",
      "history",
      "insight",
      "intimidation",
      "perception",
      "survival"
    ],
    "armorProf": "All armor, shields",
    "weaponProf": "Simple and martial weapons",
    "features": [
      {
        "name": "Fighting Style",
        "desc": "A Fighting Style of your choice (Archery, Defense, Dueling...)."
      },
      {
        "name": "Second Wind",
        "desc": "Bonus Action: regain 1d10 + level HP; several uses, regained on a rest."
      },
      {
        "name": "Weapon Mastery",
        "desc": "Use the mastery property of three weapon types of your choice."
      }
    ],
    "subclasses": [
      "Champion"
    ]
  },
  {
    "key": "magicien",
    "label": "Wizard",
    "hd": 6,
    "saves": [
      "int",
      "wis"
    ],
    "sc": "int",
    "skillCount": 2,
    "skillList": [
      "arcana",
      "history",
      "insight",
      "investigation",
      "medicine",
      "religion"
    ],
    "armorProf": "None",
    "weaponProf": "Daggers, quarterstaffs, darts, slings, light crossbows",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Intelligence); spellbook."
      },
      {
        "name": "Arcane Recovery",
        "desc": "Once per day on a short rest, recover spell slots (total ≈ ½ level)."
      },
      {
        "name": "Ritual Adept",
        "desc": "Cast the ritual spells in your spellbook as rituals."
      }
    ],
    "subclasses": [
      "Evoker"
    ]
  },
  {
    "key": "moine",
    "label": "Monk",
    "hd": 8,
    "saves": [
      "str",
      "dex"
    ],
    "sc": null,
    "skillCount": 2,
    "skillList": [
      "acrobatics",
      "athletics",
      "history",
      "insight",
      "religion",
      "stealth"
    ],
    "armorProf": "None",
    "weaponProf": "Simple weapons, shortswords",
    "features": [
      {
        "name": "Martial Arts",
        "desc": "Unarmed strikes / monk weapons: use DEX, a dedicated damage die, and an unarmed strike as a bonus action."
      },
      {
        "name": "Unarmored Defense",
        "desc": "While unarmored and without a shield, AC = 10 + DEX mod. + WIS mod."
      }
    ],
    "subclasses": [
      "Warrior of the Open Hand"
    ]
  },
  {
    "key": "paladin",
    "label": "Paladin",
    "hd": 10,
    "saves": [
      "wis",
      "cha"
    ],
    "sc": "cha",
    "skillCount": 2,
    "skillList": [
      "athletics",
      "insight",
      "intimidation",
      "medicine",
      "persuasion",
      "religion"
    ],
    "armorProf": "All armor, shields",
    "weaponProf": "Simple and martial weapons",
    "features": [
      {
        "name": "Lay on Hands",
        "desc": "Healing pool = 5 × level HP, distributed as an action; can also neutralize a poison."
      },
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Charisma) starting at level 1 in 2024."
      },
      {
        "name": "Weapon Mastery",
        "desc": "Use the Mastery property of two weapon types of your choice."
      }
    ],
    "subclasses": [
      "Oath of Devotion"
    ]
  },
  {
    "key": "rodeur",
    "label": "Ranger",
    "hd": 10,
    "saves": [
      "str",
      "dex"
    ],
    "sc": "wis",
    "skillCount": 3,
    "skillList": [
      "animal",
      "athletics",
      "insight",
      "investigation",
      "nature",
      "perception",
      "stealth",
      "survival"
    ],
    "armorProf": "Light and medium armor, shields",
    "weaponProf": "Simple and martial weapons",
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Spellcaster (Wisdom) starting at level 1 in 2024."
      },
      {
        "name": "Favored Enemy",
        "desc": "You know Hunter's Mark and cast it for free a number of times per day equal to your proficiency bonus."
      },
      {
        "name": "Weapon Mastery",
        "desc": "Use the Mastery property of two weapon types of your choice."
      }
    ],
    "subclasses": [
      "Hunter"
    ]
  },
  {
    "key": "roublard",
    "label": "Rogue",
    "hd": 8,
    "saves": [
      "dex",
      "int"
    ],
    "sc": null,
    "skillCount": 4,
    "skillList": [
      "acrobatics",
      "athletics",
      "deception",
      "insight",
      "intimidation",
      "investigation",
      "perception",
      "performance",
      "persuasion",
      "sleight",
      "stealth"
    ],
    "armorProf": "Light armor",
    "weaponProf": "Simple weapons, hand crossbows, longswords/shortswords, rapiers",
    "features": [
      {
        "name": "Expertise",
        "desc": "Double your proficiency bonus on two skills."
      },
      {
        "name": "Sneak Attack",
        "desc": "+1d6 (increases with level) with a finesse/ranged weapon, if you have advantage or an ally is adjacent to the target."
      },
      {
        "name": "Thieves' Cant",
        "desc": "Secret coded language."
      },
      {
        "name": "Weapon Mastery",
        "desc": "Use the Mastery property of two weapon types of your choice."
      }
    ],
    "subclasses": [
      "Thief"
    ]
  },
  {
    "key": "occultiste",
    "label": "Warlock",
    "hd": 8,
    "saves": [
      "wis",
      "cha"
    ],
    "sc": "cha",
    "skillCount": 2,
    "skillList": [
      "arcana",
      "deception",
      "history",
      "intimidation",
      "investigation",
      "nature",
      "religion"
    ],
    "armorProf": "Light armor",
    "weaponProf": "Simple weapons",
    "features": [
      {
        "name": "Pact Magic",
        "desc": "Spell slots that recharge on a short rest (Charisma)."
      },
      {
        "name": "Eldritch Invocations",
        "desc": "Permanent enhancements of your choice (swappable on level up)."
      }
    ],
    "subclasses": [
      "Fiend Patron"
    ]
  }
];

export const SUBCLASSES_2024 = {
  "Path of the Berserker": {
    "key": "voie-du-berserker",
    "classKey": "barbare",
    "features": [
      {
        "level": 3,
        "name": "Frenzy",
        "desc": "While raging, your first successful attack each turn deals extra damage (dice increasing with level)."
      },
      {
        "level": 6,
        "name": "Mindless Rage",
        "desc": "You can't be charmed or frightened while raging (these conditions are suspended)."
      },
      {
        "level": 10,
        "name": "Intimidating Presence",
        "desc": "Action: frighten nearby creatures (Wisdom saving throw against your ability DC)."
      },
      {
        "level": 14,
        "name": "Retaliation",
        "desc": "Reaction: when a nearby creature damages you, make a melee attack against it."
      }
    ]
  },
  "College of Lore": {
    "key": "college-du-savoir",
    "classKey": "barde",
    "features": [
      {
        "level": 3,
        "name": "Additional Proficiencies",
        "desc": "Three skills of your choice."
      },
      {
        "level": 3,
        "name": "Cutting Words",
        "desc": "Reaction: spend a Bardic Inspiration to reduce a creature's attack, check, or damage."
      },
      {
        "level": 6,
        "name": "Magical Secrets",
        "desc": "Learn spells from any class, counted as bard spells."
      },
      {
        "level": 14,
        "name": "Peerless Skill",
        "desc": "Spend a Bardic Inspiration to improve an ability check after seeing the roll."
      }
    ]
  },
  "Life Domain": {
    "key": "domaine-de-la-vie",
    "classKey": "clerc",
    "features": [
      {
        "level": 3,
        "name": "Domain Spells & Heavy Armor",
        "desc": "Domain spells always prepared and proficiency with heavy armor."
      },
      {
        "level": 3,
        "name": "Disciple of Life",
        "desc": "Your healing spells restore an extra +2 + the spell's level."
      },
      {
        "level": 6,
        "name": "Blessed Healer",
        "desc": "Your healing spells cast on others also heal you."
      },
      {
        "level": 17,
        "name": "Supreme Healing",
        "desc": "Your healing dice are treated as rolling their maximum value."
      }
    ]
  },
  "Circle of the Land": {
    "key": "cercle-de-la-terre",
    "classKey": "druide",
    "features": [
      {
        "level": 3,
        "name": "Circle Spells",
        "desc": "Bonus spells based on your chosen terrain, always prepared."
      },
      {
        "level": 3,
        "name": "Land's Aid",
        "desc": "Utility/defensive nature magic tied to your terrain."
      },
      {
        "level": 6,
        "name": "Natural Recovery",
        "desc": "On a short rest, recover spell slots (up to ≈ ½ level)."
      },
      {
        "level": 10,
        "name": "Nature's Ward",
        "desc": "Immunity to poison/disease; fey and elementals can't charm or frighten you."
      },
      {
        "level": 14,
        "name": "Nature's Sanctuary",
        "desc": "Action: prevent a creature from attacking you (Wisdom saving throw)."
      }
    ]
  },
  "Draconic Sorcery": {
    "key": "sorcellerie-draconique",
    "classKey": "ensorceleur",
    "features": [
      {
        "level": 3,
        "name": "Draconic Resilience",
        "desc": "Choose a dragon (damage type); +1 HP per level and, while unarmored, AC = 10 + DEX + CHA."
      },
      {
        "level": 6,
        "name": "Elemental Affinity",
        "desc": "Add your CHA modifier to damage of your dragon's type; spend a sorcery point for temporary resistance."
      },
      {
        "level": 14,
        "name": "Dragon Wings",
        "desc": "Grow wings: a flying speed equal to your walking speed."
      },
      {
        "level": 18,
        "name": "Draconic Presence",
        "desc": "Aura of fear or awe on nearby creatures (Wisdom saving throw)."
      }
    ]
  },
  "Champion": {
    "key": "champion",
    "classKey": "guerrier",
    "features": [
      {
        "level": 3,
        "name": "Improved Critical",
        "desc": "Your weapon attacks score a critical hit on a roll of 19-20."
      },
      {
        "level": 3,
        "name": "Remarkable Athlete",
        "desc": "Advantage on initiative and STR (Athletics) checks; minor athletic feats."
      },
      {
        "level": 7,
        "name": "Additional Fighting Style",
        "desc": "A second Fighting Style of your choice."
      },
      {
        "level": 15,
        "name": "Superior Critical",
        "desc": "Your weapon attacks score a critical hit on a roll of 18-20."
      },
      {
        "level": 18,
        "name": "Survivor",
        "desc": "Regain HP each turn as long as you're above half your HP."
      }
    ]
  },
  "Evoker": {
    "key": "evocateur",
    "classKey": "magicien",
    "features": [
      {
        "level": 3,
        "name": "Sculpt Spells",
        "desc": "Allies caught in your evocation spells automatically succeed on their saving throw and take no damage."
      },
      {
        "level": 6,
        "name": "Potent Cantrip",
        "desc": "Your offensive cantrips deal at least their minimum damage on a miss/successful saving throw."
      },
      {
        "level": 10,
        "name": "Empowered Evocation",
        "desc": "Add your INT modifier to the damage of one evocation spell per turn."
      },
      {
        "level": 14,
        "name": "Overchannel",
        "desc": "A spell of level ≤ 5 deals its maximum damage (then takes recoil damage on subsequent uses)."
      }
    ]
  },
  "Warrior of the Open Hand": {
    "key": "guerrier-de-la-main-ouverte",
    "classKey": "moine",
    "features": [
      {
        "level": 3,
        "name": "Open Hand Technique",
        "desc": "With your Flurry of Blows: knock prone, push, or deny the target its reaction."
      },
      {
        "level": 6,
        "name": "Wholeness of Body",
        "desc": "Action: heal yourself for an amount based on your level (1/long rest)."
      },
      {
        "level": 11,
        "name": "Tranquility",
        "desc": "At the end of a long rest, gain an effect similar to Sanctuary."
      },
      {
        "level": 17,
        "name": "Quivering Palm",
        "desc": "Plant a lethal vibration that can be triggered later (Constitution saving throw)."
      }
    ]
  },
  "Oath of Devotion": {
    "key": "serment-de-devotion",
    "classKey": "paladin",
    "features": [
      {
        "level": 3,
        "name": "Oath Spells",
        "desc": "Bonus spells that are always prepared."
      },
      {
        "level": 3,
        "name": "Sacred Weapon",
        "desc": "Channel Divinity: your weapon gains +CHA mod. to attacks and emits light."
      },
      {
        "level": 7,
        "name": "Aura of Devotion",
        "desc": "You and nearby allies are immune to the charmed condition."
      },
      {
        "level": 15,
        "name": "Divine Allegiance",
        "desc": "Defensive reaction tied to your Divine Smite to protect an ally."
      },
      {
        "level": 20,
        "name": "Holy Nimbus",
        "desc": "Action: aura of sacred light boosting your attacks and saving throws (1/long rest)."
      }
    ]
  },
  "Hunter": {
    "key": "chasseur",
    "classKey": "rodeur",
    "features": [
      {
        "level": 3,
        "name": "Hunter's Prey",
        "desc": "Choose an offensive specialty (e.g. Giant Killer, Horde Breaker)."
      },
      {
        "level": 7,
        "name": "Defensive Tactics",
        "desc": "Choose a defensive option against numerous or powerful enemies."
      },
      {
        "level": 11,
        "name": "Multiattack",
        "desc": "Strike several targets (Volley) or one harder, once per turn."
      },
      {
        "level": 15,
        "name": "Superior Hunter's Defense",
        "desc": "Improved defensive reaction to absorb hits."
      }
    ]
  },
  "Thief": {
    "key": "voleur",
    "classKey": "roublard",
    "features": [
      {
        "level": 3,
        "name": "Fast Hands",
        "desc": "Use your Cunning Action (bonus action) to wield tools or use an object."
      },
      {
        "level": 3,
        "name": "Second-Story Work",
        "desc": "Climb with no extra movement cost; improved jumping."
      },
      {
        "level": 9,
        "name": "Supreme Sneak",
        "desc": "Advantage on Stealth if you don't move too fast this turn."
      },
      {
        "level": 13,
        "name": "Use Magic Device",
        "desc": "Ignore class/race/level requirements to use magic items."
      },
      {
        "level": 17,
        "name": "Thief's Reflexes",
        "desc": "Two turns in the first round of combat (one normal, one at initiative −10)."
      }
    ]
  },
  "Fiend Patron": {
    "key": "patron-fielon",
    "classKey": "occultiste",
    "features": [
      {
        "level": 3,
        "name": "Dark One's Blessing",
        "desc": "When you drop an enemy to 0 HP, gain temporary HP (CHA + warlock level)."
      },
      {
        "level": 6,
        "name": "Dark One's Own Luck",
        "desc": "Add a d10 to a failed check or saving throw (1/short or long rest)."
      },
      {
        "level": 10,
        "name": "Fiendish Resilience",
        "desc": "Choose resistance to one damage type (changeable on each rest)."
      },
      {
        "level": 14,
        "name": "Hurl Through Hell",
        "desc": "Action: hurl a creature through the Lower Planes (high psychic damage, saving throw to negate)."
      }
    ]
  }
};

