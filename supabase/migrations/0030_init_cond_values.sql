-- Conditions à valeur (PF2e) : une valeur numérique par état et par combattant
-- (Effrayé 1, Ralenti 2, Affaibli 2…). Objet JSON { "<nom d'état>": <entier> }.
-- Hérite de la RLS existante de la table `initiative` (écriture MJ).
alter table public.initiative
  add column if not exists cond_values jsonb not null default '{}'::jsonb;
