-- ============================================================
-- 0029_storage_campaign.sql
-- Storage scopé par campagne (clôt le résiduel documenté en 0026).
--
-- Depuis 0026, l'autorité sur les tables de jeu est PAR CAMPAGNE
-- (is_dm_of) ; le Storage, lui, restait sur is_dm() global : un MJ « de
-- campagne » (créateur d'une campagne, ou table rejointe par code — 0028)
-- ne pouvait téléverser AUCUN fichier (cartes, jetons, portraits, audio,
-- handouts). Le backend Go applique la même règle dans storage.go (aucune
-- migration nécessaire sur le binaire).
--
-- Principe : le front préfixe désormais chaque clé par l'id de la campagne
-- active (`<campaign_id>/…`, cf. src/lib/media.js) ; l'écriture exige
-- is_dm_of(<premier segment du chemin>). Un chemin SANS préfixe uuid (tous
-- les fichiers historiques) est rattaché à la campagne par défaut — les
-- droits existants sont donc strictement conservés.
--
-- La LECTURE reste « tout authentifié » (policies 0019 inchangées) :
-- volontaire. L'import de campagne (.json) référence les fichiers de la
-- campagne d'origine sans les copier, et signer une URL exige le droit
-- SELECT du signataire — scoper la lecture casserait ces deux flux. La
-- confidentialité fine des handouts est portée par la table `handouts`.
--
-- À exécuter dans Supabase > SQL Editor (idempotent).
-- ============================================================

-- Campagne d'un chemin d'objet : premier segment s'il est un uuid,
-- sinon campagne par défaut (fichiers historiques non préfixés).
create or replace function public.storage_campaign_of(path text)
returns uuid
language sql
stable
as $$
  select case
    when split_part(path, '/', 1)
         ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(path, '/', 1)::uuid
    else '00000000-0000-4000-8000-000000000001'::uuid
  end
$$;

-- ── battlemap : écriture = MJ DE LA CAMPAGNE du chemin ──────
drop policy if exists "vaultmj battlemap insert" on storage.objects;
drop policy if exists "vaultmj battlemap update" on storage.objects;
drop policy if exists "vaultmj battlemap delete" on storage.objects;

create policy "vaultmj battlemap insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'battlemap' and public.is_dm_of(public.storage_campaign_of(name)));
create policy "vaultmj battlemap update" on storage.objects
  for update to authenticated
  using (bucket_id = 'battlemap' and public.is_dm_of(public.storage_campaign_of(name)))
  with check (bucket_id = 'battlemap' and public.is_dm_of(public.storage_campaign_of(name)));
create policy "vaultmj battlemap delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'battlemap' and public.is_dm_of(public.storage_campaign_of(name)));

-- ── handouts : idem ─────────────────────────────────────────
drop policy if exists "vaultmj handouts insert" on storage.objects;
drop policy if exists "vaultmj handouts update" on storage.objects;
drop policy if exists "vaultmj handouts delete" on storage.objects;

create policy "vaultmj handouts insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'handouts' and public.is_dm_of(public.storage_campaign_of(name)));
create policy "vaultmj handouts update" on storage.objects
  for update to authenticated
  using (bucket_id = 'handouts' and public.is_dm_of(public.storage_campaign_of(name)))
  with check (bucket_id = 'handouts' and public.is_dm_of(public.storage_campaign_of(name)));
create policy "vaultmj handouts delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'handouts' and public.is_dm_of(public.storage_campaign_of(name)));
