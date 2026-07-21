# 101-desideri — istruzioni per Claude

App web statica (vanilla JS, nessun build) per la tecnica dei **101 desideri di Igor Sibaldi**.

- **Repo:** CryptoPannoz/101-desideri · **Deploy:** GitHub Pages (branch `main`, root) → https://cryptopannoz.github.io/101-desideri/ (dominio custom previsto in futuro)
- **Auth/cloud:** Firebase (Google + email/password, Firestore). Config in `js/firebase-config.js` — finché è `null` l'app gira in modalità locale (localStorage). Le chiavi Firebase web NON sono segrete e possono stare nel repo; le regole Firestore sono nel README.
- **File chiave:** `js/validator.js` contiene le regole di Igor (errori bloccanti vs avvisi vs consigli) — se cambi una regola aggiorna anche le card in `index.html` e la tabella nel README.
- ⚖️ **Attribuzione:** app **indipendente, non affiliata né approvata da Igor Sibaldi** (disclaimer in `disclaimer` / `disclaimer_short` in `js/i18n.js`, mostrato nel footer e nella schermata di benvenuto). **Non inserire mai** testi, esempi o citazioni tratti dai suoi libri/seminari: le spiegazioni delle regole devono restare redazionali e originali. Il suo nome va usato solo in senso descrittivo ("ispirata alla tecnica di…"), mai come marchio dell'app o nel dominio. Dettagli e criteri nel README.
- **Lingue:** trilingue IT/EN/DE. Stringhe UI e messaggi del validatore in `js/i18n.js` (chiavi `t()`); la prosa delle regole è in blocchi `.lang-block` dentro `index.html`. Il validatore ha liste di parole per lingua in `js/validator.js` — se aggiungi una regola, aggiornala in tutte e tre.
- **Percorso UX:** login (o «prova senza account») → regole (gate `desideri101.rulesRead`) → brutta/bella/lettura/realizzati. Realizzato = spunta verde ✓ (`realized` + `realizedAt`); i realizzati restano nella lettura.
- Quando pubblichi modifiche, incrementa `CACHE` in `sw.js`.
- Niente framework/bundler: mantieni vanilla JS con moduli ES, deve funzionare aprendo `index.html` su Pages.
