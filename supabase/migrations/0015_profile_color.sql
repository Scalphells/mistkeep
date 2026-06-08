-- ============================================================
-- 0015 — Profil joueur : couleur personnelle.
-- ------------------------------------------------------------
-- Couleur choisie par l'utilisateur (avatar = initiales colorées), réutilisée
-- dans le chat et les dés. L'édition du profil (nom, couleur) passe par la
-- policy existante `profiles_update_self` ; le trigger anti-élévation de rôle
-- continue d'empêcher un joueur de se promouvoir MJ.
-- ============================================================

alter table public.profiles
  add column if not exists color text;
