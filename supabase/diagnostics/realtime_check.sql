-- Diagnostic Realtime (à lancer dans Supabase → SQL Editor).
-- But : comprendre pourquoi certains postgres_changes n'atteignaient pas les
-- joueurs (d'où les replis « broadcast »). Colle les 3 résultats au dev.

-- ─────────────────────────────────────────────────────────────
-- 1) Tables présentes dans la publication temps réel.
--    Une table ABSENTE ici n'émet AUCUN postgres_changes.
-- ─────────────────────────────────────────────────────────────
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;

-- ─────────────────────────────────────────────────────────────
-- 2) REPLICA IDENTITY des tables clés.
--    'default (PK)' suffit pour INSERT/UPDATE ; 'full' est requis si on veut
--    l'ancienne ligne complète sur DELETE/UPDATE (utile pour les filtres RLS).
-- ─────────────────────────────────────────────────────────────
select c.relname as "table",
  case c.relreplident
    when 'd' then 'default (PK)'
    when 'f' then 'full'
    when 'n' then 'nothing'
    when 'i' then 'index'
  end as replica_identity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'messages','dice_rolls','initiative','session_state',
    'compendium','characters','handouts','scenes','session_notes'
  )
order by c.relname;

-- ─────────────────────────────────────────────────────────────
-- 3) RLS activée + policies SELECT.
--    Realtime respecte la RLS : un client ne reçoit un évènement QUE s'il peut
--    SELECT la ligne. Si les joueurs ne peuvent pas SELECT session_state, ils
--    ne reçoivent pas les changements de scène/ambiance → d'où le repli broadcast.
-- ─────────────────────────────────────────────────────────────
select c.relname as "table", c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'messages','dice_rolls','initiative','session_state',
    'compendium','characters','handouts','scenes','session_notes'
  )
order by c.relname;

-- 3b) Policies SELECT par table (qui peut lire quoi).
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and cmd in ('SELECT', 'ALL')
  and tablename in (
    'messages','dice_rolls','initiative','session_state',
    'compendium','characters','handouts','scenes','session_notes'
  )
order by tablename, policyname;
