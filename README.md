# Kiosque Alkass

Tableau de bord de gestion pour kiosque : ventes, dépenses, réinvestissements, graphiques, objectifs et rappels par email.

## Nouveautés Phase 1 (sécurité, export, mobile)

- **Limite de tentatives de connexion** : après 8 essais en 15 minutes, il faut attendre (protection contre les attaques par mot de passe)
- **Menu mobile** : bouton ☰ pour ouvrir/fermer la navigation sur téléphone
- **Export Excel et PDF** de tous les comptes rendus (bouton dans le Dashboard)
- **Historique des actions** : nouvel onglet listant les 100 dernières actions (comptes rendus ajoutés/supprimés, mot de passe changé, objectifs fixés)
- **Pages légales** : Confidentialité, Conditions d'utilisation, Contact (liens en bas de page)
- **Indicateur de chargement** au démarrage de l'application

## Nouveautés de cette version

- **Mot de passe oublié** : email avec lien de réinitialisation
- **Graphiques** : évolution jour / semaine / mois (Chart.js)
- **Analyse** : meilleur jour et jour le plus difficile
- **Objectifs** : fixer un montant à atteindre par semaine ou par mois, avec barre de progression
- **Page Compte** : voir son email, changer son mot de passe (le mot de passe lui-même n'est jamais réaffiché — il est chiffré, c'est normal et plus sûr)
- **Rappels par email** façon Duolingo, si aucun compte rendu n'a été ajouté dans la journée
- Le stock a été retiré au profit de l'onglet Analyse

## Variables d'environnement à configurer sur Render

En plus de `SESSION_SECRET` (déjà en place), ajoute ces variables dans Render (Dashboard → ton service → Environment) :

| Variable | Valeur |
|---|---|
| `GMAIL_USER` | ton adresse Gmail complète, ex: `talibe@gmail.com` |
| `GMAIL_APP_PASSWORD` | un "mot de passe d'application" Gmail (voir ci-dessous) |
| `CRON_SECRET` | une phrase secrète de ton choix, pour protéger l'envoi des rappels |
| `APP_URL` | l'adresse de ton site, ex: `https://kiosque-alkass.onrender.com` |

### Comment obtenir un "mot de passe d'application" Gmail

1. Va sur **myaccount.google.com/security**
2. Active la **validation en 2 étapes** si ce n'est pas déjà fait (obligatoire pour l'étape suivante)
3. Cherche **"Mots de passe des applications"** (ou va directement sur **myaccount.google.com/apppasswords**)
4. Crée un nouveau mot de passe d'application (nom libre, ex: "Kiosque Alkass")
5. Google te donne un code à 16 caractères — c'est ça qu'il faut mettre dans `GMAIL_APP_PASSWORD` (pas ton mot de passe Gmail habituel)

## Activer les rappels quotidiens automatiques

Le serveur expose une route `/api/cron/send-reminders` qui envoie un rappel à tous les utilisateurs n'ayant pas encore ajouté de compte rendu aujourd'hui. Comme le plan gratuit de Render met le site en veille, il faut un service externe gratuit pour "réveiller" cette route une fois par jour :

1. Crée un compte gratuit sur **cron-job.org**
2. Crée un nouveau cron job :
   - URL : `https://TON-SITE.onrender.com/api/cron/send-reminders`
   - Méthode : **POST**
   - En-tête (header) : `x-cron-secret` = la même valeur que ta variable `CRON_SECRET`
   - Fréquence : une fois par jour (ex: 18h00)

## Installation locale

```bash
cd kiosque-alkass
npm install
npm start
```

Le site est alors accessible sur **http://localhost:3000**. En local, sans les variables `GMAIL_USER`/`GMAIL_APP_PASSWORD`, les emails ne partent pas mais le reste du site fonctionne normalement (un message s'affiche dans le terminal à la place).

## Structure du projet

```
kiosque-alkass/
  server.js         → serveur (routes API, sessions, cron)
  db.js             → lecture/écriture des données (data/db.json)
  mail.js           → envoi des emails (Gmail)
  data/db.json      → base de données (créée automatiquement)
  public/
    index.html      → application (connexion + tableau de bord)
    reset.html      → page de réinitialisation du mot de passe
    styles.css      → design
    script.js       → logique du tableau de bord
```
