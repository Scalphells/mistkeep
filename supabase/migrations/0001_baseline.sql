-- ============================================================
-- 0001_baseline.sql
-- Snapshot de référence du schéma existant (idempotent).
-- Ne recrée rien si les tables existent déjà.
-- Exécuter dans Supabase > SQL Editor.
-- ============================================================

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text,
  role         text not null default 'player',   -- 'dm' | 'player'
  character_id text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.session_state (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.initiative (
  entity_id  text primary key,
  name       text not null,
  initiative integer not null,
  hp         integer,
  hp_max     integer,
  sort_order integer not null default 0,
  conditions jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.session_notes (
  id         uuid primary key default gen_random_uuid(),
  content    text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.handouts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  content_type text,                 -- 'image' | 'text' | 'letter'
  text_content text,
  image_url    text,                 -- chemin Storage (bucket handouts)
  target_player text,                -- null = tout le monde
  pushed_by    uuid references auth.users(id),
  pushed_at    timestamptz default now()
);

create table if not exists public.dice_rolls (
  id          uuid primary key default gen_random_uuid(),
  roll_name   text not null,
  dice        text not null,
  result      integer not null,
  details     jsonb,
  roll_type   text not null default 'public',
  roller_id   uuid references auth.users(id),
  roller_name text not null,
  created_at  timestamptz default now()
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null default 'public',   -- 'public' | 'dm'
  content     text not null,
  sender_id   uuid references auth.users(id),
  sender_name text not null,
  created_at  timestamptz default now()
);

alter table public.profiles      enable row level security;
alter table public.session_state enable row level security;
alter table public.initiative    enable row level security;
alter table public.session_notes enable row level security;
alter table public.handouts      enable row level security;
alter table public.dice_rolls    enable row level security;
alter table public.messages      enable row level security;
