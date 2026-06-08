-- ============================================================
-- 0011 — Chat MJ ↔ joueur bidirectionnel.
-- ------------------------------------------------------------
-- Ajoute un destinataire aux messages privés. Sémantique du canal 'dm' :
--   - joueur -> MJ : recipient_id = null (message "vers le MJ") ;
--   - MJ -> joueur : recipient_id = id du joueur ciblé.
-- La lecture d'un message 'dm' est autorisée à l'expéditeur, au destinataire
-- et au MJ. L'écriture reste « insert = soi-même » (policy inchangée).
-- ============================================================

alter table public.messages
  add column if not exists recipient_id uuid references auth.users(id);

drop policy if exists "messages_select_dm" on public.messages;

create policy "messages_select_dm"
  on public.messages for select to authenticated
  using (
    channel = 'dm'
    and ( sender_id = auth.uid() or recipient_id = auth.uid() or public.is_dm() )
  );
