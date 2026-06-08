-- Lie un combattant à une fiche de personnage pour synchroniser les PV.

alter table public.initiative
  add column if not exists char_id text;
