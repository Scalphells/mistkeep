# Contribuer

Merci de ton intérêt ! Quelques règles simples.

## Avant de coder
- Ouvre une **issue** pour discuter d'un changement non trivial.
- Garde les PR **ciblées** (un sujet par PR).

## Qualité
- `npm test` et `npm run build` doivent passer.
- Suis le style du code existant (JS natif, modules ES, pas de framework).
- La logique métier va dans `src/lib/` (pure, testable) ; ajoute des tests Vitest.

## Règle d'or : outils, pas contenu
N'ajoute **aucun** contenu propriétaire (textes, règles, illustrations, données de
modules ou d'univers commerciaux). Seul le contenu **ouvert (SRD 5.1)** ou
original est accepté. Les fonctionnalités doivent rester du *moteur*, l'utilisateur
apportant sa propre matière.

## Sécurité
Toute écriture sensible doit rester protégée par RLS côté Supabase. Ne déplace
jamais une décision de droit vers le client.
