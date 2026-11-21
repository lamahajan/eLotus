# EduNest Parent App + Teacher App (Web / PWA)

Two web apps for the school, connected to **EduNest** through Firebase:

| App | Who uses it | What it shows / does |
|---|---|---|
| **Parent App** (`/parent/`) | Parents | Dashboard (today's gate pass, attendance, fee due, homework, notices, student card), fees with **Pay Now (UPI)**, attendance, homework, notices |
| **Teacher App** (`/teacher/`) | Teachers | Post homework, **enter exam marks** (they go into EduNest Mark Entry), **post notices to their own classes** |

### New in web apps 1.6 / EduNest 1.0.53
- **Publish the new `firestore.rules` once** (Firebase > Firestore Database > Rules > paste > Publish). Without it notices do not show.
- **Gate pass**: who picked the child up and at what time (and when the child left through the gate) shows on the parent's dashboard within seconds.
- **Pay Now**: under the fee due. It uses the student's UPI link from the online-fee Firebase (`part_qr/<admission no>`), with the amount the app shows
  put into `am=`. Setting: Cloud Sync > Parent App > *Pay links* (empty = the Online fee Firebase).
- **Notices**: the school posts in EduNest (Cloud Sync > Parent App > Notices & announcements: everyone / parents / teachers, all or some classes).
  Teachers post from the Teacher App (Notices > Post); a teacher's notice goes **only** to the classes they tick, and only classes they teach.
- **School announcements by the Principal**: two ways.
  1. In EduNest (computer): Setup > School Setup > Cloud Sync > Parent App card > *Notices & announcements* (Administrator login).
  2. From the phone: put the Principal in **Setup > Teachers** with a 10-digit mobile and their EduNest login (role Principal or Administrator).
     In the Teacher App, *Post a notice* then shows **Whole school**. Teachers only get their own classes.
- Today's notices show as cards at the top of the dashboard; the Notices tile opens all of them.
- **Teachers** log in with their **username** (the Login box says "Username"). A teacher without an EduNest login user still gets the app (login = mobile).
- **Force push all data now** (top of Cloud Sync) sends everything again at once.
- Dark look by default; the sun / moon button switches to light.

These web apps are now the **only** apps. The old Flutter apps (ParentApp / TeacherApp, APK files) are no longer used
and do not need to be built or installed. Parents and teachers open a link in Chrome and tap **Install**; the app gets its
own icon on the phone, works offline and needs no Play Store.

```
EduNest (school PC)  --->  Firebase (Firestore + Authentication)  --->  Parent App / Teacher App (phones)
   EduNest writes profile, fees, attendance                  Teacher App writes homework and exam marks
   exam marks go BOTH ways (Teacher App <-> EduNest Mark Entry)
```

---

## Contents
1. [What you need](#1-what-you-need)
2. [Firebase project (one time)](#2-firebase-project-one-time)
3. [Connect EduNest to Firebase](#3-connect-edunest-to-firebase)
4. [Configure the web apps (`config.js`)](#4-configure-the-web-apps-configjs)
5. [Put the apps online (GitHub Pages)](#5-put-the-apps-online-github-pages)
6. [Give the link to parents and teachers](#6-give-the-link-to-parents-and-teachers)
7. [How data goes from EduNest to the apps](#7-how-data-goes-from-edunest-to-the-apps)
   - [7b. Exam marks from the Teacher App](#7b-exam-marks-from-the-teacher-app)
8. [Updating the apps later](#8-updating-the-apps-later)
9. [Troubleshooting](#9-troubleshooting)
10. [Files](#10-files)

---

## 1. What you need
- A Google account for the school (owns the Firebase project).
- A GitHub account (free hosting for the apps).
- EduNest **1.0.52 or newer** running on the school server.
- In EduNest:
  - every student has **Mobile No** (10 digits) in the Admission form. This number is the parent's password (always; it cannot be changed in the app);
    brothers and sisters with the same Mobile No share one login.
  - every teacher is in **Setup > Classes > Teachers** with a **10-digit mobile** and an **active login user**
    (User Management), and is set as subject teacher (Academics Setup) and / or class teacher.

## 2. Firebase project (one time)
1. Open <https://console.firebase.google.com> > **Add project** (e.g. `lotus-school-app`). Google Analytics is not needed.
   The free **Spark** plan is enough.
2. **Build > Firestore Database > Create database** > Production mode > location **asia-south1 (Mumbai)** > Enable.
3. **Build > Authentication > Get started > Sign-in method > Email/Password > Enable** > Save.
   (Nobody types an e-mail: the apps make it from the admission number / username.)
4. **Firestore Database > Rules**: delete everything, paste the whole file **`firestore.rules`** from this folder, press **Publish**.
5. **Project settings (gear) > Service accounts > Generate new private key** > Generate key.
   A `.json` file downloads. This is the key EduNest uses to write data. **Never send it to anybody, never upload it to GitHub.**
6. **Project settings > General > Your apps > Add app > Web (`</>`)**. Name: `EduNest Web`. Do NOT tick Hosting > Register app.
   Keep the page open: you need `apiKey`, `authDomain`, `projectId`, `appId` in step 4.

## 3. Connect EduNest to Firebase
On the school server, sign in to EduNest as Administrator:

1. **Setup > School Setup > Cloud Sync > Parent App (Firestore)**.
2. **Service account key (JSON)**: open the downloaded `.json` file in Notepad, `Ctrl+A`, `Ctrl+C`, paste it here.
3. **App name shown to parents**: e.g. `Lotus Parents` (empty = school name).
4. **Send the home address to the app**: unticked is safer.
5. **Teachers enter exam marks in the Teacher App**: ticked. See section 7b.
6. **Full sync every morning after (hour)**: `6` (= 6 am). See section 7.
7. Press **Test**. You should see three green lines: *Google accepted the key*, *Firestore: connected*, *Authentication: connected*.
8. Press **Save**, then **Fetch all data now**. The result shows how many students, parent logins and teacher logins were sent,
   and lists students without Mobile No and teachers without a mobile (they get no login until you fill it in).

**Passwords are always the mobile number** (parent: Mobile No, teacher: mobile in Setup > Teachers). The apps have no way to change
a password. When a mobile number is changed in EduNest, the login is renewed with the new number automatically.
**Reset a password** (same card) puts one login back to the mobile number; **Fetch all data now** does it for every login.

## 4. Configure the web apps (`config.js`)
`config.js` is the only file you edit. Copy the 4 values from Firebase (section 2, step 6):

```js
window.EDUNEST = {
  firebase: {
    apiKey: 'AIza....',
    authDomain: 'lotus-school-app.firebaseapp.com',
    projectId: 'lotus-school-app',
    appId: '1:1234567890:web:abc123',
  },
  schoolName: 'Lotus International School',
  themeColor: '#59164C',                      // Teacher App colour (plum)
  parentThemeColor: '#0B57D0',                // Parent App colour (blue)
  logo: 'school/logo.webp',                   // round logo
  logoName: 'school/logo-name.webp',          // logo with school name (light mode)
  logoNameDark: 'school/logo-name-dark.webp', // same with white letters (dark mode)
};
```
Another school: replace the files in `school/` and `icons/` with its own logo (same names and sizes).

The `apiKey` of a web app is not a secret (it only identifies the project); `firestore.rules` protect the data.

**Demo mode**: while `apiKey` is empty (or with `?demo` at the end of the address) the apps show sample data.
Parent: Admission No `1024`. Teacher: username `ravi.kumar`. Any password works.

## 5. Put the apps online (GitHub Pages)
1. github.com > **New repository** > name e.g. `school-app` > **Public** > Create.
2. **Add file > Upload files** > drag **everything inside this folder** (including `.nojekyll`, `school/`, `icons/`, `assets/`) > Commit.
3. Repository **Settings > Pages** > Source *Deploy from a branch* > Branch `main`, folder `/ (root)` > Save.
4. After 1-2 minutes the site is live:
   - Both apps: `https://<github-name>.github.io/school-app/`
   - Parent App: `https://<github-name>.github.io/school-app/parent/`
   - Teacher App: `https://<github-name>.github.io/school-app/teacher/`
5. Firebase > **Authentication > Settings > Authorized domains > Add domain**: `<github-name>.github.io`.

Own domain (e.g. `app.lisdnn.org`): GitHub **Settings > Pages > Custom domain**, add the CNAME record at the domain provider
(Wix / GoDaddy) as GitHub shows, tick *Enforce HTTPS*, and add the domain to Firebase **Authorized domains** too.

Test with a laptop and a phone before sharing: log in as one parent and one teacher.

## 6. Give the link to parents and teachers
| | Login | Password (always) |
|---|---|---|
| Parent | Admission No (any child of the family) | Mobile No (10 digits) |
| Teacher | EduNest username (e.g. `ravi.kumar`) or the mobile number | Teacher's mobile (Setup > Teachers) |

**Install**: Android Chrome > menu > *Install app* (or the Install card in the app). iPhone Safari > Share > *Add to Home Screen*.

Sample WhatsApp message:
> Lotus Parent App: https://&lt;github-name&gt;.github.io/school-app/parent/
> Login: your child's Admission No. Password: Mobile No given in the admission form. Open in Chrome and tap Install.

## 7. How data goes from EduNest to the apps
EduNest does the sending by itself; there is nothing to press every day.

1. **The EduNest page computes the numbers.** Any EduNest page that is open in a browser (on the server or any office PC,
   with a user who has Fee Receipt rights) prepares a snapshot of all studying students (profile, fee dues, receipts,
   attendance) and all teachers, using the same calculations as the Dues Report and Attendance screen. It sends this to the
   server 5 seconds after any save (attendance, receipt, admission, setup ...) and every 10 minutes.
   **Keep EduNest open on at least one PC during school hours**; nothing new is sent while no EduNest page is open.
2. **Full sync every morning.** The first snapshot of the day after the "Full sync every morning" hour (default 6 am) makes the
   server write **every** document again: all students, logins index, teachers, school name; children who left are removed.
3. **Only changes the rest of the day.** After that only the students / teachers whose data changed are written, within about
   10 seconds. Example: a teacher saves attendance of 5TH-A -> only those 40 student records go to Firebase.
4. **Phones read** the child's record at most every 15 minutes (pull down to refresh: immediately) and keep an offline copy.
   Homework: today at most every 30 min, yesterday every 6 h, older days only once.
5. Homework older than 60 days is deleted once a day by EduNest.

| What | When it reaches the Parent App |
|---|---|
| Attendance saved in EduNest (also roll call / biometric marks that reach EduNest) | ~10 s (+ up to 15 min phone cache) |
| Fee receipt, concession, new admission, class change | ~10 s |
| New student / changed Mobile No | ~10 s (new login is made; old login is closed) |
| Everything again | every morning (full sync) or "Fetch all data now" |

Firestore free limits (50,000 reads, 20,000 writes per day) are far above what one school uses.

## 7b. Exam marks from the Teacher App
**Teacher:** Teacher App > **Exam marks** > section > choose **Term**, **Assessment**, **Subject** > type the marks
(tap **AB** for absent) > **Save**. A box turns red when the mark is above the maximum; Save stays off until it is fixed.
Only the changed marks are sent, so two teachers can work on the same class at the same time.

**What the teacher sees comes from EduNest:** the active terms and their assessments, the Scholastic subjects of the class
(and stream) with their max marks (Academics Setup, Class-wise Assessment; max 0 = no marks), and the studying students.
A teacher gets the subjects he teaches in that section; the class teacher gets every subject of his class.

**Both ways:**
| Change | Result |
|---|---|
| Teacher saves marks in the app | in EduNest Mark Entry / Mark Register / Result Card within about 1 minute |
| Office types or corrects a mark in EduNest Mark Entry | shows in the Teacher App (sheet refreshes within 2 minutes, pull down = now) |
| Same mark changed in both places | the **EduNest** mark is kept (office correction), noted in `data\server.log` |
| Mark above the maximum / not a number | not taken into EduNest |

Co-Scholastic grades are still entered in EduNest only.

**Result portal:** this replaces it. When the school stops using the portal, clear its settings in EduNest
(Setup > School Setup > Cloud Sync > Result portal) so only one connection changes marks.

## 8. Updating the apps later
**Updating from an older version (before marks):** publish the new `firestore.rules` again (Firebase > Firestore > Rules >
paste > Publish), upload all files, and in EduNest press **Fetch all data now** once.

1. Change the files and upload them again to the same GitHub repository (overwrite).
2. Change `VERSION` at the top of **`sw.js`** (e.g. `edunest-web-1.2.1`). Without this, phones keep the old files.
3. Phones get the new version the next time the app is opened with internet.

`firestore.rules` changes only take effect after pasting them again in Firebase > Firestore > Rules > Publish.

## 9. Troubleshooting
| Problem | Fix |
|---|---|
| Parent: "wrong admission number or password" | Child must be studying (not left) and have a 10-digit Mobile No. Press **Fetch all data now** (it also puts every password back to the mobile number). |
| Teacher cannot log in | Teacher needs an active EduNest user, a 10-digit mobile in Setup > Teachers, and at least one class/subject. |
| Teacher App: "marks list has not come from EduNest yet" | Open EduNest on a PC once (it sends the list), wait a minute, pull down in the app. Check the "exam marks" tick in Cloud Sync. |
| Teacher App marks: "Missing or insufficient permissions" on Save | The new `firestore.rules` (with the marks part) is not published yet: section 2, step 4. |
| Teacher sees no section / cannot post a subject | Set the teacher as subject teacher (Academics Setup) or class teacher; wait ~10 s; teacher logs out and in again. |
| Attendance / fees not updating in the app | Is EduNest open on some PC? Is the open session the current one (footer "Active Session")? Pull down to refresh in the app. Check `data\server.log` for lines starting with `Parent App:`. |
| "auth/unauthorized-domain" on login | Add the site's domain in Firebase > Authentication > Settings > Authorized domains. |
| "Missing or insufficient permissions" | `firestore.rules` not published, or published to another project. |
| Test: "Firestore Database is not created yet" | Section 2, step 2. |
| Test: "turn on Authentication > Email/Password" | Section 2, step 3. |
| App shows sample data (Aarav Sharma) | `apiKey` in `config.js` is empty: demo mode. |
| Old version still on phones | Change `VERSION` in `sw.js` and upload again. |

The Reception roll call (Class roll call, separate Realtime Database) is a different connection: see EduNest
Setup > School Setup > Cloud Sync > Class roll call. It sends EduNest attendance of **today** to the Reception app.

## 10. Files
```
config.js              school settings (the only file to edit)
firestore.rules        security rules: paste in Firebase > Firestore > Rules
index.html             chooser: Parent / Teacher
parent/  teacher/      the two apps (index.html, app.js, manifest)
assets/core.js         shared: theme, Firebase access, UI parts (DOMAIN / KEEP_DAYS must match EduNest cloud_parent.py)
assets/lib.js          Firebase SDK + Material colour library (bundled, no CDN)
assets/demo.js         sample data for demo mode
sw.js                  offline support (change VERSION on every update)
school/  icons/        school logo and home-screen icons
.nojekyll              needed by GitHub Pages
```
Font: Google Sans Flex (SIL OFL 1.1). Icons: Material Symbols (Apache 2.0).
