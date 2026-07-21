// ── Configurazione Firebase ──────────────────────────────────────
//
// ⚠️ NOTA PER CHI LEGGE (e per gli scanner di sicurezza)
// `apiKey` NON è una password e NON va revocata: per le app web Firebase
// è un IDENTIFICATIVO PUBBLICO del progetto, per progetto visibile nel
// codice del browser. Da sola non dà accesso ad alcun dato.
// Documentazione: https://firebase.google.com/docs/projects/api-keys
//
// Ad accedere ai dati ci pensano tre livelli, tutti attivi:
//  1. Regole Firestore (`firestore.rules`) — ogni utente legge/scrive SOLO
//     il proprio documento `utenti/{uid}`, previa autenticazione.
//  2. Authorized domains (Firebase Auth) — il login funziona solo dai
//     nostri domini.
//  3. Restrizioni della chiave (Google Cloud → Credentials) — la chiave
//     accetta richieste solo dai nostri referrer ed è limitata alle API
//     identitytoolkit / securetoken / firestore / installations / fcm.
//
// Se cambi dominio, aggiorna sia gli Authorized domains sia i referrer
// consentiti della chiave, altrimenti il login smette di funzionare.
//
// Se `FIREBASE_CONFIG` è `null`, l'app funziona in MODALITÀ LOCALE:
// i dati restano su questo dispositivo (localStorage). Per rigenerare
// questa configurazione su un altro progetto vedi il README.

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyCErhl1BlC8PgWjroo90k_kxbiMKvZKTsE",
  authDomain: "desideri-101.firebaseapp.com",
  projectId: "desideri-101",
  storageBucket: "desideri-101.firebasestorage.app",
  messagingSenderId: "123482361016",
  appId: "1:123482361016:web:de5cf753b0e7fd021c784d"
};
