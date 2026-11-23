// =====================================================================
//  EduNest Parent + Teacher web apps: SCHOOL SETTINGS (only this file)
// =====================================================================
// Firebase console > Project settings > General > "Your apps" > Web app (</>)
// Copy the 4 values from "firebaseConfig" below. Same Firebase project as EduNest
// (Setup > School Setup > Cloud Sync > Parent App).
// While apiKey is empty the apps open in DEMO mode with sample data.
window.EDUNEST = {
  firebase: {
    apiKey: "AIzaSyDIcvczaSADZZNIOdxWLfVgl7zVLXB2km0",
    authDomain: "edunest-60b0e.firebaseapp.com",
    projectId: "edunest-60b0e",
    appId: "1:634531246952:web:6fe8c390e02204e88e5cdd"
  },
  // MORE Firebase projects (only when EduNest > Setup > School Setup > Parent App sends some classes to other Firebase projects).
  // EduNest shows the exact lines to paste here ("Lines for config.js"). Leave it as it is when you use only one Firebase project.
  firebaseMore: [
    // { name: 'Primary wing', firebase: { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' } },
  ],
  schoolName: 'Lotus International School',   // shown on the login screens
  appName: 'Lotus EduNest',                   // official app branding
  themeColor: '#59164C',   // Teacher App colour (plum); the whole app is coloured from it (Material You)
  parentThemeColor: '#0B57D0',   // Parent App colour (blue)
  // School logo files (folder 'school'). Leave '' to show a plain icon instead.
  logo: 'school/logo.webp',                 // round logo: login screens, app chooser
  logoName: 'school/logo-name.webp',        // logo with school name: app chooser (light mode)
  logoNameDark: 'school/logo-name-dark.webp', // same with white letters (dark mode)
};
