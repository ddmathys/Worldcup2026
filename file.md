# Cahier des charges — Site de pronostics Coupe du Monde 2026

## 1. Objectif du projet

Créer un site web de pronostics **gratuit entre amis** autour de la Coupe du Monde 2026 aux États-Unis, avec une interface moderne, simple et agréable à utiliser.

Le site doit permettre à chaque utilisateur de :

- consulter la liste des matchs ;
- pronostiquer les scores ;
- modifier ses pronostics jusqu’à **2 heures avant le début du match** ;
- voir ses points calculés automatiquement après les résultats officiels ;
- consulter un **classement général des participants**.

Le site est orienté **expérience utilisateur**, avec un design visuel attractif, des drapeaux, des cartes de matchs claires, un parcours rapide, et une forte lisibilité sur mobile et desktop.

---

## 2. Positionnement

Le site n’est **pas un site de paris d’argent réel**.

C’est une plateforme de **pronostics gratuits entre amis**, sans mise d’argent, sans paiement, sans retrait, sans cotes, et sans fonctionnalités de jeu d’argent.

Le vocabulaire recommandé dans l’interface :

- utiliser **“pronostic”** plutôt que **“pari”** ;
- utiliser **“points”** plutôt que **“gain”** ;
- utiliser **“classement”** plutôt que **“cashout”**, **“jackpot”**, etc.

---

## 3. Périmètre fonctionnel

## 3.1 Fonctionnalités principales

Le site doit proposer les fonctionnalités suivantes :

1. **Inscription / connexion utilisateur**
2. **Liste des matchs**
3. **Saisie et modification des pronostics**
4. **Blocage automatique des pronostics 2h avant le coup d’envoi**
5. **Récupération automatique des matchs via API**
6. **Récupération automatique des résultats via API**
7. **Calcul automatique des points**
8. **Classement général des utilisateurs**
9. **Affichage des phases de poules**
10. **Affichage du tableau final**
11. **Gestion des fuseaux horaires pour utilisateurs en Europe**
12. **Responsive design mobile / tablette / desktop**

---

## 4. Règles de scoring

## 4.1 Phases de poules

Pour chaque match de poule :

- **3 points** si le score exact est trouvé ;
- **1 point** si le vainqueur est correct, ou si le match nul est correctement prédit sans score exact ;
- **0 point** sinon.

### Exemples

- Pronostic : 2-1  
  Résultat réel : 2-1  
  => **3 points**

- Pronostic : 1-0  
  Résultat réel : 3-1  
  => **1 point** (bonne équipe gagnante)

- Pronostic : 1-1  
  Résultat réel : 2-2  
  => **1 point** (bon résultat nul)

- Pronostic : 0-1  
  Résultat réel : 1-0  
  => **0 point**

---

## 4.2 Phases à élimination directe

Pour chaque match du tableau final (hors finale) :

- **6 points** si le score exact est trouvé ;
- **2 points** si l’équipe qualifiée / gagnante est correcte ;
- **0 point** sinon.

### Important

Pour les matchs à élimination directe, il faut définir clairement si le pronostic porte sur :

- le score à la fin du **temps réglementaire** ;
- ou le **qualifié final** après prolongation / tirs au but.

### Règle recommandée

- le **score pronostiqué** correspond au score à la fin du **temps réglementaire** ;
- en plus, l’utilisateur choisit **l’équipe qualifiée** si nécessaire en cas de nul.

Cela permet de gérer proprement les matchs à élimination directe.

### Exemples

- Pronostic : 1-1, qualifié = France  
  Résultat réel : 1-1, qualifié = France  
  => **6 points**

- Pronostic : 2-1, qualifié = Brésil  
  Résultat réel : 3-2, qualifié = Brésil  
  => **2 points**

- Pronostic : 1-0, qualifié = Espagne  
  Résultat réel : 1-1, qualifié = Portugal  
  => **0 point**

---

## 4.3 Finale

Pour la finale :

- **12 points** si le score exact est trouvé ;
- **3 points** si la bonne équipe gagnante / qualifiée est trouvée ;
- **0 point** sinon.

### Exemple

- Pronostic : 2-2, qualifié = Argentine  
  Résultat réel : 2-2, qualifié = Argentine  
  => **12 points**

- Pronostic : 1-0, qualifié = Argentine  
  Résultat réel : 2-1, qualifié = Argentine  
  => **3 points**

- Pronostic : 0-1, qualifié = Espagne  
  Résultat réel : 1-0, qualifié = Argentine  
  => **0 point**

---

## 5. Règles de blocage des pronostics

Chaque utilisateur peut créer ou modifier son pronostic **jusqu’à 2 heures avant le début officiel du match**.

À partir de **T - 2h**, le pronostic devient :

- **verrouillé** ;
- **non modifiable** ;
- toujours visible en lecture seule.

### Règles associées

- si un utilisateur n’a rien saisi avant le verrouillage, il ne peut plus entrer de pronostic ;
- si un utilisateur a saisi un pronostic avant le verrouillage, il peut le consulter mais plus le modifier ;
- le système de verrouillage doit être calculé automatiquement à partir de l’heure officielle du match issue de l’API.

---

## 6. Gestion du fuseau horaire

Les utilisateurs sont situés en Europe.

Le site doit donc afficher les horaires des matchs dans un fuseau européen cohérent.

### Recommandation UX

Afficher les heures dans le fuseau :

- **Europe/Paris** par défaut

et éventuellement mentionner :

- date ;
- heure locale Europe ;
- indication du verrouillage :  
  **“Pronostic modifiable jusqu’à 2h avant le match”**

### Règles techniques

- les dates API doivent être stockées en **UTC** ;
- l’affichage utilisateur doit être converti en **Europe/Paris** ;
- le calcul du verrouillage doit être fait côté serveur à partir de l’heure UTC officielle du match.

---

## 7. Structure des écrans

## 7.1 Page d’accueil

### Objectif

Donner une vue claire et engageante du jeu.

### Contenu

- header avec logo / nom du site ;
- message d’introduction ;
- bouton connexion / inscription ;
- aperçu des prochains matchs ;
- résumé du classement ;
- call-to-action vers les pronostics.

### Ton UX

- ambiance Coupe du Monde ;
- visuel premium mais simple ;
- cartes modernes avec drapeaux et couleurs sobres.

---

## 7.2 Page “Mes pronostics”

### Objectif

C’est l’écran principal du produit.

L’utilisateur doit pouvoir consulter rapidement tous les matchs et saisir ses pronostics sans friction.

### Structure recommandée

#### Filtres en haut

- phase : poules / tableau final / finale ;
- groupe ;
- équipe ;
- date ;
- statut :
  - à pronostiquer ;
  - modifiable ;
  - verrouillé ;
  - terminé.

#### Liste des matchs

Chaque match doit être présenté dans une **card UX moderne** avec :

- drapeau équipe 1 ;
- nom équipe 1 ;
- drapeau équipe 2 ;
- nom équipe 2 ;
- date ;
- heure Europe/Paris ;
- stade / ville si souhaité ;
- badge de statut :
  - **Ouvert**
  - **Bientôt verrouillé**
  - **Verrouillé**
  - **Terminé**

#### Zone de pronostic dans chaque carte

Pour la phase de poules :

- input score équipe 1 ;
- input score équipe 2 ;
- bouton enregistrer ;
- état visuel de sauvegarde.

Pour les phases finales :

- input score équipe 1 ;
- input score équipe 2 ;
- sélection de l’équipe qualifiée si score nul ;
- bouton enregistrer.

### Comportement UX attendu

- édition directe dans la liste sans ouvrir de popup ;
- sauvegarde rapide ;
- feedback visuel clair :
  - enregistré ;
  - erreur ;
  - verrouillé ;
  - en attente de résultat.

### Informations à afficher

- points possibles ;
- deadline de modification ;
- score réel quand le match est terminé ;
- points gagnés par l’utilisateur une fois calculés.

---

## 7.3 Page “Détail d’un match” (optionnelle)

### Objectif

Proposer une vue plus riche pour un match spécifique.

### Contenu

- équipes + drapeaux ;
- date / heure ;
- lieu ;
- score officiel ;
- état du match ;
- pronostic personnel ;
- deadline ;
- barème appliqué ;
- éventuellement statistiques communautaires :
  - % des utilisateurs ayant pronostiqué chaque issue.

---

## 7.4 Page “Classement”

### Objectif

Afficher le classement général des participants.

### Contenu

- position ;
- pseudo ;
- nombre total de points ;
- nombre de scores exacts ;
- nombre de bons vainqueurs ;
- bonus finale si besoin ;
- évolution récente éventuelle.

### UX recommandée

- podium visuel pour top 3 ;
- tableau clair pour tous les participants ;
- possibilité de filtrer :
  - classement global ;
  - classement phase de poules ;
  - classement phase finale ;
  - classement finale.

### Règles de tri

Trier par :

1. total de points ;
2. nombre de scores exacts ;
3. nombre de bons résultats ;
4. date de dernière modification la plus ancienne ou pseudo alphabétique si besoin d’un tie-break stable.

---

## 7.5 Page “Tableau final”

### Objectif

Afficher le bracket de la phase finale de manière visuelle.

### Contenu

- Round of 32 ;
- Round of 16 ;
- quarts ;
- demies ;
- finale.

### UX

- vue bracket horizontale sur desktop ;
- vue verticale simplifiée sur mobile ;
- possibilité de cliquer sur un match pour pronostiquer ;
- affichage du vainqueur pronostiqué.

---

## 8. Design system / direction UX

## 8.1 Style visuel

Le design doit être :

- moderne ;
- sportif ;
- premium ;
- lisible ;
- responsive.

### Inspirations visuelles

- cartes avec léger effet glassmorphism ou surfaces propres ;
- drapeaux visibles mais élégants ;
- contrastes forts pour les scores ;
- badges de statut très clairs.

### Palette recommandée

- fond sombre ou bleu nuit ;
- accents rouge / or / vert selon identité ;
- texte blanc ou gris clair ;
- couleurs d’état :
  - vert = ouvert / validé ;
  - orange = bientôt verrouillé ;
  - rouge = verrouillé / deadline passée ;
  - bleu = terminé.

---

## 8.2 Composants UX à prévoir

- header fixe ;
- navigation par onglets ;
- cartes de matchs ;
- champs score compacts ;
- bouton sauvegarder ;
- badge statut ;
- toast de confirmation ;
- skeleton loading ;
- tableau de classement ;
- compteur jusqu’au verrouillage ;
- modale de confirmation si besoin.

---

## 8.3 Expérience mobile

Le mobile est prioritaire.

### Contraintes mobiles

- cartes verticales faciles à lire ;
- champs score grands et tactiles ;
- CTA toujours visibles ;
- navigation simple en bas d’écran ou sticky header.

---

## 9. Modèle de données

## 9.1 Entité User

- id
- pseudo
- email
- mot_de_passe_hash
- role
- created_at
- updated_at

## 9.2 Entité Team

- id
- name
- code
- flag_url
- group_code

## 9.3 Entité Match

- id
- api_match_id
- phase
- group_code
- home_team_id
- away_team_id
- stadium_name
- city
- country
- kickoff_utc
- kickoff_europe_paris
- lock_at_utc
- status
- home_score
- away_score
- qualified_team_id
- is_finished
- is_final

## 9.4 Entité Prediction

- id
- user_id
- match_id
- predicted_home_score
- predicted_away_score
- predicted_qualified_team_id
- locked_snapshot
- points_awarded
- created_at
- updated_at

## 9.5 Entité RankingSnapshot (optionnel)

- id
- user_id
- total_points
- exact_scores_count
- correct_winner_count
- updated_at

---

## 10. Logique métier

## 10.1 Détermination du statut d’un match

Un match peut avoir les statuts suivants :

- `scheduled`
- `open_for_prediction`
- `locked`
- `live`
- `finished`

### Règles

- `open_for_prediction` si maintenant < kickoff - 2h
- `locked` si kickoff - 2h <= maintenant < kickoff
- `live` si match commencé et pas terminé
- `finished` si score officiel final disponible

---

## 10.2 Calcul des points — phase de poules

### Règle de base

Si score exact :
- 3 points

Sinon si issue correcte :
- victoire équipe A bien prédite
- victoire équipe B bien prédite
- ou match nul bien prédit
- 1 point

Sinon :
- 0 point

---

## 10.3 Calcul des points — phase finale

### Hors finale

Si score exact + bon qualifié :
- 6 points

Sinon si bon qualifié / bon gagnant :
- 2 points

Sinon :
- 0 point

### Remarque

Si le match se termine à égalité au temps réglementaire, la notion de “bonne équipe” doit être celle de **l’équipe qualifiée**.

Si tu veux simplifier, tu peux décider que :

- le score exact seul vaut 6 points ;
- sinon le bon qualifié vaut 2 points.

---

## 10.4 Calcul des points — finale

Si score exact + bon vainqueur :
- 12 points

Sinon si bon vainqueur :
- 3 points

Sinon :
- 0 point

---

## 11. Sources de données / APIs

Tu as indiqué utiliser des APIs pour :

- lister les matchs ;
- obtenir les scores ;
- figer selon l’heure.

Plusieurs sources orientées Coupe du Monde 2026 existent déjà, avec matches, standings et stades. Le dépôt `tc9011/world-cup` montre une app guide 2026 avec calendrier, carte, tableau final, gestion du fuseau horaire et export de vues. [github.com](https://github.com/tc9011/world-cup)

Une API dédiée 2026 propose les **104 matchs**, les standings, les stades et des filtres par équipe/groupe/statut. [wc2026api.com](https://wc2026api.com/)

Une autre API documentée propose aussi équipes, stades, standings et matchs pour la Coupe du Monde 2026, avec endpoints structurés pour intégration applicative. [fifa.balldontlie.io](https://fifa.balldontlie.io/)

### Recommandation technique

Prévoir une couche d’abstraction `match_provider` pour pouvoir changer d’API sans casser le reste de l’application.

### Données minimales nécessaires depuis l’API

- identifiant du match ;
- noms des équipes ;
- drapeaux ou codes pays ;
- date / heure de début en UTC ;
- phase ;
- groupe ;
- stade / ville ;
- statut du match ;
- score officiel ;
- vainqueur / qualifié si applicable.

---

## 12. Architecture recommandée

## 12.1 Front-end

Stack recommandée :

- **Next.js**
- **TypeScript**
- **Tailwind CSS**
- **React Query** ou équivalent
- **Zustand** ou contexte léger si besoin

Le projet `tc9011/world-cup` est justement basé sur **Next.js 16**, **React 19**, **Tailwind 4** et **TypeScript**, ce qui en fait une base d’inspiration crédible pour ce type d’interface. [github.com](https://github.com/tc9011/world-cup)

## 12.2 Back-end

Stack possible :

- **Next.js API routes** ou **NestJS** / **Express**
- base de données **PostgreSQL**
- ORM :
  - Prisma
  - Drizzle

## 12.3 Authentification

- email + mot de passe ;
- ou magic link ;
- session sécurisée.

## 12.4 Cron / jobs

Prévoir des tâches automatiques pour :

- synchroniser les matchs depuis l’API ;
- synchroniser les scores ;
- recalculer les points ;
- mettre à jour le classement.

---

## 13. Parcours utilisateur

## 13.1 Nouveau participant

1. l’utilisateur crée un compte ;
2. il arrive sur la page “Mes pronostics” ;
3. il voit les prochains matchs ;
4. il saisit ses scores ;
5. il enregistre ;
6. il revient plus tard pour modifier avant la deadline ;
7. après les matchs, il consulte ses points et son classement.

---

## 13.2 Utilisateur régulier

1. connexion ;
2. accès direct aux matchs encore ouverts ;
3. édition rapide ;
4. visualisation des matchs verrouillés ;
5. suivi du classement.

---

## 14. Messages UX importants

### États de sauvegarde

- `Pronostic enregistré`
- `Modification enregistrée`
- `Impossible de modifier ce pronostic : délai dépassé`
- `Résultat en attente`
- `Points attribués : X`

### États de match

- `Ouvert aux pronostics`
- `Verrouille dans moins de 2h`
- `Pronostic fermé`
- `Match en cours`
- `Match terminé`

---

## 15. Sécurité et règles serveur

Les règles de verrouillage ne doivent **jamais dépendre uniquement du front**.

Le serveur doit vérifier à chaque sauvegarde :

- que le match est encore modifiable ;
- que l’utilisateur a le droit d’éditer son propre pronostic ;
- que les scores saisis sont valides ;
- que la sélection du qualifié est cohérente en phase finale.

### Validations recommandées

- score entier >= 0 ;
- pas de valeur décimale ;
- pas de score négatif ;
- qualifié obligatoire si phase finale et pronostic nul ;
- modification interdite après `lock_at_utc`.

---

## 16. Admin minimal

Prévoir une interface admin simple pour :

- relancer une synchro API ;
- corriger manuellement un score si API KO ;
- recalculer les points ;
- voir la liste des utilisateurs ;
- ouvrir / fermer exceptionnellement un match si besoin.

---

## 17. Performance

Le site doit être fluide même avec plusieurs utilisateurs.

### Bonnes pratiques

- pagination ou virtualisation si besoin ;
- cache des matchs ;
- recalcul des classements côté serveur ;
- index DB sur `match_id`, `user_id`, `kickoff_utc`.

---

## 18. SEO / partage

Le SEO n’est pas prioritaire si le site est privé, mais prévoir :

- titre clair ;
- meta de partage ;
- favicon ;
- visuels de partage simples.

---

## 19. MVP recommandé

### Version 1

Le MVP doit inclure :

- authentification ;
- liste des matchs ;
- saisie des pronostics ;
- verrouillage à T - 2h ;
- récupération automatique des scores ;
- calcul des points ;
- classement général ;
- responsive mobile.

### Version 2

Améliorations possibles :

- bracket interactif ;
- statistiques communautaires ;
- badges / trophées ;
- notifications avant verrouillage ;
- mini ligues privées ;
- historique des journées ;
- export du classement.

---

## 20. Critères d’acceptation

Le produit est considéré comme prêt si :

- un utilisateur peut s’inscrire et se connecter ;
- il peut voir la liste des matchs avec drapeaux ;
- il peut pronostiquer directement depuis la liste ;
- il peut modifier avant T - 2h ;
- il ne peut plus modifier après T - 2h ;
- les scores officiels remontent depuis l’API ;
- les points sont correctement calculés selon la phase ;
- le classement général est visible et ordonné ;
- le site fonctionne proprement sur mobile.

---

## 21. Résumé ultra-opérationnel

### Produit

Site de pronostics gratuits Coupe du Monde 2026 entre amis.

### Écrans principaux

- Accueil
- Mes pronostics
- Tableau final
- Classement
- Connexion / inscription

### Règles de points

#### Poules
- score exact = 3
- bon vainqueur / nul = 1
- sinon = 0

#### Phases finales hors finale
- score exact = 6
- bonne équipe qualifiée = 2
- sinon = 0

#### Finale
- score exact = 12
- bonne équipe gagnante = 3
- sinon = 0

### Deadline

- modification autorisée jusqu’à **2h avant le match**
- ensuite verrouillage automatique

### Data

- matchs + scores via API
- affichage en heure Europe/Paris
- calcul de verrouillage côté serveur

### UX

- cards de matchs
- drapeaux
- édition inline
- design premium et mobile-first
- classement clair et motivant
