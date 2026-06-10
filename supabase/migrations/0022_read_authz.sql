-- 0022_read_authz.sql
-- Read-authorization parity with the Go backend (poc/go-backend readScope):
-- close the remaining over-permissive SELECT policies so a player cannot read
-- the DM's private data via the API.

-- session_state: GM-only preparation keys (the campaign binder and the image
-- bank) must not be readable by players. Every other key stays available — the
-- scene pointer, clock, shared quest log, party loot, ambience, etc.
drop policy if exists "session_state_select_auth" on public.session_state;
create policy "session_state_select_scoped"
  on public.session_state for select to authenticated
  using ( public.is_dm() or key not in ('campaign', 'imagebank') );

-- compendium: restore the `to authenticated` clause. A prior migration recreated
-- this policy without it, which let the anon role read spell/item rows.
drop policy if exists compendium_select_spells on public.compendium;
create policy compendium_select_spells
  on public.compendium for select to authenticated
  using ( public.is_dm() or kind in ('spell', 'item') );

-- Residual (intentionally not fixed here): scenes.state is a single jsonb blob
-- the player UI needs to render the map (walls/lights drive client-side vision),
-- so row-level RLS cannot strip the hidden tokens / GM notes it contains. The Go
-- backend redacts the blob in code (filterSceneState). The equivalent Supabase
-- fix is a SECURITY DEFINER projection — e.g. a get_scene_state(scene_id) RPC
-- returning a redacted state, with the client reading through it instead of
-- selecting scenes.state directly. Tracked as a follow-up.
