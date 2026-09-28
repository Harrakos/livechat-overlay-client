# LiveChat — Client

Application Electron qui tourne en fond (tray) et affiche en overlay
always-on-top les memes envoyés via la commande Discord `/meme` du projet
[LiveChat](https://github.com/Harrakos/livechat-overlay-client).

## Développement

```bash
npm install
npm start
```

Au premier lancement, copie `config.example.json` vers le dossier de config
utilisateur de l'app (chemin affiché dans les logs au démarrage) et
renseigne `serverWsUrl` / `clientToken`.

## Release (build + publication + auto-update)

Les builds Windows/macOS/Linux et leur publication sur GitHub Releases sont
entièrement automatisés par GitHub Actions
(`.github/workflows/release.yml`) — pas besoin de machine Windows/macOS en
local.

Pour sortir une nouvelle version :

```bash
# 1. Monte le numéro de version dans package.json (ex: 1.0.0 -> 1.0.1)
git add package.json
git commit -m "chore: bump version to 1.0.1"

# 2. Tag et push — c'est le tag qui déclenche le workflow
git tag v1.0.1
git push && git push --tags
```

Le workflow build alors en parallèle sur Linux, Windows et macOS
(`electron-builder --publish always`), et publie une Release GitHub
`v1.0.1` avec les installeurs de chaque plateforme + les fichiers
`latest*.yml` qu'`electron-updater` utilise pour détecter les mises à jour.

Les clients déjà installés détecteront la mise à jour automatiquement
(vérification au démarrage puis toutes les heures, ou immédiatement via le
menu du tray → "Vérifier les mises à jour") et l'installeront au prochain
redémarrage de l'app.

**Important** : le tag git (`vX.Y.Z`) et le `version` dans `package.json`
doivent correspondre — c'est ce dernier qu'`electron-updater` compare pour
savoir si une mise à jour est disponible.

`GH_TOKEN` n'a rien à faire côté local pour ce flux : GitHub Actions fournit
automatiquement son propre token (`secrets.GITHUB_TOKEN`) avec les droits
de publication sur ce repo.
