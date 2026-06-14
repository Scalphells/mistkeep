// AUTO-GÉNÉRÉ — miroir anglais des données Pathfinder 2e (Remaster). NE PAS ÉDITER À LA MAIN.
// Régénéré depuis les données FR + traductions (prose seule ; mécaniques copiées du FR).

export const ANCESTRIES = [
  {
    "key": "nain",
    "label": "Dwarf",
    "hp": 10,
    "size": "M",
    "speed": 6,
    "darkvision": 18,
    "boosts": [
      "con",
      "wis"
    ],
    "traits": [
      {
        "name": "Darkvision",
        "desc": "You see in darkness as if in full light (without color)."
      },
      {
        "name": "Dwarven Toughness",
        "desc": "High ancestry HP (10)."
      }
    ]
  },
  {
    "key": "elfe",
    "label": "Elf",
    "hp": 6,
    "size": "M",
    "speed": 9,
    "darkvision": 0,
    "boosts": [
      "dex",
      "int"
    ],
    "traits": [
      {
        "name": "Low-Light Vision",
        "desc": "You ignore the dim light condition (reduced visibility)."
      },
      {
        "name": "Fleet",
        "desc": "Speed of 9 m, higher than normal."
      }
    ]
  },
  {
    "key": "gnome",
    "label": "Gnome",
    "hp": 8,
    "size": "P",
    "speed": 7.5,
    "darkvision": 0,
    "boosts": [
      "con",
      "cha"
    ],
    "traits": [
      {
        "name": "Low-Light Vision",
        "desc": "You ignore the dim light condition."
      },
      {
        "name": "Small",
        "desc": "Size category Small."
      }
    ]
  },
  {
    "key": "gobelin",
    "label": "Goblin",
    "hp": 6,
    "size": "P",
    "speed": 7.5,
    "darkvision": 18,
    "boosts": [
      "dex",
      "cha"
    ],
    "traits": [
      {
        "name": "Darkvision",
        "desc": "You see in total darkness."
      },
      {
        "name": "Small",
        "desc": "Size category Small."
      }
    ]
  },
  {
    "key": "halfelin",
    "label": "Halfling",
    "hp": 6,
    "size": "P",
    "speed": 7.5,
    "darkvision": 0,
    "boosts": [
      "dex",
      "wis"
    ],
    "traits": [
      {
        "name": "Keen Eyes",
        "desc": "You Seek hidden creatures with greater acuity."
      },
      {
        "name": "Small",
        "desc": "Size category Small."
      }
    ]
  },
  {
    "key": "humain",
    "label": "Human",
    "hp": 8,
    "size": "M",
    "speed": 7.5,
    "darkvision": 0,
    "boosts": [],
    "free": 2,
    "traits": [
      {
        "name": "Skill Versatility",
        "desc": "Two free attribute boosts and an extra feat (ancestry or skill)."
      }
    ]
  },
  {
    "key": "leshy",
    "label": "Leshy",
    "hp": 8,
    "size": "P",
    "speed": 7.5,
    "darkvision": 0,
    "boosts": [
      "con",
      "wis"
    ],
    "traits": [
      {
        "name": "Low-Light Vision",
        "desc": "You ignore the dim light condition."
      },
      {
        "name": "Plant Nourishment",
        "desc": "Plant creature: you don't need to breathe, eat, or sleep like others."
      }
    ]
  },
  {
    "key": "orc",
    "label": "Orc",
    "hp": 10,
    "size": "M",
    "speed": 7.5,
    "darkvision": 18,
    "boosts": [],
    "free": 2,
    "traits": [
      {
        "name": "Darkvision",
        "desc": "You see in total darkness."
      },
      {
        "name": "Hardy",
        "desc": "High ancestry HP (10)."
      }
    ]
  }
];

export const BACKGROUNDS_PF2E = [
  {
    "key": "acolyte",
    "label": "Acolyte",
    "boosts": [
      "int",
      "wis"
    ],
    "skills": [
      "religion"
    ],
    "feat": "Natural Medicine or Religion."
  },
  {
    "key": "artisan",
    "label": "Artisan",
    "boosts": [
      "str",
      "int"
    ],
    "skills": [
      "artisanat"
    ],
    "feat": "Crafting specialist."
  },
  {
    "key": "criminel",
    "label": "Criminal",
    "boosts": [
      "dex",
      "int"
    ],
    "skills": [
      "discretion"
    ],
    "feat": "Skilled in trickery."
  },
  {
    "key": "eclaireur",
    "label": "Scout",
    "boosts": [
      "dex",
      "wis"
    ],
    "skills": [
      "survie"
    ],
    "feat": "Experienced tracker."
  },
  {
    "key": "erudit",
    "label": "Sage",
    "boosts": [
      "int",
      "wis"
    ],
    "skills": [
      "arcanes"
    ],
    "feat": "Research assistant (Lore of your choice)."
  },
  {
    "key": "noble",
    "label": "Noble",
    "boosts": [
      "int",
      "cha"
    ],
    "skills": [
      "societe"
    ],
    "feat": "Savvy courtier."
  },
  {
    "key": "soldat",
    "label": "Soldier",
    "boosts": [
      "str",
      "con"
    ],
    "skills": [
      "athletisme"
    ],
    "feat": "Warfare Lore."
  }
];

export const CLASSES_PF2E = [
  {
    "key": "barbare",
    "label": "Barbarian",
    "keyAbility": [
      "str"
    ],
    "hp": 12,
    "perception": 2,
    "saves": {
      "fort": 2,
      "ref": 1,
      "will": 2
    },
    "skills": 3,
    "features": [
      {
        "name": "Rage",
        "desc": "Action: you enter Rage (extra damage, temporary HP), 1 min, then fatigued."
      },
      {
        "name": "Instinct",
        "desc": "Your instinct (animal, dragon, giant…) shapes your Rage."
      }
    ]
  },
  {
    "key": "barde",
    "label": "Bard",
    "keyAbility": [
      "cha"
    ],
    "hp": 8,
    "perception": 2,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 4,
    "features": [
      {
        "name": "Occult Spellcasting",
        "desc": "Occult spontaneous caster (Charisma)."
      },
      {
        "name": "Muse",
        "desc": "A muse (enigma, maestro, polymath…) grants a feat and a spell."
      }
    ]
  },
  {
    "key": "champion",
    "label": "Champion",
    "keyAbility": [
      "str",
      "dex"
    ],
    "hp": 10,
    "perception": 1,
    "saves": {
      "fort": 2,
      "ref": 1,
      "will": 2
    },
    "skills": 2,
    "features": [
      {
        "name": "Cause",
        "desc": "Your cause (liberator, paladin, redeemer…) defines your champion's reaction."
      },
      {
        "name": "Lay on Hands",
        "desc": "Champion's healing spell."
      }
    ]
  },
  {
    "key": "clerc",
    "label": "Cleric",
    "keyAbility": [
      "wis"
    ],
    "hp": 8,
    "perception": 1,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 2,
    "features": [
      {
        "name": "Divine Spellcasting",
        "desc": "Divine prepared caster (Wisdom)."
      },
      {
        "name": "Doctrine",
        "desc": "Cloistered Cleric (healing) or Warpriest (war); your deity's domain spells."
      }
    ]
  },
  {
    "key": "druide",
    "label": "Druid",
    "keyAbility": [
      "wis"
    ],
    "hp": 8,
    "perception": 1,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 2,
    "features": [
      {
        "name": "Primal Spellcasting",
        "desc": "Primal prepared caster (Wisdom)."
      },
      {
        "name": "Druidic Order",
        "desc": "An order (animal, leaf, flame, storm…) grants a feat and a spell."
      }
    ]
  },
  {
    "key": "guerrier",
    "label": "Fighter",
    "keyAbility": [
      "str",
      "dex"
    ],
    "hp": 10,
    "perception": 2,
    "saves": {
      "fort": 2,
      "ref": 2,
      "will": 1
    },
    "skills": 3,
    "features": [
      {
        "name": "Weapon Mastery",
        "desc": "You're Expert with a weapon group (the best attack bonus in the game)."
      },
      {
        "name": "Attack of Opportunity",
        "desc": "Reaction: Strike a creature that lets its guard down within your reach."
      }
    ]
  },
  {
    "key": "moine",
    "label": "Monk",
    "keyAbility": [
      "str",
      "dex"
    ],
    "hp": 10,
    "perception": 1,
    "saves": {
      "fort": 2,
      "ref": 2,
      "will": 2
    },
    "skills": 4,
    "features": [
      {
        "name": "Martial Arts",
        "desc": "Improved unarmed attacks (damage die, agile, unarmed)."
      },
      {
        "name": "Powerful Fist or Path",
        "desc": "Ki Strike (focus) or a starting martial style."
      }
    ]
  },
  {
    "key": "pisteur",
    "label": "Ranger",
    "keyAbility": [
      "str",
      "dex"
    ],
    "hp": 10,
    "perception": 2,
    "saves": {
      "fort": 2,
      "ref": 2,
      "will": 1
    },
    "skills": 4,
    "features": [
      {
        "name": "Hunt Prey",
        "desc": "Action: designate prey; bonus to Seek and to repeated attacks against it."
      },
      {
        "name": "Hunter's Edge",
        "desc": "Precision or power against your prey."
      }
    ]
  },
  {
    "key": "roublard",
    "label": "Rogue",
    "keyAbility": [
      "dex"
    ],
    "hp": 8,
    "perception": 2,
    "saves": {
      "fort": 1,
      "ref": 2,
      "will": 2
    },
    "skills": 7,
    "features": [
      {
        "name": "Sneak Attack",
        "desc": "+1d6 (increasing) against an off-guard or incapacitated target."
      },
      {
        "name": "Rogue's Racket",
        "desc": "A racket (scoundrel, thief, spy…) that changes your key ability and edge."
      }
    ]
  },
  {
    "key": "ensorceleur",
    "label": "Sorcerer",
    "keyAbility": [
      "cha"
    ],
    "hp": 6,
    "perception": 1,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 2,
    "features": [
      {
        "name": "Spontaneous Spellcasting",
        "desc": "Spontaneous caster; tradition depends on your bloodline (Charisma)."
      },
      {
        "name": "Bloodline",
        "desc": "A bloodline (draconic, elemental, fey…) grants blood magic and powers."
      }
    ]
  },
  {
    "key": "sorcier",
    "label": "Witch",
    "keyAbility": [
      "int"
    ],
    "hp": 6,
    "perception": 1,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 3,
    "features": [
      {
        "name": "Spellcasting",
        "desc": "Prepared caster; tradition based on your patron (Intelligence)."
      },
      {
        "name": "Familiar & Patron",
        "desc": "A familiar carrying your spells and a patron granting a spell and hex magic."
      }
    ]
  },
  {
    "key": "magicien",
    "label": "Wizard",
    "keyAbility": [
      "int"
    ],
    "hp": 6,
    "perception": 1,
    "saves": {
      "fort": 1,
      "ref": 1,
      "will": 2
    },
    "skills": 2,
    "features": [
      {
        "name": "Arcane Spellcasting",
        "desc": "Arcane prepared caster; spellbook (Intelligence)."
      },
      {
        "name": "Arcane School or Thesis",
        "desc": "An arcane school (or universalist thesis) grants a slot and school spells."
      }
    ]
  }
];

