// ── Configurazione Firebase ──────────────────────────────────────
// Finché resta `null`, l'app funziona in MODALITÀ LOCALE:
// i dati vengono salvati solo su questo dispositivo (localStorage).
//
// Per attivare login (Google + email/password) e salvataggio cloud:
// 1. Vai su https://console.firebase.google.com e crea un progetto.
// 2. Aggiungi un'app Web e copia qui l'oggetto firebaseConfig.
// 3. In Authentication → Sign-in method attiva "Google" e "Email/password".
// 4. In Firestore crea il database e usa le regole del README.
// Le chiavi firebaseConfig NON sono segrete: possono stare nel repo.

window.FIREBASE_CONFIG = null;

// Esempio:
// window.FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "desideri-101.firebaseapp.com",
//   projectId: "desideri-101",
//   storageBucket: "desideri-101.appspot.com",
//   messagingSenderId: "1234567890",
//   appId: "1:1234567890:web:abcdef"
// };
