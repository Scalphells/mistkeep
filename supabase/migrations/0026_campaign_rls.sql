-- ============================================================
-- 0026_campaign_rls.sql
-- Multi-campagne — PARTIE B-2 : RLS scopées par appartenance.
--
-- L'autorité passe du rôle GLOBAL (profiles.role via is_dm()) au rôle PAR
-- CAMPAGNE (campaign_members.role via is_dm_of/is_member_of, cf. 0024) :
--   - un joueur ne lit que les données des campagnes dont il est MEMBRE ;
--   - le « MJ » d'une table est le MJ DE CETTE CAMPAGNE — un même compte
--     peut être MJ d'une campagne et simple joueur d'une autre.
-- Toute la sémantique fine existante est conservée, scopée par campagne :
-- jets cachés (0004), handouts ciblés (0010), messages privés (0011),
-- notes partagées (0017), compendium anti-spoiler (0016/0018).
--
-- Corrige au passage deux fuites relevées à l'audit : scenes.state et
-- session_state étaient lisibles par tout authentifié (y compris les clés de
-- préparation MJ 'campaign' et 'imagebank') — désormais membres uniquement,
-- clés de préparation réservées au MJ de la campagne.
--
-- À appliquer APRÈS 0024 + 0025 et après déploiement du front multi-campagne
-- Sans danger pour la table actuelle : tous les
-- comptes ont été inscrits membres de la campagne par défaut avec leur rôle
-- historique (seed 0024), les accès restent donc identiques.
--
-- RÉSIDUEL DOCUMENTÉ : les policies Storage (buckets battlemap/maps/handouts)
-- restent sur is_dm() global — un MJ « de campagne » ne peut pas téléverser de
-- fichiers tant que le Storage n'est pas scopé (chantier séparé).
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

-- ── session_state ───────────────────────────────────────────
drop policy if exists "session_state_select_auth" on public.session_state;
drop policy if exists "session_state_write_dm"    on public.session_state;

-- Membres uniquement ; les clés de préparation MJ restent invisibles aux joueurs.
create policy "session_state_select_member"
  on public.session_state for select to authenticated
  using (
    public.is_member_of(campaign_id)
    and ( public.is_dm_of(campaign_id) or key not in ('campaign', 'imagebank') )
  );

create policy "session_state_write_dm"
  on public.session_state for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

-- ── initiative ──────────────────────────────────────────────
drop policy if exists "initiative_select_auth" on public.initiative;
drop policy if exists "initiative_write_dm"    on public.initiative;

create policy "initiative_select_member"
  on public.initiative for select to authenticated
  using ( public.is_member_of(campaign_id) );

create policy "initiative_write_dm"
  on public.initiative for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

-- ── scenes (fuite using(true) corrigée) ─────────────────────
drop policy if exists "scenes_select_auth" on public.scenes;
drop policy if exists "scenes_write_dm"    on public.scenes;

create policy "scenes_select_member"
  on public.scenes for select to authenticated
  using ( public.is_member_of(campaign_id) );

create policy "scenes_write_dm"
  on public.scenes for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

-- ── handouts (destinataire conservé, scopé) ─────────────────
drop policy if exists "handouts_select_visible" on public.handouts;
drop policy if exists "handouts_write_dm"       on public.handouts;

create policy "handouts_select_visible"
  on public.handouts for select to authenticated
  using (
    public.is_member_of(campaign_id)
    and ( public.is_dm_of(campaign_id) or target_player is null or target_player = auth.uid()::text )
  );

create policy "handouts_write_dm"
  on public.handouts for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

-- ── session_notes (partagé/privé conservé, scopé) ───────────
drop policy if exists "session_notes_select_visible"  on public.session_notes;
drop policy if exists "session_notes_insert_self"     on public.session_notes;
drop policy if exists "session_notes_update_own_or_dm" on public.session_notes;
drop policy if exists "session_notes_delete_own_or_dm" on public.session_notes;

create policy "session_notes_select_visible"
  on public.session_notes for select to authenticated
  using (
    public.is_member_of(campaign_id)
    and ( public.is_dm_of(campaign_id) or created_by = auth.uid() or shared = true )
  );

create policy "session_notes_insert_self"
  on public.session_notes for insert to authenticated
  with check ( public.is_member_of(campaign_id) and created_by = auth.uid() );

create policy "session_notes_update_own_or_dm"
  on public.session_notes for update to authenticated
  using ( public.is_dm_of(campaign_id) or created_by = auth.uid() );

create policy "session_notes_delete_own_or_dm"
  on public.session_notes for delete to authenticated
  using ( public.is_dm_of(campaign_id) or created_by = auth.uid() );

-- ── dice_rolls (jets cachés conservés, scopés) ──────────────
drop policy if exists "dice_select_visible" on public.dice_rolls;
drop policy if exists "dice_insert_self"    on public.dice_rolls;

create policy "dice_select_visible"
  on public.dice_rolls for select to authenticated
  using (
    public.is_member_of(campaign_id)
    and ( roll_type = 'public' or public.is_dm_of(campaign_id) or roller_id = auth.uid() )
  );

create policy "dice_insert_self"
  on public.dice_rolls for insert to authenticated
  with check ( public.is_member_of(campaign_id) and roller_id = auth.uid() );

-- ── messages (canal privé conservé, scopé) ──────────────────
drop policy if exists "messages_select_public" on public.messages;
drop policy if exists "messages_select_dm"     on public.messages;
drop policy if exists "messages_insert_self"   on public.messages;
drop policy if exists "messages_delete_dm"     on public.messages;

create policy "messages_select_public"
  on public.messages for select to authenticated
  using ( channel = 'public' and public.is_member_of(campaign_id) );

create policy "messages_select_dm"
  on public.messages for select to authenticated
  using (
    channel = 'dm'
    and ( sender_id = auth.uid() or recipient_id = auth.uid() or public.is_dm_of(campaign_id) )
  );

create policy "messages_insert_self"
  on public.messages for insert to authenticated
  with check ( public.is_member_of(campaign_id) and sender_id = auth.uid() );

create policy "messages_delete_dm"
  on public.messages for delete to authenticated
  using ( public.is_dm_of(campaign_id) );

-- ── compendium (anti-spoiler conservé, scopé) ───────────────
drop policy if exists "compendium_dm_all"         on public.compendium;
drop policy if exists "compendium_select_spells"  on public.compendium;

create policy "compendium_dm_all"
  on public.compendium for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

create policy "compendium_select_spells"
  on public.compendium for select to authenticated
  using ( public.is_member_of(campaign_id) and kind in ('spell', 'item') );

-- ── vault_notes (MJ de la campagne uniquement) ──────────────
drop policy if exists "vault_notes_dm_all" on public.vault_notes;

create policy "vault_notes_dm_all"
  on public.vault_notes for all to authenticated
  using ( public.is_dm_of(campaign_id) )
  with check ( public.is_dm_of(campaign_id) );

-- ── characters ──────────────────────────────────────────────
drop policy if exists "char_select_auth"     on public.characters;
drop policy if exists "char_insert_dm"       on public.characters;
drop policy if exists "char_update_owner_dm" on public.characters;
drop policy if exists "char_delete_dm"       on public.characters;

create policy "char_select_member"
  on public.characters for select to authenticated
  using ( public.is_member_of(campaign_id) );

create policy "char_insert_dm"
  on public.characters for insert to authenticated
  with check ( public.is_dm_of(campaign_id) );

create policy "char_update_owner_dm"
  on public.characters for update to authenticated
  using ( public.is_dm_of(campaign_id) or owner_id = auth.uid() )
  with check ( public.is_dm_of(campaign_id) or owner_id = auth.uid() );

create policy "char_delete_dm"
  on public.characters for delete to authenticated
  using ( public.is_dm_of(campaign_id) );

-- ── character_private (hérite de la campagne via la fiche) ──
drop policy if exists "char_priv_select" on public.character_private;
drop policy if exists "char_priv_insert" on public.character_private;
drop policy if exists "char_priv_update" on public.character_private;
drop policy if exists "char_priv_delete" on public.character_private;

create policy "char_priv_select"
  on public.character_private for select to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_private.char_id
        and ( c.owner_id = auth.uid() or public.is_dm_of(c.campaign_id) )
    )
  );

create policy "char_priv_insert"
  on public.character_private for insert to authenticated
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_private.char_id
        and ( c.owner_id = auth.uid() or public.is_dm_of(c.campaign_id) )
    )
  );

create policy "char_priv_update"
  on public.character_private for update to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_private.char_id
        and ( c.owner_id = auth.uid() or public.is_dm_of(c.campaign_id) )
    )
  )
  with check (
    exists (
      select 1 from public.characters c
      where c.id = character_private.char_id
        and ( c.owner_id = auth.uid() or public.is_dm_of(c.campaign_id) )
    )
  );

create policy "char_priv_delete"
  on public.character_private for delete to authenticated
  using (
    exists (
      select 1 from public.characters c
      where c.id = character_private.char_id and public.is_dm_of(c.campaign_id)
    )
  );
