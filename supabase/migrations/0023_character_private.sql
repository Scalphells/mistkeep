-- ============================================================
-- 0022_character_private.sql
-- Histoire « privée » d'une fiche de personnage.
--
-- Chaque fiche peut avoir une partie d'histoire confidentielle, visible et
-- modifiable UNIQUEMENT par le joueur propriétaire de la fiche et par le MJ.
-- (La partie « partagée » de l'histoire reste dans characters.data.story, qui
--  est lisible par tout le groupe — voir 0005_characters.sql.)
--
-- Modèle :
--   - Lecture / écriture : MJ, ou le joueur propriétaire (owner_id) de la fiche.
--   - Suppression : MJ uniquement (cascade si la fiche est supprimée).
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

create table if not exists public.character_private (
  char_id    text primary key references public.characters(id) on delete cascade,
  notes      text not null default '',
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table public.character_private enable row level security;

-- ── Policies ────────────────────────────────────────────────
drop policy if exists "char_priv_select" on public.character_private;
drop policy if exists "char_priv_insert" on public.character_private;
drop policy if exists "char_priv_update" on public.character_private;
drop policy if exists "char_priv_delete" on public.character_private;

-- Lecture : MJ, ou propriétaire de la fiche liée.
create policy "char_priv_select"
  on public.character_private for select to authenticated
  using (
    public.is_dm()
    or exists (
      select 1 from public.characters c
      where c.id = character_private.char_id and c.owner_id = auth.uid()
    )
  );

-- Création : MJ, ou propriétaire de la fiche liée.
create policy "char_priv_insert"
  on public.character_private for insert to authenticated
  with check (
    public.is_dm()
    or exists (
      select 1 from public.characters c
      where c.id = character_private.char_id and c.owner_id = auth.uid()
    )
  );

-- Modification : MJ, ou propriétaire de la fiche liée.
create policy "char_priv_update"
  on public.character_private for update to authenticated
  using (
    public.is_dm()
    or exists (
      select 1 from public.characters c
      where c.id = character_private.char_id and c.owner_id = auth.uid()
    )
  )
  with check (
    public.is_dm()
    or exists (
      select 1 from public.characters c
      where c.id = character_private.char_id and c.owner_id = auth.uid()
    )
  );

-- Suppression : MJ uniquement (sinon cascade depuis characters).
create policy "char_priv_delete"
  on public.character_private for delete to authenticated
  using ( public.is_dm() );

-- ── Realtime ────────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.character_private;
exception
  when duplicate_object then null;
end $$;
