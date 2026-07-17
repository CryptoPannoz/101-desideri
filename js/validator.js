// ── Validatore dei desideri secondo le regole di Igor Sibaldi ────
// Restituisce { errors: [...], warnings: [...], advice: [...], wordCount }
// errors  → violano una regola (bloccano il salvataggio)
// warnings→ probabilmente violano una regola (si può salvare comunque)
// advice  → i "consigli" di Igor (mai bloccanti)

const NEGAZIONI = ["non", "mai", "niente", "nulla", "nessuno", "nessuna", "nessun", "senza", "né", "neanche", "neppure", "nemmeno", "no"];
const NEGAZIONI_NASCOSTE = ["incolume", "illeso", "illesa", "indenne", "immune", "smettere", "smetta", "evitare", "eviti", "perdere", "togliere", "eliminare", "liberarmi", "liberami"];
const SOLDI = ["soldi", "soldo", "denaro", "denari", "contanti", "euro", "eur", "dollari", "dollaro", "sterline", "sterlina", "lire", "lira", "franchi", "bitcoin", "milione", "milioni", "miliardo", "miliardi", "stipendio", "€", "$", "£"];
const PARAGONI_PAROLE = ["come"];
const PARAGONI_FRASI = ["più di", "piu di", "meno di", "meglio di", "peggio di", "quanto lui", "quanto lei", "al pari di", "uguale a"];
const AMORE = ["amore", "amare", "amato", "amata", "innamorare", "innamorato", "innamorata", "fidanzato", "fidanzata", "sposare", "matrimonio", "sesso", "sessuale", "sessuali", "storia", "storie", "relazione"];

// diminutivi: euristica sui suffissi + lista di falsi positivi da ignorare
const SUFFISSI_DIM = ["ino", "ina", "ini", "ine", "etto", "etta", "etti", "ette", "uccio", "uccia", "ucci", "ucce", "ottino", "olino", "olina"];
const NON_DIMINUTIVI = new Set([
  "macchina", "cucina", "collina", "pagina", "medicina", "piscina", "vetrina", "cantina", "farina",
  "benzina", "dozzina", "rovina", "mattina", "mattino", "giardino", "vino", "destino", "cammino",
  "casino", "cugino", "cugina", "bambino", "bambina", "bambini", "bambine", "vicino", "vicina",
  "latino", "marino", "marina", "alpino", "torino", "berlino", "domino", "molino", "mulino",
  "tetto", "letto", "petto", "netto", "retto", "ghetto", "getto", "corretto", "perfetto", "perfetta",
  "progetto", "progetti", "oggetto", "oggetti", "effetto", "affetto", "aspetto", "rispetto",
  "architetto", "biglietto", "biglietti", "concetto", "difetto", "dialetto", "insetto", "tragitto",
  "bicicletta", "biciclette", "ricetta", "ricette", "vendetta", "fretta", "etichetta", "barzelletta",
  "pallina", "regina", "colline", "salutino"
]);
const STOPWORDS = new Set(["io", "voglio", "il", "lo", "la", "i", "gli", "le", "un", "uno", "una", "di", "a", "da", "in", "con", "su", "per", "tra", "fra", "e", "che", "del", "della", "dello", "dei", "delle", "degli", "al", "alla", "allo", "ai", "alle", "agli", "nel", "nella", "mio", "mia", "miei", "mie", "ogni", "più", "molto", "tanto", "essere", "avere", "fare", "modo"]);

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[.;:!?"«»()]/g, " ")
    .split(/\s+/)
    .map(w => w.replace(/,+$/g, "").trim())
    .filter(Boolean);
}

export function countWords(fullText) {
  const words = fullText.trim().split(/\s+/).filter(Boolean).length;
  const commas = (fullText.match(/,/g) || []).length;
  return words + commas;
}

function isDiminutivo(word) {
  const w = word.toLowerCase().replace(/[^a-zàèéìòù]/g, "");
  if (w.length < 6 || NON_DIMINUTIVI.has(w)) return false;
  return SUFFISSI_DIM.some(s => w.endsWith(s) && w.length >= s.length + 3);
}

function significantWords(text) {
  return tokenize(text).filter(w => !STOPWORDS.has(w) && w.length > 2);
}

export function similarity(a, b) {
  const A = new Set(significantWords(a));
  const B = new Set(significantWords(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * @param {string} rest - il testo DOPO "Io voglio"
 * @param {Array} existing - desideri esistenti [{id, text}] (text = frase completa)
 * @param {string|null} editingId - id in modifica (escluso dal confronto seriale)
 */
export function validate(rest, existing = [], editingId = null) {
  const full = "Io voglio " + rest.trim();
  const errors = [];
  const warnings = [];
  const advice = [];
  const tokens = tokenize(rest);
  const wordCount = countWords(full);

  if (!rest.trim()) {
    return { errors: [], warnings: [], advice: [], wordCount: 2, empty: true };
  }

  // Regola 1 — deve restare "Io voglio ..." (l'utente potrebbe riscriverlo)
  if (/^(io\s+)?(voglio|desidero|vorrei)\b/i.test(rest.trim())) {
    warnings.push("«Io voglio» c'è già: scrivi solo quello che viene dopo.");
  }
  if (/\b(desidero|vorrei|mi piacerebbe|spero)\b/i.test(rest)) {
    errors.push("Regola 1 — Si dice «Io voglio», non «desidero / vorrei / mi piacerebbe». Il volere vuole risposte dirette.");
  }

  // Regola 2 — negazioni
  const negTrovate = tokens.filter(t => NEGAZIONI.includes(t));
  if (negTrovate.length) {
    errors.push(`Regola 2 — Il volere non capisce le negazioni: togli «${[...new Set(negTrovate)].join("», «")}». Riformula in positivo (es. «Io voglio stare perfettamente bene»).`);
  }
  const negNascoste = tokens.filter(t => NEGAZIONI_NASCOSTE.some(n => t.startsWith(n)));
  if (negNascoste.length) {
    warnings.push(`Regola 2 — «${[...new Set(negNascoste)].join("», «")}» nasconde una negazione o una mancanza: meglio dire cosa VUOI, non cosa vuoi evitare o superare.`);
  }

  // Regola 3 — max 14 parole (virgole = 1 parola)
  if (wordCount > 14) {
    errors.push(`Regola 3 — ${wordCount} parole: troppe. Massimo 14 (compreso «Io voglio», e le virgole valgono una parola). Deve stare in un solo fiato.`);
  }

  // Regola 4 (consiglio) — amore/sesso con persone precise
  const haAmore = tokens.some(t => AMORE.some(a => t.startsWith(a)));
  const nomiPropri = rest.match(/(?<!^)(?<![.!?]\s)\b[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,}\b/g) || [];
  if (haAmore && nomiPropri.length) {
    advice.push(`Consiglio 4 — In amore niente persone precise (${nomiPropri.join(", ")}): chiedi il fatto, «bellissime storie d'amore», e lascia aperta la porta.`);
  }
  if (/\bcon\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]+/.test(rest)) {
    advice.push("Consiglio 4 — Stai nominando una persona precisa? Meglio chiedere il fatto, senza nomi: il volere obbedisce troppo bene.");
  }

  // Regola 5 — paragoni
  const paragone = PARAGONI_PAROLE.filter(p => tokens.includes(p));
  const paragoneFrasi = PARAGONI_FRASI.filter(p => rest.toLowerCase().includes(p));
  if (paragone.length || paragoneFrasi.length) {
    warnings.push("Regola 5 — Sembra un paragone («" + [...paragone, ...paragoneFrasi].join("», «") + "»). Tu sei irripetibile: niente confronti, chiedi la TUA cosa.");
  }

  // Regola 6 — desideri seriali (somiglianza con quelli esistenti)
  for (const w of existing) {
    if (editingId && w.id === editingId) continue;
    if (similarity(full, w.text) >= 0.75) {
      warnings.push(`Regola 6 — Somiglia troppo a «${w.text}». Ogni desiderio deve essere originale e meravigliarti.`);
      break;
    }
  }

  // Regola 7 — soldi
  const soldi = tokens.filter(t => SOLDI.includes(t))
    .concat([...rest.matchAll(/[€$£]/g)].map(m => m[0]));
  if (soldi.length) {
    errors.push(`Regola 7 — Niente soldi («${[...new Set(soldi)].join("», «")}»): sono astratti. Chiedi la cosa, non la somma per comprarla.`);
  }

  // Regola 8 — chiedere per gli altri
  if (/^\s*che\s+(mio|mia|i miei|le mie|lui|lei|loro|tu|voi)\b/i.test(rest) ||
      /\bvoglio che\b/i.test(rest)) {
    warnings.push("Regola 8 — Stai chiedendo per un altro? Lo strumento è troppo forte. Riformula: «fare in modo che…» — il protagonista sei tu.");
  }
  if (/^\s*fare in modo che\b/i.test(rest.trim()) === false && /\b(guarisca|guariscano|trovi lavoro|sia felice|siano felici)\b/i.test(rest)) {
    warnings.push("Regola 8 — Se è per un'altra persona, usa «Io voglio fare in modo che…»: paghi tu, e l'altro resta libero.");
  }

  // Regola 9 — diminutivi
  const dim = tokens.filter(isDiminutivo);
  if (dim.length) {
    warnings.push(`Regola 9 — «${[...new Set(dim)].join("», «")}» sembra un diminutivo. Chiedi giusto: la realtà ti prende in parola (chiedi la casa, non la casettina).`);
  }

  // Consiglio precisione — oggetti senza dettagli
  if (/\b(macchina|auto|automobile|moto|barca|casa|appartamento|orologio)\b/i.test(rest) && !/\b(19|20)\d{2}\b/.test(rest) && wordCount <= 6) {
    advice.push("Consiglio — Sii preciso: metti anno, colore, dettagli («una Jaguar del 2001, blu») sennò ti rifilano boiate.");
  }

  return { errors, warnings, advice, wordCount, empty: false };
}
