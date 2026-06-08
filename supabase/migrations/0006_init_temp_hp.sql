-- PV temporaires pour le tracker d'initiative.
-- Les dégâts entament d'abord les PV temporaires, puis les PV réels.

alter table public.initiative
  add column if not exists hp_temp integer not null default 0;
