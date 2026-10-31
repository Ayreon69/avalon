# Avalon

**Loyaux d'Arthur et sbires de Mordred autour d'une même table. Qui ment ?**

👉 **Jouer : adresse à venir** (la première ouverture peut prendre jusqu'à une minute, le temps que le serveur gratuit se réveille)

Jeu de rôles cachés multijoueur en ligne, à jouer entre amis depuis un navigateur, sur téléphone ou ordinateur, sans compte ni installation. On débat à voix haute, autour d'une table ou en appel ; l'appli distribue les rôles en secret, garde les votes et les cartes de quête.
D'après *The Resistance : Avalon*, le jeu de Don Eskridge édité par Indie Boards & Cards (création de fans, non officielle, avec ses propres visuels).

## Règles en bref

- De 5 à 10 joueurs, répartis en secret : à 5, 3 loyaux contre 2 sbires ; à 6, 4 contre 2 ; à 7, 4 contre 3 ; à 8, 5 contre 3 ; à 9, 6 contre 3 ; à 10, 6 contre 4.
- **La nuit**, les sbires de Mordred se reconnaissent. Merlin, chez les loyaux, les voit aussi, mais doit rester discret.
- **À chaque quête**, le meneur choisit l'équipe (2 à 5 chevaliers selon la quête et le nombre de joueurs). Tout le monde vote pour ou contre, en même temps. Plus de la moitié de « pour » : l'équipe part. Sinon, le meneur suivant propose la sienne ; **cinq équipes rejetées d'affilée et le Mal gagne**.
- **En quête**, chaque membre joue une carte en secret. Un loyal joue toujours Réussite ; un sbire choisit. Les cartes sont mélangées puis retournées : une seule carte Échec fait échouer la quête (il en faut deux à la 4e quête à partir de 7 joueurs).
- **Trois quêtes échouées** : le Mal gagne. **Trois quêtes réussies** : l'Assassin a une dernière chance. S'il désigne Merlin, le Mal gagne ; sinon, le Bien triomphe.
- Rôles en option :
  - **Perceval et Morgane** : Perceval voit Merlin… et Morgane, qui se fait passer pour lui ;
  - **Mordred** : invisible aux yeux de Merlin ;
  - **Oberon** : sert Mordred, mais seul, sans connaître ses complices ni être connu d'eux ;
  - **la Dame du Lac** : après les quêtes 2, 3 et 4, celui qui la tient découvre en secret le camp d'un joueur, puis la lui confie. On ne sonde jamais un ancien porteur.

Les règles suivent le livret de l'éditeur : répartition des camps, tailles des équipes, majorité stricte, cinq rejets, deux Échec à la 4e quête dès 7 joueurs, assassinat de Merlin, rôles optionnels et Dame du Lac.

Sont des choix de ce jeu :

- **Le débat se fait à voix haute** par défaut ; l'hôte peut ouvrir une **discussion écrite** dans l'appli, pour jouer à distance sans appel. Les spectateurs la lisent sans écrire.
- **Les votes restent visibles quelques secondes** après leur dépouillement, puis disparaissent. Aucun historique des équipes ni des votes n'est gardé ni envoyé au client : on s'en souvient, ou on en débat.
- **Ton rôle se revoit à tout moment** (bouton « Mon rôle », qu'on touche pour l'allumer) avec ce que la nuit t'a montré, mais rien n'est jamais marqué sur les sièges.
- **Le résultat de la Dame du Lac n'est connu que de celui qui l'a consultée** ; ce qu'il en dit ensuite, vrai ou faux, n'engage que lui.
- **Pendant l'assassinat, l'Assassin se dévoile**, comme à une vraie table où il prend la parole.
- **Les deux cartes de quête s'affichent pour tout le monde**, loyaux compris : un loyal qui touche Échec voit la carte refuser, et personne autour ne peut deviner son camp à son écran.
- **La nuit dure au plus une minute**. Le temps pour proposer une équipe est réglable (sans limite, 2 ou 4 minutes) ; avec un chrono, les votes, les cartes et la Dame du Lac ont 45 secondes. Le temps écoulé, le pilote automatique joue à ta place.
- **Un joueur absent plus de 20 secondes est remplacé par le pilote automatique** jusqu'à son retour.

## Les bots

Ils ne savent que ce que leur rôle leur apprend, et ce que tout le monde voit à la table : les équipes, les votes, les résultats des quêtes. Ils votent et jouent, mais **ne parlent pas** : Avalon se joue d'abord entre amis, les bots servent à compléter la table.

- Ils envisagent toutes les répartitions des sbires compatibles avec ce qu'ils savent, et les pondèrent par les quêtes échouées (une équipe propre réussit presque toujours) et par les votes (un sbire soutient volontiers une équipe où se trouve un complice). Ils oublient un peu, et leur niveau varie d'un bot à l'autre.
- Les loyaux composent les équipes les moins suspectes et votent en conséquence ; Merlin vote selon ce qu'il sait, mais pas toujours, pour ne pas se trahir.
- Les sbires imitent le raisonnement d'un loyal pour se fondre dans la masse, glissent un complice dans l'équipe quand il en faut deux pour faire échouer la quête, et, sauf nécessité, évitent de jouer deux Échec dans la même équipe.
- L'Assassin cherche Merlin dans les votes et les équipes proposées : celui qui écarte toujours les bons joueurs a l'air d'en savoir trop.

Entre bots qui raisonnent, le Bien gagne 55 % des parties à 5 joueurs, 52 % à 7 et 75 % à 10 (72 % à 10 avec tous les rôles et la Dame du Lac). Des loyaux qui jouent au hasard ne gagnent presque jamais face à des sbires qui raisonnent (`npx tsx test/sim.ts 200` pour mesurer).

## Fonctionnalités

- Tables privées avec code à 4 lettres, lien d'invitation, partage natif et QR code
- Partie contre 4 à 9 bots en un clic
- Salon : aperçu des rôles en jeu selon le nombre de joueurs, rôles optionnels, débat oral ou écrit, chrono
- La nuit : ta fenêtre de vitrail s'allume quand tu la touches, avec ce que ton rôle te montre des autres
- Une table ronde : la couronne du meneur, les boucliers de l'équipe, la Dame du Lac ; le meneur compose l'équipe en touchant les sièges
- Vote secret en un geste ; les bulletins se retournent tous ensemble sur les sièges, « Acceptée » ou « Rejetée » s'y tamponne
- Les cartes de quête sont mélangées, retournées une à une au centre de la table, puis le verdict tombe
- Médaillons des cinq quêtes, jetons de rejet, assassinat en direct
- Écran de victoire, puis tous les rôles dévoilés ; victoires de la soirée, revanche en un clic
- Réactions, règles consultables en jeu
- Reprise automatique après une coupure, pilote automatique, spectateurs
- Sons synthétisés et vibrations, animations réduites si le système le demande

## Développement

```bash
npm install
npm run dev:server   # serveur temps réel sur http://localhost:3190
npm run dev:client   # interface sur http://localhost:5198
npm test             # distribution, visions de la nuit, votes, quêtes, Dame du Lac, assassinat, vues et bots
npm run build && npm run e2e   # parties complètes avec de vrais clients connectés
npx tsx test/sim.ts 200        # force des bots : 200 parties par configuration
```

`AV_FAST=1` accélère les bots et les chronos (tests locaux uniquement).

## Architecture

- `shared/` : contrat client/serveur, camps, tailles des quêtes, rôles et réglages
- `server/` : Express + Socket.IO, moteur de partie (`game.ts`), bots et leur raisonnement (`bots.ts`), table, pilote automatique et minuteries (`room.ts`). Le serveur fait autorité : chacun ne reçoit que son rôle et ce qu'il en voit, les votes seulement le temps du dépouillement, les cartes de quête mélangées et sans leurs auteurs, et rien de passé n'est renvoyé
- `client/` : React + Vite + Framer Motion. Les vitraux, médaillons, bulletins et cartes sont dessinés dans `components/Art.tsx`, la table dans `screens/Table.tsx`
- Déploiement : un seul service Node (`npm ci && npm run build`, puis `npm start`)
