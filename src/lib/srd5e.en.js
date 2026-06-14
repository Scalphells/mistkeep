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

/* PHB2014-EXTRA — full PHB 2014 subclass roster (mirrors srd5e.js). Stable key = FR slug. */
const _PHB2014_SUB_EN = {
  "Path of the Totem Warrior": {"key":"voie-du-totem","classKey":"barbare","features":[{"level":3,"name":"Spirit Seeker","desc":"You can cast beast sense and speak with animals as rituals."},{"level":3,"name":"Totem Spirit","desc":"Pick a totem: Bear (resistance to all damage except psychic while raging), Eagle (Dash as a bonus action and disadvantage on opportunity attacks against you) or Wolf (your allies get advantage on melee attacks vs foes within 5 ft of you)."},{"level":6,"name":"Aspect of the Beast","desc":"Lasting boon by totem: Bear (double carrying capacity, advantage on Strength checks to push, pull, lift or break), Eagle (see clearly up to 1 mile, no Perception disadvantage in dim light) or Wolf (track at a fast pace, move stealthily at a normal pace)."},{"level":10,"name":"Spirit Walker","desc":"You can cast commune with nature as a ritual, summoning a spirit that acts as your guide."},{"level":14,"name":"Totemic Attunement","desc":"Combat boon while raging by totem: Bear (foes within 5 ft have disadvantage to attack anyone but you), Eagle (gain a flying speed equal to your walking speed, used during your move) or Wolf (bonus action to knock a Large or smaller creature prone after hitting it in melee)."}]},
  "College of Valor": {"key":"college-de-la-vaillance","classKey":"barde","features":[{"level":3,"name":"Bonus Proficiencies","desc":"You gain proficiency with medium armor, shields, and martial weapons."},{"level":3,"name":"Combat Inspiration","desc":"A creature holding your Bardic Inspiration die can add it to one weapon damage roll, or to its AC against one incoming attack."},{"level":6,"name":"Extra Attack","desc":"You can attack twice, instead of once, whenever you take the Attack action on your turn."},{"level":14,"name":"Battle Magic","desc":"After taking the Attack action, you can cast one bard spell as a bonus action."}]},
  "Knowledge Domain": {"key":"domaine-de-la-connaissance","classKey":"clerc","features":[{"level":1,"name":"Blessings of Knowledge","desc":"You learn two languages and gain doubled proficiency in two skills among Arcana, History, Nature and Religion."},{"level":2,"name":"Channel Divinity: Knowledge of the Ages","desc":"As an action, gain proficiency with one skill or tool of your choice for 10 minutes."},{"level":6,"name":"Channel Divinity: Read Thoughts","desc":"Read a creature's surface thoughts, then probe deeper or impose a suggestion effect on it."},{"level":8,"name":"Potent Spellcasting","desc":"You add your Wisdom modifier to the damage of your cleric cantrips."},{"level":17,"name":"Visions of the Past","desc":"After meditating, you receive visions of an object's or an area's recent past."}]},
  "Light Domain": {"key":"domaine-de-la-lumiere","classKey":"clerc","features":[{"level":1,"name":"Bonus Cantrip & Warding Flare","desc":"You learn the light cantrip; as a reaction, impose disadvantage on an attack roll against you (uses = Wis mod)."},{"level":2,"name":"Channel Divinity: Radiance of the Dawn","desc":"As an action, dispel nearby magical darkness and deal 2d10 + cleric level radiant damage (Con save halves)."},{"level":6,"name":"Improved Warding Flare","desc":"You can use Warding Flare to protect another creature you can see, not just yourself."},{"level":8,"name":"Potent Spellcasting","desc":"You add your Wisdom modifier to the damage of your cleric cantrips."},{"level":17,"name":"Corona of Light","desc":"As an action, emit bright light for 1 minute; foes have disadvantage on saves against your fire and radiant spells."}]},
  "Nature Domain": {"key":"domaine-de-la-nature","classKey":"clerc","features":[{"level":1,"name":"Acolyte of Nature","desc":"You learn a druid cantrip, one skill among Animal Handling, Nature or Survival, and heavy armor proficiency."},{"level":2,"name":"Channel Divinity: Charm Animals and Plants","desc":"As an action, charm nearby beasts and plant creatures (Wis save) for 1 minute."},{"level":6,"name":"Dampen Elements","desc":"As a reaction, grant yourself or an ally taking the damage resistance to acid, cold, fire, lightning or thunder."},{"level":8,"name":"Divine Strike","desc":"Once per turn, add 1d8 cold, fire or lightning damage to a weapon hit (2d8 at level 14)."},{"level":17,"name":"Master of Nature","desc":"As a bonus action, verbally command beasts and plants charmed by your Channel Divinity."}]},
  "Tempest Domain": {"key":"domaine-de-la-tempete","classKey":"clerc","features":[{"level":1,"name":"Wrath of the Storm & Heavy Armor","desc":"You gain heavy armor proficiency; as a reaction when hit in melee, the attacker takes 2d8 lightning or thunder damage (Dex save halves, uses = Wis mod)."},{"level":2,"name":"Channel Divinity: Destructive Wrath","desc":"When you deal lightning or thunder damage, deal maximum on that damage roll instead of rolling."},{"level":6,"name":"Thunderbolt Strike","desc":"When you deal lightning damage to a Large or smaller creature, you can push it 10 feet away."},{"level":8,"name":"Divine Strike","desc":"Once per turn, add 1d8 thunder damage to a weapon hit (2d8 at level 14)."},{"level":17,"name":"Stormborn","desc":"You gain a flying speed equal to your walking speed while not underground or indoors."}]},
  "Trickery Domain": {"key":"domaine-de-la-tromperie","classKey":"clerc","features":[{"level":1,"name":"Blessing of the Trickster","desc":"As an action, give a willing creature advantage on Stealth checks for 1 hour."},{"level":2,"name":"Channel Divinity: Invoke Duplicity","desc":"As an action, create an illusory duplicate of yourself for 1 minute that grants advantage and serves as an origin for your spells."},{"level":6,"name":"Channel Divinity: Cloak of Shadows","desc":"As an action, become invisible until the end of your next turn."},{"level":8,"name":"Divine Strike","desc":"Once per turn, add 1d8 poison damage to a weapon hit (2d8 at level 14)."},{"level":17,"name":"Improved Duplicity","desc":"Your Invoke Duplicity creates up to four duplicates instead of one."}]},
  "War Domain": {"key":"domaine-de-la-guerre","classKey":"clerc","features":[{"level":1,"name":"War Priest & Martial Weapons","desc":"You gain martial weapon and heavy armor proficiency, and can make a weapon attack as a bonus action (uses = Wis mod)."},{"level":2,"name":"Channel Divinity: Guided Strike","desc":"You add +10 to an attack roll, yours or that of an ally you can see."},{"level":6,"name":"Channel Divinity: War God's Blessing","desc":"As a reaction, grant a nearby ally +10 to an attack roll."},{"level":8,"name":"Divine Strike","desc":"Once per turn, add 1d8 damage of the weapon's type to a weapon hit (2d8 at level 14)."},{"level":17,"name":"Avatar of Battle","desc":"You gain resistance to bludgeoning, piercing and slashing damage from nonmagical weapons."}]},
  "Circle of the Moon": {"key":"cercle-de-la-lune","classKey":"druide","features":[{"level":2,"name":"Combat Wild Shape","desc":"You can Wild Shape as a bonus action and, as a bonus action, spend a spell slot to recover 1d8 HP per level of the slot."},{"level":2,"name":"Circle Forms","desc":"You can transform into beasts of CR 1 starting at level 2, then up to a max CR equal to your druid level divided by 3 (rounded down) from level 6."},{"level":6,"name":"Primal Strike","desc":"Attacks in your beast forms count as magical for the purpose of bypassing resistances and immunities."},{"level":10,"name":"Elemental Wild Shape","desc":"You can expend two Wild Shape uses to turn into an air, earth, fire, or water elemental."},{"level":14,"name":"Thousand Forms","desc":"You cast Alter Self at will, without components, to alter your humanoid appearance."}]},
  "Wild Magic": {"key":"magie-sauvage","classKey":"ensorceleur","features":[{"level":1,"name":"Wild Magic Surge","desc":"On casting a spell of 1st level or higher, the DM may have you roll on the Wild Magic Surge table for a random chaotic effect."},{"level":1,"name":"Tides of Chaos","desc":"1/long rest: gain advantage on one attack roll, ability check, or saving throw; the DM may then trigger a Wild Magic Surge to restore the use."},{"level":6,"name":"Bend Luck","desc":"As a reaction, spend 2 sorcery points to add or subtract 1d4 to a visible creature's attack roll or saving throw."},{"level":14,"name":"Controlled Chaos","desc":"When you roll on the Wild Magic Surge table, roll twice and choose which result to use."},{"level":18,"name":"Spell Bombardment","desc":"1/turn: when a damage die for one of your spells rolls its maximum, roll one more die of that type and add it to the damage."}]},
  "Battle Master": {"key":"maitre-de-guerre","classKey":"guerrier","features":[{"level":3,"name":"Combat Superiority","desc":"Learn 3 maneuvers fueled by 4 superiority dice (d8) spent to add tactical effects to attacks."},{"level":3,"name":"Student of War","desc":"Gain proficiency with one type of artisan's tools of your choice."},{"level":7,"name":"Know Your Enemy","desc":"Observe a creature for 1 min to compare two of its capabilities with yours."},{"level":10,"name":"Improved Combat Superiority","desc":"Your superiority dice become d10s."},{"level":15,"name":"Relentless","desc":"Regain one superiority die when you roll initiative with none left."},{"level":18,"name":"Improved Combat Superiority","desc":"Your superiority dice become d12s."}]},
  "Eldritch Knight": {"key":"chevalier-occultiste","classKey":"guerrier","features":[{"level":3,"name":"Spellcasting","desc":"Learn wizard spells (mainly abjuration/evocation), cast using Intelligence."},{"level":3,"name":"Weapon Bond","desc":"Bond with up to 2 weapons; summon a bonded weapon as a bonus action and can't be disarmed of it."},{"level":7,"name":"War Magic","desc":"After casting a cantrip as an action, make one weapon attack as a bonus action."},{"level":10,"name":"Eldritch Strike","desc":"On a weapon hit, the target has disadvantage on its next saving throw against a spell you cast before the end of your next turn."},{"level":15,"name":"Arcane Charge","desc":"When you use Action Surge, teleport up to 30 ft to an unoccupied space."},{"level":18,"name":"Improved War Magic","desc":"After casting a spell as an action, make one weapon attack as a bonus action."}]},
  "School of Abjuration": {"key":"ecole-d-abjuration","classKey":"magicien","features":[{"level":2,"name":"Abjuration Savant","desc":"You copy abjuration spells into your spellbook for half the gold and time."},{"level":2,"name":"Arcane Ward","desc":"Casting an abjuration spell forms a ward that absorbs damage you take."},{"level":6,"name":"Projected Ward","desc":"As a reaction, your Arcane Ward absorbs damage taken by a creature within 30 ft."},{"level":10,"name":"Improved Abjuration","desc":"You add your proficiency bonus to ability checks made as part of an abjuration spell."},{"level":14,"name":"Spell Resistance","desc":"You have advantage on saving throws against spells and other magical effects."}]},
  "School of Conjuration": {"key":"ecole-de-conjuration","classKey":"magicien","features":[{"level":2,"name":"Conjuration Savant","desc":"You copy conjuration spells into your spellbook for half the gold and time."},{"level":2,"name":"Minor Conjuration","desc":"As an action, you conjure a small inanimate object you can hold, lasting up to 1 hour."},{"level":6,"name":"Benign Transposition","desc":"You teleport up to 30 ft, or swap places with a Medium or smaller creature you can see."},{"level":10,"name":"Focused Conjuration","desc":"Taking damage can't break your concentration on a conjuration spell."},{"level":14,"name":"Durable Summons","desc":"Creatures you summon with a conjuration spell gain 30 temporary hit points."}]},
  "School of Divination": {"key":"ecole-de-divination","classKey":"magicien","features":[{"level":2,"name":"Divination Savant","desc":"You copy divination spells into your spellbook for half the gold and time."},{"level":2,"name":"Portent","desc":"After a long rest, roll two d20s and reserve them to replace any attack, save, or ability check."},{"level":6,"name":"Expert Divination","desc":"Casting a divination spell of 2nd level or higher restores a lower-level spell slot."},{"level":10,"name":"The Third Eye","desc":"As an action, gain darkvision, ethereal sight, read any language, or see invisibility."},{"level":14,"name":"Greater Portent","desc":"You roll three d20s for your Portent feature instead of two."}]},
  "School of Enchantment": {"key":"ecole-d-enchantement","classKey":"magicien","features":[{"level":2,"name":"Enchantment Savant","desc":"You copy enchantment spells into your spellbook for half the gold and time."},{"level":2,"name":"Hypnotic Gaze","desc":"As an action, charm and incapacitate one creature within 5 ft while you maintain your gaze."},{"level":6,"name":"Instinctive Charm","desc":"As a reaction to being attacked, redirect the attacker against another creature (Wis save)."},{"level":10,"name":"Split Enchantment","desc":"When you cast a single-target enchantment spell, you can target a second creature."},{"level":14,"name":"Alter Memories","desc":"You make a charmed target unaware it was charmed and erase up to your INT mod hours of its memory."}]},
  "School of Illusion": {"key":"ecole-d-illusion","classKey":"magicien","features":[{"level":2,"name":"Illusion Savant","desc":"You copy illusion spells into your spellbook for half the gold and time."},{"level":2,"name":"Improved Minor Illusion","desc":"You learn Minor Illusion and can create both a sound and an image with one casting."},{"level":6,"name":"Malleable Illusions","desc":"As an action, you reshape one of your active illusion spells while it lasts."},{"level":10,"name":"Illusory Self","desc":"As a reaction, an illusory duplicate causes one attack that would hit you to miss instead."},{"level":14,"name":"Illusory Reality","desc":"You make one inanimate object from an illusion spell real for up to 1 minute."}]},
  "School of Necromancy": {"key":"ecole-de-necromancie","classKey":"magicien","features":[{"level":2,"name":"Necromancy Savant","desc":"You copy necromancy spells into your spellbook for half the gold and time."},{"level":2,"name":"Grim Harvest","desc":"Once a turn, killing a creature with a spell heals you for 2× the spell's level (3× if it's necromancy)."},{"level":6,"name":"Undead Thralls","desc":"You learn Animate Dead; your undead gain bonus HP and damage and you raise one extra."},{"level":10,"name":"Inured to Undeath","desc":"You gain resistance to necrotic damage and your hit point maximum can't be reduced."},{"level":14,"name":"Command Undead","desc":"As an action, you attempt to seize control of one undead within 60 ft (Charisma save)."}]},
  "School of Transmutation": {"key":"ecole-de-transmutation","classKey":"magicien","features":[{"level":2,"name":"Transmutation Savant","desc":"You copy transmutation spells into your spellbook for half the gold and time."},{"level":2,"name":"Minor Alchemy","desc":"You temporarily transform one nonmagical material into another for up to 1 hour."},{"level":6,"name":"Transmuter's Stone","desc":"You craft a stone granting a chosen benefit (speed, darkvision, CON save, or resistance)."},{"level":10,"name":"Shapechanger","desc":"You learn Polymorph and can cast it on yourself without a slot once per short or long rest."},{"level":14,"name":"Master Transmuter","desc":"You destroy your transmuter's stone for a major effect: transformation, panacea, restore life, or restore youth."}]},
  "Way of Shadow": {"key":"voie-de-l-ombre","classKey":"moine","features":[{"level":3,"name":"Shadow Arts","desc":"You know the Minor Illusion cantrip and can spend 2 ki points to cast Darkness, Darkvision, Pass Without Trace, or Silence."},{"level":6,"name":"Shadow Step","desc":"From dim light or darkness, use a bonus action to teleport up to 60 ft. to another such area, with advantage on your next melee attack this turn."},{"level":11,"name":"Cloak of Shadows","desc":"In dim light or darkness, take an action to become invisible until you attack, cast a spell, or enter bright light."},{"level":17,"name":"Opportunist","desc":"When a creature within 5 ft. of you is hit by an attack from someone other than you, you can use your reaction to make a melee attack against it."}]},
  "Way of the Four Elements": {"key":"voie-des-quatre-elements","classKey":"moine","features":[{"level":3,"name":"Disciple of the Elements","desc":"You learn elemental disciplines (including Elemental Attunement) and spend ki points to fuel elemental effects, gaining additional disciplines at levels 6, 11, and 17."}]},
  "Oath of the Ancients": {"key":"serment-des-anciens","classKey":"paladin","features":[{"level":3,"name":"Channel Divinity","desc":"Nature's Wrath (spectral vines restrain a foe, repeated Str/Dex save) or Turn the Faithless (fey and fiends are frightened and flee)."},{"level":7,"name":"Aura of Warding","desc":"You and friendly creatures within 10 ft (30 ft at level 18) have resistance to damage from spells."},{"level":15,"name":"Undying Sentinel","desc":"When reduced to 0 HP without being killed outright, you drop to 1 HP instead (1/long rest); you stop aging and can't be aged magically."},{"level":20,"name":"Elder Champion","desc":"1 min: regain 10 HP at the start of each turn, cast paladin spells (1-action) as a bonus action, and foes within 10 ft have disadvantage on saves vs your spells and Channel Divinity (1/long rest)."}]},
  "Oath of Vengeance": {"key":"serment-de-vengeance","classKey":"paladin","features":[{"level":3,"name":"Channel Divinity","desc":"Abjure Enemy (frighten a creature, Wis save) or Vow of Enmity (advantage on attacks against one target for 1 min)."},{"level":7,"name":"Relentless Avenger","desc":"When you hit a creature with an opportunity attack, you can move up to half your speed without provoking opportunity attacks."},{"level":15,"name":"Soul of Vengeance","desc":"Against a target of your Vow of Enmity, you can make a melee attack as a reaction when it attacks."},{"level":20,"name":"Avenging Angel","desc":"1 hour: gain flight (60 ft) and an aura that frightens enemies starting their turn within 30 ft (Wis save when it appears) (1/long rest)."}]},
  "Beast Master": {"key":"maitre-des-betes","classKey":"rodeur","features":[{"level":3,"name":"Ranger's Companion","desc":"A Small/Medium beast (CR 1/4 or lower) serves him, acting on his initiative, attacking on command, and gaining his proficiency bonus plus hit points tied to his level."},{"level":7,"name":"Exceptional Training","desc":"On any turn he doesn't command an attack, he can use a bonus action to have his beast Dash, Disengage, Dodge, or Help, and its attacks count as magical."},{"level":11,"name":"Bestial Fury","desc":"When he commands his beast to attack, it can make two attacks instead of one."},{"level":15,"name":"Share Spells","desc":"A spell he casts targeting only himself can also affect his beast companion if it is within 30 feet of him."}]},
  "Assassin": {"key":"assassin","classKey":"roublard","features":[{"level":3,"name":"Bonus Proficiencies","desc":"Proficiency with the disguise kit and the poisoner's kit."},{"level":3,"name":"Assassinate","desc":"Advantage on attacks against any creature that hasn't taken a turn, and any hit on a surprised creature is a critical."},{"level":9,"name":"Infiltration Expertise","desc":"Spend time and money to establish a convincing false identity."},{"level":13,"name":"Impostor","desc":"Flawlessly mimic the speech, writing, and mannerisms of a studied person."},{"level":17,"name":"Death Strike","desc":"When you hit a surprised creature, it makes a Constitution save or takes double damage."}]},
  "Arcane Trickster": {"key":"arnaqueur-arcanique","classKey":"roublard","features":[{"level":3,"name":"Spellcasting","desc":"Cast wizard spells using Intelligence, focused on enchantment and illusion."},{"level":3,"name":"Mage Hand Legerdemain","desc":"Invisible mage hand that can pick locks, disarm traps, and stow or retrieve items at range."},{"level":9,"name":"Magical Ambush","desc":"If you're hidden when you cast a spell, the target has disadvantage on its save against it."},{"level":13,"name":"Versatile Trickster","desc":"Bonus action: use mage hand to distract a creature, gaining advantage on attacks against it until your next turn."},{"level":17,"name":"Spell Thief","desc":"Reaction (1/long rest): on a successful save against a spell targeting you, negate it and learn it for 8 hours."}]},
  "The Archfey": {"key":"l-archifee","classKey":"occultiste","features":[{"level":1,"name":"Fey Presence","desc":"Action: each creature in a 10-ft cube must succeed on a Wisdom save or be charmed or frightened (your choice) until the end of your next turn; recharges on a short or long rest."},{"level":6,"name":"Misty Escape","desc":"When you take damage, reaction to turn invisible and teleport up to 60 ft to an unoccupied space you can see; once per short or long rest."},{"level":10,"name":"Beguiling Defenses","desc":"You're immune to being charmed; when a creature tries to charm you, you can turn the effect back on it, forcing a Wisdom save or it is charmed instead."},{"level":14,"name":"Dark Delirium","desc":"Action: once per short or long rest, drag a creature you can see within 60 ft into an illusory realm, charming or frightening it for 1 min (a Wisdom save each time it takes damage ends the effect)."}]},
  "The Great Old One": {"key":"le-grand-ancien","classKey":"occultiste","features":[{"level":1,"name":"Awakened Mind","desc":"You can telepathically speak to any creature within 30 ft that understands a language, though it can't reply telepathically."},{"level":6,"name":"Entropic Ward","desc":"When a creature attacks you, reaction to impose disadvantage; if it misses, your next attack against it has advantage; once per short or long rest."},{"level":10,"name":"Thought Shield","desc":"Your thoughts can't be read; you gain resistance to psychic damage, and a creature that deals you psychic damage takes the same amount."},{"level":14,"name":"Create Thrall","desc":"Action: touch an incapacitated humanoid to charm it until it is cured, and you can telepathically communicate with it anywhere on the same plane."}]},
};
Object.assign(SUBCLASSES, _PHB2014_SUB_EN);
{
  const _byClass = {};
  for (const [_lab, _sc] of Object.entries(_PHB2014_SUB_EN)) (_byClass[_sc.classKey] ||= []).push(_lab);
  for (const _c of CLASSES) if (_byClass[_c.key]) _c.subclasses = [..._c.subclasses, ..._byClass[_c.key]];
}
