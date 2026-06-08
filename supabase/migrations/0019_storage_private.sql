-- 0019 — Buckets Storage privés + policies RLS.
--
-- L'app sert déjà TOUTES les images/audios via des URLs signées (createSignedUrl),
-- donc passer les buckets en privé n'affecte pas l'affichage. On restreint :
--   - lecture : utilisateur authentifié uniquement (plus d'accès anonyme par URL) ;
--   - écriture/suppression : MJ uniquement (public.is_dm()).
--
-- À exécuter manuellement dans Supabase (SQL Editor).

-- 1) Rendre les buckets privés.
update storage.buckets set public = false where id in ('battlemap', 'handouts');

-- 2) Policies sur storage.objects (idempotent : on (re)crée proprement).
drop policy if exists "vaultmj battlemap read" on storage.objects;
drop policy if exists "vaultmj battlemap insert" on storage.objects;
drop policy if exists "vaultmj battlemap update" on storage.objects;
drop policy if exists "vaultmj battlemap delete" on storage.objects;
drop policy if exists "vaultmj handouts read" on storage.objects;
drop policy if exists "vaultmj handouts insert" on storage.objects;
drop policy if exists "vaultmj handouts update" on storage.objects;
drop policy if exists "vaultmj handouts delete" on storage.objects;

-- battlemap : lecture pour tout authentifié, écriture MJ uniquement.
create policy "vaultmj battlemap read" on storage.objects
  for select to authenticated using (bucket_id = 'battlemap');
create policy "vaultmj battlemap insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'battlemap' and public.is_dm());
create policy "vaultmj battlemap update" on storage.objects
  for update to authenticated using (bucket_id = 'battlemap' and public.is_dm());
create policy "vaultmj battlemap delete" on storage.objects
  for delete to authenticated using (bucket_id = 'battlemap' and public.is_dm());

-- handouts : lecture pour tout authentifié (le ciblage par joueur est géré par la
-- table `handouts`), écriture MJ uniquement.
create policy "vaultmj handouts read" on storage.objects
  for select to authenticated using (bucket_id = 'handouts');
create policy "vaultmj handouts insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'handouts' and public.is_dm());
create policy "vaultmj handouts update" on storage.objects
  for update to authenticated using (bucket_id = 'handouts' and public.is_dm());
create policy "vaultmj handouts delete" on storage.objects
  for delete to authenticated using (bucket_id = 'handouts' and public.is_dm());
