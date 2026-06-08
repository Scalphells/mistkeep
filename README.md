# Mistkeep — table virtuelle JDR auto-hébergeable

Une table virtuelle (VTT) légère et originale pour mener des parties de jeu de
rôle **D&D 5e (contenu ouvert SRD 5.1)** en ligne avec ta table : fiches de
personnage, suivi d'initiative, carte tactique avec jetons et **vision
dynamique**, chat, **journal de combat façon cartes**, compendium, gestion de
ressources de classe, trésor de groupe, journal de quêtes, et plus.

Front-end statique (Vite, JavaScript natif, sans framework) + **Supabase**
(authentification, base PostgreSQL, temps réel, stockage de fichiers). Tu héberges
**ta propre instance** : tes données t'appartiennent, aucun service central.

> ⚠️ **Outils, pas contenu.** Ce dépôt ne fournit que des *outils* et du contenu
> **ouvert (SRD 5.1)**. Il ne contient **aucun** texte, règle, illustration ou
> donnée propriétaire (univers commerciaux, modules publiés, etc.). Tu importes
> **ton propre matériel** dans ton instance privée, pour ton usage à ta table.

## ✨ Fonctionnalités

- **Fiches D&D 5e** : caractéristiques, jets, compétences, sorts, emplacements,
  ressources de classe, inventaire & monnaie, repos court/long, dés de vie.
- **Combat** : initiative (avec jets de groupe pour les hordes), PV/états/effets à
  durée, **jets de sauvegarde contre la mort**, **sauvegardes de groupe (AoE)**,
  journal de combat en cartes riches.
- **Carte tactique** : jetons (dispositions, auras, élévation), **vision dynamique**
  (murs, portes, lumières, brouillard à 3 niveaux, vision dans le noir), gabarits
  de sort, dessin, scènes multiples, ambiance (obscurité/météo), **HUD de jeton**.
- **Partagé** : chat (public/privé, modes de jet), handouts, compendium (SRD
  importable via [dnd5eapi](https://www.dnd5eapi.co/)), trésor de groupe, quêtes.
- **Disposition « Rail VTT »** optionnelle façon table virtuelle (carte centrale +
  fenêtres flottantes).

## 🧱 Prérequis

- **Node.js ≥ 20.19**
- Un projet **Supabase** (la [formule gratuite](https://supabase.com/) suffit
  largement pour une table).

## 🚀 Déployer ta propre instance (≈ 10 min)

### 1. Créer le projet Supabase
Crée un projet sur [supabase.com](https://supabase.com/). Note, dans
**Project Settings → API** : l'**URL du projet** et la **clé `anon` publique**.

### 2. Créer le schéma
Dans **Supabase → SQL Editor**, exécute **dans l'ordre** chaque fichier de
`supabase/migrations/` (`0001_…` puis `0002_…`, etc., jusqu'au dernier). Ils
créent les tables, la sécurité (RLS) et les buckets de stockage.

### 3. Configurer le front
```bash
git clone <ce-dépôt>
cd mistkeep
npm install
cp .env.example .env      # renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
```

### 4. Créer les comptes & désigner le MJ
Lance l'app (`npm run dev`), crée ton compte (et ceux des joueurs, ou laisse-les
s'inscrire). Puis, **une fois**, dans **Supabase → SQL Editor**, donne le rôle MJ
à ton compte :
```sql
update public.profiles set role = 'dm' where email = 'TON_EMAIL';
```

### 5. Déployer (statique)
```bash
npm run build      # produit dist/
```
Déploie le dossier `dist/` sur n'importe quel hébergeur de fichiers statiques
gratuit (Cloudflare Pages, Netlify, Vercel, GitHub Pages…), en y déclarant les
variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

Tes joueurs ouvrent l'URL, créent leur compte, et c'est parti. 🎲

## 🛠 Développement

```bash
npm run dev        # serveur local (http://localhost:5173)
npm test           # tests unitaires (Vitest)
npm run build      # build de production
```

Architecture : store central (`src/state.js`), une fonction `mount(container)`
par fonctionnalité (`src/features/`), logique pure et testable dans `src/lib/`,
routeur de vues léger (`src/features/nav.js`).

## 🔒 Sécurité (points clés)

- Le rôle (`dm`/`player`) est la **source de vérité en base** (`profiles.role`),
  protégé par RLS + trigger anti-escalade. Aucune décision de droit côté client.
- Les écritures sensibles sont **réservées au MJ** par RLS (`public.is_dm()`).
- Le stockage (cartes, handouts) est **privé** ; accès par URL signées.

## 📜 Contenu & droits

L'application est un **moteur**. Le **contenu** de ta campagne (PNJ, lieux,
textes de modules commerciaux, illustrations…) reste le tien et **n'est pas
fourni** ici. N'importe que du contenu dont tu as les droits ; le SRD 5.1 est
disponible sous licence ouverte.

## 🤝 Contribuer

Les contributions sont bienvenues — voir [CONTRIBUTING.md](CONTRIBUTING.md).

## ⚖️ Licence

[GNU AGPL-3.0-or-later](LICENSE). En résumé : tu peux utiliser, modifier et
redistribuer librement, mais toute version modifiée **distribuée ou exploitée
comme service en ligne** doit publier son code source sous la même licence.
