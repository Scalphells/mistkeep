-- ============================================================
-- 0017 — Notes de session : écriture par les joueurs (partagé / privé).
-- ------------------------------------------------------------
-- Chaque joueur peut écrire ses notes. Une note est soit partagée (visible de
-- tous), soit privée (visible de son auteur). Le MJ voit TOUJOURS toutes les
-- notes. Auteur ou MJ peuvent modifier/supprimer.
-- ============================================================

alter table public.session_notes
  add column if not exists shared boolean default false;

-- Remplace l'ancienne policy MJ-only par des policies granulaires.
drop policy if exists "session_notes_write_dm"    on public.session_notes;
drop policy if exists "session_notes_select_auth" on public.session_notes;

-- Lecture : MJ (tout), auteur (ses notes), ou note partagée.
create policy "session_notes_select_visible"
  on public.session_notes for select to authenticated
  using ( public.is_dm() or created_by = auth.uid() or shared = true );

-- Création : chacun crée ses propres notes.
create policy "session_notes_insert_self"
  on public.session_notes for insert to authenticated
  with check ( created_by = auth.uid() );

-- Modification / suppression : l'auteur ou le MJ.
create policy "session_notes_update_own_or_dm"
  on public.session_notes for update to authenticated
  using ( public.is_dm() or created_by = auth.uid() );

create policy "session_notes_delete_own_or_dm"
  on public.session_notes for delete to authenticated
  using ( public.is_dm() or created_by = auth.uid() );
