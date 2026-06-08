-- Jets de sauvegarde contre la mort (D&D 5e) pour le tracker d'initiative.
-- État par combattant : { "s": <réussites 0-3>, "f": <échecs 0-3> }.
-- NULL = pas en train de mourir (PV > 0, monstre, ou déjà stabilisé/réanimé).
alter table public.initiative
  add column if not exists death_saves jsonb default null;
