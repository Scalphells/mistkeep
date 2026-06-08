-- ============================================================
-- 0002_security_fixes.sql
-- Corrige les failles RLS critiques relevées dans le dump existant.
-- Exécuter dans Supabase > SQL Editor APRÈS 0001.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Helper : déterminer si l'utilisateur courant est MJ.
--    SECURITY DEFINER pour éviter la récursion RLS sur profiles.
-- ------------------------------------------------------------
create or replace function public.is_dm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'dm'
  );
$$;

-- Normalise les rôles : NULL -> 'player', défaut 'player'.
alter table public.profiles alter column role set default 'player';
update public.profiles set role = 'player' where role is null;

-- ------------------------------------------------------------
-- 1. FAILLE CRITIQUE : un joueur pouvait se définir role = 'dm'.
-- ------------------------------------------------------------

-- 1a. INSERT : on n'autorise que son propre profil, jamais en 'dm'.
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "profiles_insert_self"
  on public.profiles for insert to authenticated
  with check ( auth.uid() = id and (role is null or role = 'player') );

-- 1b. UPDATE : on ne peut modifier que son propre profil.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update to authenticated
  using ( auth.uid() = id )
  with check ( auth.uid() = id );

-- 1c. Garde-fou robuste : un trigger remet l'ancien role si un
--     non-MJ tente de le changer (protège même contre un bug de policy).
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if not public.is_dm() then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_role on public.profiles;
create trigger trg_guard_profile_role
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- 1d. Lecture des profils : connectés uniquement (plus 'public'/anon).
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

-- ------------------------------------------------------------
-- 2. INITIATIVE : supprimer la policy permissive qui laissait
--    n'importe quel joueur écrire/supprimer.
-- ------------------------------------------------------------
drop policy if exists "Initiative is viewable by everyone" on public.initiative;
drop policy if exists "Only DM can update initiative"      on public.initiative;
drop policy if exists vmj_init_read                        on public.initiative;
drop policy if exists vmj_init_rw                          on public.initiative;

create policy "initiative_select_auth"
  on public.initiative for select to authenticated using (true);
create policy "initiative_write_dm"
  on public.initiative for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

-- ------------------------------------------------------------
-- 3. SESSION_STATE (carte, tokens, fog) : écriture MJ only.
-- ------------------------------------------------------------
drop policy if exists "Session state is viewable by everyone" on public.session_state;
drop policy if exists vmj_session_rw                          on public.session_state;

create policy "session_state_select_auth"
  on public.session_state for select to authenticated using (true);
create policy "session_state_write_dm"
  on public.session_state for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

-- ------------------------------------------------------------
-- 4. HANDOUTS : lecture connectés, écriture MJ. Nettoyage doublons.
-- ------------------------------------------------------------
drop policy if exists "Handouts are viewable by everyone" on public.handouts;
drop policy if exists "Only DM can insert handouts"        on public.handouts;
drop policy if exists handouts_read                        on public.handouts;
drop policy if exists handouts_write                       on public.handouts;

create policy "handouts_select_auth"
  on public.handouts for select to authenticated using (true);
create policy "handouts_write_dm"
  on public.handouts for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

-- ------------------------------------------------------------
-- 5. SESSION_NOTES : lecture connectés, écriture MJ.
-- ------------------------------------------------------------
drop policy if exists "Only DM can delete session notes"     on public.session_notes;
drop policy if exists "Only DM can insert session notes"     on public.session_notes;
drop policy if exists "Session notes are viewable by everyone" on public.session_notes;

create policy "session_notes_select_auth"
  on public.session_notes for select to authenticated using (true);
create policy "session_notes_write_dm"
  on public.session_notes for all to authenticated
  using ( public.is_dm() ) with check ( public.is_dm() );

-- ------------------------------------------------------------
-- 6. DICE_ROLLS : lecture connectés, insert = soi-même.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can insert dice rolls" on public.dice_rolls;
drop policy if exists "Dice rolls are viewable by everyone"        on public.dice_rolls;

create policy "dice_select_auth"
  on public.dice_rolls for select to authenticated using (true);
create policy "dice_insert_self"
  on public.dice_rolls for insert to authenticated
  with check ( auth.uid() = roller_id );

-- ------------------------------------------------------------
-- 7. MESSAGES : insert = soi-même, lecture publique pour tous,
--    lecture 'dm' réservée à l'expéditeur et au MJ.
-- ------------------------------------------------------------
drop policy if exists "Authenticated users can insert messages"   on public.messages;
drop policy if exists "DM messages viewable by sender and DM"     on public.messages;
drop policy if exists "Public messages are viewable by everyone"  on public.messages;

create policy "messages_insert_self"
  on public.messages for insert to authenticated
  with check ( auth.uid() = sender_id );

create policy "messages_select_public"
  on public.messages for select to authenticated
  using ( channel = 'public' );

create policy "messages_select_dm"
  on public.messages for select to authenticated
  using ( channel = 'dm' and ( sender_id = auth.uid() or public.is_dm() ) );

-- ------------------------------------------------------------
-- 8. BOOTSTRAP DU MJ (à exécuter une fois, adapte l'email).
--    Décommente la ligne suivante :
-- update public.profiles set role = 'dm' where email = 'scalphells@jdr.com';
-- ------------------------------------------------------------
