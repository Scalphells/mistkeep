-- ============================================================
-- 0010 — Handouts ciblés : la lecture respecte le destinataire.
-- ------------------------------------------------------------
-- Avant : tout authentifié pouvait lire TOUS les handouts (select using true),
-- y compris une lettre destinée à un seul joueur. On restreint la lecture :
--   - le MJ voit tout ;
--   - un handout sans destinataire (target_player null) est public ;
--   - sinon, seul le joueur ciblé (target_player = son id) peut le lire.
-- L'écriture reste réservée au MJ (policy handouts_write_dm inchangée).
-- ============================================================

drop policy if exists "handouts_select_auth"    on public.handouts;
drop policy if exists "handouts_select_visible"  on public.handouts;

create policy "handouts_select_visible"
  on public.handouts for select to authenticated
  using (
    public.is_dm()
    or target_player is null
    or target_player = auth.uid()::text
  );
