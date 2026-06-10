-- ============================================================
-- 0025_campaign_keys.sql
-- Multi-campagne â€” PARTIE B-1 : clÃ©s composites.
--
-- Les tables Ã  clÃ© Â« sÃ©mantique Â» (session_state.key, initiative.entity_id,
-- vault_notes.path) avaient une PK globale : la mÃªme clÃ© ne pouvait exister
-- qu'une seule fois, toutes campagnes confondues. On passe la PK en
-- (campaign_id, clÃ©) pour que chaque campagne ait ses propres entrÃ©es.
--
-- âš  ORDRE DE DÃ‰PLOIEMENT : appliquer cette migration APRÃˆS avoir dÃ©ployÃ© le
-- front multi-campagne (commit Â« Multi-campagne : scoping frontâ€¦ Â»). L'ancien
-- front upsertait avec onConflict:'key' (exige une contrainte UNIQUE(key),
-- supprimÃ©e ici) ; le nouveau front Ã©crit en UPDATE-puis-INSERT et fonctionne
-- avec les DEUX schÃ©mas â€” aucune coupure dans ce sens-lÃ .
--
-- Sans cette migration, ne PAS crÃ©er de deuxiÃ¨me campagne (collision de clÃ©s).
--
-- Idempotent. ExÃ©cuter dans Supabase > SQL Editor.
-- ============================================================

do $$
declare n int;
begin
  -- session_state : (key) -> (campaign_id, key)
  select array_length(c.conkey, 1) into n
  from pg_constraint c
  where c.conrelid = 'public.session_state'::regclass and c.contype = 'p';
  if n = 1 then
    alter table public.session_state drop constraint session_state_pkey;
    alter table public.session_state add primary key (campaign_id, key);
  end if;

  -- initiative : (entity_id) -> (campaign_id, entity_id)
  select array_length(c.conkey, 1) into n
  from pg_constraint c
  where c.conrelid = 'public.initiative'::regclass and c.contype = 'p';
  if n = 1 then
    alter table public.initiative drop constraint initiative_pkey;
    alter table public.initiative add primary key (campaign_id, entity_id);
  end if;

  -- vault_notes : (path) -> (campaign_id, path)
  select array_length(c.conkey, 1) into n
  from pg_constraint c
  where c.conrelid = 'public.vault_notes'::regclass and c.contype = 'p';
  if n = 1 then
    alter table public.vault_notes drop constraint vault_notes_pkey;
    alter table public.vault_notes add primary key (campaign_id, path);
  end if;
end $$;
