-- ============================================================
-- 0009_battlemap.sql
-- Carte de combat partagée : fond d'écran lisible par les joueurs.
-- L'état de la carte (tokens, fog, grille) vit dans session_state
-- (clé 'map_state'), déjà couvert par les policies existantes
-- (lecture pour tous, écriture MJ).
-- Le ping est éphémère (Realtime broadcast, pas de table).
-- Exécuter dans Supabase > SQL Editor APRÈS 0008.
-- ============================================================

-- Bucket du fond de carte partagé : MJ écrit, tous les connectés lisent.
insert into storage.buckets (id, name, public)
values ('battlemap', 'battlemap', false)
on conflict (id) do nothing;

drop policy if exists "battlemap_read_auth" on storage.objects;
create policy "battlemap_read_auth"
  on storage.objects for select to authenticated
  using ( bucket_id = 'battlemap' );

drop policy if exists "battlemap_insert_dm" on storage.objects;
create policy "battlemap_insert_dm"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'battlemap' and public.is_dm() );

drop policy if exists "battlemap_update_dm" on storage.objects;
create policy "battlemap_update_dm"
  on storage.objects for update to authenticated
  using ( bucket_id = 'battlemap' and public.is_dm() );

drop policy if exists "battlemap_delete_dm" on storage.objects;
create policy "battlemap_delete_dm"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'battlemap' and public.is_dm() );
