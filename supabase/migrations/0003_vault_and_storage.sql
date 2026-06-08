-- ============================================================
-- 0003_vault_and_storage.sql
-- Vault privé MJ (sync DB) + buckets Storage pour le partage.
-- Exécuter dans Supabase > SQL Editor APRÈS 0002.
-- ============================================================

-- ------------------------------------------------------------
-- 1. VAULT_NOTES : notes Markdown privées du MJ.
--    Lecture ET écriture réservées au MJ.
--    Le partage avec les joueurs passe EXCLUSIVEMENT par handouts.
-- ------------------------------------------------------------
create table if not exists public.vault_notes (
  path       text primary key,        -- ex: '0_Sessions/Session 1.md'
  content    text not null default '',
  is_folder  boolean not null default false,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.vault_notes enable row level security;

drop policy if exists vault_notes_dm_all on public.vault_notes;
create policy "vault_notes_dm_all"
  on public.vault_notes for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

-- ------------------------------------------------------------
-- 2. STORAGE : buckets privés (URLs signées à la demande).
--    - handouts : le MJ uploade, tous les connectés peuvent lire.
--    - maps     : strictement MJ (cartes/fonds non partagés).
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('handouts', 'handouts', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('maps', 'maps', false)
on conflict (id) do nothing;

-- handouts : lecture connectés
drop policy if exists "handouts_obj_read_auth" on storage.objects;
create policy "handouts_obj_read_auth"
  on storage.objects for select to authenticated
  using ( bucket_id = 'handouts' );

-- handouts : écriture/modif/suppression MJ
drop policy if exists "handouts_obj_write_dm" on storage.objects;
create policy "handouts_obj_write_dm"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'handouts' and public.is_dm() );

drop policy if exists "handouts_obj_update_dm" on storage.objects;
create policy "handouts_obj_update_dm"
  on storage.objects for update to authenticated
  using ( bucket_id = 'handouts' and public.is_dm() );

drop policy if exists "handouts_obj_delete_dm" on storage.objects;
create policy "handouts_obj_delete_dm"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'handouts' and public.is_dm() );

-- maps : MJ uniquement (toutes opérations)
drop policy if exists "maps_obj_dm_all" on storage.objects;
create policy "maps_obj_dm_all"
  on storage.objects for all to authenticated
  using ( bucket_id = 'maps' and public.is_dm() )
  with check ( bucket_id = 'maps' and public.is_dm() );

-- ------------------------------------------------------------
-- 3. REALTIME : activer la diffusion sur les tables partagées.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.initiative;
alter publication supabase_realtime add table public.session_state;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.handouts;
alter publication supabase_realtime add table public.session_notes;
alter publication supabase_realtime add table public.dice_rolls;
