# Déploiement sur Vercel avec MongoDB Atlas

## 1. Prérequis

- Compte [Vercel](https://vercel.com)
- Compte [MongoDB Atlas](https://www.mongodb.com/atlas) avec un cluster gratuit (M0)
- Projet poussé sur GitHub / GitLab / Bitbucket

## 2. MongoDB Atlas

1. Créez un cluster gratuit (M0).
2. **Database Access** : ajoutez un utilisateur (ex. `signedoc-user`) avec mot de passe.
3. **Network Access** : ajoutez `0.0.0.0/0` (Allow access from anywhere) pour que Vercel puisse se connecter.
4. **Connect → Connect your application** : récupérez l’URI (Driver **Node.js**, version **6.x**).
5. Remplacez `<password>` et ajoutez le nom de base :  
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/signedoc?retryWrites=true&w=majority`

## 3. Déployer sur Vercel

1. Sur [vercel.com](https://vercel.com), **Add New → Project**.
2. Importez le dépôt Git du projet.
3. **Configure** :
   - **Root Directory** : laisser la racine.
   - **Build Command** : `npm run build` (déjà dans `vercel.json`).
   - **Output Directory** : `dist` (déjà dans `vercel.json`).
4. **Environment Variables** (Settings → Environment Variables) :

   | Variable     | Valeur |
   |-------------|--------|
   | `MONGO_URI` | `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/signedoc?retryWrites=true&w=majority` |
   | `BASE_URL`  | `https://VOTRE-PROJET.vercel.app` (à mettre après le 1er déploiement) |

5. **Deploy**.

## 4. Après le premier déploiement

1. Récupérez l’URL du projet (ex. `https://signedoc-xxx.vercel.app`).
2. Dans Vercel → **Settings → Environment Variables**, éditez `BASE_URL` et mettez cette URL.
3. **Redeploy** pour que les liens (signature, téléchargement) utilisent la bonne base.

## 5. Limites sur Vercel

- **Fichiers uploadés** : stockés dans `/tmp` (éphémère). Les PDF uploadés peuvent disparaître entre deux invocations. Pour un usage sérieux, prévoir un stockage externe (Vercel Blob, S3, etc.).
- **Socket.io** : désactivé en mode serverless (pas de mise à jour temps réel du dashboard).
- **E-mails** : configurer SMTP (variables `SMTP_*`, `MAIL_FROM`) si vous voulez envoyer les liens par mail.

## 6. Test rapide

1. Ouvrez l’URL Vercel.
2. Uploadez un PDF, ajoutez un signataire, placez un champ signature, envoyez le workflow.
3. Utilisez le lien de signature (console ou e-mail si SMTP configuré) pour signer.
4. Téléchargez le PDF signé via « Download Final Document ».
