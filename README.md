# ✨ 101 Desideri

Web app **trilingue (IT · EN · DE)** per praticare la **tecnica dei 101 desideri di Igor Sibaldi**: quaderno di brutta (150 desideri), quaderno di bella (i 101 scelti) e lettura quotidiana per 365 giorni — con la validazione automatica delle regole di Igor mentre scrivi.

**Demo / produzione:** https://cryptopannoz.github.io/101-desideri/

## Le regole implementate

| # | Regola | Nell'app |
|---|--------|----------|
| 1 | Ogni desiderio comincia con «Io voglio» | prefisso fisso nel form + blocco di «desidero/vorrei/mi piacerebbe» |
| 2 | Niente negazioni («non», «mai», «senza»…) | ⛔ errore bloccante; le negazioni nascoste («incolume», «smettere»…) danno ⚠️ avviso |
| 3 | Max 14 parole, virgole comprese | contatore live + ⛔ errore |
| 4 | (consiglio) niente persone precise in amore/sesso | 💡 suggerimento |
| 5 | Niente paragoni («come», «più di»…) | ⚠️ avviso |
| 6 | Niente desideri seriali | ⚠️ avviso se somiglia troppo a uno esistente |
| 7 | Niente soldi | ⛔ errore bloccante |
| 8 | Non chiedere per gli altri → «fare in modo che…» | ⚠️ avviso con riformulazione suggerita |
| 9 | Niente diminutivi («casettina», «macchinina»…) | ⚠️ avviso (euristica sui suffissi) |
| + | Sii preciso (anno, colore), metti anche desideri assurdi | 💡 suggerimenti e testi nella pagina regole |

Gli **errori ⛔ bloccano** il salvataggio; gli **avvisi ⚠️** si possono superare con «Salva comunque» (in fondo il quaderno è tuo).

## Struttura

- `index.html` — single page app (regole / brutta / bella / lettura / account)
- `css/style.css` — stile "quaderno"
- `js/validator.js` — le regole di Igor in forma di validatore
- `js/app.js` — stato, quaderni, lettura, sync
- `js/firebase-config.js` — configurazione cloud (vedi sotto)

## Mobile / PWA

L'app è pensata **prima di tutto per il telefono**: barra di navigazione in basso, lettura a schede con swipe, tap target grandi. È una **PWA installabile**: dal browser del telefono → "Aggiungi a schermata Home" e diventa un'app con la sua icona, che funziona **anche offline** (service worker `sw.js`; quando pubblichi modifiche, incrementa `CACHE` in `sw.js`).

## Percorso UX

1. **Benvenuto/login** (Google o email/password; link discreto «prova senza account» per la modalità locale)
2. **Le regole** — finché non premi «Ho letto le regole» le altre sezioni restano nascoste
3. **Brutta → Bella → Lettura → Realizzati** (spunta verde ✓ con data; i realizzati restano nella lettura quotidiana, come vuole la tecnica)

## Lingue

Interfaccia e **validatore** in italiano, inglese e tedesco (selettore IT/EN/DE in alto). Ogni lingua ha le sue liste: negazioni, soldi, paragoni, diminutivi («casettina» / “little house” / „Häuslein“). UI: stringhe in `js/i18n.js`; le pagine di prosa (regole) sono blocchi `.lang-block` in `index.html`.

## Dati e account

L'app salva in localStorage e, con login, sincronizza su Firestore (vince il più recente).
Con Firebase configurato si sbloccano **login con Google**, **email/password** e il **salvataggio cloud** (i quaderni ti seguono su ogni dispositivo).

### Attivare Firebase (una volta sola, ~10 minuti)

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) → **Aggiungi progetto** (es. `desideri-101`). Google Analytics non serve.
2. Nella home del progetto: **⚙️ → Impostazioni progetto → Le tue app → Web `</>`** → registra l'app e copia l'oggetto `firebaseConfig`.
3. Incollalo in `js/firebase-config.js` (`window.FIREBASE_CONFIG = { ... }`). Le chiavi non sono segrete: possono stare nel repo.
4. **Authentication → Sign-in method**: attiva **Google** e **Email/password**.
5. **Authentication → Settings → Authorized domains**: aggiungi `cryptopannoz.github.io` (e in futuro il dominio custom).
6. **Firestore Database → Crea database** (produzione, region `eur3`), poi in **Regole** incolla:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /utenti/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Ogni utente può leggere e scrivere **solo il proprio** documento: i desideri restano privati.

## Sicurezza e privacy

La `apiKey` in `js/firebase-config.js` è **pubblica per progetto**: nelle app web Firebase è un identificativo, non una password, ed è per progetto visibile nel codice del browser ([doc ufficiale](https://firebase.google.com/docs/projects/api-keys)). Gli scanner di segreti la segnalano lo stesso: **non va revocata** — revocarla romperebbe l'app senza aumentare la sicurezza.

I dati sono protetti da tre livelli, tutti attivi:

1. **Regole Firestore** (`firestore.rules`): ogni utente autenticato legge e scrive solo `utenti/{suo-uid}`. Nessun utente può vedere i desideri di un altro.
2. **Authorized domains** (Firebase Auth): il login funziona solo dai domini registrati.
3. **Restrizioni della chiave** (Google Cloud → APIs & Services → Credentials): referrer consentiti (`cryptopannoz.github.io`, i domini Firebase, localhost) e sole API `identitytoolkit`, `securetoken`, `firestore`, `firebaseinstallations`, `fcmregistrations`.

> **Cambio di dominio:** aggiorna sia gli *Authorized domains* di Auth sia i *referrer consentiti* della chiave, altrimenti il login smette di funzionare.

Nota di trasparenza: il proprietario del progetto Firebase può tecnicamente vedere i documenti dalla console (vale per qualunque app non end-to-end encrypted). Per questo l'app promette che *nessun altro utente* può leggere i desideri, non che siano illeggibili in assoluto.

## Deploy

GitHub Pages dal branch `main` (cartella root). Ogni `git push` aggiorna il sito.
Per il dominio custom: Settings → Pages → Custom domain, poi CNAME dal DNS.

---
*«Mettetene anche di assurdi: sono quelli che si realizzano prima.» — Igor Sibaldi*
