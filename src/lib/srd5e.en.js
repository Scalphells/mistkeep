// AUTO-GÉNÉRÉ — miroir anglais des données SRD 5.1. NE PAS ÉDITER À LA MAIN.
// Régénéré depuis les données FR + traductions (prose seule ; mécaniques copiées du FR).

export const CLASSES = [
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
        "desc": "Bonus action: +melee damage, advantage on STR checks, resistance to bludgeoning/piercing/slashing."
      },
      {
        "name": "Unarmored Defense",
        "desc": "While unarmored, AC = 10 + DEX mod. + CON mod."
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
        "desc": "Spellcaster (Charisma)."
      },
      {
        "name": "Bardic Inspiration",
        "desc": "Bonus action: grant a d6 die to an ally (regained on a long rest)."
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
        "desc": "Spellcaster (Wisdom)."
      },
      {
        "name": "Divine Domain",
        "desc": "Chosen at 1st level, grants spells and features."
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
        "desc": "Spellcaster (Wisdom)."
      },
      {
        "name": "Druidic",
        "desc": "The secret language of druids."
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
        "name": "Sorcerous Origin",
        "desc": "Source of power chosen at 1st level."
      }
    ],
    "subclasses": [
      "Draconic Bloodline"
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
        "desc": "Specialization chosen at 1st level (archery, defense…)."
      },
      {
        "name": "Second Wind",
        "desc": "Bonus action: regain 1d10 + level HP (short/long rest)."
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
        "desc": "Spellcaster (Intelligence)."
      },
      {
        "name": "Arcane Recovery",
        "desc": "On a short rest, regain some spell slots."
      }
    ],
    "subclasses": [
      "School of Conjuration"
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
        "name": "Unarmored Defense",
        "desc": "While unarmored and without a shield, AC = 10 + DEX mod. + WIS mod."
      },
      {
        "name": "Martial Arts",
        "desc": "Unarmed strikes using DEX, unarmed strike as a bonus action."
      }
    ],
    "subclasses": [
      "Way of the Open Hand"
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
        "name": "Divine Sense",
        "desc": "Detect nearby celestial/fiend/undead."
      },
      {
        "name": "Lay on Hands",
        "desc": "Healing pool = 5 × level HP (long rest)."
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
        "name": "Favored Enemy",
        "desc": "Advantage to track and recall information about a type of creature."
      },
      {
        "name": "Natural Explorer",
        "desc": "Proficiency in a favored type of terrain."
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
        "name": "Sneak Attack",
        "desc": "Extra damage (1d6 at level 1) with advantage or an adjacent ally."
      },
      {
        "name": "Expertise",
        "desc": "Double proficiency on 2 skills (or tools)."
      },
      {
        "name": "Thieves' Cant",
        "desc": "Secret coded jargon."
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
        "name": "Otherworldly Patron",
        "desc": "Pact made at level 1, grants spells."
      },
      {
        "name": "Pact Magic",
        "desc": "Spellcasting (Charisma); spell slots regained on a short rest."
      }
    ],
    "subclasses": [
      "The Fiend"
    ]
  }
];

export const RACES = [
  {
    "key": "humain",
    "label": "Human",
    "ability": {
      "str": 1,
      "dex": 1,
      "con": 1,
      "int": 1,
      "wis": 1,
      "cha": 1
    },
    "speed": 9,
    "darkvision": 0,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Versatile",
        "desc": "+1 to all ability scores."
      }
    ]
  },
  {
    "key": "elfe-haut",
    "label": "Elf (High Elf)",
    "ability": {
      "dex": 2,
      "int": 1
    },
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [
      "perception"
    ],
    "traits": [
      {
        "name": "Fey Ancestry",
        "desc": "Advantage against the charmed condition; immune to magical sleep."
      },
      {
        "name": "Keen Senses",
        "desc": "Proficiency in Perception."
      },
      {
        "name": "Trance",
        "desc": "Meditates 4 hours instead of sleeping 8 hours."
      },
      {
        "name": "Cantrip",
        "desc": "One wizard cantrip (Intelligence)."
      }
    ]
  },
  {
    "key": "elfe-sylvestre",
    "label": "Wood Elf",
    "ability": {
      "dex": 2,
      "wis": 1
    },
    "speed": 10.5,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [
      "perception"
    ],
    "traits": [
      {
        "name": "Fey Ancestry",
        "desc": "Advantage against the charmed condition; immune to magical sleep."
      },
      {
        "name": "Keen Senses",
        "desc": "Proficiency in Perception."
      },
      {
        "name": "Trance",
        "desc": "Meditates 4 hours instead of sleeping 8 hours."
      },
      {
        "name": "Mask of the Wild",
        "desc": "Can attempt to hide even when only lightly obscured by natural phenomena."
      }
    ]
  },
  {
    "key": "elfe-drow",
    "label": "Elf (Drow)",
    "ability": {
      "dex": 2,
      "cha": 1
    },
    "speed": 9,
    "darkvision": 36,
    "size": "M",
    "fixedSkills": [
      "perception"
    ],
    "traits": [
      {
        "name": "Fey Ancestry",
        "desc": "Advantage against the charmed condition; immune to magical sleep."
      },
      {
        "name": "Sunlight Sensitivity",
        "desc": "Disadvantage on attack rolls and sight-based Perception in direct sunlight."
      },
      {
        "name": "Drow Magic",
        "desc": "Dancing Lights cantrip (Charisma)."
      }
    ]
  },
  {
    "key": "nain-collines",
    "label": "Hill Dwarf",
    "ability": {
      "con": 2,
      "wis": 1
    },
    "speed": 7.5,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "hpPerLevel": 1,
    "traits": [
      {
        "name": "Dwarven Resilience",
        "desc": "Advantage on saving throws against poison, resistance to poison damage."
      },
      {
        "name": "Dwarven Toughness",
        "desc": "+1 HP per level."
      },
      {
        "name": "Dwarven Combat Training",
        "desc": "Proficiency with battleaxe, handaxe, light hammer, and warhammer."
      }
    ]
  },
  {
    "key": "nain-montagnes",
    "label": "Mountain Dwarf",
    "ability": {
      "con": 2,
      "str": 2
    },
    "speed": 7.5,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Dwarven Resilience",
        "desc": "Advantage on saving throws against poison, resistance to poison damage."
      },
      {
        "name": "Dwarven Armor Training",
        "desc": "Proficiency with light and medium armor."
      }
    ]
  },
  {
    "key": "halfelin-pied-leger",
    "label": "Halfling (Lightfoot)",
    "ability": {
      "dex": 2,
      "cha": 1
    },
    "speed": 7.5,
    "darkvision": 0,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Lucky",
        "desc": "Reroll a 1 on a d20 (attack, ability check, saving throw)."
      },
      {
        "name": "Brave",
        "desc": "Advantage on saving throws against being frightened."
      },
      {
        "name": "Halfling Nimbleness",
        "desc": "Move through the space of any creature larger than you."
      },
      {
        "name": "Naturally Stealthy",
        "desc": "Can hide behind a creature larger than you."
      }
    ]
  },
  {
    "key": "halfelin-robuste",
    "label": "Halfling (Stout)",
    "ability": {
      "dex": 2,
      "con": 1
    },
    "speed": 7.5,
    "darkvision": 0,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Lucky",
        "desc": "Reroll a 1 on a d20 (attack, ability check, saving throw)."
      },
      {
        "name": "Brave",
        "desc": "Advantage on saving throws against being frightened."
      },
      {
        "name": "Halfling Nimbleness",
        "desc": "Move through the space of any creature larger than you."
      },
      {
        "name": "Stout Resilience",
        "desc": "Advantage on saving throws against poison, resistance to poison damage."
      }
    ]
  },
  {
    "key": "drakeide",
    "label": "Dragonborn",
    "ability": {
      "str": 2,
      "cha": 1
    },
    "speed": 9,
    "darkvision": 0,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Draconic Ancestry",
        "desc": "Choice of dragon type (sets your breath weapon and resistance)."
      },
      {
        "name": "Breath Weapon",
        "desc": "Exhale area damage (saving throw, recharges on a short rest)."
      },
      {
        "name": "Damage Resistance",
        "desc": "Resistance to the damage type of your ancestry."
      }
    ]
  },
  {
    "key": "gnome-roches",
    "label": "Rock Gnome",
    "ability": {
      "int": 2,
      "con": 1
    },
    "speed": 7.5,
    "darkvision": 18,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Gnome Cunning",
        "desc": "Advantage on INT, WIS, and CHA saving throws against magic."
      },
      {
        "name": "Artificer's Lore",
        "desc": "Double proficiency bonus to identify magic items."
      },
      {
        "name": "Tinker",
        "desc": "Construct tiny clockwork devices."
      }
    ]
  },
  {
    "key": "gnome-forets",
    "label": "Forest Gnome",
    "ability": {
      "int": 2,
      "dex": 1
    },
    "speed": 7.5,
    "darkvision": 18,
    "size": "P",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Gnome Cunning",
        "desc": "Advantage on INT, WIS, and CHA saving throws against magic."
      },
      {
        "name": "Natural Illusionist",
        "desc": "You know the Minor Illusion cantrip (Intelligence)."
      },
      {
        "name": "Speak with Small Beasts",
        "desc": "Communicate simple ideas to Small or smaller beasts."
      }
    ]
  },
  {
    "key": "demi-elfe",
    "label": "Half-Elf",
    "ability": {
      "cha": 2
    },
    "abilityChoose": {
      "count": 2,
      "from": [
        "str",
        "dex",
        "con",
        "int",
        "wis"
      ],
      "amount": 1
    },
    "skillChoose": {
      "count": 2,
      "from": "all"
    },
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Fey Ancestry",
        "desc": "Advantage against the charmed condition; immune to magical sleep."
      },
      {
        "name": "Skill Versatility",
        "desc": "Proficiency in 2 skills of your choice (check manually)."
      }
    ]
  },
  {
    "key": "demi-orc",
    "label": "Half-Orc",
    "ability": {
      "str": 2,
      "con": 1
    },
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [
      "intimidation"
    ],
    "traits": [
      {
        "name": "Menacing",
        "desc": "Proficiency in Intimidation."
      },
      {
        "name": "Relentless Endurance",
        "desc": "Drop to 1 HP instead of 0 (once per long rest)."
      },
      {
        "name": "Savage Attacks",
        "desc": "On a melee critical hit, roll one extra weapon damage die."
      }
    ]
  },
  {
    "key": "tieffelin",
    "label": "Tiefling",
    "ability": {
      "cha": 2,
      "int": 1
    },
    "speed": 9,
    "darkvision": 18,
    "size": "M",
    "fixedSkills": [],
    "traits": [
      {
        "name": "Hellish Resistance",
        "desc": "Resistance to fire damage."
      },
      {
        "name": "Infernal Legacy",
        "desc": "You know the Thaumaturgy cantrip; additional spells at 3rd and 5th level (Charisma)."
      }
    ]
  }
];

export const CLASS_EQUIPMENT = {
  "barbare": [
    {
      "choose": [
        {
          "label": "A greataxe",
          "items": [
            {
              "nm": "Greataxe",
              "qty": 1
            }
          ]
        },
        {
          "label": "A martial melee weapon",
          "items": [
            {
              "nm": "Martial melee weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "Two handaxes",
          "items": [
            {
              "nm": "Handaxe",
              "qty": 2
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Explorer's pack",
          "qty": 1
        },
        {
          "nm": "Javelin",
          "qty": 4
        }
      ]
    }
  ],
  "barde": [
    {
      "choose": [
        {
          "label": "A rapier",
          "items": [
            {
              "nm": "Rapier",
              "qty": 1
            }
          ]
        },
        {
          "label": "A longsword",
          "items": [
            {
              "nm": "Longsword",
              "qty": 1
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A diplomat's pack",
          "items": [
            {
              "nm": "Diplomat's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "An entertainer's pack",
          "items": [
            {
              "nm": "Entertainer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A lute",
          "items": [
            {
              "nm": "Lute",
              "qty": 1
            }
          ]
        },
        {
          "label": "Another musical instrument",
          "items": [
            {
              "nm": "Musical instrument",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Leather armor",
          "qty": 1
        },
        {
          "nm": "Dagger",
          "qty": 1
        }
      ]
    }
  ],
  "clerc": [
    {
      "choose": [
        {
          "label": "A mace",
          "items": [
            {
              "nm": "Mace",
              "qty": 1
            }
          ]
        },
        {
          "label": "A warhammer (if proficient)",
          "items": [
            {
              "nm": "Warhammer",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "Scale mail",
          "items": [
            {
              "nm": "Scale mail",
              "qty": 1
            }
          ]
        },
        {
          "label": "Leather armor",
          "items": [
            {
              "nm": "Leather armor",
              "qty": 1
            }
          ]
        },
        {
          "label": "Chain mail (if proficient)",
          "items": [
            {
              "nm": "Chain mail",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A light crossbow and 20 bolts",
          "items": [
            {
              "nm": "Light crossbow",
              "qty": 1
            },
            {
              "nm": "Bolt",
              "qty": 20
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Shield",
          "qty": 1
        },
        {
          "nm": "Holy symbol",
          "qty": 1
        },
        {
          "nm": "Priest's pack",
          "qty": 1
        }
      ]
    }
  ],
  "druide": [
    {
      "choose": [
        {
          "label": "A wooden shield",
          "items": [
            {
              "nm": "Shield",
              "qty": 1
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A scimitar",
          "items": [
            {
              "nm": "Scimitar",
              "qty": 1
            }
          ]
        },
        {
          "label": "A simple melee weapon",
          "items": [
            {
              "nm": "Simple weapon (melee)",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Leather armor",
          "qty": 1
        },
        {
          "nm": "Explorer's pack",
          "qty": 1
        },
        {
          "nm": "Druidic focus",
          "qty": 1
        }
      ]
    }
  ],
  "ensorceleur": [
    {
      "choose": [
        {
          "label": "A light crossbow and 20 bolts",
          "items": [
            {
              "nm": "Light crossbow",
              "qty": 1
            },
            {
              "nm": "Bolt",
              "qty": 20
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A component pouch",
          "items": [
            {
              "nm": "Component pouch",
              "qty": 1
            }
          ]
        },
        {
          "label": "An arcane focus",
          "items": [
            {
              "nm": "Arcane focus",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dungeoneer's pack",
          "items": [
            {
              "nm": "Dungeoneer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Dagger",
          "qty": 2
        }
      ]
    }
  ],
  "guerrier": [
    {
      "choose": [
        {
          "label": "Chain mail",
          "items": [
            {
              "nm": "Chain mail",
              "qty": 1
            }
          ]
        },
        {
          "label": "Leather armor, a longbow, and 20 arrows",
          "items": [
            {
              "nm": "Leather armor",
              "qty": 1
            },
            {
              "nm": "Longbow",
              "qty": 1
            },
            {
              "nm": "Arrow",
              "qty": 20
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A martial weapon and a shield",
          "items": [
            {
              "nm": "Martial weapon",
              "qty": 1
            },
            {
              "nm": "Shield",
              "qty": 1
            }
          ]
        },
        {
          "label": "Two martial weapons",
          "items": [
            {
              "nm": "Martial weapon",
              "qty": 2
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A light crossbow and 20 bolts",
          "items": [
            {
              "nm": "Light crossbow",
              "qty": 1
            },
            {
              "nm": "Bolt",
              "qty": 20
            }
          ]
        },
        {
          "label": "Two handaxes",
          "items": [
            {
              "nm": "Handaxe",
              "qty": 2
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dungeoneer's pack",
          "items": [
            {
              "nm": "Dungeoneer's pack",
              "qty": 1
            }
          ]
        }
      ]
    }
  ],
  "magicien": [
    {
      "choose": [
        {
          "label": "A quarterstaff",
          "items": [
            {
              "nm": "Quarterstaff",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dagger",
          "items": [
            {
              "nm": "Dagger",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A component pouch",
          "items": [
            {
              "nm": "Component pouch",
              "qty": 1
            }
          ]
        },
        {
          "label": "An arcane focus",
          "items": [
            {
              "nm": "Arcane focus",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A scholar's pack",
          "items": [
            {
              "nm": "Scholar's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Spellbook",
          "qty": 1
        }
      ]
    }
  ],
  "moine": [
    {
      "choose": [
        {
          "label": "A shortsword",
          "items": [
            {
              "nm": "Shortsword",
              "qty": 1
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dungeoneer's pack",
          "items": [
            {
              "nm": "Dungeoneer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Dart",
          "qty": 10
        }
      ]
    }
  ],
  "paladin": [
    {
      "choose": [
        {
          "label": "A martial weapon and a shield",
          "items": [
            {
              "nm": "Martial weapon",
              "qty": 1
            },
            {
              "nm": "Shield",
              "qty": 1
            }
          ]
        },
        {
          "label": "Two martial weapons",
          "items": [
            {
              "nm": "Martial weapon",
              "qty": 2
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "Five javelins",
          "items": [
            {
              "nm": "Javelin",
              "qty": 5
            }
          ]
        },
        {
          "label": "A simple melee weapon",
          "items": [
            {
              "nm": "Simple weapon (melee)",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Chain mail",
          "qty": 1
        },
        {
          "nm": "Holy symbol",
          "qty": 1
        },
        {
          "nm": "Priest's pack",
          "qty": 1
        }
      ]
    }
  ],
  "rodeur": [
    {
      "choose": [
        {
          "label": "Scale mail",
          "items": [
            {
              "nm": "Scale mail",
              "qty": 1
            }
          ]
        },
        {
          "label": "Leather armor",
          "items": [
            {
              "nm": "Leather armor",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "Two shortswords",
          "items": [
            {
              "nm": "Shortsword",
              "qty": 2
            }
          ]
        },
        {
          "label": "Two simple melee weapons",
          "items": [
            {
              "nm": "Simple weapon (melee)",
              "qty": 2
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dungeoneer's pack",
          "items": [
            {
              "nm": "Dungeoneer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Longbow",
          "qty": 1
        },
        {
          "nm": "Arrow",
          "qty": 20
        }
      ]
    }
  ],
  "roublard": [
    {
      "choose": [
        {
          "label": "A rapier",
          "items": [
            {
              "nm": "Rapier",
              "qty": 1
            }
          ]
        },
        {
          "label": "A shortsword",
          "items": [
            {
              "nm": "Shortsword",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A shortbow and 20 arrows",
          "items": [
            {
              "nm": "Shortbow",
              "qty": 1
            },
            {
              "nm": "Arrow",
              "qty": 20
            }
          ]
        },
        {
          "label": "A shortsword",
          "items": [
            {
              "nm": "Shortsword",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A burglar's pack",
          "items": [
            {
              "nm": "Burglar's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "A dungeoneer's pack",
          "items": [
            {
              "nm": "Dungeoneer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Leather armor",
          "qty": 1
        },
        {
          "nm": "Dagger",
          "qty": 2
        },
        {
          "nm": "Thieves' tools",
          "qty": 1
        }
      ]
    }
  ],
  "occultiste": [
    {
      "choose": [
        {
          "label": "A light crossbow and 20 bolts",
          "items": [
            {
              "nm": "Light crossbow",
              "qty": 1
            },
            {
              "nm": "Bolt",
              "qty": 20
            }
          ]
        },
        {
          "label": "A simple weapon",
          "items": [
            {
              "nm": "Simple weapon",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A component pouch",
          "items": [
            {
              "nm": "Component pouch",
              "qty": 1
            }
          ]
        },
        {
          "label": "An arcane focus",
          "items": [
            {
              "nm": "Arcane focus",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "choose": [
        {
          "label": "A scholar's pack",
          "items": [
            {
              "nm": "Scholar's pack",
              "qty": 1
            }
          ]
        },
        {
          "label": "An explorer's pack",
          "items": [
            {
              "nm": "Explorer's pack",
              "qty": 1
            }
          ]
        }
      ]
    },
    {
      "fixed": [
        {
          "nm": "Leather armor",
          "qty": 1
        },
        {
          "nm": "Simple weapon",
          "qty": 1
        },
        {
          "nm": "Dagger",
          "qty": 2
        }
      ]
    }
  ]
};

export const BACKGROUNDS = [
  {
    "key": "acolyte",
    "label": "Acolyte",
    "skills": [
      "insight",
      "religion"
    ],
    "tools": "",
    "languages": "2 of your choice",
    "feature": {
      "name": "Shelter of the Faithful",
      "desc": "You and your companions receive free healing and care at a temple of your faith."
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
        "Stick of incense",
        5
      ],
      [
        "Vestments",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 15
  },
  {
    "key": "criminel",
    "label": "Criminal",
    "skills": [
      "deception",
      "stealth"
    ],
    "tools": "one type of gaming set, thieves' tools",
    "languages": "",
    "feature": {
      "name": "Criminal Contact",
      "desc": "You have a reliable contact in the criminal underworld who acts as your liaison."
    },
    "equipment": [
      [
        "Crowbar",
        1
      ],
      [
        "Dark common clothes with a hood",
        1
      ]
    ],
    "gold": 15
  },
  {
    "key": "soldat",
    "label": "Soldier",
    "skills": [
      "athletics",
      "intimidation"
    ],
    "tools": "one type of gaming set, land vehicles",
    "languages": "",
    "feature": {
      "name": "Military Rank",
      "desc": "Soldiers loyal to your former organization recognize your authority."
    },
    "equipment": [
      [
        "Insignia of rank",
        1
      ],
      [
        "Trophy taken from a fallen enemy",
        1
      ],
      [
        "Set of bone dice",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 10
  },
  {
    "key": "sage",
    "label": "Sage",
    "skills": [
      "arcana",
      "history"
    ],
    "tools": "",
    "languages": "2 of your choice",
    "feature": {
      "name": "Researcher",
      "desc": "When you don't know a piece of information, you often know where and from whom you can find it."
    },
    "equipment": [
      [
        "Bottle of ink",
        1
      ],
      [
        "Quill",
        1
      ],
      [
        "Small knife",
        1
      ],
      [
        "Letter from a dead colleague",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 10
  },
  {
    "key": "noble",
    "label": "Noble",
    "skills": [
      "history",
      "persuasion"
    ],
    "tools": "one type of gaming set",
    "languages": "1 of your choice",
    "feature": {
      "name": "Position of Privilege",
      "desc": "You are treated with respect in high society, and common folk try to accommodate you."
    },
    "equipment": [
      [
        "Fine clothes",
        1
      ],
      [
        "Signet ring",
        1
      ],
      [
        "Scroll of pedigree",
        1
      ]
    ],
    "gold": 25
  },
  {
    "key": "ermite",
    "label": "Hermit",
    "skills": [
      "medicine",
      "religion"
    ],
    "tools": "herbalism kit",
    "languages": "1 of your choice",
    "feature": {
      "name": "Discovery",
      "desc": "During your seclusion, you discovered a unique and powerful truth."
    },
    "equipment": [
      [
        "Scroll case",
        1
      ],
      [
        "Blanket",
        1
      ],
      [
        "Common clothes",
        1
      ],
      [
        "Herbalism kit",
        1
      ]
    ],
    "gold": 5
  },
  {
    "key": "artiste",
    "label": "Entertainer",
    "skills": [
      "acrobatics",
      "performance"
    ],
    "tools": "disguise kit, one type of musical instrument",
    "languages": "",
    "feature": {
      "name": "By Popular Demand",
      "desc": "You are welcomed and lodged wherever you perform, in exchange for your shows."
    },
    "equipment": [
      [
        "Musical instrument",
        1
      ],
      [
        "Gift from an admirer",
        1
      ],
      [
        "Costume",
        1
      ]
    ],
    "gold": 15
  },
  {
    "key": "charlatan",
    "label": "Charlatan",
    "skills": [
      "deception",
      "sleight"
    ],
    "tools": "disguise kit, forgery kit",
    "languages": "",
    "feature": {
      "name": "False Identity",
      "desc": "You have a credible second identity and can forge documents."
    },
    "equipment": [
      [
        "Fine clothes",
        1
      ],
      [
        "Disguise kit",
        1
      ],
      [
        "Con tools",
        1
      ]
    ],
    "gold": 15
  },
  {
    "key": "heros-du-peuple",
    "label": "Folk Hero",
    "skills": [
      "animal",
      "survival"
    ],
    "tools": "one type of artisan's tools, land vehicles",
    "languages": "",
    "feature": {
      "name": "Rustic Hospitality",
      "desc": "Common folk offer you shelter and will hide you if needed."
    },
    "equipment": [
      [
        "Artisan's tools",
        1
      ],
      [
        "Shovel",
        1
      ],
      [
        "Iron pot",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 10
  },
  {
    "key": "marin",
    "label": "Sailor",
    "skills": [
      "athletics",
      "perception"
    ],
    "tools": "navigator's tools, water vehicles",
    "languages": "",
    "feature": {
      "name": "Ship's Passage",
      "desc": "You can secure free passage on a ship for yourself and your companions."
    },
    "equipment": [
      [
        "Silk rope (15 m)",
        1
      ],
      [
        "Lucky charm",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 10
  },
  {
    "key": "artisan-de-guilde",
    "label": "Guild Artisan",
    "skills": [
      "insight",
      "persuasion"
    ],
    "tools": "one type of artisan's tools",
    "languages": "1 of your choice",
    "feature": {
      "name": "Guild Membership",
      "desc": "Your guild offers you support, lodging, and access to professional contacts."
    },
    "equipment": [
      [
        "Artisan's tools",
        1
      ],
      [
        "Letter of introduction",
        1
      ],
      [
        "Traveler's clothes",
        1
      ]
    ],
    "gold": 15
  },
  {
    "key": "enfant-des-rues",
    "label": "Urchin",
    "skills": [
      "sleight",
      "stealth"
    ],
    "tools": "disguise kit, thieves' tools",
    "languages": "",
    "feature": {
      "name": "City Secrets",
      "desc": "You know the secret passages and shortcuts of cities."
    },
    "equipment": [
      [
        "Small knife",
        1
      ],
      [
        "Map of your home city",
        1
      ],
      [
        "Pet mouse",
        1
      ],
      [
        "Common clothes",
        1
      ]
    ],
    "gold": 10
  }
];

export const SUBCLASSES = {
  "Path of the Berserker": {
    "key": "voie-du-berserker",
    "classKey": "barbare",
    "features": [
      {
        "level": 3,
        "name": "Frenzy",
        "desc": "While raging, an extra melee weapon attack as a bonus action; exhaustion when the rage ends."
      },
      {
        "level": 6,
        "name": "Mindless Rage",
        "desc": "While raging, you can't be charmed or frightened."
      },
      {
        "level": 10,
        "name": "Intimidating Presence",
        "desc": "Action: frighten a creature (Wisdom saving throw against your ability DC)."
      },
      {
        "level": 14,
        "name": "Retaliation",
        "desc": "When a creature within 1.5 m damages you, make a melee attack as a reaction."
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
        "desc": "3 skills of your choice."
      },
      {
        "level": 3,
        "name": "Cutting Words",
        "desc": "Reaction: expend a Bardic Inspiration die to reduce a creature's attack/check/damage."
      },
      {
        "level": 6,
        "name": "Additional Magical Secrets",
        "desc": "Learn 2 spells from any class."
      },
      {
        "level": 14,
        "name": "Peerless Skill",
        "desc": "For an ability check, add an expended Bardic Inspiration die."
      }
    ]
  },
  "Life Domain": {
    "key": "domaine-de-la-vie",
    "classKey": "clerc",
    "features": [
      {
        "level": 1,
        "name": "Domain Spells + heavy armor",
        "desc": "Bonus domain spells and heavy armor proficiency."
      },
      {
        "level": 1,
        "name": "Disciple of Life",
        "desc": "Your healing spells restore +2 + the spell's level."
      },
      {
        "level": 2,
        "name": "Channel Divinity: Preserve Life",
        "desc": "Restore a total of 5 × your cleric level HP, divided as you choose among creatures (those at ≤ ½ HP)."
      },
      {
        "level": 6,
        "name": "Blessed Healer",
        "desc": "When you cast a healing spell on others, you regain 2 + the spell's level in HP."
      },
      {
        "level": 8,
        "name": "Divine Strike",
        "desc": "1/turn: +1d8 radiant damage on a weapon attack (2d8 at level 14)."
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
        "level": 2,
        "name": "Bonus Cantrip",
        "desc": "One additional druid cantrip."
      },
      {
        "level": 2,
        "name": "Natural Recovery",
        "desc": "On a short rest, recover spell slots (up to ½ your druid level)."
      },
      {
        "level": 3,
        "name": "Circle Spells",
        "desc": "Bonus spells based on your chosen land (levels 3, 5, 7, 9)."
      },
      {
        "level": 6,
        "name": "Land's Stride",
        "desc": "Ignore natural difficult terrain and certain plant effects."
      },
      {
        "level": 10,
        "name": "Nature's Ward",
        "desc": "Immune to poison and disease; fey and elementals can't charm or frighten you."
      },
      {
        "level": 14,
        "name": "Nature's Sanctuary",
        "desc": "Action: prevent a creature from attacking you (Wisdom saving throw)."
      }
    ]
  },
  "Draconic Bloodline": {
    "key": "lignee-draconique",
    "classKey": "ensorceleur",
    "features": [
      {
        "level": 1,
        "name": "Draconic Ancestry",
        "desc": "Choose a dragon type (sets the associated damage type)."
      },
      {
        "level": 1,
        "name": "Draconic Resilience",
        "desc": "+1 HP per level; while unarmored, AC = 13 + DEX mod."
      },
      {
        "level": 6,
        "name": "Elemental Affinity",
        "desc": "+CHA mod to damage of your dragon's type; 1 sorcery point → resistance for 1 hr."
      },
      {
        "level": 14,
        "name": "Dragon Wings",
        "desc": "Grow wings, gaining a flying speed equal to your walking speed."
      },
      {
        "level": 18,
        "name": "Draconic Presence",
        "desc": "5 sorcery points: aura of frightening or charming presence within 18 m."
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
        "desc": "Score a critical hit on a roll of 19-20."
      },
      {
        "level": 7,
        "name": "Remarkable Athlete",
        "desc": "½ proficiency on STR/DEX/CON checks you aren't proficient in; longer running long jump."
      },
      {
        "level": 10,
        "name": "Additional Fighting Style",
        "desc": "A second Fighting Style of your choice."
      },
      {
        "level": 15,
        "name": "Superior Critical",
        "desc": "Score a critical hit on a roll of 18-20."
      },
      {
        "level": 18,
        "name": "Survivor",
        "desc": "Regain HP at the start of each turn if you're above half your HP."
      }
    ]
  },
  "School of Conjuration": {
    "key": "ecole-d-invocation",
    "classKey": "magicien",
    "features": [
      {
        "level": 2,
        "name": "Evocation Savant",
        "desc": "Copy evocation spells into your spellbook at half the cost and time."
      },
      {
        "level": 2,
        "name": "Sculpt Spells",
        "desc": "Allies in the area automatically succeed on their saving throw and take no damage."
      },
      {
        "level": 6,
        "name": "Potent Cantrip",
        "desc": "Your damaging cantrips deal half damage even on a successful save."
      },
      {
        "level": 10,
        "name": "Empowered Evocation",
        "desc": "+INT mod to the damage of one evocation spell each turn."
      },
      {
        "level": 14,
        "name": "Overchannel",
        "desc": "A spell of level ≤ 5 deals maximum damage (then you take damage in return)."
      }
    ]
  },
  "Way of the Open Hand": {
    "key": "voie-de-la-main-ouverte",
    "classKey": "moine",
    "features": [
      {
        "level": 3,
        "name": "Open Hand Technique",
        "desc": "With your Flurry of Blows: knock prone, push 4.5 m, or deny a reaction."
      },
      {
        "level": 6,
        "name": "Wholeness of Body",
        "desc": "Action: heal yourself for 3 × your monk level HP (1/long rest)."
      },
      {
        "level": 11,
        "name": "Tranquility",
        "desc": "At the end of a long rest, gain the effect of a sanctuary spell."
      },
      {
        "level": 17,
        "name": "Quivering Palm",
        "desc": "Sets up lethal vibrations you can trigger later (Constitution saving throw)."
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
        "name": "Channel Divinity",
        "desc": "Sacred Weapon (+CHA mod. to attacks, sheds light) or Turn the Unholy."
      },
      {
        "level": 7,
        "name": "Aura of Devotion",
        "desc": "You and allies within 3 m (6 m at level 18) are immune to the charmed condition."
      },
      {
        "level": 15,
        "name": "Purity of Spirit",
        "desc": "You are always under the effects of Protection from Evil and Good."
      },
      {
        "level": 20,
        "name": "Holy Nimbus",
        "desc": "1 min: aura of light, radiant damage, and advantage on saving throws against spells cast by fiends and undead."
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
        "desc": "Choose one: Colossus Slayer, Horde Breaker, or Giant Killer."
      },
      {
        "level": 7,
        "name": "Defensive Tactics",
        "desc": "Choose one: Escape the Horde, Multiattack Defense, or Steel Will."
      },
      {
        "level": 11,
        "name": "Multiattack",
        "desc": "Choose one: Volley or Whirlwind Attack."
      },
      {
        "level": 15,
        "name": "Superior Hunter's Defense",
        "desc": "Choose one: reduce the damage from a single source."
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
        "desc": "Bonus action: Use an Object, make a Sleight of Hand check, or use thieves' tools to pick a lock or disarm a trap."
      },
      {
        "level": 3,
        "name": "Second-Story Work",
        "desc": "Climbing costs no extra movement; improved jumping distance."
      },
      {
        "level": 9,
        "name": "Supreme Sneak",
        "desc": "Advantage on Stealth checks if you move no more than half your speed."
      },
      {
        "level": 13,
        "name": "Use Magic Device",
        "desc": "Ignore class, race, and level requirements for using a magic item."
      },
      {
        "level": 17,
        "name": "Thief's Reflexes",
        "desc": "Two turns during the first round of combat (separate initiative counts)."
      }
    ]
  },
  "The Fiend": {
    "key": "le-fielon",
    "classKey": "occultiste",
    "features": [
      {
        "level": 1,
        "name": "Expanded Spell List",
        "desc": "Additional spells made available through the pact."
      },
      {
        "level": 1,
        "name": "Dark One's Blessing",
        "desc": "When an enemy drops to 0 HP, gain temporary HP equal to CHA mod. + your level."
      },
      {
        "level": 6,
        "name": "Dark One's Own Luck",
        "desc": "1/short rest: add 1d10 to an ability check or a saving throw."
      },
      {
        "level": 10,
        "name": "Fiendish Resilience",
        "desc": "After each short rest, choose one damage resistance (except from magical or silvered weapons)."
      },
      {
        "level": 14,
        "name": "Hurl Through Hell",
        "desc": "1/long rest: hurl a creature through the lower planes (10d10 psychic damage)."
      }
    ]
  }
};

