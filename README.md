# Philip Karto — Atelier CRM

CRM interne, independant de Cover Dream, pour l'atelier Philip Karto : suivi du
stock de sacs vintage (Louis Vuitton / Hermes), des achats fournisseurs, du
processus de fabrication (reception -> desassemblage -> fabrication -> controle
qualite -> emballage -> expedition -> comptabilite) et des ventes clients.

Stack : Next.js 14 (App Router, TypeScript, Tailwind CSS) + Supabase
(base de donnees Postgres, authentification, Row Level Security).

## 1. Installer les dependances

```bash
cd philip-karto-crm
npm install
```

## 2. Creer le projet Supabase

1. Va sur [supabase.com](https://supabase.com) et cree un nouveau projet.
2. Dans **SQL Editor**, colle le contenu de `supabase/migrations/0001_init.sql`
   et execute-le. Cela cree toutes les tables, les regles de securite (RLS)
   et les donnees de depart (etapes de fabrication reprises du fichier CSV
   fournisseur, marques Louis Vuitton / Hermes, modeles Speedy / Keepall /
   Neverfull / Birkin).
3. Dans **Project Settings > API**, recupere l'URL du projet et la cle
   `anon public`.

## 3. Configurer les variables d'environnement

```bash
cp .env.example .env.local
```

Remplis `.env.local` avec les valeurs recuperees a l'etape precedente :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 4. Creer les utilisateurs (admin, atelier, commercial, comptabilite)

Un profil est cree automatiquement des qu'un compte se connecte pour la
premiere fois (role "atelier" par defaut).

1. Dans Supabase : **Authentication > Users > Invite user**, envoie une
   invitation a chaque salarie avec son email.
2. Une fois qu'un salarie a active son compte (mot de passe defini),
   connecte-toi avec ton propre compte admin puis va dans
   **Parametres > Utilisateurs** pour lui attribuer le bon role : Admin,
   Atelier, Commercial ou Comptabilite.
3. Pour ton tout premier compte admin : cree-le via Invite user, connecte-toi,
   puis modifie directement la ligne dans la table `profiles` (colonne
   `role`) depuis le Table Editor de Supabase pour la passer a `admin`.

## 5. Lancer l'application en local

```bash
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).

## 6. Mettre en ligne (Vercel + GitHub)

1. Pousse ce dossier dans un nouveau repo GitHub.
2. Sur [vercel.com](https://vercel.com), importe ce repo.
3. Dans les parametres du projet Vercel, ajoute les memes variables
   d'environnement que dans `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
4. Deploie. Chaque salarie invite pourra alors se connecter depuis
   l'URL Vercel avec son compte.

## Structure du projet

```
src/
  app/
    login/              page de connexion
    (app)/               zone protegee (necessite d'etre connecte)
      dashboard/         tableau de bord (stats, retards, CA)
      bags/              stock de sacs (liste, creation, fiche detail + suivi fabrication)
      production/        vue d'ensemble de la fabrication par phase
      orders/             commandes clients / ventes
      customers/          carnet clients
      suppliers/           fournisseurs
      settings/
        stages/           gestion de la liste des etapes de fabrication (admin)
        users/             gestion des roles utilisateurs (admin)
  components/            composants d'interface reutilisables
  lib/supabase/          clients Supabase (navigateur, serveur, middleware)
supabase/migrations/     schema SQL + regles de securite + donnees de depart
```

## Le pipeline de fabrication

Repris tel quel du fichier CSV fournisseur ("TEMPLATE ORDER (the BAG)") :

1. **Reception** — reception du sac
2. **Desassemblage** — nettoyage, repassage, pose fermeture eclair, broderie
   cote, pose des bandes
3. **Fabrication** — broderie, pose des anses, doublure, fermeture, peinture,
   bandouliere, patch, sous-traitance
4. **Controle qualite** — fermeture eclair, carte d'authentification,
   bandouliere, doublure, peinture
5. **Emballage** — demarrage emballage, emballage
6. **Expedition** — commande d'expedition, expedie
7. **Comptabilite** — facture, numero de facture, paiement

Chaque sac possede sa propre checklist (case a case, comme dans le CSV
d'origine) modifiable depuis sa fiche detail. La liste des etapes elle-meme
est modifiable dans **Parametres > Etapes de fabrication** (reserve aux
administrateurs).

## Roles

- **Admin** : acces complet, gere les utilisateurs et la liste des etapes.
- **Atelier** : cree les sacs, gere le stock et coche les etapes de
  fabrication.
- **Commercial** : gere les clients et les commandes/ventes.
- **Comptabilite** : gere le statut de paiement et la facturation des
  commandes.

Les droits sont appliques directement au niveau de la base de donnees
(Row Level Security Supabase), pas seulement dans l'interface.
