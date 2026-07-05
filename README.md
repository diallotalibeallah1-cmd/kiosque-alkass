# Kiosque Alkass

Tableau de bord de gestion pour kiosque : ventes, dépenses, réinvestissements et stock, avec de vrais comptes utilisateurs et des données sauvegardées côté serveur.

## Ce qui est inclus

- **Backend** : Node.js + Express
- **Comptes utilisateurs** : inscription / connexion avec mot de passe chiffré (bcrypt), session sécurisée par cookie
- **Base de données** : fichier local `data/db.json` (aucune base externe à installer)
- **Frontend** : les 3 fichiers `index.html` / `styles.css` / `script.js`, connectés au backend via des appels API

## Installation (sur ton ordinateur)

Il te faut [Node.js](https://nodejs.org) installé (version 18 ou plus récente).

```bash
cd kiosque-alkass
npm install
npm start
```

Le site est alors accessible sur : **http://localhost:3000**

## Mettre le site en ligne

Ce projet peut être déployé tel quel sur un hébergeur qui supporte Node.js, par exemple :

- **Railway** ou **Render** (gratuit pour démarrer, très simple : connecter le dossier/GitHub et déployer)
- Un VPS (OVH, Contabo...) avec Node.js installé

Avant la mise en ligne, pense à :

1. Définir une variable d'environnement `SESSION_SECRET` avec une valeur longue et aléatoire (sert à sécuriser les sessions de connexion).
2. Si l'hébergeur impose un port, il est déjà géré automatiquement via `process.env.PORT`.

## Structure du projet

```
kiosque-alkass/
  server.js         → le serveur (routes API, sessions)
  db.js             → lecture/écriture des données (data/db.json)
  data/db.json       → la base de données (créée automatiquement au premier lancement)
  public/
    index.html      → la page (connexion + tableau de bord)
    styles.css      → le design
    script.js       → les appels au backend (fetch)
```

## Limites actuelles à connaître

- La base de données est un simple fichier JSON : parfait pour un ou quelques kiosques avec un usage modéré, mais pas conçu pour un très grand volume de données simultanées.
- Il n'y a pas encore de récupération de mot de passe oublié ni de vérification d'email.
- Chaque utilisateur ne voit que ses propres comptes rendus et son propre stock.

Si le kiosque grandit et que tu as besoin de plus de robustesse (beaucoup d'utilisateurs, plusieurs kiosques, statistiques avancées), on pourra migrer `data/db.json` vers une vraie base de données (PostgreSQL par exemple) sans changer le reste de l'application.
