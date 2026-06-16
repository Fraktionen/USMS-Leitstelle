# USMS — Senora City Personaldatenbank

## Dateien

```
public/
  index.html       ← Hauptseite
  callback.html    ← Discord OAuth Redirect
  css/style.css    ← Styling
  js/app.js        ← Firebase + Discord Logic
```

## Setup

### 1. Firebase Firestore Regeln setzen
In der Firebase Console → Firestore → Regeln:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /employees/{dn} {
      allow read: if true;
      allow write: if false; // Schreiben nur über die App mit Discord-Auth
    }
  }
}
```

### 2. Discord OAuth2 Redirect URI eintragen
Im Discord Developer Portal → deine App → OAuth2 → Redirects:
```
https://DEINUSERNAME.github.io/usms/callback.html
```
Oder lokal zum Testen:
```
http://localhost:5500/callback.html
```

### 3. Lokal testen
Mit VS Code Live Server: Rechtsklick auf index.html → "Open with Live Server"

### 4. GitHub Pages deployen
- Repo erstellen: `usms`
- `public/` Ordner Inhalt ins Repo pushen
- GitHub Pages aktivieren (Settings → Pages → main branch / root)

## Admin IDs
Nur diese Discord IDs können Einträge bearbeiten:
- 1088404945323167745
- 974749925239828520
- 1403712702609625153

Weitere IDs in `js/app.js` in der `ADMIN_IDS` Liste eintragen.
