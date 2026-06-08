-- ============================================================
-- 0005_characters.sql
-- Fiches de personnage D&D 5e (table partagée à la table de jeu).
--
-- Modèle :
--   - Lecture : tous les membres connectés (visibilité de groupe).
--   - Écriture : le MJ, ou le joueur propriétaire (owner_id) de SA fiche.
--   - Création / suppression / attribution d'un propriétaire : MJ uniquement.
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

create table if not exists public.characters (
  id         text primary key,
  owner_id   uuid references auth.users(id) on delete set null,
  name       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.characters enable row level security;

-- ── Policies ────────────────────────────────────────────────
drop policy if exists "char_select_auth"   on public.characters;
drop policy if exists "char_insert_dm"      on public.characters;
drop policy if exists "char_update_owner_dm" on public.characters;
drop policy if exists "char_delete_dm"      on public.characters;

create policy "char_select_auth"
  on public.characters for select to authenticated using (true);

create policy "char_insert_dm"
  on public.characters for insert to authenticated
  with check ( public.is_dm() );

-- Le MJ écrit tout ; un joueur ne peut modifier que sa fiche et ne peut
-- pas se réattribuer une autre fiche (owner_id inchangé via WITH CHECK).
create policy "char_update_owner_dm"
  on public.characters for update to authenticated
  using ( public.is_dm() or owner_id = auth.uid() )
  with check ( public.is_dm() or owner_id = auth.uid() );

create policy "char_delete_dm"
  on public.characters for delete to authenticated
  using ( public.is_dm() );

-- ── Realtime ────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.characters;
exception
  when duplicate_object then null;
end $$;

-- ── Seed des 5 personnages (Curse of Strahd) ────────────────
-- N'écrase rien si la fiche existe déjà.

insert into public.characters (id, name, data) values
('pj1', 'Aélor', $json$
{
  "player":"Thomas","cls":"Moine","sub":"Voie de l'Ombre","lvl":3,
  "race":"Elfe Sylvestre","bg":"Criminel","align":"Loyal Neutre",
  "hp":21,"hpMax":21,"hpTmp":0,"ac":15,"spd":13,"initB":0,"prof":2,"insp":false,
  "str":8,"dex":17,"con":13,"int":11,"wis":15,"cha":12,
  "saves":["str","dex"],
  "profs":["acrobatics","stealth","perception","history","athletics","insight"],
  "exp":[],
  "atks":[
    {"nm":"Kusarigama (Fouet)","bon":"+5","dmg":"1d4+3","typ":"perforant","prop":"allonge 3m"},
    {"nm":"Kunai (Dague)","bon":"+5","dmg":"1d4+3","typ":"perforant","prop":"lancer 6/18m"},
    {"nm":"Mains nues","bon":"+5","dmg":"1d4+3","typ":"contondant","prop":"Arts martiaux"}
  ],
  "sc":"wis","slots":{},
  "spells":[
    {"nm":"Ténèbres (2 ki)","lvl":2},{"nm":"Silence (2 ki)","lvl":2},
    {"nm":"Pas sans trace (2 ki)","lvl":2},{"nm":"Illusion mineure","lvl":0}
  ],
  "feats":"Frappe martiale — dés 1d4+DEX/FOR\nArts martiaux niv.3 (1d4)\nMouvement sans armure +3m\nDéflexion de projectiles (réaction)\nKi — 3 pts / repos court:\n  Déluge de coups (1 ki) — 2 frappes bonus\n  Pas du vent (1 ki) — Désengagement ou Esquive\n  Frappe étourdissante (1 ki après toucher)\nVoie de l'Ombre — sorts gratuits dim/obscurité:\n  Ténèbres (2 ki), Silence (2 ki), Pas sans trace (2 ki)\nCachette naturelle — se cacher dans brume/végétation/pluie\nVision dans le noir 18m\nAscendance féérique — avantage charme",
  "equip":"Kusarigama (= Fouet)\nKunai (= Dague) ×2\nVêtements de moine\nSymbole sacré\nRelique Barovienne",
  "notes":"Mission de l'Abbé depuis 3 ans — cherche quelqu'un en Barovie. Muriel Corbeau l'observe différemment depuis B5a.",
  "ds":{"s":0,"f":0},"xp":900
}
$json$::jsonb),

('pj2', 'Sforen', $json$
{
  "player":"Julien","cls":"Barde","sub":"Collège du Savoir","lvl":3,
  "race":"Humain","bg":"Hanté","align":"Chaotique Neutre",
  "hp":23,"hpMax":23,"hpTmp":0,"ac":13,"spd":9,"initB":0,"prof":2,"insp":false,
  "str":9,"dex":15,"con":14,"int":11,"wis":13,"cha":16,
  "saves":["dex","cha"],
  "profs":["acrobatics","sleight","intimidation","history","medicine","perception","persuasion","performance","deception","insight"],
  "exp":[],
  "atks":[
    {"nm":"Rapière","bon":"+4","dmg":"1d8+2","typ":"perforant","prop":"Finesse"},
    {"nm":"Dague","bon":"+4","dmg":"1d4+2","typ":"perforant","prop":"lancer 6/18m"}
  ],
  "sc":"cha","slots":{"1":{"m":4,"u":0},"2":{"m":2,"u":0}},
  "spells":[
    {"nm":"Moquerie cruelle","lvl":0},{"nm":"Illusion mineure","lvl":0},{"nm":"Main du mage invisible","lvl":0},
    {"nm":"Murmures dissonants","lvl":1},{"nm":"Mot de guérison","lvl":1},
    {"nm":"Image silencieuse","lvl":1},{"nm":"Lueurs féeriques","lvl":1},
    {"nm":"Fléau","lvl":1},{"nm":"Suggestion","lvl":2}
  ],
  "feats":"Inspiration bardique (1d6) — action bonus, 1 allié à 18m, récup repos long\nTouche à tout — demi-maîtrise compétences non maîtrisées\nChant reposant — alliés +1d6 PV au repos court\nMots cinglants ⭐ — réaction, dépense 1 inspiration, ennemi −1d6 jet attaque/dégâts\nCollège du Savoir — 2 emplacements bonus niv.1",
  "equip":"Rapière\nDague\nArmure de cuir\nMandoline ancienne ⭐ (potentiellement hantée)\nOcarina\nTambourin 'Meliamne' ⭐ (nom en Sylvain gravé)\nBoîte à musique (joue parfois seule)\nÉcaille de dragon (origine inconnue)\nMorceau d'ambre\nRelique Barovienne : Écaille de Dragon",
  "notes":"'Meliamne' sur le tambourin → Madam Eva le reconnaîtra à Tser Pool. Mandoline hantée — joue seule la nuit.",
  "ds":{"s":0,"f":0},"xp":900
}
$json$::jsonb),

('pj3', 'Xor''ath', $json$
{
  "player":"Clément","cls":"Occultiste","sub":"Pacte du Fiélon","lvl":3,
  "race":"Tieffelin","bg":"Sage","align":"Chaos Neutre",
  "hp":22,"hpMax":22,"hpTmp":0,"ac":13,"spd":9,"initB":0,"prof":2,"insp":false,
  "str":8,"dex":14,"con":13,"int":11,"wis":12,"cha":17,
  "saves":["wis","cha"],
  "profs":["arcana","deception","intimidation","persuasion"],
  "exp":[],
  "atks":[
    {"nm":"Décharge déchirante","bon":"+5","dmg":"1d10+3","typ":"force","prop":"portée 36m"},
    {"nm":"Arbalète légère","bon":"+4","dmg":"1d8+2","typ":"perforant","prop":"24/96m"},
    {"nm":"Dague","bon":"+4","dmg":"1d4+2","typ":"perforant","prop":"lancer 6/18m"},
    {"nm":"Serpe","bon":"+2","dmg":"1d4−1","typ":"tranchant","prop":"légère"}
  ],
  "sc":"cha","slots":{"2":{"m":2,"u":0}},
  "spells":[
    {"nm":"Décharge déchirante","lvl":0},{"nm":"Thaumaturgie","lvl":0},
    {"nm":"Illusion mineure","lvl":0},{"nm":"Assistance","lvl":0},
    {"nm":"Main du mage","lvl":0},{"nm":"Glas","lvl":0},
    {"nm":"Armure d'Agathys","lvl":1},{"nm":"Maléfice","lvl":1},
    {"nm":"Injonction","lvl":1},{"nm":"Mains brûlantes","lvl":1},
    {"nm":"Rayon ardent","lvl":2},{"nm":"Suggestion","lvl":2}
  ],
  "feats":"Magie de pacte — 2 emplacements Niv.2, récup REPOS COURT ⭐\nPacte du Grimoire — 3 cantrips bonus\nBénédiction du Ténébreux ⭐ — +5 PV temp à chaque kill\nAscendance Infernale — résistance au feu\nVision dans le noir 18m\nInvocations occultes:\n  Agonizing Blast — +CHA aux dégâts Décharge déchirante\n  Vision du Diable — voit dans le noir magique 36m",
  "equip":"Arbalète légère + 20 carreaux\nDague ×2\nSerpe\nArmure de cuir\nFocaliseur arcanique\nSac d'aventurier\nLivre / notes (historique Sage)\nLettre d'un collègue décédé (question sans réponse) ⭐\nRelique Barovienne : Éclat d'Ambre",
  "notes":"Lady Wachter à Vallaki = fellow occultiste (hook). Les Dark Powers = entités à étudier. Barovie = mystère ancien.",
  "ds":{"s":0,"f":0},"xp":900
}
$json$::jsonb),

('pj4', 'Khott', $json$
{
  "player":"Sebco","cls":"Barbare","sub":"","lvl":2,
  "race":"Demi-Orc","bg":"Soldat","align":"Loyal Mauvais",
  "hp":23,"hpMax":23,"hpTmp":0,"ac":13,"spd":9,"initB":0,"prof":2,"insp":false,
  "str":17,"dex":13,"con":15,"int":12,"wis":8,"cha":10,
  "saves":["str","con"],
  "profs":["athletics","intimidation","history","nature","animal"],
  "exp":[],
  "atks":[
    {"nm":"Hache à 2 mains","bon":"+5","dmg":"1d12+3","typ":"tranchant","prop":"lourde, deux mains"},
    {"nm":"Hachette","bon":"+5","dmg":"1d6+3","typ":"tranchant","prop":"légère, lancer 6/18m"},
    {"nm":"Javeline","bon":"+5","dmg":"1d6+3","typ":"perforant","prop":"lancer 9/36m"}
  ],
  "sc":null,"slots":{},"spells":[],
  "feats":"Rage (2/jour) — action bonus, +2 dégâts, résistance C/P/T, 1 min\nDéfense sans armure — CA = 10+DEX(+1)+CON(+2) = 13\nTémérité — avantage attaques mêlée CE tour / adversaires aussi avantage contre toi\nSens du danger — avantage JS DEX contre effets visibles\nAcharnement (Demi-Orc) ⭐ — 1/repos long → tombe à 1 PV au lieu de 0\nSauvagerie (Demi-Orc) — crits = +1 dé supplémentaire\nVision dans le noir 18m\n⚠️ Sous-classe choisie au niv.3 (prochain level up)",
  "equip":"Hache à 2 mains\nHachette ×2\nJaveline ×4\nInsigne de grade (Compagnie du Fer Gris)\nDés en os\nMorceau de bride de Brimstone ⭐ (destrier tué — objet émotionnel)\nVêtements ordinaires\nRelique Barovienne : Pièce d'Électrum",
  "notes":"Brimstone (destrier) tué par embuscade nécromantique. Baron traître à retrouver. Cherche un nouveau destrier — ferme abandonnée route Vallaki.",
  "ds":{"s":0,"f":0},"xp":600
}
$json$::jsonb),

('pj5', 'Emiko', $json$
{
  "player":"Fastiraz","cls":"Rôdeur","sub":"","lvl":2,
  "race":"Humain","bg":"Criminel","align":"Chaotique Bon",
  "hp":23,"hpMax":23,"hpTmp":0,"ac":13,"spd":9,"initB":0,"prof":2,"insp":false,
  "str":16,"dex":14,"con":15,"int":9,"wis":13,"cha":11,
  "saves":["str","dex"],
  "profs":["athletics","deception","stealth","perception","nature","survival"],
  "exp":[],
  "atks":[
    {"nm":"Arc long","bon":"+4","dmg":"1d8+2","typ":"perforant","prop":"45/180m, lourde"},
    {"nm":"Serpe","bon":"+5","dmg":"1d4+3","typ":"tranchant","prop":"légère ×2"},
    {"nm":"Coup à mains nues","bon":"+5","dmg":"4","typ":"contondant","prop":""}
  ],
  "sc":"wis","slots":{"1":{"m":2,"u":0}},
  "spells":[{"nm":"Marque du chasseur","lvl":1},{"nm":"Soins des blessures","lvl":1}],
  "feats":"Ennemi juré — Morts-vivants ⭐\n  Avantage pistage + bonus attaque vs morts-vivants\nExplorateur-né — Marais\n  Pas de ralentissement terrain difficile, ne se perd pas\nStyle de combat : Archerie — +2 jets d'attaque à distance\nVision dans le noir (N/A — Humain)",
  "equip":"Arc long + 20 flèches\nSerpe ×2\nArmure de cuir\nPied-de-biche\nVêtements sombres avec capuche\nOutils de voleur\nJeu d'échecs draconique\nSac à dos + équipement explorateur\nRelique Barovienne : Plume d'Ange",
  "notes":"Né noble, a tout quitté. Crime passé = lien possible avec réseaux criminels Vallaki. Backstory noble résonne avec l'oppression barovienne.",
  "ds":{"s":0,"f":0},"xp":600
}
$json$::jsonb)
on conflict (id) do nothing;
