-- ============================================================
-- 0016 — Compendium : sorts accessibles aux joueurs.
-- ------------------------------------------------------------
-- Le compendium était MJ-only. On ajoute une policy de LECTURE permissive pour
-- les entrées de type 'spell' : les joueurs peuvent consulter les sorts, mais
-- pas les monstres/PNJ/objets/tables (stats secrètes). L'écriture reste MJ
-- (policy `compendium_dm_all` inchangée ; les policies sont permissives/OU).
-- ============================================================

drop policy if exists "compendium_select_spells" on public.compendium;
create policy "compendium_select_spells"
  on public.compendium for select to authenticated
  using ( kind = 'spell' );
