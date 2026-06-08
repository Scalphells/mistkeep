-- ============================================================
-- 0014 — Scènes multiples (cartes préparées, basculables en direct).
-- ------------------------------------------------------------
-- Chaque scène stocke un état de carte complet (fond, jetons, murs, lumières,
-- brouillard…). La scène active est pointée par session_state['active_scene'].
-- ============================================================

create table if not exists public.scenes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Scène',
  state      jsonb default '{}'::jsonb,
  sort       int default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.scenes enable row level security;

-- Lecture pour tous les authentifiés (les joueurs chargent la scène active),
-- écriture réservée au MJ.
drop policy if exists "scenes_select_auth" on public.scenes;
create policy "scenes_select_auth"
  on public.scenes for select to authenticated using (true);

drop policy if exists "scenes_write_dm" on public.scenes;
create policy "scenes_write_dm"
  on public.scenes for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

alter publication supabase_realtime add table public.scenes;

-- Reprise : crée une « Scène 1 » à partir de la carte actuelle (map_state)
-- s'il n'existe encore aucune scène.
insert into public.scenes (name, state, sort)
select 'Scène 1', coalesce((select value from public.session_state where key = 'map_state'), '{}'::jsonb), 0
where not exists (select 1 from public.scenes);
