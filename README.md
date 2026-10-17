# DELOS CASH

DELOS CASH est un annuaire public de collectes transparentes : associations et
cagnottes montrent qui collecte, combien entre, où l’argent est dépensé et les
preuves associées.

> **Mode démo : aucun argent réel ne circule.** Les paiements utilisent le
> simulateur Bitnob. L’application n’est ni une banque ni un portefeuille.

## Cloner et démarrer en local

### Prérequis

- Git
- Node.js 22 ou supérieur (la version LTS est recommandée). Sous Windows,
  installez le fichier `.msi` depuis la [page officielle de téléchargement de
  Node.js](https://nodejs.org/en/download/) et laissez l’option d’ajout au
  `PATH` activée.

Après l’installation de Node.js, fermez puis rouvrez PowerShell. Vérifiez que
`node` et `npm` sont disponibles, puis installez la version de pnpm utilisée
par le projet :

```bash
node --version
npm --version
npm install --global pnpm@11.25.0
pnpm --version
```

Si `node` ou `npm` reste introuvable, relancez l’installation de Node.js en
vérifiant que l’ajout au `PATH` est activé, puis ouvrez un nouveau terminal.

### Installation

```bash
git clone https://github.com/Mirak29/delos-cash.git
cd delos-cash
pnpm install
pnpm dev
```

Ouvrez ensuite **http://localhost:8000**. L’API locale écoute sur le port
8001; l’interface lui transmet ses appels automatiquement.

Vous n’avez pas besoin de créer un fichier `.env` pour démarrer la démo. Le
mode `mock` de Bitnob et le changement de compte de démonstration sont activés
par défaut en développement. Au premier lancement, le serveur crée la base
SQLite `delos.db` et génère les documents de démonstration. Ces fichiers restent
sur votre machine et ne sont pas suivis par Git.

Dans l’application, utilisez l’avatar pour choisir Public, Awa, Moussa, Fatou,
Ibrahima ou Modération. « Réinitialiser la démo » restaure les données de
démonstration.

### Commandes courantes

| Commande          | Rôle                                                            |
| ----------------- | --------------------------------------------------------------- |
| `pnpm dev`        | Lance Vite, React et l’API locale sur les ports 8000 et 8001    |
| `pnpm test`       | Lance les tests Node.js avec SQLite en mémoire et Bitnob simulé |
| `pnpm check`      | Vérifie les types TypeScript du client et du serveur            |
| `pnpm lint`       | Alias actuel de `pnpm check` (aucun outil ESLint séparé)        |
| `pnpm fmt`        | Formate le code avec Prettier                                   |
| `pnpm build`      | Génère le build de production dans `dist/`                      |
| `pnpm start`      | Lance le serveur de production après le build                   |
| `pnpm seed-files` | Régénère les pièces jointes de démonstration et leur manifeste  |
| `pnpm icons`      | Régénère les icônes PNG de la PWA                               |
| `pnpm backup`     | Sauvegarde la base et les documents                             |

`pnpm start` lit `.env-prod`. Pour une mise en production locale, configurez-y
notamment `DATABASE_PATH`, `FILES_DIR` et `PUBLIC_URL`; pour un déploiement
standard, utilisez Docker.

## Configuration et secrets

Le développement fonctionne avec les valeurs par défaut. Les fichiers
`.env-dev` et `.env` sont facultatifs et locaux. Ne commitez jamais de clés
Bitnob ou Resend.

- `BITNOB_MODE=mock` utilise le simulateur local.
- `BITNOB_MODE=sandbox` appelle la sandbox Bitnob et exige
  `BITNOB_CLIENT_ID` et `BITNOB_CLIENT_SECRET`.
- `RESEND_API_KEY` et `RESEND_FROM` activent les e-mails. Sans clé, la démo
  affiche les liens de confirmation à l’écran.
- `DEMO_ACCESS=1` active le changement de compte et les outils de démonstration.
  Réservez cette option aux environnements de démo.
- `MODERATOR_EMAILS` contient les adresses des modérateurs d’une instance
  réelle, séparées par des virgules.

`.env.example` sert de modèle pour le déploiement. Pour Docker, copiez-le vers
`.env-prod`, remplacez les valeurs d’exemple et gardez ce fichier hors de Git :

```bash
cp .env.example .env-prod
```

## Déployer avec Docker

Docker et Docker Compose doivent être installés.

```bash
cp .env.example .env-prod
# Modifiez .env-prod : PUBLIC_URL, secrets éventuels, DEMO_ACCESS=0 en production
docker compose up -d --build
```

L’application est disponible sur **http://localhost:3000**. La base, les
documents et les sauvegardes persistent dans le volume Docker `delos-data`.
Pour arrêter les conteneurs sans supprimer les données :

```bash
docker compose down
```

`docker compose down -v` supprime aussi le volume et donc la base, les documents
et les sauvegardes.

## Déployer sur Vercel

Le dépôt est configuré pour une interface Vite et une fonction Node.js Vercel.
En production, l’API utilise Neon PostgreSQL (`DATABASE_URL`) et un magasin
Vercel Blob privé (`BLOB_READ_WRITE_TOKEN`) pour les justificatifs. SQLite et
les fichiers locaux restent le mode par défaut pour le développement et Docker.

Créez une base PostgreSQL Neon et un magasin Blob **privé**, puis ajoutez ces
variables dans les paramètres Vercel :

- `DATABASE_URL`
- `BLOB_READ_WRITE_TOKEN`
- `CRON_SECRET` (secret aléatoire d’au moins 16 caractères)
- `BITNOB_MODE=mock` pour la démo, ou `sandbox` avec les clés Bitnob sandbox
- `DEMO_ACCESS=1` uniquement pour une démonstration publique

Le forfait Vercel Hobby ne permet qu'un cron quotidien. Pour conserver une
réconciliation fréquente sans abonnement payant, le dépôt contient un workflow
GitHub Actions qui appelle `/api/cron/reconcile` toutes les cinq minutes.
Ajoutez le secret `CRON_SECRET` dans les secrets Actions du dépôt GitHub, avec
exactement la même valeur que dans Vercel. GitHub peut retarder les tâches
planifiées lorsque ses runners sont chargés. Le webhook Bitnob reste disponible
sur `/api/webhooks/bitnob`.

Les pièces privées sont conservées dans Blob et renvoyées seulement après les
contrôles d’accès DELOS. Ne configurez pas le magasin Blob en mode public. Les
secrets doivent être saisis dans Vercel, jamais commités dans Git.

## Parcours de démonstration

La démo guidée présente l’annuaire, une contribution Lightning, une dépense
approuvée par plusieurs responsables, son paiement, les preuves, la vérification
du registre, le lancement d’une cagnotte et la modération. En mode `mock`, les
paiements sont simulés localement. En mode `sandbox`, une contribution tente de
débiter le solde fictif du compte Bitnob configuré; le compte doit autoriser les
paiements Lightning sortants. Aucun fonds réel n’est utilisé. Utilisez le bouton
du panneau « Démo guidée » pour avancer étape par étape.

## Documentation du produit

- [Cahier des charges](CAHIER-DES-CHARGES.md) : règles métier, parcours,
  permissions et intégration Bitnob.
- [Design](DESIGN.md) : écrans, composants, textes et données de démonstration.
- [AGENTS.md](AGENTS.md) : architecture du dépôt, conventions et consignes de
  contribution.

## Repères dans le code

```text
api/                 Adaptateur Vercel (fonction catch-all)
server/              API Hono, règles serveur, SQLite/PostgreSQL, paiements et fichiers
web/app.tsx          cadre React et routes chargées à la demande
web/pages/           pages de l’application
web/ui/              composants réutilisables
web/lib/             état client, règles partagées, appels API et données démo
server/migrations/   évolutions de la base
task-dev.ts          serveurs Vite et API pour le développement
task-prod.ts         build de production
prod-server.ts       serveur HTTP de production
Dockerfile           image de production
compose.yaml         service Docker et volume persistant
```
