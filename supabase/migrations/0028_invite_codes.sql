-- ============================================================
-- 0028_invite_codes.sql
-- Invitation par code : un joueur rejoint une campagne de façon autonome.
--
-- Le MJ génère un code court sur sa campagne (campaigns.invite_code) ; un
-- joueur le saisit et devient membre 'player'. Comme un non-membre ne peut
-- pas LIRE la campagne (RLS 0024/0026), la résolution du code passe par une
-- fonction SECURITY DEFINER au périmètre minimal : code → adhésion, rien
-- d'autre n'est exposé.
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- (Backend Go : équivalent automatique — migration SQLite v6 + POST /rpc/join_campaign.)
-- ============================================================

alter table public.campaigns
  add column if not exists invite_code text unique;

create or replace function public.join_campaign(code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise.';
  end if;
  select id into cid
  from public.campaigns
  where invite_code is not null and invite_code = upper(trim(code));
  if cid is null then
    raise exception 'Code d''invitation inconnu.';
  end if;
  insert into public.campaign_members (campaign_id, user_id, role)
  values (cid, auth.uid(), 'player')
  on conflict (campaign_id, user_id) do nothing;
  return cid;
end;
$$;

revoke all on function public.join_campaign(text) from public;
grant execute on function public.join_campaign(text) to authenticated;
