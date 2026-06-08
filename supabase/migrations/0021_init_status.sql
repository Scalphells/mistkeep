-- Statut tactique d'un combattant dans le tracker d'initiative.
-- NULL = normal ; 'ready' = action préparée ; 'delayed' = tour retardé.
alter table public.initiative
  add column if not exists status text default null;
