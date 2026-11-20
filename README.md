# EduNest Parent + Teacher Web Apps (PWA)

These web apps replace the two Flutter APKs. They use the same Firebase project, the same data
(`students`, `homework`, `teachers`, `loginIndex`, `tLogin`, `meta`) and the same `firestore.rules`,
so **nothing changes in EduNest**. Parents and teachers open a link and tap **Install**, and the app
gets its own icon on the phone. It works offline and needs no Play Store.

- Parent App: `https://<your-github-name>.github.io/<repo>/parent/`
- Teacher App: `https://<your-github-name>.github.io/<repo>/teacher/`
- Both: `https://<your-github-name>.github.io/<repo>/`

## 1. Firebase: add a Web app (one time)
1. Firebase console > your EduNest project > Project settings (gear) > General.
2. "Your apps" > **Add app** > Web (`</>`). Name it "EduNest Web". Do NOT tick Hosting.
3. Copy `apiKey`, `authDomain`, `projectId`, `appId` into **config.js** (the only file you edit).
   `schoolName`, `themeColor` (#59164C) and the logo files are already set for Lotus.
4. Authentication > Settings > **Authorized domains** > Add domain: `<your-github-name>.github.io`.

Firestore rules stay exactly as they are (same file as the APK version).

## 2. GitHub Pages (free hosting)
1. github.com > New repository (Public), e.g. `school-app`.
2. Upload **everything inside this folder** (including `.nojekyll`) to the repository root.
3. Settings > Pages > Source: "Deploy from a branch" > Branch `main`, folder `/ (root)` > Save.
4. After 1-2 minutes, open `https://<your-github-name>.github.io/school-app/`.

A custom domain (e.g. `app.lisdnn.org`) works too: Settings > Pages > Custom domain. Add that domain
to Firebase Authorized domains as well.

## 3. Updating later
Change files, upload again, and change `VERSION` at the top of **sw.js** (e.g. `edunest-web-1.0.1`).
Phones pick up the new version the next time the app is opened with internet.

## Demo mode
While `apiKey` in config.js is empty (or with `?demo` at the end of the address) the apps show sample
data. Parent: Admission No `1024`. Teacher: login `ravi.kumar`. Any password works.

## Reads (Firestore cost): same as the APK
| What | When the server is asked |
|---|---|
| Student record | at most every 6 hours (pull down to refresh: now) |
| Today's homework | at most every 30 minutes |
| Yesterday | at most every 6 hours |
| 2-7 days ago | only if this phone never saw that day |
| Older (up to 60 days) | only when "Older homework" is opened |
| Teacher record | at most every 6 hours; a section's day every 5 minutes |

Firestore keeps its offline copy in the browser (IndexedDB), so a fresh install costs about 10 reads,
like the APK.

## Files
```
config.js              school settings (edit this)
index.html             chooser: Parent / Teacher
parent/  teacher/      the two apps (index.html, app.js, manifest)
assets/core.js         shared: Material 3 theme, data access, UI parts
assets/lib.js          Firebase SDK 13.4 + Material colour library (bundled, no CDN)
assets/demo.js         sample data for demo mode
sw.js                  offline support
school/                school logo (round + with name, light and dark)
icons/                 home-screen icons (school logo + Parent / Teacher badge)
```
Font: Google Sans Flex (SIL OFL 1.1). Icons: Material Symbols (Apache 2.0).
