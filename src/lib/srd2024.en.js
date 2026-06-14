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

/* PHB2024-EXTRA — full PHB 2024 subclass roster (mirrors srd2024.js). Stable key = FR slug. */
const _PHB2024_SUB_EN = {
  "Path of the Wild Heart": {"key":"voie-du-c-ur-sauvage","classKey":"barbare","features":[{"level":3,"name":"Animal Speaker","desc":"You can cast Beast Sense and Speak with Animals, but only as Rituals."},{"level":3,"name":"Rage of the Wilds","desc":"When you Rage, pick a spirit: Bear (Resistance to nearly all damage types), Eagle (Disengage and Dash as a Bonus Action) or Wolf (allies have Advantage against foes within 5 feet of you)."},{"level":6,"name":"Aspect of the Wilds","desc":"You gain a lasting animal boon for out-of-combat utility (Owl: Darkvision; Panther: Climb Speed; Salmon: Swim Speed), changeable on each Long Rest."},{"level":10,"name":"Nature Speaker","desc":"You can cast Commune with Nature, but only as a Ritual (Wisdom is your spellcasting ability)."},{"level":14,"name":"Power of the Wilds","desc":"When you Rage, choose a power: Falcon (Fly Speed while unarmored), Lion (adjacent foes have Disadvantage attacking anyone but you) or Ram (knock a Large-or-smaller target you hit in melee Prone)."}]},
  "Path of the World Tree": {"key":"voie-de-l-arbre-monde","classKey":"barbare","features":[{"level":3,"name":"Vitality of the Tree","desc":"When you Rage, gain Temporary HP equal to your Barbarian level, and at the start of each of your turns while raging you can grant Temporary HP to a creature within 10 feet."},{"level":6,"name":"Branches of the Tree","desc":"While raging, as a Reaction, spectral branches seize a creature within 30 feet and teleport it to an unoccupied space within 5 feet of you."},{"level":10,"name":"Battering Roots","desc":"The reach of your Heavy and Versatile melee weapons increases by 10 feet on your turn, and you can use the Push or Topple mastery property with them."},{"level":14,"name":"Travel along the Tree","desc":"While raging, you can teleport 60 feet on each of your turns, and once per Rage you can extend the range and bring up to six willing creatures with you."}]},
  "Path of the Zealot": {"key":"voie-du-zelateur","classKey":"barbare","features":[{"level":3,"name":"Divine Fury","desc":"While raging, the first creature you hit each turn takes extra damage equal to 1d6 plus half your Barbarian level, Necrotic or Radiant (your choice)."},{"level":3,"name":"Warrior of the Gods","desc":"You have a pool of d12s you can spend as a Bonus Action to heal yourself; it refreshes on a Long Rest and grows as you level."},{"level":6,"name":"Fanatical Focus","desc":"Once per Rage, if you fail a saving throw, you can reroll it with a bonus equal to your Rage Damage bonus and must use the new roll."},{"level":10,"name":"Zealous Presence","desc":"As a Bonus Action, up to ten creatures of your choice within 60 feet gain Advantage on attack rolls and saving throws until the start of your next turn (1/Long Rest, regained by expending a Rage)."},{"level":14,"name":"Rage of the Gods","desc":"When you Rage, you assume a divine warrior form (Fly Speed and resistances) and can expend a Rage to keep yourself or an ally from dropping to 0 HP."}]},
  "College of Dance": {"key":"college-de-la-danse","classKey":"barde","features":[{"level":3,"name":"Dazzling Footwork","desc":"While unarmored and unshielded, your AC = 10 + DEX + CHA, your Unarmed Strikes deal your Bardic Inspiration die + DEX (without expending it), and you have Advantage on Performance checks involving dance."},{"level":6,"name":"Inspiring Movement","desc":"When a visible foe ends its turn within 5 feet of you, spend Bardic Inspiration as a Reaction to move yourself and a nearby ally up to half your Speed each without provoking Opportunity Attacks."},{"level":6,"name":"Tandem Footwork","desc":"When you roll Initiative and aren't Incapacitated, roll and add a Bardic Inspiration die to your Initiative and to that of each ally within 30 feet who can see or hear you."},{"level":14,"name":"Leading Evasion","desc":"When you succeed on a Dexterity save for half damage, you take none instead (and only half on a failure), and you can share this benefit with creatures within 5 feet making the same save."}]},
  "College of Glamour": {"key":"college-de-la-seduction","classKey":"barde","features":[{"level":3,"name":"Beguiling Magic","desc":"You always have Charm Person and Mirror Image prepared, and after casting an Enchantment or Illusion spell you can force a nearby creature to make a Wisdom save or be Charmed or Frightened by you."},{"level":3,"name":"Mantle of Inspiration","desc":"Bonus Action: spend Bardic Inspiration to grant several nearby allies temporary HP equal to twice the die rolled, and each can immediately use its Reaction to move without provoking Opportunity Attacks."},{"level":6,"name":"Mantle of Majesty","desc":"Bonus Action: cast Command without a slot, then again each turn as a Bonus Action for 1 minute; any creature you have Charmed automatically fails its save."},{"level":14,"name":"Unbreakable Majesty","desc":"Bonus Action: for 1 minute, the first time a creature hits you on its turn it must succeed on a Charisma save or the attack misses."}]},
  "College of Valor": {"key":"college-de-la-vaillance","classKey":"barde","features":[{"level":3,"name":"Martial Training","desc":"You gain proficiency with Martial weapons, training with Medium armor and Shields, and you can use a Simple or Martial weapon as a Spellcasting Focus."},{"level":3,"name":"Combat Inspiration","desc":"A creature holding your Bardic Inspiration can add the die to a damage roll after hitting, or as a Reaction when hit add it to its AC against that attack."},{"level":6,"name":"Extra Attack","desc":"You can attack twice, instead of once, whenever you take the Attack action on your turn."},{"level":14,"name":"Battle Magic","desc":"After you cast a spell that has a casting time of an action, you can make one weapon attack as a Bonus Action."}]},
  "Light Domain": {"key":"domaine-de-la-lumiere","classKey":"clerc","features":[{"level":3,"name":"Light Domain Spells","desc":"You always have the domain spells prepared and gain the Light cantrip if you don't know it."},{"level":3,"name":"Warding Flare","desc":"As a Reaction (Prof. Bonus/long rest), you impose Disadvantage on the attack roll of a nearby attacker you can see."},{"level":6,"name":"Radiance of the Dawn","desc":"Channel Divinity (action): you emit light dealing radiant damage to nearby foes, with a Constitution save for half."},{"level":17,"name":"Corona of Light","desc":"As a Bonus Action, you radiate light for 10 minutes, giving affected foes Disadvantage on saves against your fire and radiant spells."}]},
  "Trickery Domain": {"key":"domaine-de-la-tromperie","classKey":"clerc","features":[{"level":3,"name":"Trickery Domain Spells","desc":"You always have the Trickery domain spells prepared."},{"level":3,"name":"Blessing of the Trickster","desc":"As a Bonus Action, you grant yourself or a nearby ally Advantage on Stealth checks for 1 hour."},{"level":3,"name":"Invoke Duplicity","desc":"Channel Divinity (Bonus Action): you conjure an illusory duplicate for 1 minute that you can move and cast spells through."},{"level":6,"name":"Trickster's Transposition","desc":"As part of the Bonus Action that moves your duplicate, you can teleport to swap places with it."},{"level":17,"name":"Improved Duplicity","desc":"Your Invoke Duplicity creates up to four duplicates at once, and you can transpose with any of them."}]},
  "War Domain": {"key":"domaine-de-la-guerre","classKey":"clerc","features":[{"level":3,"name":"War Domain Spells","desc":"You always have the domain spells prepared and gain proficiency with Martial weapons and Heavy armor."},{"level":3,"name":"War Priest","desc":"As a Bonus Action (Prof. Bonus/long rest), you make one extra weapon attack."},{"level":6,"name":"War God's Blessing","desc":"Channel Divinity (Reaction): you add a +10 bonus to the attack roll of a nearby creature you can see, yours or an ally's."},{"level":17,"name":"Avatar of Battle","desc":"You gain Resistance to Bludgeoning, Piercing, and Slashing damage from nonmagical attacks."}]},
  "Circle of the Moon": {"key":"cercle-de-la-lune","classKey":"druide","features":[{"level":3,"name":"Circle Forms","desc":"In Wild Shape you gain a minimum AC (13 + your Wisdom mod), Temporary HP (three times your level), and can assume a higher-Challenge-Rating beast."},{"level":3,"name":"Circle of the Moon Spells","desc":"Always-prepared bonus spells (Cure Wounds, Moonbeam, Starry Wisp…) that you can cast even while in Wild Shape."},{"level":6,"name":"Improved Circle Forms","desc":"Your Wild Shape attacks deal extra Radiant damage and you add your Wisdom modifier to Constitution saving throws."},{"level":10,"name":"Moonlight Step","desc":"As a Bonus Action you teleport up to 30 feet and gain Advantage on your next attack this turn, with uses tied to your Wisdom modifier."},{"level":14,"name":"Lunar Form","desc":"Once per turn you deal an extra 2d10 Radiant damage with a Wild Shape attack, and your Moonlight Step can also teleport a nearby ally."}]},
  "Circle of the Sea": {"key":"cercle-des-mers","classKey":"druide","features":[{"level":3,"name":"Wrath of the Sea","desc":"By spending a Wild Shape use you create a 5-foot sea emanation that, each turn, strikes a nearby creature for Cold or Lightning damage and pushes it."},{"level":3,"name":"Circle of the Sea Spells","desc":"Always-prepared bonus spells tied to water and wind (Fog Cloud, Gust of Wind, Thunderwave, Cone of Cold…)."},{"level":6,"name":"Aquatic Affinity","desc":"Your emanation's radius increases to 10 feet and you gain a swim speed equal to your Speed."},{"level":10,"name":"Stormborn","desc":"While your Wrath of the Sea is active, you gain a fly speed and resistance to Cold, Lightning, and Thunder damage."},{"level":14,"name":"Oceanic Gift","desc":"You can manifest your emanation around a willing creature within 60 feet, which gains all its benefits using your save DC and Wisdom."}]},
  "Circle of Stars": {"key":"cercle-des-astres","classKey":"druide","features":[{"level":3,"name":"Star Map","desc":"You create a celestial chart that serves as a spellcasting focus; while holding it, Guidance and Guiding Bolt are prepared and you can cast Guiding Bolt without a slot, with uses tied to your Wisdom."},{"level":3,"name":"Starry Form","desc":"By spending a Wild Shape use you take a constellation: Archer (ranged Radiant attack), Chalice (healing) or Dragon (steadier concentration and Int/Wis checks)."},{"level":6,"name":"Cosmic Omen","desc":"After each long rest, roll a die for a Weal (add 1d6) or Woe (subtract 1d6) omen you spend on rolls, with uses tied to your Wisdom."},{"level":10,"name":"Twinkling Constellations","desc":"The Archer and Chalice damage rises from 1d8 to 2d8, the Dragon gains a flying speed with hovering, and you can change constellation each turn."},{"level":14,"name":"Full of Stars","desc":"While your Starry Form is active, you become partially incorporeal and gain resistance to Bludgeoning, Piercing, and Slashing damage."}]},
  "Aberrant Sorcery": {"key":"sorcellerie-aberrante","classKey":"ensorceleur","features":[{"level":3,"name":"Psionic Spells","desc":"You always have a set of psionic spells prepared, expanding as you level up, and they don't count against your spells known."},{"level":3,"name":"Telepathic Speech","desc":"Bonus Action: you forge a telepathic link with one creature within 30 feet for a number of minutes equal to your Charisma modifier."},{"level":6,"name":"Psionic Sorcery","desc":"You can cast one of your psionic spells by spending Sorcery Points equal to its level, with no Verbal, Somatic, or non-consumed Material components."},{"level":6,"name":"Psychic Defenses","desc":"You gain Resistance to Psychic damage and Advantage on saving throws to avoid or end the Charmed and Frightened conditions."},{"level":14,"name":"Revelation in Flesh","desc":"Bonus Action: spend Sorcery Points to reshape your body for 10 minutes, gaining flight, a swim speed, see invisibility, or the ability to squeeze through gaps."},{"level":18,"name":"Warping Implosion","desc":"Action: you teleport up to 120 feet, then pull creatures toward your starting point and deal Force damage to them (Strength save)."}]},
  "Clockwork Sorcery": {"key":"sorcellerie-mecanique","classKey":"ensorceleur","features":[{"level":3,"name":"Clockwork Spells","desc":"You always have a set of clockwork spells prepared, tied to cosmic order, and they don't count against your spells known."},{"level":3,"name":"Restore Balance","desc":"Reaction: you cancel Advantage or Disadvantage on a creature's d20 within 60 feet, a number of times equal to your Charisma modifier per Long Rest."},{"level":6,"name":"Bastion of Law","desc":"Bonus Action: spend 1 to 5 Sorcery Points to give a creature a pool of that many d8 protection dice that absorb incoming damage."},{"level":14,"name":"Trance of Order","desc":"Attack rolls against you can't gain Advantage, and you can treat a d20 of 9 or lower on an attack, check, or save as a 10."},{"level":18,"name":"Clockwork Cavalcade","desc":"Action: you summon spirits of order in a 30-foot Cube that heal allies, repair objects, and end one spell on each chosen creature."}]},
  "Wild Magic Sorcery": {"key":"sorcellerie-sauvage","classKey":"ensorceleur","features":[{"level":3,"name":"Wild Magic Surge","desc":"When you cast a level 1+ spell, you can roll on the Wild Magic Surge table to unleash a random magical effect."},{"level":3,"name":"Tides of Chaos","desc":"You gain Advantage on one attack roll, ability check, or save; you regain this use by triggering a Wild Magic Surge."},{"level":6,"name":"Bend Luck","desc":"Reaction: you spend 1 Sorcery Point to add or subtract 1d4 from a creature's attack roll, ability check, or saving throw."},{"level":14,"name":"Controlled Chaos","desc":"When you roll on the Wild Magic Surge table, you roll twice and choose which of the two effects occurs."},{"level":18,"name":"Tamed Surge","desc":"Immediately after casting a sorcerer spell, you can deliberately choose one Wild Magic Surge effect to trigger, once per Long Rest."}]},
  "Battle Master": {"key":"maitre-de-guerre","classKey":"guerrier","features":[{"level":3,"name":"Combat Superiority","desc":"You learn maneuvers fueled by Superiority Dice (d8) that you spend for tactical effects, regained on a rest."},{"level":3,"name":"Student of War","desc":"You gain proficiency with one type of artisan's tools and one skill of your choice."},{"level":7,"name":"Know Your Enemy","desc":"As a Bonus Action, you discern the Immunities, Resistances, and Vulnerabilities of a creature you can see within 30 feet."},{"level":10,"name":"Improved Combat Superiority","desc":"Your Superiority Dice become d10s and you gain one additional die."},{"level":15,"name":"Relentless","desc":"When you roll Initiative and have no Superiority Dice, you regain one Superiority Die (d8)."}]},
  "Eldritch Knight": {"key":"chevalier-occulte","classKey":"guerrier","features":[{"level":3,"name":"Spellcasting","desc":"You cast Wizard spells (focused on Abjuration and Evocation), using Intelligence as your spellcasting ability."},{"level":3,"name":"War Bond","desc":"Through a ritual you bond with up to two weapons and can summon one to your hand as a Bonus Action."},{"level":7,"name":"War Magic","desc":"When you take the Attack action, you can replace one of the attacks with a cantrip."},{"level":10,"name":"Eldritch Strike","desc":"When you hit a creature with a weapon, it has Disadvantage on its next save against a spell of yours before the end of your next turn."},{"level":15,"name":"Arcane Charge","desc":"When you use Action Surge, you can teleport up to 30 feet to an unoccupied space you can see."}]},
  "Psi Warrior": {"key":"guerrier-psi","classKey":"guerrier","features":[{"level":3,"name":"Psionic Power","desc":"You gain Psionic Energy Dice (starting at d6) that fuel your telekinetic talents."},{"level":3,"name":"Protective Field","desc":"As a Reaction, spend a Psionic Energy Die to reduce damage to yourself or a nearby creature."},{"level":3,"name":"Psionic Strike","desc":"Once per turn, add a Psionic Energy Die as Force damage to a creature you hit with an attack."},{"level":3,"name":"Telekinetic Movement","desc":"As a Bonus Action, move yourself or a nearby object/creature using telekinesis (free once per rest)."},{"level":7,"name":"Telekinetic Adept","desc":"You gain Psi-Powered Leap (a brief fly speed) and Telekinetic Thrust (knock prone or push a Psionic Strike target)."},{"level":10,"name":"Guarded Mind","desc":"You gain Resistance to Psychic damage and can spend a Psionic Energy Die to end the Frightened or Charmed condition on yourself."},{"level":15,"name":"Bulwark of Force","desc":"As a Bonus Action, you grant Half Cover to yourself and nearby allies for one minute (free once per Long Rest, otherwise a Psionic Energy Die)."}]},
  "Abjurer": {"key":"abjurateur","classKey":"magicien","features":[{"level":3,"name":"Abjuration Savant","desc":"You can copy Abjuration spells into your spellbook for half the usual time and gold cost."},{"level":3,"name":"Arcane Ward","desc":"Casting an Abjuration spell of level 1+ raises a ward with HP equal to twice the spell's level plus your INT modifier that absorbs damage you take and recharges as you cast more abjurations."},{"level":6,"name":"Projected Ward","desc":"As a Reaction when a creature within 30 feet takes damage, you spend your Arcane Ward's HP to absorb that damage for it instead."},{"level":10,"name":"Spell Breaker","desc":"You always have Counterspell and Dispel Magic prepared, and casting either one restores HP to your Arcane Ward equal to the level of the slot you spent."},{"level":14,"name":"Spell Resistance","desc":"You have advantage on saving throws against spells, and you have resistance to the damage dealt by spells."}]},
  "Diviner": {"key":"devin","classKey":"magicien","features":[{"level":3,"name":"Divination Savant","desc":"You can copy Divination spells into your spellbook for half the usual time and gold cost."},{"level":3,"name":"Portent","desc":"After a long rest, roll two d20s and store them; you can replace any creature's attack roll, saving throw, or ability check with a stored die."},{"level":6,"name":"Expert Divination","desc":"Casting a Divination spell of level 2+ lets you regain one expended spell slot of a lower level (no higher than level 5)."},{"level":10,"name":"The Third Eye","desc":"As a Bonus Action, gain one benefit until your next rest: Darkvision, the ability to read any language, or to see invisible creatures and objects within 10 feet."},{"level":14,"name":"Greater Portent","desc":"Your Portent feature now has you roll and store three d20s after a long rest."}]},
  "Illusionist": {"key":"illusionniste","classKey":"magicien","features":[{"level":3,"name":"Illusion Savant","desc":"You can copy Illusion spells into your spellbook for half the usual time and gold cost, and you know the Minor Illusion cantrip (creating both sound and image at once)."},{"level":3,"name":"Improved Illusions","desc":"Your Illusion spells lasting at least 1 minute no longer require Verbal components, and you can cast Minor Illusion as a Bonus Action."},{"level":6,"name":"Phantasmal Creatures","desc":"When you cast an Illusion spell that creates an image, you can make it appear as an illusory creature that moves and acts as you direct."},{"level":10,"name":"Illusory Self","desc":"As a Reaction when a creature hits you with an attack, you interpose an illusory duplicate so the attack misses instead (recharges on a short or long rest)."},{"level":14,"name":"Illusory Reality","desc":"While concentrating on an Illusion spell, use a Bonus Action to make one nonmagical, inanimate object within the illusion physically real for 1 minute."}]},
  "Warrior of the Elements": {"key":"credo-des-elements","classKey":"moine","features":[{"level":3,"name":"Elemental Attunement","desc":"Spend 1 Focus Point: for 10 min your Unarmed Strikes gain 5 ft of reach and can deal acid, cold, fire, lightning or thunder damage."},{"level":3,"name":"Manipulate Elements","desc":"While Elemental Attunement is active, an Unarmed Strike can push or pull the target up to 10 ft."},{"level":6,"name":"Elemental Burst","desc":"In place of an attack, spend 1 Focus Point to hurl a 20-foot-radius elemental burst dealing elemental damage (Dexterity save for half)."},{"level":11,"name":"Stride of the Elements","desc":"While Elemental Attunement is active, you gain a Fly Speed and Swim Speed equal to your Speed."},{"level":17,"name":"Elemental Epitome","desc":"While Elemental Attunement is active: resistance to one elemental damage type (changeable each turn), boosted Step of the Wind, and +1 Martial Arts die on one Unarmed Strike per turn."}]},
  "Warrior of Mercy": {"key":"credo-de-la-misericorde","classKey":"moine","features":[{"level":3,"name":"Hand of Healing / Hand of Harm","desc":"Spend 1 Focus Point: Hand of Healing restores HP (Martial Arts die + Wis mod); Hand of Harm adds necrotic damage to an Unarmed Strike (once per turn)."},{"level":3,"name":"Implements of Mercy","desc":"You gain proficiency in the Insight and Medicine skills and with the Herbalism Kit."},{"level":6,"name":"Physician's Touch","desc":"At no extra cost: Hand of Healing also ends a condition (Blinded, Deafened, Paralyzed, Poisoned, Stunned); Hand of Harm also imposes Poisoned."},{"level":11,"name":"Flurry of Healing and Harm","desc":"During Flurry of Blows, replace strikes with Hand of Healing and trigger Hand of Harm without spending Focus (uses equal to Wis mod, regained on a long rest)."},{"level":17,"name":"Hand of Ultimate Mercy","desc":"Spend 5 Focus Points to bring a creature dead under 24h back to life (4d10 + Wis mod HP), freed of the listed conditions (1/long rest)."}]},
  "Warrior of Shadow": {"key":"credo-de-l-ombre","classKey":"moine","features":[{"level":3,"name":"Shadow Arts","desc":"You know the Minor Illusion cantrip (cast with Wisdom) and can spend 1 Focus Point to cast Darkness, seeing through it and moving it."},{"level":6,"name":"Shadow Step","desc":"In dim light or darkness, Bonus Action teleport up to 60 ft to another dark spot, gaining Advantage on your next Unarmed Strike this turn."},{"level":11,"name":"Improved Shadow Step","desc":"When you use Shadow Step, you can immediately make one free Unarmed Strike."},{"level":17,"name":"Cloak of Shadows","desc":"In dim light or darkness, action to become Invisible until the end of your next turn or until you attack, cast a spell or leave the darkness."}]},
  "Oath of the Ancients": {"key":"serment-des-anciens","classKey":"paladin","features":[{"level":3,"name":"Oath of the Ancients Spells","desc":"You always have your Oath spells prepared (Ensnaring Strike, Entangle, then Misty Step, Moonbeam, and more as you level up)."},{"level":3,"name":"Channel Divinity: Nature's Wrath","desc":"As a Bonus Action, you conjure spectral vines that leave a creature Restrained, repeating a Strength save each of its turns to end the effect."},{"level":7,"name":"Aura of Warding","desc":"You and your allies in your aura have Resistance to Necrotic, Psychic, and Radiant damage."},{"level":15,"name":"Undying Sentinel","desc":"When you drop to 0 Hit Points without being killed outright, you can drop to 1 instead, once per Long Rest, and you no longer age magically."},{"level":20,"name":"Elder Champion","desc":"As a Bonus Action, for 1 minute you regain Hit Points each turn, cast Paladin spells faster, and nearby foes have Disadvantage on saves against your spells and Channel Divinity."}]},
  "Oath of Glory": {"key":"serment-de-gloire","classKey":"paladin","features":[{"level":3,"name":"Oath of Glory Spells","desc":"You always have your Oath spells prepared (Guiding Bolt, Heroism, then Haste, Magic Weapon, and more as you level up)."},{"level":3,"name":"Channel Divinity: Peerless Athlete","desc":"As a Bonus Action, for 10 minutes you gain Advantage on Strength and Dexterity checks, jump farther, and stand up from Prone for only 5 feet of movement."},{"level":3,"name":"Channel Divinity: Inspiring Smite","desc":"After you hit with a melee weapon, you can distribute Temporary Hit Points equal to 2d8 plus your Paladin level among creatures of your choice within range."},{"level":7,"name":"Aura of Alacrity","desc":"Your Speed increases by 10 feet, and any ally who starts their turn in your aura gains a bonus to their Speed until the start of their next turn."},{"level":15,"name":"Glorious Defense","desc":"As a Reaction, when you or a creature you can see is hit by an attack, you add your Charisma modifier to AC against it, and on a miss you can make a weapon attack against the attacker."},{"level":20,"name":"Living Legend","desc":"As a Bonus Action, for 1 minute you can Charm foes who fail a save, missed melee attacks hit instead, and you can reroll a failed saving throw once per turn."}]},
  "Oath of Vengeance": {"key":"serment-de-vengeance","classKey":"paladin","features":[{"level":3,"name":"Oath of Vengeance Spells","desc":"You always have your Oath spells prepared (Bane, Hunter's Mark, then Haste, Hold Person, and more as you level up)."},{"level":3,"name":"Channel Divinity: Vow of Enmity","desc":"As a Bonus Action, mark a creature within range and gain Advantage on attack rolls against it for 1 minute or until it drops to 0 Hit Points."},{"level":7,"name":"Relentless Avenger","desc":"When you hit a creature with an Opportunity Attack, you can immediately move up to half your Speed without provoking Opportunity Attacks."},{"level":15,"name":"Soul of Vengeance","desc":"As a Reaction, when a creature under your Vow of Enmity makes an attack, you can make a melee attack against it."},{"level":20,"name":"Avenging Angel","desc":"As a Bonus Action, for 10 minutes you gain a flying speed and emit an aura that Frightens enemies who start their turn near you."}]},
  "Beast Master": {"key":"belluaire","classKey":"rodeur","features":[{"level":3,"name":"Primal Companion","desc":"You summon a primal beast (Land, Sea, or Sky) that acts on your initiative and can attack when you take the Attack action."},{"level":7,"name":"Exceptional Training","desc":"As a Bonus Action you can command your beast to take the Dodge action, and its attacks now deal Force damage."},{"level":11,"name":"Bestial Fury","desc":"Your beast makes two attacks when you command it to Attack, and deals an extra 2d6 Force damage to a target of your Hunter's Mark."},{"level":15,"name":"Share Spells","desc":"When you cast a spell targeting yourself, you can also have it target your primal companion if it is within 30 feet of you."}]},
  "Fey Wanderer": {"key":"vagabond-feerique","classKey":"rodeur","features":[{"level":3,"name":"Dreadful Strikes","desc":"When you hit a creature with a weapon, you can deal an extra 1d4 Psychic damage once per turn (1d6 at level 11)."},{"level":3,"name":"Otherworldly Glamour","desc":"You gain proficiency in one Charisma skill and add your Wisdom modifier to your Charisma checks (minimum +1)."},{"level":3,"name":"Fey Wanderer Spells","desc":"You always have a list of fey spells prepared (charm person, misty step, etc.) that don't count against your number of prepared spells."},{"level":7,"name":"Beguiling Twist","desc":"When you cast an enchantment spell, you can redirect the effect to bounce from one target to another nearby creature, and you have advantage on saves against the Charmed and Frightened conditions."},{"level":11,"name":"Fey Reinforcements","desc":"You can cast summon fey without a Material component, and once without a spell slot per long rest."},{"level":15,"name":"Misty Wanderer","desc":"You can cast misty step without expending a spell slot a number of times equal to your Wisdom modifier per long rest."}]},
  "Gloom Stalker": {"key":"traqueur-des-tenebres","classKey":"rodeur","features":[{"level":3,"name":"Dread Ambusher","desc":"You add your Wisdom modifier to initiative, gain extra Speed on your first turn, and deal an extra 2d6 Psychic damage once per turn (Wis times per long rest)."},{"level":3,"name":"Gloom Stalker Spells","desc":"You always have a list of stealthy spells prepared (disguise self, etc.) that don't count against your number of prepared spells."},{"level":3,"name":"Umbral Sight","desc":"You gain 60 feet of Darkvision and are Invisible to any creature that relies on Darkvision to see you in Darkness."},{"level":7,"name":"Iron Mind","desc":"You gain proficiency in Wisdom saving throws (or Intelligence or Charisma if you already have it)."},{"level":11,"name":"Stalker's Flurry","desc":"Once per turn, when you miss with a weapon attack, you can make another weapon attack as part of the same action."},{"level":15,"name":"Shadowy Dodge","desc":"As a Reaction when a creature attacks you, you impose Disadvantage and teleport up to 30 feet to an unoccupied space."}]},
  "Arcane Trickster": {"key":"arnaqueur-arcanique","classKey":"roublard","features":[{"level":3,"name":"Spellcasting","desc":"You learn wizard spells focused on Illusion and Enchantment, casting them using Intelligence as your spellcasting ability."},{"level":3,"name":"Mage Hand Legerdemain","desc":"You always know Mage Hand, can cast it invisibly, and use the spectral hand at range for thievery such as picking locks or pickpocketing."},{"level":9,"name":"Magical Ambush","desc":"When a creature you're hidden from must make a saving throw against one of your spells, it has Disadvantage on that save."},{"level":13,"name":"Versatile Trickster","desc":"When you hit a creature with Mage Hand, you can spend Sneak Attack dice to topple it, shove it, or give it Disadvantage."},{"level":17,"name":"Spell Thief","desc":"As a Reaction, when you succeed on a save against a spell, you negate it and steal it, able to cast it until your next long rest."}]},
  "Assassin": {"key":"assassin","classKey":"roublard","features":[{"level":3,"name":"Assassinate","desc":"You have Advantage on attacks against any creature that hasn't taken a turn; on your first turn, your hits deal bonus damage equal to your Rogue level, and hitting a Surprised creature is a Critical Hit."},{"level":3,"name":"Assassin's Tools","desc":"You gain proficiency with the Poisoner's Kit and Disguise Kit, and you receive free doses of poison after each long rest."},{"level":9,"name":"Infiltration Expertise","desc":"You can craft a believable false identity and flawlessly mimic the speech, writing, and mannerisms of a person you've studied."},{"level":13,"name":"Envenom Weapons","desc":"When you coat a weapon in poison with your Poisoner's Kit, the poison's save DC increases and the poison damage it deals is doubled."},{"level":17,"name":"Death Strike","desc":"When you hit a Surprised creature, it must succeed on a Constitution save (DC 8 + Dex modifier + proficiency bonus) or take double the attack's damage."}]},
  "Soulknife": {"key":"lame-psychique","classKey":"roublard","features":[{"level":3,"name":"Psychic Blades","desc":"You manifest blades of psychic energy to attack in melee or at range (psychic damage), with no need for a physical weapon."},{"level":3,"name":"Psionic Power","desc":"You have Psionic Energy Dice that fuel talents: bolster an ability check (Psi-Bolstered Knack) or communicate telepathically (Psychic Whispers)."},{"level":9,"name":"Soul Blades","desc":"Your Psionic Energy Dice become more numerous and larger, and you can spend them to avoid missing with a Psychic Blade (Homing Strikes) or teleport with it (Psychic Teleportation)."},{"level":13,"name":"Psychic Veil","desc":"As a Magic action, you become Invisible until the end of your next turn, once per long rest or by spending a Psionic Energy Die."},{"level":17,"name":"Rend Mind","desc":"When you deal Sneak Attack damage with a Psychic Blade, you can spend three Psionic Energy Dice to Stun the target (Wisdom save) until the end of your next turn."}]},
  "Archfey Patron": {"key":"patron-archifee","classKey":"occultiste","features":[{"level":3,"name":"Steps of the Fey","desc":"Misty Step is always prepared and you can cast it without a slot a number of times equal to your CHA modifier per long rest; each teleport grants temporary HP (1d10) or imposes Disadvantage on attacks against others near where you left."},{"level":6,"name":"Misty Escape","desc":"You can cast Misty Step as a Reaction when you take damage, and you gain two new Steps of the Fey options (turning Invisible until your next turn, or dealing psychic damage to nearby creatures)."},{"level":10,"name":"Beguiling Defenses","desc":"You're immune to the Charmed condition; when an attack hits you, you can use a Reaction to halve the damage and force the attacker to make a Wisdom save, dealing that damage back as psychic on a failure."},{"level":14,"name":"Bewitching Magic","desc":"After casting an Enchantment or Illusion spell using an action and a spell slot, you can immediately cast Misty Step as part of that same action without expending a slot."}]},
  "Celestial Patron": {"key":"patron-celeste","classKey":"occultiste","features":[{"level":3,"name":"Healing Light","desc":"You have a pool of d6s (1 + your Warlock level) that you can spend as a Bonus Action to restore HP to yourself or a creature you can see, refreshing on a long rest."},{"level":6,"name":"Radiant Soul","desc":"You have Resistance to Radiant damage, and once per turn when a spell you cast deals Fire or Radiant damage you can add your Charisma modifier to that damage."},{"level":10,"name":"Celestial Resilience","desc":"When you use Magical Cunning or finish a rest, you gain temporary HP (Warlock level + CHA modifier) and can grant half that amount to several creatures you can see nearby."},{"level":14,"name":"Searing Vengeance","desc":"When a creature you can see within 60 ft is about to make a death saving throw, you can save it: it regains half its HP maximum and ends Prone, while nearby enemies take radiant damage and are Blinded (once per long rest)."}]},
  "Great Old One Patron": {"key":"patron-grand-ancien","classKey":"occultiste","features":[{"level":3,"name":"Awakened Mind","desc":"As a Bonus Action, you form a telepathic bond with a creature you can see (range tied to your CHA modifier); it understands you only if you share a language."},{"level":3,"name":"Psychic Spells","desc":"When a Warlock spell deals damage you can change its type to psychic; your Enchantment and Illusion spells require no Verbal or Somatic components."},{"level":6,"name":"Clairvoyant Combatant","desc":"When you form your Awakened Mind bond, you can force the target to make a Wisdom save; on a failure it has Disadvantage on attacks against you and you have Advantage against it while the bond lasts."},{"level":10,"name":"Eldritch Hex","desc":"The Hex spell is always prepared for you, and when you cast it and choose an ability, the target also has Disadvantage on saving throws of that ability."},{"level":10,"name":"Thought Shield","desc":"Your thoughts can't be read without your consent, you have Resistance to Psychic damage, and when a creature deals psychic damage to you it takes the same amount."},{"level":14,"name":"Create Thrall","desc":"You can cast Summon Aberration without Concentration (1 minute), and the summoned aberration deals extra psychic damage to creatures affected by your Hex."}]},
};
Object.assign(SUBCLASSES_2024, _PHB2024_SUB_EN);
{
  const _byClass = {};
  for (const [_lab, _sc] of Object.entries(_PHB2024_SUB_EN)) (_byClass[_sc.classKey] ||= []).push(_lab);
  for (const _c of CLASSES_2024) if (_byClass[_c.key]) _c.subclasses = [..._c.subclasses, ..._byClass[_c.key]];
}
