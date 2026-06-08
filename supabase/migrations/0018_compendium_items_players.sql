-- 0018 — Compendium : lecture des SORTS et OBJETS par les joueurs.
-- Étend la policy 0016 (sorts uniquement) pour inclure aussi les objets.
-- Les monstres / PNJ / tables restent réservés au MJ (anti-spoiler).

drop policy if exists compendium_select_spells on public.compendium;

create policy compendium_select_spells on public.compendium
  for select
  using ( public.is_dm() or kind in ('spell', 'item') );
