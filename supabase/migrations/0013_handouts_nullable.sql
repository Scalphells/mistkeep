-- ============================================================
-- 0013 — Handouts texte/lettre : image_url & text_content nullables.
-- ------------------------------------------------------------
-- L'ancienne table `handouts` avait `image_url` NOT NULL (héritage du
-- monolithe). Un handout de type texte/lettre n'a pas d'image → l'insertion
-- échouait (« null value in column "image_url" … violates not-null »).
-- On rend ces colonnes nullables.
-- ============================================================

alter table public.handouts alter column image_url drop not null;
alter table public.handouts alter column text_content drop not null;
