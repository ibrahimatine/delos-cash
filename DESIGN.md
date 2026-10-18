# Prompt Claude Design — DELOS CASH

Tu vas concevoir l'interface complète d'une **Progressive Web App** (PWA). Lis tout avant de commencer. Respecte exactement les écrans, contenus et états décrits. N'ajoute aucun écran ni aucune fonctionnalité non listés.

**Version 1.4 (30/09/2026).** Ce document fait foi sur le cahier des charges v1.2. La v1.4 corrige deux points des données de démo : les cagnottes avec ou sans historique (§3.1, §3.4 bis) et les empreintes SHA-256. Il reprend les meilleures idées de la maquette mobile « DELOS CASH Écrans » : le suivi de dépense en quatre étapes (§2.26), la phrase « l'argent ne passe pas par les responsables » (§1.2) et le repli « Détails techniques » (§2.27).

---

## 0. Contexte

- **Produit** : DELOS CASH, un **annuaire public de collectes transparentes** au Sénégal : associations et cagnottes.
- **Promesse** : « Voyez qui collecte, ce qui entre, où part l'argent, et la preuve qu'il a servi à la cause. »
- **Deux types de collecte**, présentés côte à côte :
  - **collecte d'association** : lancée par une association enrôlée et vérifiée ; chaque dépense est approuvée par plusieurs membres ;
  - **cagnotte** : lancée simplement par une à trois personnes dont l'identité est vérifiée ; elle déclare dès le départ à qui ira l'argent.
- **Pour le public** : n'importe qui ouvre l'app, parcourt l'annuaire, et voit pour chaque collecte ses responsables, ses **entrées**, ses **sorties** et les **preuves** (justificatifs, approbations, paiement, livraison).
- **Paiements** : contributions en Bitcoin Lightning, versements aux bénéficiaires en Mobile Money (Wave, Orange Money…), via la **sandbox Bitnob**. Les appels, cotations, références et statuts sont réels, mais **aucun argent réel ne circule**. Chaque opération financière porte le badge « Simulation Bitnob ».
- **Usage** : prototype de hackathon (Code & Chain Dakar 2026), présenté en 5 minutes à un jury qui manipule aussi l'app sur téléphone.
- **Langue** : français, vouvoiement partout. Montants en « FCFA » (« XOF » seulement dans les détails techniques). Séparateur de milliers : espace fine insécable (« 350 000 FCFA »).

---

## 1. Principes et contraintes de design

### 1.1 Très intuitif, très peu de clics
C'est la contrainte principale. L'app doit se comprendre sans explication.
- **L'accueil est l'annuaire.** Pas de page marketing avant.
- Une action principale par écran, en bas, à portée de pouce.
- Pas de menu à plusieurs niveaux. Navigation globale mobile : barre d'onglets en bas **Explorer · Lancer · Mon espace**.
- Vocabulaire simple : « Entrées », « Sorties », « Disponible », « Preuve », « Vérifié ». Les détails techniques (sats, références Bitnob, empreintes) sont repliés par défaut, toujours accessibles.
- Budgets de clics à respecter (hors saisie) :

| Action | Budget |
| --- | --- |
| Accueil → page d'une collecte | 1 clic |
| Voir où est parti l'argent | 0 clic (résumé en haut de la page), détail en 1 clic |
| Voir la preuve d'une dépense | 1 clic depuis la page de la collecte |
| Contribuer | 2 clics + le paiement |
| Lancer une cagnotte (compte vérifié) | 3 écrans, 1 bouton par écran |
| Approuver une dépense | 2 clics depuis « Mon espace » |

### 1.2 Confiance visible
- Sur chaque carte et chaque page de collecte : **qui est derrière**, avec le badge « Identité vérifiée » ou « Association vérifiée ».
- Indicateur factuel « Dépenses justifiées 2/2 » (ce n'est pas une note, pas d'étoiles, pas de pourcentage de confiance). Toujours sous forme de fraction « justifiées / terminées », jamais en pourcentage.
- Sur la page de collecte et la chaîne de preuves, une phrase simple rappelle le mécanisme : « L'argent ne passe jamais par les responsables : il est versé directement au bénéficiaire. »

### 1.2 bis Bitcoin et Bitnob visibles pour qui les cherche
Le public ne doit pas être gêné par la technique, mais le jury doit pouvoir constater en un toucher que les paiements passent réellement par Bitcoin Lightning et la sandbox Bitnob. Règle :
- toujours visibles : le badge « Lightning » et le montant en sats sur la contribution, le badge « Simulation Bitnob » sur chaque montant traité par Bitnob ;
- repliés dans « Détails techniques » (§2.27), à un toucher : références, empreintes, cotation détaillée, étapes Bitnob, preimage.

### 1.3 Contraintes techniques
- **Implémentation** : React + Tailwind CSS v4, composants maison, icônes Lucide. Dessine des composants réalisables en Tailwind : cartes, badges, boutons, onglets, puces de filtre, listes, modales, bottom sheets, steppers, barres de progression, toasts, bannières, champs de formulaire, zones de dépôt.
- **PWA, mobile d'abord** :
  - maquettes principales en **390×844** ;
  - **1440×900** pour l'annuaire, la page de collecte, la trésorerie et la modération (et ce qui est marqué [desktop]) ;
  - l'app s'ouvre installée, plein écran, **sans barre d'adresse** : la navigation doit se suffire à elle-même ;
  - zones de toucher de 44 px minimum ; respect des zones sûres (encoche, barre d'accueil).
- **Thèmes** : clair et sombre.
- **Système de design** : n'utilise **aucun** design system préinstallé dans ton espace (en particulier « Industry » : Barlow Condensed, bleu acier, repères « + » dans les coins). La typographie (§1.4) et les couleurs (§1.5) de ce document priment.
- **Style** : sobre, chaleureux et digne de confiance, dense mais aéré (esprit Linear, Stripe, Revolut). Les photos de collecte (facultatives) apportent la chaleur ; pas d'illustrations décoratives, pas de dégradés, pas d'emoji, pas de pièces ni de cadenas clipart.

### 1.4 Typographie
- **Unbounded** : titres (h1, h2) et grands chiffres (entrées, disponible).
- **Bricolage Grotesque** : tout le texte de l'interface.
- **Space Mono** : libellés en capitales, références (`DELOS-C014-…`), empreintes SHA-256, montants en sats, codes Bitnob, horodatages techniques.
- **Nasalization** : le logo texte « DELOS CASH », en capitales espacées.
- Chiffres tabulaires pour tous les montants alignés.

### 1.5 Couleurs
- Base neutre (gris) ; accent indigo pour les actions principales.
- Vert = confirmé, terminé, vérifié, intégrité OK. Rouge = échoué, rejeté, rupture. Ambre = en attente, en cours, justificatif attendu. Gris = à venir.
- **Orange Bitcoin (#F7931A) réservé exclusivement à Bitcoin / Lightning** : cadre du QR code, montants en sats, badge « Lightning ». Jamais ailleurs.
- **Badge « Simulation Bitnob »** : visuellement distinct de tous les statuts (bordure pointillée, icône fiole `flask-conical`, texte), jamais basé sur la couleur seule.
- **Accessibilité** : aucune information par la couleur seule ; chaque statut a une icône et un libellé ; contraste AA ; focus visible.

---

## 2. Composants réutilisables (planche dédiée, clair et sombre)

### 2.1 Barre supérieure
- Gauche : logo « DELOS CASH ».
- Droite : badge « Démo — aucun fonds réel », bouton « Démo guidée », bascule de thème, bouton « Installer » (si non installée), avatar ou « Se connecter ».
- En mobile : logo + badge « Démo » + avatar ; le reste dans un menu.

### 2.2 Barre d'onglets mobile
« Explorer » (boussole) · « Lancer » (plus) · « Mon espace » (utilisateur, pastille du nombre de « À faire »).

### 2.3 Carte de collecte (annuaire)
- Type : puce « Association » ou « Cagnotte ».
- Photo facultative (ratio 16:9), titre, catégorie, commune.
- Responsables : nom de l'association ou « Par Ibrahima Fall et Mariama Ba », avec le badge de vérification (§2.4).
- Barre de progression et « 975 000 / 1 000 000 FCFA ».
- Ligne de faits : « Sorties 120 000 · Dépenses justifiées 1/1 ». Variante : « Justificatif attendu », en ambre.
- Dernière activité : « il y a 3 min ».
- Toute la carte est cliquable (1 clic vers la page).

### 2.4 Badges de vérification
- « Identité vérifiée » (coche dans un bouclier, vert), avec la date au survol ou à l'appui.
- « Association vérifiée » (bâtiment + coche, vert).
- « Vérification en cours » (ambre, sablier).
- « Invitation en attente » (gris, pour un co-lanceur qui n'a pas encore accepté).

### 2.5 Bloc « Responsables »
- Collecte d'association : nom légal, sigle, « Association vérifiée le 02/09/2026 », puis les représentants (initiales, nom, rôle, badge).
- Cagnotte : un à trois lanceurs (initiales, nom, badge), la date de vérification, et la phrase « Ils répondent publiquement de l'usage des fonds ».

### 2.6 Résumé « Où va l'argent »
Trois grands chiffres : **Entrées** · **Sorties** · **Disponible**, puis la ligne « Dépenses justifiées 1/1 » et un lien « Voir le détail ». Mention discrète : « Registre tenu par DELOS, ce n'est pas un compte bancaire. »

### 2.7 Montant
- Principal en FCFA ; secondaire en sats (Space Mono, orange Bitcoin) : « 67 568 sats » ; mention optionnelle « taux figé le 17/10 à 10:42 ».

### 2.8 Badge « Simulation Bitnob »
Bordure pointillée, icône fiole, texte. Variante « Simulé localement » (icône `wifi-off`).

### 2.9 Statut d'opération
Icône + libellé : « En attente » (ambre, horloge), « En traitement » (ambre, spinner), « Confirmé » / « Terminé » (vert, coche), « Échoué » (rouge, croix), « Expiré » (gris, sablier barré).

### 2.10 Barre de progression
Barre, pourcentage, montants ; à 100 % : « Objectif atteint » (vert, coche).

### 2.11 Ligne d'entrée
Nom affiché ou « Anonyme », montant FCFA, heure, badge « Lightning ». Aucune autre information sur le contributeur.

### 2.12 Ligne de sortie
Titre de la dépense, bénéficiaire masqué (§2.20), montant, statut, et le suivi en quatre étapes (§2.26) en version compacte : quatre pictos alignés, devis ✓ · approbations ✓ · paiement ✓ · livraison ○. Toute la ligne ouvre la chaîne de preuves.

### 2.13 Carte facture Lightning
QR code au cadre orange, montant FCFA et sats, compte à rebours « Expire dans 59:12 », chaîne BOLT11 tronquée avec « Copier », statut en direct, badge « Lightning ».

### 2.14 Compte à rebours
mm:ss ; ambre sous 2 min, rouge sous 30 s. Variante « Cotation valable encore 14:12 ».

### 2.15 Référence copiable et empreinte
- Référence Space Mono tronquée au milieu, icône copier, « Copié ».
- « SHA-256 · 32258564…d01423dc », info-bulle : « Empreinte du fichier : toute modification la change. »

### 2.16 Carte de justificatif
Icône du type, nom, taille, date, auteur, empreinte, badge « Public » / « Privé », miniature pour les photos.

### 2.17 Puce d'approbation et jauge de règle
- Puce : initiales, nom, rôle ; « Approuvé » (vert, heure), « En attente » (gris), « Rejeté » (rouge, motif) ; variante « Auteur de la demande — ne peut pas approuver » (grisé, icône interdit).
- Jauge : « 2 approbations requises sur 3 membres », cases qui se remplissent. Variante cagnotte : « Approbation d'un co-lanceur requise ».

### 2.18 Stepper de payout
Étapes verticales (en attente / en cours / terminée avec heure / erreur) : Cotation créée → Bénéficiaire attaché → Dépôt sandbox détecté → En traitement → Versement Mobile Money → Terminé. Référence Bitnob sous chaque étape terminée.

### 2.19 Registre et intégrité
- Ligne de registre : horodatage, type (icône + libellé), acteur, montant, référence ; maillon « hash précédent → hash » replié.
- Bandeau : « Intégrité vérifiée · 42 événements · dernier hash 3c1e…a7f0 » (vert, bouclier) ; variante « Rupture détectée à l'événement 17 » (rouge).

### 2.20 Masquage Mobile Money
« Wave · +221 •• ••• •• 47 », nom de l'opérateur en texte (pas de logo officiel).

### 2.21 Carte de cotation
Reçu par le bénéficiaire (grand), débité (BTC et sats), frais, taux et taux effectif, expiration, référence de cotation, badge « Simulation Bitnob ».

### 2.22 Assistant en étapes
En-tête « Étape 2 sur 3 » avec trois segments, titre de l'étape, bouton principal en bas (« Continuer », puis « Publier »), retour discret en haut.

### 2.23 Zone de dépôt de document
« Déposer un fichier » ou, en mobile, « Prendre une photo » ; formats acceptés ; après l'envoi, carte §2.16. Variante privée : « Visible uniquement par l'équipe de modération ».

### 2.24 Bandeaux de connexion
« Hors connexion · données du 17/10 à 10:42 » (ambre) ; « De retour en ligne » (vert, bref) ; indicateur « En direct » (point vert pulsé).

### 2.25 Sélecteur de compte de démo
Visible seulement en mode démo : « Public · Awa · Moussa · Fatou · Ibrahima · Modération ».

### 2.26 Suivi de dépense en quatre étapes
Quatre cercles reliés horizontalement : **Demandée → Approuvée → Payée → Justifiée**, chacun avec l'heure une fois l'étape franchie. États : franchie (vert, coche), en cours (accent), à venir (gris), erreur (rouge, croix : rejet à « Approuvée », échec à « Payée »). Cagnotte à un seul lanceur : l'étape « Approuvée » devient « Publiée ». Utilisé en tête de P6 et de G3, et en version compacte dans la ligne de sortie (§2.12).

### 2.27 Détails techniques
Section repliée par défaut, titre « Détails techniques » avec un chevron, contenu en Space Mono. Contenu selon l'écran :
- P4 et P5 : chaîne BOLT11, référence `DELOS-C014-CONTRIB-0039`, payment hash, preimage ;
- P6 et G5 : cotation (`QT2_31407788`, débité en BTC et sats, frais, taux, taux effectif), référence du payout, identifiant de règlement, les six étapes Bitnob du stepper (§2.18) avec leurs heures ;
- justificatifs : empreinte SHA-256 ;
- P7 : nombre d'événements, dernier hash, maillons « hash précédent → hash ».

---

## 3. Données de démo (à utiliser partout, de façon cohérente)

Toutes les données sont fictives. Taux de démo : 1 BTC ≈ 37 000 000 FCFA.

### 3.1 Annuaire

| Collecte | Type | Catégorie · commune | Responsables | Entrées / objectif | Sorties | Justifiées |
| --- | --- | --- | --- | --- | --- | --- |
| **Équipement de l'école de Ndiass** | Association | Éducation · Ndiass | Association des parents d'élèves de Ndiass (vérifiée) | 975 000 / 1 000 000 | 120 000 | 1/1 |
| Tournoi inter-quartiers 2026 | Association | Sport · Grand-Yoff | ASC Grand-Yoff (vérifiée) | 410 000 / 600 000 | 150 000 | 1/1 |
| Fournitures pour la classe de CM2 | Cagnotte | Éducation · Rufisque | Cheikh Faye (identité vérifiée) | 180 000 / 200 000 | 150 000 | 0/1 · « Justificatif attendu (reste 5 jours) » |
| Déplacement de l'équipe de basket féminine | Cagnotte | Sport · Thiès | Aminata Diallo et Rokhaya Ndiaye (vérifiées) | 320 000 / 500 000 | 150 000 | 1/1 |
| Simulation · Aide alimentaire aux familles de Gaza | Scénario fictif | Urgence · Gaza | Ibrahima Fall (compte de démo) | 0 / 1 500 000 | 0 | 0/0 |
| Simulation · Soutien aux familles déplacées en RDC | Scénario fictif | Urgence · Nord-Kivu | Ibrahima Fall (compte de démo) | 0 / 2 000 000 | 0 | 0/0 |
| Simulation · Relèvement après des inondations au Sénégal | Scénario fictif | Urgence · Sénégal | Ibrahima Fall (compte de démo) | 0 / 1 000 000 | 0 | 0/0 |

Les trois scénarios humanitaires sont des exemples de pitch, à solde nul. Ils
ne sont affiliés à aucune ONG ou opération de secours et ne collectent ni ne
transfèrent de fonds vers les régions citées. Le bénéficiaire affiché est lui
aussi fictif. Les contributions de présentation passent uniquement par le
compte de test Bitnob configuré.

Catégories : Éducation, Santé, Urgence, Sport, Communauté.

Pendant la démo, deux éléments apparaissent :
- la cagnotte **« Reconstruire l'atelier de Mame Diarra »** (Urgence · Pikine), lancée par Ibrahima Fall avec Mariama Ba, objectif 750 000 FCFA ;
- l'association **Collectif Santé Kolda** (Santé · Kolda), une fois validée par la modération.

Ces deux éléments sont **créés pendant la démo** : ils n'existent pas dans l'annuaire de départ et n'ont aucun historique. Juste après sa publication, la cagnotte de Mame Diarra affiche 0 / 750 000 FCFA, aucune entrée, aucune sortie. Pour montrer une cagnotte qui a déjà dépensé et justifié, utilise **« Déplacement de l'équipe de basket féminine »** (§3.4 bis).

Empreintes SHA-256 de démo : utilise uniquement celles de ce document. N'emploie jamais une empreinte connue (fichier vide `e3b0c442…`, « test » `9f86d081…`, « foo » `2c26b46b…`, « 1 » `6b86b273…`, « 2 » `d4735e3a…`) : un jury technique les reconnaîtrait.

### 3.2 Association des parents d'élèves de Ndiass
- Sigle APE Ndiass ; récépissé n° 000123/2026 (fictif) ; vérifiée le 02/09/2026 ; siège : Ndiass, région de Thiès.
- Représentants : **Moussa Sarr**, président (MS) ; **Awa Diop**, trésorière (AD). Membre approbatrice : **Fatou Ndiaye**, contrôleuse (FN).
- Règle : 2 approbations sur 3 membres, l'auteur ne compte pas.
- Collectes : « Équipement de l'école de Ndiass » (en cours) ; « Cantine de la rentrée 2025 » (terminée : 270 000 entrées, 270 000 sorties, 3/3 justifiées).

### 3.3 Collecte « Équipement de l'école de Ndiass »
- Description : « Tables, bancs et tableaux pour les deux nouvelles classes de CE1. »
- Objectif 1 000 000 FCFA ; avant la démo : 975 000 collectés, 38 contributions.
- Sortie déjà terminée : « Peinture des deux classes », 120 000 FCFA, Atelier Diouf (Wave •• 03), facture et photo publiées.
- Dépense en attente : « Tableaux blancs ×2 », 90 000 FCFA, 1/2 (Moussa a approuvé).
- **Contribution du jury** : 25 000 FCFA · 67 568 sats ; `DELOS-C014-CONTRIB-0039` ; payment hash `a3f9…c21e`, preimage `7b1d…09fa` ; « Anonyme ». La collecte passe à 1 000 000 FCFA, 39 contributions, « Objectif atteint ».
- **Dépense de la démo** : « Achat de 20 tables » (EXP-007), 350 000 FCFA, Menuiserie Ndiaye, Wave +221 •• ••• •• 47 ; `devis-tables.pdf`, 184 Ko, SHA-256 `32258564…d01423dc`, public ; motif « 20 tables biplaces pour les classes de CE1 » ; proposée par Awa à 10:31, approuvée par Moussa à 10:34 et Fatou à 10:36.
- **Cotation** : reçu 350 000 FCFA ; débité 0,00945946 BTC (945 946 sats) ; frais 0,00001200 BTC (≈ 444 FCFA) ; taux 37 000 000, effectif 36 953 000 ; `QT2_31407788`, valable 15 min.
- **Payout** : `DELOS-C014-EXP-007-PAYOUT-001`, règlement `sandbox_txn_4c9e…81d2`, terminé à 10:41.
- **Preuves post-paiement** : `facture-menuiserie-ndiaye.pdf` (SHA-256 `47372217…6eeab334`), `livraison-tables.jpg` (SHA-256 `d1af9824…4a0255cd`, photo de tables dans une salle de classe).
- **Après la démo** : Entrées 1 000 000 · Sorties 470 000 · Disponible 530 000 · Dépenses justifiées 2/2.
- **Registre** (42 événements, dernier hash `3c1e…a7f0`), du plus récent au plus ancien : justificatif `livraison-tables.jpg` ; justificatif `facture-menuiserie-ndiaye.pdf` ; payout terminé 350 000 FCFA à Menuiserie Ndiaye via Wave ; payout lancé (`QT2_31407788`) ; dépense approuvée 2/2 (Fatou) ; approbation (Moussa) ; dépense proposée « Achat de 20 tables » (Awa) ; objectif atteint ; contribution confirmée 25 000 FCFA, anonyme.

### 3.4 Cagnotte « Reconstruire l'atelier de Mame Diarra »
- Histoire : « L'atelier de couture de Mame Diarra Sow a brûlé le 12 octobre. Les fonds serviront à racheter deux machines et le tissu perdu. »
- Objectif 750 000 FCFA ; catégorie Urgence ; Pikine ; photo facultative (atelier).
- Où ira l'argent : **Mame Diarra Sow**, Orange Money +221 •• ••• •• 12 ; lien avec la cause : « Propriétaire de l'atelier ».
- Lanceurs : **Ibrahima Fall** (identité vérifiée le 20/09/2026), **Mariama Ba** (invitée, accepte pendant la démo).
- Aucun historique : 0 FCFA collecté, aucune dépense (voir §3.1).

### 3.4 bis Cagnotte « Déplacement de l'équipe de basket féminine »
Cagnotte de référence pour tout ce qui montre une cagnotte **avec historique** : P2 variante cagnotte, P6 variante cagnotte, planche de composants.
- Histoire : « Transport et hébergement de l'équipe cadette de Thiès pour le tournoi national de Ziguinchor. »
- Objectif 500 000 FCFA ; Sport ; Thiès ; 320 000 collectés, 27 contributions.
- Lanceuses : **Aminata Diallo** (AD, vérifiée le 08/09/2026) et **Rokhaya Ndiaye** (RN, vérifiée le 09/09/2026).
- Où ira l'argent : **GIE Transport Cayor**, Wave +221 •• ••• •• 81, « transporteur de l'équipe ».
- Sortie terminée et justifiée : « Location du minibus Thiès–Ziguinchor », 150 000 FCFA ; proposée par Aminata le 10/10 à 09:12 (`devis-minibus.pdf`, SHA-256 `75afd224…36fd3940`) ; approuvée par Rokhaya, co-lanceuse, à 11:40 ; payée à 11:52 ; justifiée le 13/10 à 19:05 (`facture-transport-cayor.pdf`, SHA-256 `01e150c2…dad708a7` ; `equipe-minibus.jpg`, SHA-256 `ffa6ed37…0dfc04d5`).
- Après cette sortie : Entrées 320 000 · Sorties 150 000 · Disponible 170 000 · Dépenses justifiées 1/1.

### 3.5 Enrôlement « Collectif Santé Kolda »
- Nom légal « Collectif Santé Kolda », sigle CSK ; cause « Prévention du paludisme dans les villages du département de Kolda » ; Santé ; siège à Kolda ; contact public contact@sante-kolda.example.
- Documents : récépissé n° 000456/2026 (fictif, scan), statuts (PDF), NINEA non renseigné.
- Représentants : Dr Ousmane Baldé, président (identité vérifiée) ; Aïssatou Diallo, trésorière (identité vérifiée). Règle : 2 sur 3.
- Dossier envoyé le 15/10/2026 à 18:02, statut « En vérification ».

### 3.6 Modération
Modératrice : « Khadija, équipe DELOS ». File : 1 dossier d'association (Collectif Santé Kolda), 1 identité (Mariama Ba, pièce : CNI fictive).

---

## 4. Écrans

Chaque écran existe en **mobile 390×844**. Ceux marqués **[desktop]** existent aussi en 1440×900.

### 4.1 Public

#### P0 — Annuaire (accueil, `/`) [desktop]
- Titre court : « Collectes transparentes », sous-titre : « Voyez qui collecte, ce qui entre et où part l'argent. »
- Champ de recherche.
- Segmenté **Tout · Associations · Cagnottes** ; puces de catégorie défilantes.
- Liste de cartes (§2.3), données §3.1, triées par activité récente. Desktop : grille de 3 colonnes.
- Encart discret en bas : « Vous collectez pour une cause ? » avec deux boutons « Lancer une cagnotte » et « Enrôler votre association ».
- État vide de recherche : « Aucune collecte ne correspond. »

#### P1 — Fiche d'association (`/a/ape-ndiass`) [desktop]
- Bloc « Responsables » (§2.5) : nom légal, sigle, badge, date de vérification, récépissé n° (public), siège, cause, contact.
- Chiffres cumulés : entrées, sorties, dépenses justifiées, toutes collectes confondues.
- Collectes « En cours » puis « Terminées » (cartes §2.3).
- Lien « Règle de décision : 2 approbations sur 3 membres ».

#### P2 — Page de collecte (`/c/ecole-ndiass`) [desktop]
Écran central du produit.
- En-tête : photo facultative, puce de type, titre, catégorie · commune, description.
- Bloc « Responsables » (§2.5), cliquable vers P1 pour une association.
- Barre de progression, nombre de contributions, indicateur « En direct ».
- **Résumé « Où va l'argent »** (§2.6), toujours visible sans défiler en mobile, suivi de la phrase « L'argent ne passe jamais par les responsables : il est versé directement au bénéficiaire. »
- Onglets :
  - **Entrées** : lignes §2.11 ;
  - **Sorties** : lignes §2.12, dépense en attente d'approbation incluse (« 1/2 approbations ») ;
  - **Preuves** : bandeau d'intégrité, registre (§2.19), bouton « Vérifier maintenant » (P7).
- Cagnotte : sous le résumé, encadré « Où ira l'argent » avec le bénéficiaire déclaré. Deux exemples : « Déplacement de l'équipe de basket féminine » avec son historique (§3.4 bis), et « Reconstruire l'atelier de Mame Diarra » juste après sa publication (0 FCFA, « Mame Diarra Sow (Orange Money •• 12), propriétaire de l'atelier »).
- Cagnotte à un seul lanceur avec justificatif en retard : bandeau ambre « Justificatif de livraison attendu pour “Fournitures” (reste 5 jours) ».
- Bouton principal fixé en bas : « Contribuer ».

#### P3 — Contribuer (bottom sheet en mobile, modale en desktop)
- Montants suggérés : 5 000 · 10 000 · **25 000** · 50 000 FCFA, et « Autre montant » ; sats mis à jour en direct.
- Case « Afficher mon nom » avec champ « Nom affiché » (sinon « Anonyme »).
- Bouton « Payer en Lightning » ; mention : « Aucun argent réel : paiement simulé dans la sandbox Bitnob. »

#### P4 — Facture Lightning
- Carte facture (§2.13), « En attente de paiement ».
- « Scannez avec un portefeuille Lightning, ou utilisez le paiement simulé de la démo. » ; en mode démo : « Simuler le paiement (sandbox) ».
- Passage animé à « Paiement confirmé », sans rechargement.
- États : en attente, confirmé, **expiré** (« Cette facture a expiré. Aucun paiement n'a été reçu. », « Nouvelle facture »), **échec** (bannière rouge, « Réessayer »).

#### P5 — Reçu de contribution
Grande coche, « Contribution confirmée », 25 000 FCFA, 67 568 sats, référence, date, badges « Lightning » et « Simulation Bitnob », preimage tronqué (« Secret révélé par le paiement Lightning : il prouve que la facture a été réglée »), « Objectif atteint ! », boutons « Voir la collecte » et « Télécharger le reçu ».

#### P6 — Chaîne de preuves d'une dépense (`/d/exp-007`) [desktop]
- Titre, montant, bénéficiaire masqué, statut.
- Suivi en quatre étapes (§2.26) juste sous l'en-tête : on comprend l'état de la dépense sans défiler.
- Maillons verticaux, chacun avec date, acteur et preuve : 1. Proposée (devis §2.16) ; 2. Approuvée ×2 (puces, jauge) ; 3. Cotation (résumé §2.21) ; 4. Paiement Mobile Money terminé (stepper replié, références) ; 5. Livraison (facture, photo).
- Variante « livraison à confirmer » : dernier maillon gris.
- Variante cagnotte (données §3.4 bis) : maillon 2 « Approuvée par Rokhaya Ndiaye, co-lanceuse ».
- En bas : « Détails techniques » (§2.27), replié.

#### P7 — Vérification d'intégrité
« Chaque événement contient l'empreinte du précédent : modifier un seul événement casse toute la suite. » ; vérification animée (« 17 / 42 ») ; résultat vert, ou **variante rouge** avec l'événement fautif, « hash attendu » et « hash trouvé » côte à côte ; mention « Ce registre est un journal chaîné par empreintes, pas une blockchain. »

### 4.2 Compte et identité

#### C1 — Connexion / création de compte
Un seul écran à deux onglets « Se connecter » · « Créer un compte ». Création : nom, e-mail, mot de passe (règles affichées au fil de la saisie), téléphone. Après l'envoi : « Vérifiez votre e-mail : un lien vous a été envoyé. » En mode démo : sélecteur de compte (§2.25) au-dessus.

#### C2 — Vérifier mon identité
- Pourquoi : « Pour lancer une cagnotte ou représenter une association, votre nom est affiché publiquement et vérifié. »
- Champs : nom légal, date de naissance, pièce (CNI ou passeport), numéro, photo de la pièce (§2.23, variante privée).
- Ce qui sera public : « Votre nom et la date de vérification. Jamais votre pièce, son numéro ni votre date de naissance. »
- Bouton « Envoyer pour vérification ». États : **en cours** (« Un modérateur vérifie votre demande ») ; **vérifiée** (badge, date) ; **refusée** (motif, « Recommencer »).

#### C3 — Mon espace
- « À faire » en tête, par exemple : « 1 dépense attend votre approbation » (Moussa, Fatou) ; « Dépense approuvée : lancer le paiement » (Awa) ; « Mariama Ba vous invite à co-lancer une cagnotte ».
- Mes collectes (cartes compactes), mes associations, mes contributions, statut de mon identité.

### 4.3 Lancer une cagnotte (3 écrans, assistant §2.22)
Pré-requis : identité vérifiée. Sinon, écran de blocage : « Vérifiez d'abord votre identité (2 minutes) », bouton vers C2.

#### L1 — La cause
Titre, catégorie, commune, histoire (300 caractères max), objectif en FCFA, photo facultative. Aperçu de la carte d'annuaire en direct sous le formulaire (desktop : à droite).

#### L2 — Où ira l'argent
- Un ou plusieurs bénéficiaires : nom, lien avec la cause, opérateur (Wave, Orange Money, Free Money, Expresso), numéro.
- Phrase publique générée : « Les fonds seront versés à Mame Diarra Sow (Orange Money •• 12), propriétaire de l'atelier. »
- Rappel : « Seuls les bénéficiaires déclarés ici pourront recevoir de l'argent. »

#### L3 — Les lanceurs
- Vous (badge « Identité vérifiée »), puis « Ajouter un co-lanceur » par e-mail (2 maximum).
- Règle affichée selon le nombre de lanceurs : « Chaque dépense sera approuvée par un autre lanceur. » ou, seul : « Vous serez seul à décider : chaque dépense exigera un justificatif, publié ici. »
- Récapitulatif compact, bouton principal « Publier la cagnotte ».

#### L4 — Cagnotte publiée
Coche, lien de la cagnotte copiable, boutons « Partager » et « Voir la cagnotte » ; co-lanceuse affichée « Invitation en attente ».

#### L5 — Invitation de co-lanceur (vue de Mariama Ba)
« Ibrahima Fall vous invite à co-lancer “Reconstruire l'atelier de Mame Diarra”. » ; ce que ça implique (nom public, approbation des dépenses) ; boutons « Accepter » et « Refuser » ; si son identité n'est pas vérifiée : « Vérifiez d'abord votre identité ».

### 4.4 Enrôler une association (assistant §2.22, 3 écrans + confirmation)

#### E1 — L'association
Nom légal, sigle, cause, catégorie, région et commune du siège, contact public.

#### E2 — Documents
Numéro du récépissé de déclaration et son scan, statuts (PDF), NINEA (facultatif) ; zones §2.23, variante privée pour le scan du récépissé, les statuts pouvant être rendus publics.

#### E3 — Représentants et règle
Vous (rôle : président ou trésorier), inviter le second représentant, ajouter des membres approbateurs ; règle « 2 approbations sur 3 membres » (sélecteur) ; rappel « Les deux représentants doivent avoir une identité vérifiée ». Bouton « Envoyer le dossier ».

#### E4 — Dossier envoyé
Statut « En vérification », liste de contrôle (informations ✓, documents ✓, représentants vérifiés 2/2 ✓), « Vous pourrez publier vos collectes dès la validation. » ; variante **validée** (badge « Association vérifiée ») ; variante **refusée** (motif, « Corriger le dossier »).

### 4.5 Gérer une collecte

#### G1 — Trésorerie [desktop]
Résumé « Où va l'argent », progression, « À faire », liste des dépenses (statut, jauge), dernières entrées, bouton « Nouvelle dépense » (trésorière ou lanceur).

#### G2 — Nouvelle dépense
- Titre, montant (avec « Disponible : 1 000 000 FCFA »), motif.
- Bénéficiaire : association → nom, opérateur (liste venant de Bitnob), numéro, titulaire ; cagnotte → choix parmi les **bénéficiaires déclarés** uniquement.
- Justificatif (§2.23) et visibilité Public / Privé.
- Bouton « Soumettre aux approbateurs » (cagnotte seule : « Publier la dépense »).
- Mention : « Toute modification après une approbation remettra les approbations à zéro. »
- États : montant supérieur au disponible ; fichier refusé (« PDF, JPEG ou PNG, 5 Mo maximum »).

#### G3 — Détail de dépense et approbation [desktop]
- Suivi en quatre étapes (§2.26) sous l'en-tête.
- Justificatif, motif, impact (« Disponible après cette dépense : 530 000 FCFA »), jauge et puces.
- Actions fixées en bas selon le compte :
  - Moussa ou Fatou : « Approuver » et « Rejeter » (motif obligatoire) ;
  - Awa (auteur) : « Vous avez proposé cette dépense : vous ne pouvez pas l'approuver. » ;
  - après 2/2 : bannière « Dépense approuvée · 350 000 FCFA réservés » et, pour Awa, « Obtenir la cotation ».
- Confirmation d'approbation en bottom sheet (montant, bénéficiaire, justificatif).

#### G4 — Cotation et confirmation
Carte de cotation (§2.21) avec compte à rebours, bénéficiaire masqué, case « J'ai vérifié le bénéficiaire et le montant », bouton « Confirmer le paiement de 350 000 FCFA » (spinner puis désactivé, pas de double envoi). États : **cotation expirée** (« Nouvelle cotation ») ; **hors tolérance** (ambre : « Les frais ont augmenté de plus de 2 % : une nouvelle approbation est requise. »).

#### G5 — Suivi du payout [desktop]
Stepper (§2.18) en direct, récapitulatif, à la fin « Paiement terminé à 10:41 », références, bouton « Ajouter la facture et la photo de livraison ». États : **échec** (« Numéro refusé par l'opérateur. Les 350 000 FCFA restent disponibles. », « Relancer avec une nouvelle cotation ») ; **statut incertain** (« Vérification automatique en cours »).

#### G6 — Justificatifs post-paiement
Emplacements « Facture » et « Photo de livraison » (appareil photo en mobile), case « Marquer la livraison comme confirmée », bouton « Publier ». L'indicateur passe à « Dépenses justifiées 2/2 ».

### 4.6 Modération

#### M1 — File de vérification [desktop]
Onglets « Associations (1) » · « Identités (1) », cartes avec nom, type, ancienneté (« il y a 12 min »).

#### M2 — Dossier [desktop]
- Association : informations, documents dans une visionneuse marquée « Document fictif — démo », représentants et leur statut, liste de contrôle (nom concordant, récépissé lisible, 2 représentants vérifiés).
- Identité : pièce en visionneuse privée, nom déclaré face au nom sur la pièce.
- Boutons « Valider » et « Refuser » (motif obligatoire). Mention : « La décision est inscrite au registre. Le public ne voit jamais les documents privés. »

### 4.7 PWA

#### W1 — Installation
Carte « Installer DELOS CASH » (icône, trois avantages : accès direct, plein écran, collectes consultables hors connexion, bouton « Installer ») ; variante iOS « Partager → Sur l'écran d'accueil ». Dessine l'**icône** (192 et 512 px, maskable) et l'**écran de démarrage**.

#### W2 — Hors connexion
P2 avec le bandeau hors connexion et les chiffres du dernier passage, « Contribuer » désactivé (« Connexion requise ») ; écran de repli « Cette page n'est pas disponible hors connexion » avec les collectes déjà consultées.

#### W3 — Action bloquée hors connexion
G3 vue par Moussa, « Approuver » désactivé : « Connexion requise pour signer et transmettre cette opération. Rien n'est envoyé en arrière-plan. »

### 4.8 Démonstration

#### D1 — Panneau de démo guidée
Panneau flottant en bas à droite en desktop (320 px, repliable), bottom sheet réduite en mobile. Étapes numérotées (faite / en cours / à venir), chacune avec une action contextuelle :
1. Explorer l'annuaire — « Ouvrir l'école de Ndiass »
2. Contribuer — « Choisir 25 000 FCFA », « Simuler le paiement »
3. Proposer une dépense — « Passer à Awa », « Remplir l'exemple »
4. Approuver à deux — « Passer à Moussa », « Passer à Fatou »
5. Payer — « Obtenir la cotation »
6. Publier les preuves — « Ajouter les justificatifs »
7. Vérifier le registre — « Vérifier »
8. Lancer une cagnotte — « Passer à Ibrahima », « Remplir l'exemple »
9. Valider une association — « Passer à la modération »

Bouton « Réinitialiser la démo » (avec confirmation) ; badge « Mode démo » visible tant que le mode est actif.

---

## 5. À ne pas dessiner

- Pas de page marketing avant l'annuaire, pas de tarifs, pas d'abonnement.
- Pas de portefeuille personnel, de solde utilisateur, de dépôt ou de retrait d'argent réel.
- Pas de note, d'étoiles, de score de confiance ni de classement des collectes ou des contributeurs.
- Pas de pièce d'identité, de numéro de pièce ni de date de naissance hors de C2 et M2.
- Pas de numéro de téléphone complet hors des champs de saisie.
- Pas de logos officiels Wave, Orange Money ou Bitnob : noms en texte uniquement.
- Pas de graphiques de cours du Bitcoin, pas de trading.
- Pas le mot « blockchain » pour décrire le registre.
- Pas de promesse de sécurité bancaire, de « fonds garantis » ni de « prix garanti » : une cotation est « valable encore 14:12 », jamais garantie.
- Pas de selfie ni de code SMS dans la vérification d'identité (prévus plus tard, hors prototype) : pièce d'identité validée par un modérateur (C2, M2).
- Pas de collecte illustrée par un enfant malade ou une situation médicale intime : les exemples de §3 suffisent.

---

## 6. Livrables

1. Planche de composants (section 2), en clair et en sombre.
2. Tous les écrans en **390×844**, thème clair, avec les données de la section 3.
3. En **1440×900**, thème clair : P0, P1, P2, P6, G1, G3, G5, M1, M2.
4. En thème sombre : P0, P2, P4, G3 (mobile).
5. Les états listés : P0 recherche vide ; P2 cagnotte et justificatif en retard ; P4 expiré et échec ; P6 livraison à confirmer et variante cagnotte ; P7 rupture ; C2 en cours, vérifiée, refusée ; blocage avant L1 ; L5 identité non vérifiée ; E4 validée et refusée ; G2 erreurs ; G3 vue de l'auteur, rejet, approuvée ; G4 expirée et hors tolérance ; G5 échec et incertain ; W1 iOS ; W2 page non disponible.
6. L'icône de l'app, sa variante maskable et l'écran de démarrage.
7. Deux parcours cliquables en mobile :
   - **Transparence et paiement** : P0 → P2 → P3 → P4 → P5 → G2 (Awa) → G3 (Moussa) → G3 (Fatou) → G4 → G5 → G6 → P6 → P7 ;
   - **Lancer et vérifier** : C2 → L1 → L2 → L3 → L4 → L5 → P0, puis E1 → E2 → E3 → E4 → M1 → M2 → P1.

**Ordre de priorité** si tu dois étaler le travail : P0, P2, P6, L1–L3, G3, P4/P5, G5, puis le reste.
