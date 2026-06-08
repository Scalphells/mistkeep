-- ============================================================
-- 0012 — Compendium (bibliothèque MJ) + effets/durées en combat.
-- ============================================================

-- 1) Compendium : contenu réutilisable (monstres, sorts, objets, PNJ, tables).
create table if not exists public.compendium (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,                 -- 'monster' | 'spell' | 'item' | 'npc' | 'table'
  name       text not null,
  data       jsonb default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.compendium enable row level security;

-- Outil de préparation du MJ : lecture et écriture réservées au MJ.
drop policy if exists "compendium_dm_all" on public.compendium;
create policy "compendium_dm_all"
  on public.compendium for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

alter publication supabase_realtime add table public.compendium;

-- 2) Effets/durées sur les combattants (concentration, sorts à durée…).
--    Format : [{ "name": "Bénédiction", "until": 5 }]  (until = n° de round de fin)
alter table public.initiative
  add column if not exists effects jsonb default '[]'::jsonb;
