-- ============================================================
-- 0024_campaigns.sql
-- Multi-campagne — PARTIE A (additive, non-cassante) + schéma cible figé.
--
-- Cap produit : une CAMPAGNE = un groupe de jeu + UN système de jeu
-- (cf. src/lib/systems/ — 'dnd5e-2014' aujourd'hui, pf2e/5e-2024/custom demain).
-- Ce fichier fige le schéma cible AVANT le backend Cloudflare, pour qu'il soit
-- écrit une seule fois contre le bon contrat.
--
-- Cette partie A est sans risque pour le front actuel (mono-campagne) :
--   - tables `campaigns` + `campaign_members` + helpers RLS is_member_of/is_dm_of ;
--   - campagne par défaut à uuid FIXE ; toutes les données existantes y sont
--     rattachées ;
--   - `campaign_id NOT NULL DEFAULT <campagne par défaut>` sur chaque table de
--     jeu → les écritures actuelles (qui ignorent campaign_id) restent valides ;
--   - `profiles.active_campaign_id` : pointeur de campagne active de l'UI.
--
-- PARTIE B — à livrer AVEC l'UI multi-campagne (changement front coordonné,
-- NE PAS appliquer avant) :
--   - PK composites là où la clé est sémantique (le front passera son onConflict
--     de 'key' à 'campaign_id,key', etc.) :
--       session_state : (key)       → (campaign_id, key)
--       initiative    : (entity_id) → (campaign_id, entity_id)
--       vault_notes   : (path)      → (campaign_id, path)
--     `characters.id` reste une PK globale (ids aléatoires c_xxxxxxxx) ;
--     `character_private` hérite de la campagne via char_id → characters.
--   - resserrer les RLS de jeu : is_member_of(campaign_id) en lecture et
--     is_dm_of(campaign_id) en écriture, au lieu de « authenticated » + is_dm()
--     global ; profiles.role devient alors un simple héritage mono-campagne.
--   - retirer les DEFAULT campaign_id (le front fournira la campagne active).
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

-- ── 1. Campagnes ────────────────────────────────────────────
create table if not exists public.campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Campagne',
  system     text not null default 'dnd5e-2014',   -- id de système (src/lib/systems/)
  owner_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Membres d'une campagne : le rôle ('dm'|'player') et la fiche liée deviennent
-- PAR CAMPAGNE (un même compte peut être MJ ici et joueur ailleurs).
create table if not exists public.campaign_members (
  campaign_id  uuid not null references public.campaigns(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'player',   -- 'dm' | 'player'
  character_id text,                             -- fiche liée DANS cette campagne
  created_at   timestamptz default now(),
  primary key (campaign_id, user_id)
);

-- ── 2. Campagne par défaut (uuid fixe) + reprise de l'existant ──
-- L'uuid fixe permet aux DEFAULT des colonnes campaign_id d'être constants.
insert into public.campaigns (id, name, system, owner_id)
values (
  '00000000-0000-4000-8000-000000000001',
  'Campagne 1',
  'dnd5e-2014',
  (select id from public.profiles where role = 'dm' limit 1)
)
on conflict (id) do nothing;

-- Tous les profils existants deviennent membres de la campagne par défaut,
-- avec leur rôle et leur fiche actuels.
insert into public.campaign_members (campaign_id, user_id, role, character_id)
select '00000000-0000-4000-8000-000000000001', id, role, character_id
from public.profiles
on conflict (campaign_id, user_id) do nothing;

-- Pointeur de campagne active (l'UI multi-campagne lira/écrira ce champ).
alter table public.profiles
  add column if not exists active_campaign_id uuid
  references public.campaigns(id) on delete set null
  default '00000000-0000-4000-8000-000000000001';

update public.profiles
set active_campaign_id = '00000000-0000-4000-8000-000000000001'
where active_campaign_id is null;

-- ── 3. Helpers RLS (security definer → pas de récursion) ────
create or replace function public.is_member_of(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = c and user_id = auth.uid()
  );
$$;

create or replace function public.is_dm_of(c uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.campaign_members
    where campaign_id = c and user_id = auth.uid() and role = 'dm'
  );
$$;

-- ── 4. campaign_id sur chaque table de jeu ──────────────────
-- NOT NULL + DEFAULT campagne par défaut = les écritures actuelles du front
-- (sans campaign_id) restent valides ; le DEFAULT sera retiré en partie B.
alter table public.session_state  add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.initiative     add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.session_notes  add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.handouts       add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.dice_rolls     add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.messages       add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.vault_notes    add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.characters     add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.compendium     add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;
alter table public.scenes         add column if not exists campaign_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.campaigns(id) on delete cascade;

create index if not exists idx_session_state_campaign on public.session_state(campaign_id);
create index if not exists idx_initiative_campaign    on public.initiative(campaign_id);
create index if not exists idx_session_notes_campaign on public.session_notes(campaign_id);
create index if not exists idx_handouts_campaign      on public.handouts(campaign_id);
create index if not exists idx_messages_campaign      on public.messages(campaign_id);
create index if not exists idx_dice_rolls_campaign    on public.dice_rolls(campaign_id);
create index if not exists idx_vault_notes_campaign   on public.vault_notes(campaign_id);
create index if not exists idx_characters_campaign    on public.characters(campaign_id);
create index if not exists idx_compendium_campaign    on public.compendium(campaign_id);
create index if not exists idx_scenes_campaign        on public.scenes(campaign_id);

-- ── 5. RLS des nouvelles tables ─────────────────────────────
alter table public.campaigns        enable row level security;
alter table public.campaign_members enable row level security;

-- Campagnes : visibles par leurs membres (+ le propriétaire, même avant sa
-- première adhésion) ; création par tout connecté (il en devient propriétaire) ;
-- modification par le MJ de la campagne ; suppression par le propriétaire.
drop policy if exists "campaigns_select_member" on public.campaigns;
create policy "campaigns_select_member"
  on public.campaigns for select to authenticated
  using ( public.is_member_of(id) or owner_id = auth.uid() );

drop policy if exists "campaigns_insert_self" on public.campaigns;
create policy "campaigns_insert_self"
  on public.campaigns for insert to authenticated
  with check ( owner_id = auth.uid() );

drop policy if exists "campaigns_update_dm" on public.campaigns;
create policy "campaigns_update_dm"
  on public.campaigns for update to authenticated
  using ( public.is_dm_of(id) or owner_id = auth.uid() )
  with check ( public.is_dm_of(id) or owner_id = auth.uid() );

drop policy if exists "campaigns_delete_owner" on public.campaigns;
create policy "campaigns_delete_owner"
  on public.campaigns for delete to authenticated
  using ( owner_id = auth.uid() );

-- Membres : un membre voit la liste de SA campagne (et toujours ses propres
-- adhésions) ; gestion par le MJ de la campagne — le propriétaire passe aussi,
-- pour pouvoir s'auto-ajouter en 'dm' juste après la création.
drop policy if exists "members_select_member" on public.campaign_members;
create policy "members_select_member"
  on public.campaign_members for select to authenticated
  using ( public.is_member_of(campaign_id) or user_id = auth.uid() );

drop policy if exists "members_write_dm" on public.campaign_members;
create policy "members_write_dm"
  on public.campaign_members for all to authenticated
  using (
    public.is_dm_of(campaign_id)
    or exists (select 1 from public.campaigns g
               where g.id = campaign_id and g.owner_id = auth.uid())
  )
  with check (
    public.is_dm_of(campaign_id)
    or exists (select 1 from public.campaigns g
               where g.id = campaign_id and g.owner_id = auth.uid())
  );

-- ── 6. Realtime ─────────────────────────────────────────────
do $$
begin
  alter publication supabase_realtime add table public.campaigns;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.campaign_members;
exception
  when duplicate_object then null;
end $$;
