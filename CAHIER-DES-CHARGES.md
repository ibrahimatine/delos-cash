# Cahier des charges — DELOS CASH

| | |
| --- | --- |
| Version | 1.2 (29 septembre 2026) |
| Nature | Prototype fonctionnel de hackathon, **PWA**, fonds exclusivement sandbox |
| Événement | Code & Chain Dakar 2026, 17–18 octobre 2026 |
| Design | Brief séparé pour Claude Design : [`DESIGN.md`](DESIGN.md) |
| Vérification | Chaque affirmation sur Bitnob a été vérifiée dans la documentation officielle le 29/09/2026 (sources en §20). Les points non confirmés sont marqués **[spike T0]**. |

---

## 1. Contexte

### 1.1 Le problème

Les associations, cagnottes communautaires, tontines et collectes solidaires souffrent d'un déficit de confiance :

- on ne sait pas qui est réellement derrière une cagnotte ;
- les contributeurs ne savent pas combien a été collecté ;
- les dépenses sont rarement reliées à un justificatif ;
- une seule personne décide souvent des décaissements ;
- les frais, les conversions et le bénéficiaire réel restent opaques ;
- personne ne peut vérifier que l'argent a vraiment servi à la cause annoncée.

### 1.2 La réponse

DELOS CASH est un **annuaire public de collectes transparentes**. N'importe qui peut ouvrir l'application, parcourir les associations et les cagnottes, et voir pour chacune **ce qui entre, ce qui sort, et la preuve que l'argent a servi à la cause**.

```
Contribution → confirmation du paiement → proposition de dépense
→ approbation → versement au bénéficiaire → publication des preuves
```

### 1.3 Le hackathon

Code & Chain Dakar 2026 est consacré aux solutions financières utilisant Bitcoin, l'open source et l'API Bitnob. Critères annoncés : innovation, réalisation technique, usage significatif de Bitcoin et de Bitnob, impact, UX, qualité open source.

> **Règlement non vérifié.** Aucune page officielle du règlement n'a pu être consultée. La clause « projet développé pendant le hackathon et publié sur un dépôt GitHub public » doit être confirmée **par écrit** auprès des organisateurs avant tout développement (tâche T0.1). Tant qu'elle ne l'est pas, seuls la spécification, le design, l'apprentissage de l'API et les tests sandbox sont sûrs.

### 1.4 Ce que DELOS CASH n'est pas

Ni banque, ni établissement de paiement, ni conservateur de fonds, ni place de marché. Le prototype ne déplace **aucun argent réel** :

| | |
| --- | --- |
| Argent réel, clés de production, conservation de fonds, comptes financiers | **Non** |
| KYC réglementaire ou automatisé, vrais comptes Wave | **Non** |
| Vérification d'identité par modération, sur données fictives | **Oui** |
| Appels réels à l'API sandbox Bitnob | **Oui** |
| Factures Lightning, cotations, payouts sandbox | **Oui** |
| Webhooks et références Bitnob réels | **Oui** |
| Parcours de bout en bout | **Oui** |

Toute opération financière porte le badge **« Simulation Bitnob »**. Formulation devant le jury :

> « Les transactions sont simulées avec l'infrastructure sandbox de Bitnob. Les appels API, les cotations, les identifiants, les états et les webhooks sont réels ; aucun argent réel n'est déplacé. »

---

## 2. Vision produit

### 2.1 Proposition de valeur

> Voir qui collecte, ce qui entre, où part l'argent, et la preuve qu'il a servi à la cause.

### 2.2 Deux types de collecte

Le terme générique est **collecte**. Il en existe deux types, présentés côte à côte dans l'annuaire :

| | **Collecte d'association** | **Cagnotte** |
| --- | --- | --- |
| Lancée par | Une association **enrôlée et vérifiée** | Une à trois personnes à **identité vérifiée** |
| Exemples | Équipement d'une école, campagne de santé, tournoi sportif | Reconstruire un atelier après un incendie, fournitures pour une classe |
| Création | Par un représentant, depuis l'espace de l'association | En 3 étapes, depuis un compte vérifié |
| Décision de dépense | Règle de l'association (démo : 2 approbations sur 3 membres) | Plusieurs lanceurs : un autre lanceur approuve ; un seul lanceur : garde-fous renforcés (RG-08) |
| Bénéficiaires | Fournisseurs ajoutés à chaque dépense | **Déclarés publiquement à la création** : « où ira l'argent » |
| Page publique | Fiche de l'association + page de chaque collecte | Page de la cagnotte |

### 2.3 Trois promesses pour le public

1. **Qui** : chaque collecte affiche nommément ses responsables, avec le badge « Identité vérifiée » ou « Association vérifiée ».
2. **Combien** : entrées, sorties et disponible, à jour en direct.
3. **Pour quoi** : chaque sortie est reliée à un bénéficiaire, un justificatif et, quand c'est possible, une preuve de livraison. Un indicateur public montre la part des dépenses justifiées.

### 2.4 Simplicité : peu de clics

L'interface doit être comprise sans explication. Budgets de clics (hors saisie) :

| Action | Budget |
| --- | --- |
| Accueil → page d'une collecte | 1 clic |
| Voir où est parti l'argent (sorties) | 0 clic : résumé visible en haut de la page, détail en 1 clic |
| Voir la preuve d'une dépense | 1 clic depuis la page de la collecte |
| Contribuer | 2 clics (montant, puis « Payer ») + le paiement |
| Lancer une cagnotte (compte vérifié) | 3 écrans, 1 bouton par écran |
| Approuver une dépense | 2 clics depuis l'accueil connecté (« À faire » → « Approuver ») |

Principes : l'accueil **est** l'annuaire ; une action principale par écran, en bas à portée de pouce ; pas de menu à plusieurs niveaux ; vocabulaire simple (« Entrées », « Sorties », « Disponible », « Preuve ») ; les termes techniques (sats, références Bitnob, empreintes) sont repliés par défaut.

### 2.5 Public cible

Côté collecte : associations, collectifs, ONG locales, familles, groupes d'amis. Côté lecture : contributeurs, donateurs, membres de la diaspora, curieux, partenaires et auditeurs.

### 2.6 Pourquoi une PWA

Les contributeurs et les membres d'association au Sénégal utilisent d'abord leur téléphone, souvent sur une connexion instable. DELOS CASH est donc une **Progressive Web App** :

- installable depuis le navigateur, sans store ;
- icône sur l'écran d'accueil, ouverture plein écran (`display: standalone`) ;
- coque de l'application disponible hors connexion ;
- annuaire et pages de collecte déjà consultés lisibles hors connexion ;
- **mobile d'abord** pour tout le parcours public, la contribution, le lancement de cagnotte et l'approbation ; desktop pour la trésorerie d'association et la modération.

Règle absolue : **aucune opération financière n'est finalisée hors connexion** (voir §9).

---

## 3. Démonstration de bout en bout (scénario de référence)

Données fictives, voir [`DESIGN.md`](DESIGN.md) §3.

1. **Annuaire.** Le jury ouvre l'application : associations et cagnottes, chacune avec son badge de vérification, ses entrées, ses sorties et sa part de dépenses justifiées.
2. **Collecte d'association.** En un clic, il ouvre « Équipement de l'école de Ndiass » (Association des parents d'élèves de Ndiass, vérifiée) : objectif 1 000 000 FCFA, 975 000 collectés, une dépense déjà terminée et justifiée (« Peinture des deux classes »).
3. **Contribution.** Il choisit 25 000 FCFA. Le backend crée une facture Lightning Bitnob, l'écran affiche le QR code et le compte à rebours. Le paiement est simulé en sandbox **[spike T0 : mécanisme exact, §7.4]**. La collecte passe à 1 000 000 FCFA, « Objectif atteint », sans rechargement (SSE).
4. **Dépense.** Awa Diop, trésorière, propose « Achat de 20 tables », 350 000 FCFA, pour Menuiserie Ndiaye via Wave, avec `devis-tables.pdf` (empreinte SHA-256 inscrite au registre).
5. **Approbation.** L'application refuse qu'Awa approuve sa propre demande. Moussa Sarr (président) puis Fatou Ndiaye (contrôleuse) approuvent : 2/2.
6. **Payout.** Awa obtient la cotation Bitnob (taux, frais, expiration d'environ 15 min) et confirme. Le suivi défile en direct jusqu'à « Terminé ».
7. **Preuve.** La page publique montre Entrées 1 000 000 · Sorties 470 000 · Disponible 530 000, et pour la dépense : devis ✓, deux approbations ✓, paiement ✓, livraison ○. Awa ajoute la facture et la photo de livraison : « 2/2 dépenses justifiées ».
8. **Intégrité.** « Vérifier le registre » : « Intégrité vérifiée ». On modifie une ligne en base : « Rupture détectée à l'événement N ».
9. **Cagnotte en 3 étapes.** Ibrahima Fall (identité vérifiée) lance « Reconstruire l'atelier de Mame Diarra » : la cause, où ira l'argent (Mame Diarra Sow, Orange Money), puis une co-lanceuse, Mariama Ba. La cagnotte apparaît aussitôt dans l'annuaire, avec les deux noms vérifiés.
10. **Enrôlement.** Le dossier du « Collectif Santé Kolda » attend la modération. Le modérateur DELOS ouvre le dossier (récépissé, statuts, deux représentants vérifiés) et le valide : l'association apparaît dans l'annuaire avec le badge « Association vérifiée ».
11. **Robustesse.** Double clic sur « Confirmer le paiement » : un seul payout. Webhook rejoué : un seul événement.
12. **PWA.** Installation sur téléphone, ouverture plein écran, passage hors connexion : l'annuaire et la collecte restent lisibles, l'approbation est bloquée avec « Connexion requise ».

Durée cible : 5 minutes. Les étapes 9 et 10 peuvent être raccourcies grâce au panneau de démo guidée.

---

## 4. Périmètre

### 4.1 P0 — indispensable à la démonstration

**Public**
- annuaire : recherche, filtre Associations / Cagnottes, catégories, cartes avec vérification, entrées, sorties et dépenses justifiées ;
- fiche d'association : identité légale, représentants, chiffres cumulés, collectes ;
- page de collecte : responsables vérifiés, progression, résumé « Où va l'argent », onglets **Entrées**, **Sorties**, **Preuves** ;
- chaîne de preuves d'une dépense ;
- registre public chaîné par hash et page de vérification ;
- contribution Lightning : facture, QR code, compte à rebours, confirmation, reçu.

**Comptes et identité**
- création de compte par e-mail vérifié et mot de passe ;
- vérification d'identité (nom légal, pièce d'identité) validée par un modérateur ;
- enrôlement d'une association : informations légales, documents, deux représentants vérifiés, règle d'approbation, validation par modération ;
- lancement d'une cagnotte en 3 étapes, co-lanceurs invités par e-mail et vérifiés ;
- espace de modération (identités et associations) ;
- en mode démo, bascule rapide entre comptes préremplis.

**Argent**
- proposition de dépense avec justificatif haché ;
- approbation (règle de l'association, ou co-lanceur pour une cagnotte) et séparation des pouvoirs ;
- bénéficiaire Mobile Money Sénégal construit depuis le schéma Bitnob ;
- cotation, initialisation, financement sandbox, finalisation du payout ;
- webhooks Bitnob vérifiés et dédupliqués, **réconciliation obligatoire** (§7.9) ;
- justificatifs post-paiement (facture, photo de livraison) ;
- temps réel par SSE.

**Plateforme**
- **PWA installable** : manifest, icônes, service worker, coque hors ligne, pages publiques en cache, blocage des actions financières hors ligne ;
- panneau de démo guidée et commande de réinitialisation ;
- mode `mock` de secours produisant la même machine d'états, clairement signalé.

### 4.2 P1 — produit complet de hackathon

Contributions USDT/USDC ; anonymat public du contributeur ; rejet motivé ; export CSV ; historique des tentatives de payout ; journal technique ; panneau de simulation d'échecs ; brouillons hors connexion (IndexedDB) ; ajout public d'un nouveau bénéficiaire de cagnotte avec délai de 24 h ; signalement d'une collecte par le public ; suspension par un modérateur ; selfie de vérification ; CSRF et limitation de débit.

### 4.3 P2 — feuille de route

Vérification d'identité par un prestataire agréé ; contrôle du récépissé auprès du registre officiel ; OTP par SMS ; cartes de dépenses associatives ; notifications push ; signature cryptographique personnelle des approbateurs ; ancrage périodique du hash du registre sur Bitcoin ; Wallet Infrastructure Bitnob Enterprise ; passage en production après qualification juridique.

### 4.4 Hors périmètre

Portefeuille d'argent réel, dépôt ou retrait en production, KYC réglementaire ou automatisé, vérification auprès d'un registre officiel, conservation de fonds, vrais comptes Wave, onboarding réglementaire, comptes virtuels (orientés NGN : inadaptés au Sénégal).

---

## 5. Acteurs et permissions

| Acteur | Peut | Ne peut pas |
| --- | --- | --- |
| **Visiteur** | Parcourir l'annuaire, lire toute page publique (entrées, sorties, preuves, registre), vérifier l'intégrité, contribuer (sans compte) | Voir une pièce d'identité, un document privé, un numéro complet |
| **Compte** (e-mail vérifié) | Demander la vérification de son identité, suivre ses contributions | Lancer une cagnotte ou représenter une association tant que son identité n'est pas vérifiée |
| **Lanceur de cagnotte** (identité vérifiée) | Créer une cagnotte, inviter jusqu'à 2 co-lanceurs, déclarer les bénéficiaires, proposer une dépense, confirmer le payout, publier les preuves | Approuver sa propre dépense ; payer un bénéficiaire non déclaré |
| **Co-lanceur** (identité vérifiée, invitation acceptée) | Mêmes droits ; approuve les dépenses des autres lanceurs | Approuver sa propre dépense |
| **Représentant d'association** (président, trésorier ; identité vérifiée) | Enrôler l'association, inviter des membres, lancer des collectes ; le trésorier propose les dépenses et lance les payouts | Approuver sa propre dépense |
| **Membre approbateur** (contrôleur, autre membre désigné) | Approuver ou rejeter, consulter les preuves | Lancer un payout |
| **Modérateur DELOS** | Vérifier identités et dossiers d'association, valider, refuser avec motif ; suspendre (P1) | Modifier une collecte, un montant ou un événement du registre |

Le backend vérifie chaque permission, même quand l'interface masque déjà l'action.

---

## 6. Règles de gestion

### 6.1 Identité et enrôlement

- **RG-01 Compte.** E-mail vérifié par lien, mot de passe validé champ par champ, téléphone déclaré.
- **RG-02 Identité vérifiée.** Nom légal, date de naissance, type et numéro de pièce (CNI sénégalaise ou passeport), photo de la pièce. Un modérateur valide ou refuse avec motif. Le public voit le **nom légal** et le badge ; jamais la pièce, son numéro ni la date de naissance. Les pièces sont stockées en privé avec leur empreinte, et ne sont lisibles que par le modérateur.
- **RG-03 Association vérifiée.** Dossier : nom légal, sigle, numéro du récépissé de déclaration et son scan, statuts (PDF), NINEA (facultatif), siège (région, commune), cause, contact public. **Deux représentants à identité vérifiée** au minimum (président et trésorier), une règle d'approbation. Tant que le dossier n'est pas validé, l'association peut préparer une collecte mais pas la publier.
- **RG-04 Affichage public.** Une collecte affiche toujours ses responsables : nom de l'association et de ses représentants, ou noms des lanceurs, avec la date de vérification. Une cagnotte dont un co-lanceur n'a pas encore accepté l'invitation l'indique.
- **RG-05 Démo.** Les identités et documents sont fictifs. La modération est un vrai écran, utilisé en direct pendant la démo.

### 6.2 Gouvernance des dépenses

- **RG-06 Association.** Règle « N approbations sur M membres approbateurs ». Démo : 2 sur 3.
- **RG-07 Cagnotte à plusieurs lanceurs.** Chaque dépense est approuvée par au moins un lanceur autre que son auteur.
- **RG-08 Cagnotte à un seul lanceur.** Pas d'approbation possible, donc garde-fous renforcés : versements **uniquement aux bénéficiaires déclarés à la création** ; justificatif obligatoire à la proposition ; signal public « Justificatif de livraison attendu » si aucun n'est publié 7 jours après le paiement.
- **RG-09 Séparation des pouvoirs.** L'auteur d'une dépense ne compte jamais parmi ses approbateurs. Un payout exige une dépense approuvée (ou, RG-08, conforme).
- **RG-10 Modification.** Toute modification du montant, du bénéficiaire, du numéro, du justificatif ou du motif après la première approbation remet les approbations à zéro.

### 6.3 Argent

- **RG-11 Montants.** Jamais de nombres flottants. Stockage en entiers : XOF en francs, BTC en satoshis, USDT/USDC en micro-unités (6 décimales). Bitnob renvoie ses montants en **chaînes décimales** (`"amount": "0.724761"`, `"settlement_amount": "1000"`, `"sat_amount": "1144"`) : conversion par un parseur décimal exact, chaîne d'origine conservée dans la réponse brute. Les montants Lightning sont des satoshis entiers.
- **RG-12 Valorisation.** Une contribution conserve son montant natif, son actif, le taux à la confirmation, sa contre-valeur XOF figée et la source du taux. L'historique n'est jamais recalculé.
- **RG-13 Soldes.** `Entrées` = contributions confirmées ; `Réservé` = dépenses approuvées non terminées ; `Sorties` = payouts terminés ; `Disponible` = Entrées − Réservé − Sorties. C'est un registre métier, jamais présenté comme un compte bancaire.
- **RG-14 Dépenses justifiées.** Indicateur public : dépenses terminées ayant un justificatif de livraison / dépenses terminées. Affiché sur la carte de l'annuaire et la page de la collecte. Ce n'est pas une note : c'est un fait.
- **RG-15 Conditions du payout.** Dépense approuvée, bénéficiaire actif, montant disponible, corridor ouvert, cotation non expirée, aucune tentative réussie existante.
- **RG-16 Cotation.** Une cotation Bitnob expire (environ 15 min) : elle est toujours demandée **après** les approbations. Une cotation expirée n'est jamais réutilisée ; si la nouvelle dépasse la tolérance configurée, une nouvelle approbation est requise.
- **RG-17 Justificatifs.** Identifiant, type MIME (PDF, JPEG, PNG), taille (≤ 5 Mo), SHA-256, date, auteur, visibilité, version. Remplacer un fichier crée une nouvelle version.
- **RG-18 Immutabilité.** Les entrées du registre ne sont jamais supprimées ni modifiées ; une correction crée un événement compensatoire.
- **RG-19 Succès.** Un payout n'est « Terminé » que si `GET /api/payouts/:id` renvoie `COMPLETED`. Une contribution n'est « Confirmée » que si la facture renvoie `status = paid` et un `preimage`. Un webhook déclenche la vérification, il ne la remplace pas.
- **RG-20 Hors connexion.** Aucune approbation, contribution, cotation, payout, modification de bénéficiaire ou décision de modération n'est envoyée sans connexion ni rejouée en arrière-plan.

---

## 7. Intégration Bitnob (vérifiée dans la documentation officielle)

### 7.1 Environnement

- URL unique pour la sandbox et la production : `https://api.bitnob.com`. **C'est le secret qui choisit l'environnement** ; le Client ID est le même.
- Compte créé sur `app.bitnob.com`, tableau de bord en mode Sandbox, clés dans Settings → API Keys.
- Les données sandbox peuvent être réinitialisées : DELOS garde son propre état et une commande de réinitialisation.
- Certains produits, dont les Payouts, peuvent nécessiter une activation par l'équipe Bitnob **[spike T0]**. Message à envoyer dès T0 : *« Please enable sandbox payouts for our Code & Chain hackathon project, including the Senegal XOF mobile-money corridor. »*
- Aucune clé de production dans le projet.

### 7.2 Authentification des requêtes

Toutes les requêtes sont signées **côté serveur uniquement** :

| En-tête | Valeur |
| --- | --- |
| `X-Auth-Client` | Client ID |
| `X-Auth-Timestamp` | Horodatage Unix en secondes |
| `X-Auth-Nonce` | 16 octets aléatoires en hexadécimal |
| `X-Auth-Signature` | HMAC-SHA256 en hexadécimal |

Message signé : `CLIENT_ID:TIMESTAMP:NONCE:PAYLOAD`, où `PAYLOAD` est **exactement** le JSON envoyé (sans espace ajouté), ou une chaîne vide sans corps (GET, finalisation). Diagnostic : `GET /api/whoami`.

### 7.3 Lightning — contributions

| Endpoint | Usage |
| --- | --- |
| `POST /api/lightning/invoices` | Créer la facture d'une contribution |
| `GET /api/lightning/invoices/:id` | Lire le statut, source de vérité |
| `GET /api/lightning/invoices` | Réconciliation |
| `POST /api/lightning/decode` | Afficher le détail d'une facture BOLT11 |
| `POST /api/lightning/pay` | Payer une facture (piste de simulation, §7.4) |

Création : `amount` en satoshis (1 à 20 000 000), `description` obligatoire, `expiry` en secondes (défaut 86 400), `reference` obligatoire et **idempotente** (renvoyée deux fois, elle retourne la facture d'origine), `customer_id` facultatif. Réponse : `id`, `payment_hash`, `request` (BOLT11), `amount_sat` (chaîne), `status`, `expires_at`.

Statuts : `pending`, `paid`, `expired`, `failed`. Une facture payée porte un `preimage` (64 caractères hex), **preuve cryptographique du paiement** affichée sur le reçu.

Référence DELOS : `DELOS-C{collecte}-CONTRIB-{séquence}`.

### 7.4 Paiement sandbox d'une contribution

Le sandbox expose `POST /api/lightning/pay`, qui prend une facture BOLT11 et une référence idempotente. Le paiement débite le portefeuille de test associé aux identifiants Bitnob configurés. DELOS relit ensuite la facture entrante ; seule une facture `paid` avec son `preimage` confirme la contribution (RG-19). L'endpoint documenté pour simuler les dépôts d'un payout (§7.8) reste distinct.

Le parcours démo en mode sandbox paie donc avec le solde test du compte Bitnob
configuré. En mode mock, le paiement reste simulé localement et porte le badge
correspondant. Les fonds sandbox sont fictifs et séparés de la production. Lors
du dernier test de ce compte, Bitnob a répondu HTTP 403 (« Lightning withdrawals
feature is currently not available ») : l’option doit être activée par Bitnob
pour que le paiement sandbox aboutisse.

### 7.5 Taux, soldes, transactions

- `GET /api/exchange-rates`, `GET /api/exchange-rates/convert` : contre-valeur indicative. Présence du XOF **[spike T0]**. Pour un payout, seule la cotation fait foi.
- `GET /api/balances`, `GET /api/balances/:currency` : tableau de bord interne et réconciliation.
- `GET /api/transactions`, `GET /api/transactions/{id ou référence}` : rapprochement avec les références DELOS.

### 7.6 Corridors — Sénégal

D'après la documentation, le **XOF au Sénégal est en Mobile Money uniquement** : Orange Money, Free Money, Expresso, Wave. Pas de virement bancaire.

La liste sandbox est un **sous-ensemble** de la production : elle est découverte à chaque démarrage, jamais codée en dur.

| Endpoint | Usage |
| --- | --- |
| `GET /api/payouts/supported-countries` | Pays et rails (`destination_types`) ouverts |
| `GET /api/payouts/supported-countries/SN` | Schéma exact des champs du bénéficiaire (type, validation, options, limites), qui pilote le formulaire |
| `GET /api/payouts/banks/SN` | Opérateurs Mobile Money et leur `bank_code` |
| `GET /api/payouts/limits` | Montants min/max par corridor |

Si le corridor SN/XOF/mobile_money est absent du sandbox, DELOS utilise un **adaptateur Mobile Money local** produisant la même machine d'états, signalé comme tel, et le reste de l'intégration reste réel.

### 7.7 Cycle du payout

| Étape | Endpoint | Statut Bitnob |
| --- | --- | --- |
| Cotation | `POST /api/payouts/quotes` | `QUOTE` |
| Initialisation (bénéficiaire) | `POST /api/payouts/:quoteId/initialize` | `INITIATED` |
| Financement (onchain) | adresse ou facture fournie par Bitnob, simulée en sandbox (§7.8) | — |
| Finalisation (sans corps) | `POST /api/payouts/:quoteId/finalize` | `PENDING` |
| Règlement | — | `PROCESSING` puis `COMPLETED` ou `FAILED` |
| Lecture | `GET /api/payouts/:id`, `GET /api/payouts/reference/:reference` | — |

**Cotation** : `country` (`SN`), `from_asset` (`BTC`, `USDT` ou `USDC`), `to_currency` (`XOF`), `source` (`offchain` ou `onchain`), `chain` si onchain, `reference` obligatoire, et **soit** `amount` (côté crypto) **soit** `settlement_amount` (montant reçu par le bénéficiaire). DELOS envoie `settlement_amount` = montant de la dépense. La réponse contient `quote_id`, `amount`, `settlement_amount`, `fees` (dans l'actif source), `exchange_rate` (`rate`, `effective_rate`), `expires_at`.

**Initialisation** : `quote_id`, `reference`, **`payment_reason` obligatoire** (certains corridors imposent une liste), `callback_url` facultatif, `beneficiary` avec `destination_type: "mobile_money"`, `country`, `account_name`, `account_number`, `bank_code` (obligatoire pour mobile money), plus les champs exigés par le schéma SN. La finalisation doit intervenir avant `expires_at`.

**Choix de la source : onchain.** En `offchain`, Bitnob débite le solde du compte sandbox, dont on ne sait pas comment l'alimenter. En `onchain`, Bitnob fournit une adresse ou une facture à financer, et le financement est simulable avec un endpoint documenté (§7.8). Le parcours onchain rend aussi l'étape « Dépôt sandbox détecté » visible pour le jury.

Référence DELOS : `DELOS-C{collecte}-EXP-{dépense}-PAYOUT-{tentative}`.

### 7.8 Simulation sandbox

Endpoint documenté (présent dans le code de la page, non affiché par la documentation) :

```
POST /api/payouts/simulate-address-deposit
{ "address": "<adresse fournie>", "amount": 2.00 }     // dépôt onchain
{ "invoice": "<facture fournie>", "amount": 50000 }    // financement Lightning
```

Il marque la cotation comme financée et déclenche les webhooks. Le guide sandbox décrit aussi : sous-paiement, cotation expirée (`QUOTE_EXPIRED`), échecs de payout, webhooks en retard et rejoués. Le format exact des montants et des corps est à confirmer sur la collection Postman ou l'OpenAPI **[spike T0]**. Aucun chemin n'est inventé.

### 7.9 Webhooks

Endpoint DELOS : `POST /api/webhooks/bitnob` (URL HTTPS **publique** : un lien protégé par une connexion bloquerait Bitnob, voir §15).

- Signature : en-tête `x-bitnob-signature`, **HMAC-SHA512 du corps brut**. La doc parle de « your secret key » : clé exacte (client secret ou secret dédié) **[spike T0]**.
- Nouvelles tentatives : 3 au maximum, avec backoff exponentiel si la réponse n'est pas 200. Déduplication par `event_id`.
- Événements Payouts documentés : `payouts.initialized`, `payouts.processing`, `payouts.withdrawal.success`, `payouts.withdrawal.expired`. Les anciens noms `payout.transfer.*` ne sont pas utilisés.
- **Aucun webhook d'échec n'est documenté** : un payout `FAILED` n'est détecté que par `GET /api/payouts/:id`. **Le job de réconciliation est donc obligatoire.**
- Piège documenté : `data.status` d'un webhook (`initiated`, `processing`, `success`, `expired`, en minuscules) n'est pas le statut du payout (`INITIATED` … `COMPLETED`, en majuscules). **La décision se prend sur le champ `event`**, puis sur la lecture du payout.
- Le guide sandbox cite encore d'anciens noms (`asset.received`, `payouts.asset.underpayment`) : tout événement inconnu est stocké brut, journalisé et déclenche une réconciliation, sans erreur.
- Lightning : un événement `btc.lightning.received.success` est mentionné comme exemple.

Traitement : lire le corps brut → vérifier la signature en temps constant → vérifier l'unicité de `event_id` → stocker → **répondre 200 immédiatement** → traiter en tâche de fond → relire l'état chez Bitnob → écrire au registre → diffuser en SSE.

### 7.10 Idempotence

Chaque mouvement a une référence DELOS lisible, unique en base, réutilisée à l'initialisation et à la finalisation, un verrou transactionnel, et conserve la référence et le `request_id` Bitnob. Bitnob renvoie le résultat d'origine quand une référence est rejouée (documenté pour Lightning ; comportement Payouts **[spike T0]**).

### 7.11 Customers et Beneficiary (facultatif)

L'API Bitnob expose aussi `Customers` et `Beneficiary` (menu de la référence API). Ils pourraient rattacher une contribution à un client (`customer_id` d'une facture) ou enregistrer les bénéficiaires déclarés d'une cagnotte. Champs et intérêt **[spike T0]** ; l'identité des lanceurs reste gérée par DELOS et **n'est jamais envoyée à Bitnob**.

### 7.12 Hors P0

Adresses stablecoin (`GET /api/stablecoins/supported-chains`, `POST /api/addresses` : P1, chaînes découvertes dynamiquement), Trading, Virtual Cards, Virtual Accounts, Wallet Infrastructure Enterprise.

---

## 8. Architecture technique

### 8.1 Stack

L’implémentation actuelle utilise Node.js et React, en conservant les règles métier
et l’interface définies dans ce cahier des charges.

| Couche | Choix |
| --- | --- |
| Runtime | Node.js 22+, TypeScript strict, pnpm |
| Serveur | Hono sur Node.js, routes avec validation, jobs de fond avec progression |
| Base | SQLite via better-sqlite3, migrations versionnées, table d'événements |
| Crypto | Web Crypto : SHA-256 (justificatifs, registre), HMAC-SHA256 (requêtes Bitnob), HMAC-SHA512 (webhooks) |
| Interface | React, routeur History API local, TypeScript |
| Styles | **Tailwind CSS v4** via Vite ; thème dans `@theme` (variables CSS sémantiques, `light-dark()` pour le thème sombre) ; `className=` standard |
| Build | Vite (bundle de l'app et service worker) |
| Temps réel | Server-Sent Events, `Last-Event-ID`, filtrage par collecte |
| PWA | `manifest.webmanifest`, service worker, icônes, coque hors ligne (§9) |
| Typographie | **Unbounded** (titres, grands montants), **Bricolage Grotesque** (texte), **Space Mono** (libellés, références, empreintes, sats), **Nasalization** (logo texte) |
| Icônes | Lucide en SVG inline |
| Tests disponibles | Node.js test runner : tests unitaires et d'intégration sur les vraies routes ; E2E et audits accessibilité/PWA restent à compléter (§14) |

Interface en **français, vouvoiement** ; code, commentaires et identifiants en anglais.

### 8.2 Vue d'ensemble

```
PWA React (Tailwind)
  ├── public : annuaire, fiches, collectes (entrées / sorties / preuves), contribution, registre
  ├── comptes : identité, lancement de cagnotte, enrôlement d'association
  ├── gestion : trésorerie, dépenses, approbations, payouts, justificatifs
  ├── modération : identités et associations
  └── service worker : coque, cache public, blocage hors ligne
        │ HTTP JSON + SSE (même origine)
        ▼
Serveur Node.js (Hono)
  ├── comptes, sessions, identité, modération
  ├── moteur de gouvernance (association, co-lanceurs, garde-fous)
  ├── registre append-only chaîné
  ├── documents et empreintes
  ├── client Bitnob signé + adaptateur mock
  ├── webhooks (vérification, déduplication, file)
  ├── jobs : réconciliation, suivi des payouts
  └── diffusion SSE
        │
        ▼
SQLite + justificatifs + pièces privées            Bitnob Sandbox (api.bitnob.com)
```

Application et API sont servies sur la **même origine** : cookies, SSE, CSP et installation PWA simplifiés.

### 8.3 Modes

| `BITNOB_MODE` | Usage |
| --- | --- |
| `sandbox` | Véritable API Bitnob, argent fictif. Mode de la démo. |
| `mock` | Simulateur local produisant les mêmes états (`pending → processing → completed`, ou `failed`). Secours si Internet ou Bitnob tombe. Chaque écran l'affiche. |

Variables (backend uniquement) : `BITNOB_MODE`, `BITNOB_CLIENT_ID`, `BITNOB_CLIENT_SECRET`, `BITNOB_WEBHOOK_SECRET` (si distinct, [spike T0]), `BITNOB_BASE_URL=https://api.bitnob.com`, `PUBLIC_URL`. Jamais dans le frontend, le dépôt, une capture d'écran ni les logs.

---

## 9. PWA

### 9.1 Installation

- `manifest.webmanifest` : `name` « DELOS CASH », `short_name` « DELOS », `display: standalone`, `start_url: /`, `scope: /`, `theme_color` et `background_color` issus du thème, `lang: fr`.
- Icônes 192 et 512 px, variante `maskable`, `apple-touch-icon` ; captures d'écran du manifest pour l'invite d'installation enrichie.
- Bouton « Installer l'application » (événement `beforeinstallprompt`) et aide pour iOS (« Partager → Sur l'écran d'accueil »).
- Servie en HTTPS (obligatoire pour le service worker).

### 9.2 Service worker

| Ressource | Stratégie |
| --- | --- |
| Coque : `index.html`, JS, CSS, polices, icônes | Pré-cache à l'installation, versionné par build |
| `GET /api/public/*` (annuaire, fiches, collectes, registre, dépenses) | Stale-while-revalidate, page marquée « Hors connexion · données du JJ/MM à HH:MM » |
| Autres `GET /api/*` (privé) | Réseau uniquement |
| `POST`, `PUT`, `DELETE`, webhooks, `GET /api/events` (SSE) | **Jamais interceptés ni mis en cache** |

Jamais en cache : secrets, cookies, réponses privées, pièces d'identité, corps de webhook, numéros Mobile Money complets.

### 9.3 Hors connexion

| Disponible | Interdit |
| --- | --- |
| Coque de l'application | Approuver ou rejeter |
| Annuaire et collectes déjà consultés | Contribuer |
| Registre public récemment consulté | Demander une cotation, confirmer un payout |
| Règles de gouvernance | Modifier un bénéficiaire, décider en modération |
| Brouillon de dépense (P1, IndexedDB) | Envoyer silencieusement une action en attente |

Une action financière préparée hors connexion exige une **confirmation explicite après reconnexion** : « Connexion requise pour signer et transmettre cette opération. » Aucune Background Sync pour une mutation financière.

### 9.4 Critères

Installable (audit Lighthouse PWA), démarrage hors connexion sur la coque, annuaire et collecte lisibles hors connexion après une visite, actions financières désactivées avec message, reconnexion SSE automatique au retour du réseau.

---

## 10. Modèle de données

```
users · sessions · identity_verifications · identity_documents
organizations · organization_applications · organization_documents · organization_members
governance_policies · moderation_decisions
funds (type : association | cagnotte) · fund_launchers · fund_invitations · declared_beneficiaries
contribution_intents · contributions · provider_invoices
beneficiaries · expense_proposals · expense_approvals
documents · document_versions
payout_quotes · payout_attempts · provider_transactions · provider_webhook_events
ledger_entries · audit_events · background_jobs · idempotency_records
```

- `funds` porte le type, le slug public, la catégorie, la région, l'objectif, et soit `organization_id` (collecte d'association), soit ses lanceurs (`fund_launchers`).
- `identity_verifications` : statut (`pending`, `verified`, `rejected`), modérateur, date, motif. Les pièces (`identity_documents`) sont privées.
- `organization_applications` : dossier d'enrôlement et son statut ; une organisation n'est publique qu'une fois vérifiée.

Registre (`audit_events`) : `id`, `fund_id`, `actor_type`, `actor_id`, `event_type`, `public_payload`, `private_payload`, `previous_hash`, `event_hash`, `provider_reference`, `created_at`. Les événements d'identité publics (« Association vérifiée le… », « Co-lanceuse ajoutée ») y figurent, sans aucune donnée de pièce.

```
event_hash = SHA-256(previous_hash + JSON canonique de l'événement public)
```

La page de vérification recalcule la chaîne et affiche « Intégrité vérifiée » ou « Rupture détectée à l'événement N ». Ce registre est **un journal chaîné par hash, pas une blockchain** : il ne faut pas le présenter autrement.

---

## 11. API interne DELOS

```
# public (sans compte)
GET    /api/public/directory?type=&category=&q=     annuaire
GET    /api/public/organizations/:slug              fiche d'association
GET    /api/public/funds/:slug                      collecte : responsables, soldes, résumé
GET    /api/public/funds/:slug/inflows              entrées
GET    /api/public/funds/:slug/outflows             sorties
GET    /api/public/funds/:slug/ledger               registre
GET    /api/public/expenses/:id                     chaîne de preuves
GET    /api/public/ledger/verify?fund=              vérification de la chaîne
POST   /api/public/funds/:slug/contributions        créer la facture Lightning
GET    /api/public/contributions/:id

# comptes et identité
POST   /api/auth/signup · /api/auth/verify-email · /api/auth/login · /api/auth/logout
GET    /api/me
POST   /api/identity                                 demande de vérification (pièce)
POST   /api/demo/session · POST /api/demo/reset      mode démo

# enrôlement et modération
POST   /api/organizations                            dossier d'enrôlement
POST   /api/organizations/:id/members                inviter un représentant ou un membre
POST   /api/organizations/:id/submit
GET    /api/moderation/queue
POST   /api/moderation/identities/:id/decision
POST   /api/moderation/organizations/:id/decision

# collectes
POST   /api/funds                                    lancer une cagnotte ou une collecte
POST   /api/funds/:id/invitations                    inviter un co-lanceur
POST   /api/invitations/:token/accept

# argent
POST   /api/expenses · /api/expenses/:id/approve · /api/expenses/:id/reject
POST   /api/expenses/:id/quote · /api/expenses/:id/payout
POST   /api/contributions/:id/reconcile · /api/payouts/:id/reconcile
GET    /api/corridors/SN                             schéma bénéficiaire et opérateurs
POST   /api/documents · GET /api/documents/:id

POST   /api/webhooks/bitnob
GET    /api/events                                   SSE
```

Toutes les mutations acceptent une clé d'idempotence DELOS.

### 11.1 SSE

`GET /api/events?fund={id}`, `Accept: text/event-stream`. Événements : `CONTRIBUTION_CONFIRMED`, `CONTRIBUTION_EXPIRED`, `EXPENSE_SUBMITTED`, `EXPENSE_APPROVED`, `EXPENSE_REJECTED`, `PAYOUT_QUOTED`, `PAYOUT_STEP`, `PAYOUT_COMPLETED`, `PAYOUT_FAILED`, `PROOF_PUBLISHED`, `FUND_PUBLISHED`, `ORGANIZATION_VERIFIED`, `AUDIT_APPENDED`. Un événement ne transporte que `id`, `type`, ressource, date et version ; le client recharge la ressource par l'API. Aucune donnée sensible dans le flux.

---

## 12. Écrans

Le détail des écrans, composants, données de démo et états est dans [`DESIGN.md`](DESIGN.md). Liste :

- **Public (mobile d'abord)** : P0 Annuaire (accueil) · P1 Fiche d'association · P2 Page de collecte (Entrées / Sorties / Preuves) · P3 Contribuer · P4 Facture Lightning · P5 Reçu · P6 Chaîne de preuves d'une dépense · P7 Vérification d'intégrité.
- **Compte et identité** : C1 Connexion / création de compte · C2 Vérifier mon identité · C3 Mon espace (« À faire », mes collectes).
- **Lancer une cagnotte** : L1 La cause · L2 Où ira l'argent · L3 Les lanceurs · L4 Cagnotte publiée · L5 Invitation de co-lanceur.
- **Enrôler une association** : E1 L'association · E2 Documents · E3 Représentants et règle · E4 Dossier envoyé.
- **Gérer une collecte** : G1 Trésorerie · G2 Nouvelle dépense · G3 Détail et approbation · G4 Cotation · G5 Suivi du payout · G6 Justificatifs post-paiement.
- **Modération** : M1 File de vérification · M2 Dossier.
- **PWA** : W1 Installation · W2 Hors connexion · W3 Action bloquée hors connexion.
- **Démo** : D1 Panneau de démo guidée.

---

## 13. Sécurité et données personnelles

- Secrets Bitnob côté serveur uniquement ; `.env.example` sans valeur.
- Cookies `HttpOnly`, `Secure`, `SameSite=Lax` ; mots de passe hachés ; contrôle des rôles côté serveur.
- Signature des webhooks vérifiée en temps constant sur le corps brut ; unicité de `event_id` ; idempotence des payouts.
- Fichiers limités à PDF, JPEG, PNG et 5 Mo, type vérifié sur le contenu.
- **Pièces d'identité** : stockage privé, empreinte SHA-256, lecture réservée au modérateur, jamais servies par une URL publique, jamais mises en cache par le service worker, jamais envoyées à Bitnob ni journalisées. Suppression après décision (prototype).
- Numéros Mobile Money masqués (`•• 47`) partout sauf à la saisie.
- HTTPS, CSP stricte (même origine), aucun secret ni donnée personnelle dans les logs, `request_id` Bitnob journalisé, sauvegarde de la base avant la démonstration. CSRF et limitation de débit en P1.
- **Avant toute production** : qualification au regard de la loi sénégalaise sur les données personnelles et de la réglementation des collectes de fonds et des paiements. Le prototype n'utilise que des données fictives.

---

## 14. Tests et critères d'acceptation

- **Unitaires** : parseur décimal, références, HMAC-SHA256 des requêtes (même résultat que le code de signature officiel de la doc), HMAC-SHA512 des webhooks, chaîne de hash, soldes, indicateur de dépenses justifiées, règles 2 sur 3 et co-lanceur, garde-fous de la cagnotte à un lanceur, expiration des cotations, statuts Bitnob.
- **Intégration** (vraies routes, base en mémoire, Bitnob en mock) : création de compte, vérification d'identité et refus, enrôlement et validation, cagnotte sans identité vérifiée refusée, invitation de co-lanceur, contribution, webhook valide, invalide et dupliqué, approbations concurrentes, payout sans permission, payout vers un bénéficiaire non déclaré refusé, cotation expirée, double soumission, réconciliation après webhook manquant, payout `FAILED` sans webhook.
- **Contrat sandbox** (manuel, T0) : whoami, facture, corridors SN, cotation, payout complet, payload réel des webhooks, référence rejouée.
- **E2E** : annuaire → collecte → contribuer → confirmer → proposer → approuver ×2 → coter → payer → justifier → registre vérifié ; lancer une cagnotte en 3 étapes ; enrôler et valider une association.
- **PWA** : installabilité, démarrage hors connexion, lecture en cache, actions bloquées, reconnexion SSE.
- **Échecs** : facture expirée, montant invalide, corridor indisponible, numéro invalide, cotation expirée, HTTP 429 et 5xx, signature invalide, perte SSE, perte réseau pendant la finalisation, état inconnu après timeout.
- **Budgets de clics** (§2.4) vérifiés par les tests E2E.

### 14.1 Indicateurs de réussite de la démo

Le jury trouve une collecte et voit ses entrées et sorties en un clic ; il sait qui est derrière chaque collecte ; une contribution passe à « confirmée » sans rechargement ; une dépense ne peut pas être payée sans approbation ; un double clic ne crée jamais deux payouts ; un webhook reçu deux fois ne produit qu'un événement ; le payout atteint `COMPLETED` ; chaque sortie est reliée à sa preuve ; la vérification d'intégrité fonctionne ; une cagnotte se lance en 3 écrans ; l'application s'installe.

---

## 15. Hébergement

- URL HTTPS **publique et sans mur de connexion** : indispensable pour la PWA, pour le jury et **pour recevoir les webhooks Bitnob**. Un Secure Link Brev protégé par la connexion NVIDIA ne convient pas ; utiliser un lien public ou un Cloudflare Tunnel.
- Conteneur Docker, base SQLite, justificatifs et pièces (séparées) dans un volume, données de démonstration initialisées au démarrage, `docker compose up -d --build`.
- E-mails de vérification et d'invitation par l'API Resend ; en démo, lien affiché à l'écran si l'envoi est désactivé.
- Adresses IP d'envoi des webhooks Bitnob documentées, mais la vérification de signature reste la seule protection fiable.

---

## 16. Découpage des tâches

| Phase | Contenu | Livrable |
| --- | --- | --- |
| **T0 Conformité et spike Bitnob** (bloquant) | Confirmation écrite du règlement ; compte sandbox ; activation Payouts et corridor SN ; `whoami` ; collection Postman/OpenAPI ; facture Lightning ; **simulation d'un paiement entrant (§7.4)** ; corridors SN et `bank_code` ; XOF dans les taux ; cotation → initialize → simulate-address-deposit → finalize → `COMPLETED` ; payloads et clé de signature des webhooks ; référence rejouée | Rapport de faisabilité : chaque point [spike T0] tranché |
| **T1 Fondations** | Runtime, interface, styles, migrations, routeur, erreurs, environnements et seed | socle de l'application opérationnel |
| **T2 Comptes et identité** | Inscription, e-mail vérifié, connexion, vérification d'identité, stockage privé des pièces, mode démo | C1, C2, C3 |
| **T3 Modération et enrôlement** | Dossier d'association, invitations de représentants, règle d'approbation, file de modération, décisions | E1–E4, M1, M2 |
| **T4 Annuaire et pages publiques** | Annuaire, fiche d'association, page de collecte avec Entrées / Sorties / Preuves, indicateur de dépenses justifiées | P0, P1, P2 |
| **T5 Registre** | Journal append-only chaîné, vérification, chaîne de preuves | P6, P7 |
| **T6 Lancement de cagnotte** | Assistant 3 étapes, bénéficiaires déclarés, co-lanceurs, publication | L1–L5 |
| **T7 Client Bitnob** | Signature HMAC, erreurs typées, parseur décimal, adaptateur mock, `request_id` | Client validé par `GET /api/whoami` en sandbox |
| **T8 Contributions Lightning** | Facture, QR, compte à rebours, statut, preimage, reçu, réconciliation | P3, P4, P5 |
| **T9 Webhooks et SSE** | Endpoint public, HMAC-SHA512, déduplication, file, SSE avec reprise | Mise à jour en direct |
| **T10 Dépenses et gouvernance** | Formulaire, bénéficiaire depuis le schéma SN, justificatifs, approbations (association, co-lanceur, garde-fous), réservation | G1, G2, G3 |
| **T11 Payouts et preuves** | Cotation, initialisation, financement simulé, finalisation, suivi, réconciliation, justificatifs post-paiement | G4, G5, G6 |
| **T12 PWA** | Manifest, icônes, service worker, coque, cache public, blocage hors ligne, invite d'installation, audit Lighthouse | W1, W2, W3 |
| **T13 UX, accessibilité, QA** | Budgets de clics, mobile d'abord, états vides/chargement/erreur, statuts icône + libellé, clavier, contraste ; tests unitaires, intégration, E2E, sécurité | Suite verte, audit |
| **T14 Livraison** | Dépôt public, README, schéma d'architecture, guide sandbox, `.env.example`, démo guidée, script, vidéo de secours, licence, répétition chronométrée | Soumission |

---

## 17. Planning

À n'exécuter avant le hackathon **que si le règlement l'autorise** (T0.1). Sinon, les deux semaines servent au spike, au design et à l'apprentissage, et le code est écrit les 17–18 octobre sur un P0 réduit : annuaire, page de collecte, contribution, une dépense approuvée et payée, registre.

| Date | Objectif |
| --- | --- |
| 1 oct. | Règlement, compte Bitnob, authentification, demande d'activation Payouts |
| 2 oct. | Spike : paiement Lightning entrant, corridor SN, payout complet, webhooks |
| 3 oct. | Fondations : runtime, Tailwind, migrations, routeur, seed |
| 4 oct. | Comptes, e-mail vérifié, vérification d'identité |
| 5 oct. | Enrôlement d'association et modération |
| 6 oct. | Annuaire, fiche d'association, page de collecte |
| 7 oct. | Registre chaîné, vérification, chaîne de preuves |
| 8 oct. | Lancement de cagnotte et co-lanceurs |
| 9 oct. | Client Bitnob, contribution Lightning, webhooks, SSE |
| 10 oct. | Dépenses, justificatifs, approbations |
| 11 oct. | Cotation, payout, réconciliation, preuves post-paiement |
| 12 oct. | PWA : manifest, service worker, hors connexion |
| 13 oct. | Budgets de clics, mobile, accessibilité, finitions |
| 14 oct. | Tests E2E et sécurité |
| 15 oct. | Démo guidée, seed, documentation |
| 16 oct. | Marge, répétition, vidéo de secours |

---

## 18. Risques

| Risque | Réponse |
| --- | --- |
| Pré-développement interdit | Confirmation écrite (T0.1), sinon P0 réduit codé sur place |
| **Paiement Lightning entrant non simulable en sandbox** | Second compte + `lightning/pay`, sinon mock pour cette étape, signalé |
| Payouts non activés, corridor SN absent du sandbox | Demande dès T0 ; adaptateur Mobile Money local, même machine d'états |
| Aucun webhook d'échec | Réconciliation par `GET /api/payouts/:id` (P0) |
| Documentation divergente | Postman/OpenAPI, tests réels, support Bitnob ; événements inconnus stockés et réconciliés |
| Périmètre élargi (comptes, identité, enrôlement, modération) | Mode démo avec comptes préremplis ; ces flux restent simples (formulaires + une décision de modération) ; P0 réduit défini en §17 |
| Perception de « faux KYC » | Dire clairement : vérification par modération sur données fictives, prestataire agréé en P2 |
| Données d'identité sensibles | Données fictives uniquement ; stockage privé, jamais public ni en cache (§13) |
| Cagnotte à un seul lanceur détournée | Bénéficiaires déclarés à la création, justificatif obligatoire, signal public de preuve manquante (RG-08) |
| Webhook non reçu ou dupliqué | Réconciliation ; `event_id` unique |
| Double payout | Référence unique, verrou transactionnel |
| Cotation expirée | Cotation après approbation ; nouvelle cotation, réapprobation au-delà de la tolérance |
| Hébergement derrière un mur de connexion | Lien public ou Cloudflare Tunnel (§15) |
| Internet instable pendant la démo | Mode mock, seed local, vidéo de secours |
| Sandbox réinitialisé | État DELOS local reproductible, commande de réinitialisation |
| Service worker qui rejoue une action financière | Aucune mutation interceptée ni mise en file |

---

## 19. Définition de terminé

Le parcours P0 fonctionne de bout en bout ; l'annuaire montre associations et cagnottes avec leurs responsables vérifiés ; chaque page de collecte montre entrées, sorties et preuves ; les budgets de clics sont tenus ; une cagnotte se lance en 3 écrans ; une association s'enrôle et est validée par un modérateur ; chaque transaction a une référence unique ; les webhooks sont vérifiés et dédupliqués ; un succès n'est déclaré qu'après lecture chez Bitnob ; le registre public relie contribution, dépense, payout et preuve ; la vérification d'intégrité fonctionne ; les données sensibles sont masquées et les pièces d'identité jamais exposées ; **la PWA est installable et sa coque démarre hors connexion** ; les actions financières hors connexion sont bloquées ; les tests critiques passent ; aucun secret dans Git ; le dépôt est public et documenté ; la démo tient en cinq minutes ; le mode de secours est reproductible.

---

## 20. Sources Bitnob

Lues et vérifiées le 29/09/2026 :

- Authentification : https://bitnob.dev/api-reference/authentication
- Lightning : https://bitnob.dev/api-reference/lightning
- Payouts (quote, initialize, finalize) : https://bitnob.dev/api-reference/payouts
- Pays, schémas, opérateurs, limites : https://bitnob.dev/api-reference/payouts/get-supported-countries
- Webhooks Payouts : https://bitnob.dev/api-reference/payouts/webhooks
- Devises et corridors : https://bitnob.dev/docs/payouts/supported-currencies
- Simulation sandbox : https://bitnob.dev/docs/genesis/api-best-practices/simulating-flows-and-testing-in-sandbox

À lire pendant le spike T0 (repérées, pas encore vérifiées) :

- Idempotence : https://bitnob.dev/docs/genesis/api-best-practices/idempotency-and-reference-integrity
- Expiration des cotations : https://bitnob.dev/docs/genesis/api-best-practices/quote-expiry-and-transaction-windows
- Collection Postman : https://bitnob.dev/docs/developer-resources/postman-collection
