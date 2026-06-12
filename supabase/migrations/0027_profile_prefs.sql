-- ============================================================
-- 0027_profile_prefs.sql
-- Réglages d'affichage portés par le compte.
--
-- profiles.prefs (jsonb) : échelle, thème, contraste, accent, disposition
-- VTT… Le localStorage reste un cache local immédiat ; le compte devient la
-- source durable — les réglages suivent l'utilisateur entre appareils et
-- survivent aux nettoyages du navigateur.
-- Écriture couverte par profiles_update_self (0002), lecture par
-- profiles_select_authenticated : rien de sensible dans ces réglages.
--
-- Idempotent. Exécuter dans Supabase > SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists prefs jsonb;
