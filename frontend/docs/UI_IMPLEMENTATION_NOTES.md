# Notes d’implémentation UI — MindLog AI

## Architecture

L’application utilise React 19, Vite, JavaScript, Tailwind CSS v4, React Router en mode Data (`createBrowserRouter`/`RouterProvider`), Lucide React et Recharts.

- `src/app` : composition de l’application et inventaire central des routes.
- `src/components` : primitives UI et shell authentifié.
- `src/features` : pages regroupées par domaine fonctionnel.
- `src/data` : données de démonstration stables et interconnectées.
- `src/store` : état partagé et synchronisation `localStorage`.
- `src/services` : frontière d’accès aux données, simulation et futur client HTTP.

## Système visuel

Le système local suit la palette demandée : fond ardoise clair, texte sombre, violet principal, cyan réservé à l’IA, surfaces blanches, bordures légères et états sémantiques. La police Manrope est chargée via Google Fonts. Les composants partagés incluent `Button`, `Card`, `Input`, `Select`, `Textarea`, `Badge`, `Modal`, `PageHeader`, `Stat`, `Empty` et `Loading`.

Le shell comporte une barre latérale rétractable, un menu mobile, une recherche globale visuelle, un compteur de notifications et un menu utilisateur.

## Inventaire fonctionnel

### Journal

Liste, recherche, tri, favoris, création, brouillon, détail, édition, suppression et analyse IA simulée.

### Humeurs

Dashboard, enregistrement avec intensité, historique filtrable, détail, suppression et tendances non médicales.

### Multimédia

Bibliothèque, détail, téléversement simulé, atelier d’image IA, groupes de personnes avec notice de confidentialité et transcription éditable.

### Objectifs & Habitudes

Statistiques, filtres, création/édition/détail d’objectif, progression, validation d’habitudes et suggestions simulées.

### Souvenirs & Événements

Le module prioritaire s’appuie sur une source unique :

- vue grille/liste avec recherche, filtres et tri ;
- création/édition avec médias associés et suggestions IA contrôlées ;
- détail riche, suppression confirmée, résumé, médias et souvenirs similaires ;
- timeline groupée par mois et année ;
- calendrier mensuel avec sélection de date et création préremplie ;
- recherche naturelle simulée avec synonymes simples ;
- synthèses mensuelles, annuelles ou personnalisées ;
- graphiques, tags fréquents, souvenirs importants et résumés sauvegardés.

## Persistance

Les collections mutables sont enregistrées sous des clés `mindlog_*`. Les préférences de thème et les résumés de souvenirs sont également conservés. Le service souvenirs reste la source de vérité pour le CRUD ; le store recharge cette source après chaque mutation.

La suppression d’un souvenir ne supprime jamais les médias globaux associés.

## Comportement IA simulé

Les interfaces IA utilisent des délais courts pour représenter les états chargement/succès. Les résultats sont dérivés des données affichées lorsque cela est nécessaire, notamment pour les résumés par période. Aucune interface ne prétend appeler Gemini, un modèle de langage, un moteur d’image, une reconnaissance faciale ou un service de transcription.

## Intégration Django REST Framework

`VITE_API_BASE_URL` activera la base d’un client HTTP. Contrats REST attendus :

- `GET/POST /memories/`
- `GET/PATCH/DELETE /memories/{id}/`
- `GET /memories/search/?q=&category=&importance=`
- `GET /memories/period/?start=&end=`
- `GET /memories/{id}/similar/`
- `POST /ai/memories/summary/`
- `POST /ai/memories/suggest-category/`
- `POST /ai/memories/suggest-tags/`
- Ressources équivalentes pour `journal-entries`, `moods`, `media`, `goals`, `habits`, `notifications` et `profile`.

Les réponses backend pourront être converties entre `snake_case` DRF et le `camelCase` local dans la couche service.

## Travaux restants

- Ajouter authentification réelle, jetons et garde de routes.
- Remplacer les simulations par des endpoints explicites et sécurisés.
- Ajouter upload objet/cloud et gestion de la durée de vie des fichiers.
- Ajouter i18n si l’anglais devient réellement disponible.
- Découper le bundle par route.
- Ajouter tests unitaires et d’intégration, avec priorité sur la cohérence multi-vues des souvenirs.
