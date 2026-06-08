-- ============================================================
-- 0004_dice_secret.sql
-- Corrige une faille : les jets cachés (roll_type = 'dm') étaient
-- lisibles par TOUS les joueurs via la policy SELECT `using (true)`.
-- Désormais un jet 'dm' n'est visible que par le MJ ou son auteur.
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

drop policy if exists "dice_select_auth" on public.dice_rolls;

create policy "dice_select_visible"
  on public.dice_rolls for select to authenticated
  using (
    roll_type = 'public'
    or public.is_dm()
    or roller_id = auth.uid()
  );
