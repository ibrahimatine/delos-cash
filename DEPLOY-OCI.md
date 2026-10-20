# Mise en ligne gratuite sur Oracle Cloud

Le dépôt a déjà une image Docker et un volume SQLite. Cette procédure évite
Neon et Vercel Blob en gardant la base et les justificatifs sur le disque de la
machine. Oracle propose une offre Always Free pour certaines machines, sous
réserve d’éligibilité et de disponibilité dans la région choisie :
[offre Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/).

## 1. Créer la machine

Dans Oracle Cloud, créez une instance Ubuntu (A1 Ampere si elle est disponible,
sinon une configuration Always Free proposée dans votre compte). Gardez une
adresse IPv4 publique et autorisez les ports TCP 22 et 3000 dans la liste de
sécurité du sous-réseau. Connectez-vous en SSH avec la clé créée lors du
lancement de l’instance.

L’offre gratuite et la capacité des machines dépendent du compte et de la
région. Oracle peut demander un moyen de paiement pour vérifier le compte ; ne
validez aucune option payante.

## 2. Installer Docker et démarrer l’application

Sur la machine Ubuntu :

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
```

Déconnectez-vous puis reconnectez-vous en SSH pour appliquer le groupe Docker.
Ensuite :

```bash
git clone <URL_DU_DEPOT> delos-cash
cd delos-cash
cp .env.example .env-prod
nano .env-prod
docker compose up -d --build
```

Dans `.env-prod`, configurez au minimum :

```dotenv
BITNOB_MODE=mock
DEMO_ACCESS=1
PUBLIC_URL=http://<IP_PUBLIQUE>:3000
MODERATOR_EMAILS=<votre-adresse-email>
```

Laissez `DATABASE_URL` vide : l’application utilise SQLite dans le volume
`delos-data`, sans Neon. N’ajoutez pas `BLOB_READ_WRITE_TOKEN` : les fichiers
sont conservés dans ce même volume. N’utilisez pas les clés Bitnob de
production ; le mode `mock` simule les paiements.

L’application répond ensuite sur `http://<IP_PUBLIQUE>:3000`. Pour vérifier
l’état du conteneur et consulter les journaux :

```bash
docker compose ps
docker compose logs -f app
```

Les données restent dans `delos-data` lors des redémarrages et mises à jour.
Ne lancez pas `docker compose down -v` : cette commande supprime aussi ce
volume. Faites une copie de sauvegarde avec :

```bash
docker compose run --rm app pnpm run backup
```

Cette mise en ligne utilise HTTP sur le port 3000. Pour un site public avec
HTTPS et un nom de domaine, configurez ensuite un domaine et un reverse proxy
TLS (par exemple Caddy) devant l’application.
