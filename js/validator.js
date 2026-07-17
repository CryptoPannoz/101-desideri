// ── Validatore dei desideri secondo le regole di Igor Sibaldi ────
// Multilingue: le liste di parole dipendono dalla lingua dell'interfaccia.
// Restituisce { errors, warnings, advice, wordCount } con messaggi già localizzati.
import { t, lang, PREFIX_RE } from "./i18n.js";

const L = {
it: {
  neg: ["non", "mai", "niente", "nulla", "nessuno", "nessuna", "nessun", "senza", "né", "neanche", "neppure", "nemmeno", "no"],
  negHidden: ["incolume", "illeso", "illesa", "indenne", "immune", "smettere", "smetta", "evitare", "eviti", "perdere", "togliere", "eliminare", "liberarmi", "liberami"],
  money: ["soldi", "soldo", "denaro", "denari", "contanti", "euro", "eur", "dollari", "dollaro", "sterline", "sterlina", "lire", "lira", "franchi", "bitcoin", "milione", "milioni", "miliardo", "miliardi", "stipendio"],
  compWords: ["come"],
  compPhrases: ["più di", "piu di", "meno di", "meglio di", "peggio di", "al pari di", "uguale a"],
  love: ["amore", "amare", "amato", "amata", "innamor", "fidanzat", "sposare", "matrimonio", "sesso", "sessual", "storia", "storie", "relazione"],
  dimSuffix: ["ino", "ina", "ini", "ine", "etto", "etta", "etti", "ette", "uccio", "uccia", "ucci", "ucce", "olino", "olina"],
  dimOk: new Set(["macchina","cucina","collina","pagina","medicina","piscina","vetrina","cantina","farina","benzina","dozzina","rovina","mattina","mattino","giardino","vino","destino","cammino","casino","cugino","cugina","bambino","bambina","bambini","bambine","vicino","vicina","latino","marino","marina","alpino","torino","berlino","molino","mulino","tetto","letto","petto","netto","retto","ghetto","getto","corretto","perfetto","perfetta","progetto","progetti","oggetto","oggetti","effetto","affetto","aspetto","rispetto","architetto","biglietto","biglietti","concetto","difetto","dialetto","insetto","tragitto","bicicletta","biciclette","ricetta","ricette","vendetta","fretta","etichetta","barzelletta","pallina","regina","colline"]),
  dimWords: [],
  wishVerbs: /\b(desidero|vorrei|mi piacerebbe|spero)\b/i,
  prefixDup: /^(io\s+)?(voglio|desidero|vorrei)\b/i,
  forOthers: [/^\s*che\s+(mio|mia|i miei|le mie|lui|lei|loro|tu|voi)\b/i, /\bvoglio che\b/i, /\b(guarisca|guariscano|sia felice|siano felici|trovi lavoro)\b/i],
  forOthersOk: /fare in modo/i,
  stop: new Set(["io","voglio","il","lo","la","i","gli","le","un","uno","una","di","a","da","in","con","su","per","tra","fra","e","che","del","della","dello","dei","delle","degli","al","alla","allo","ai","alle","agli","nel","nella","mio","mia","miei","mie","ogni","più","molto","tanto","essere","avere","fare","modo"]),
  objects: /\b(macchina|auto|automobile|moto|barca|casa|appartamento|orologio)\b/i
},
en: {
  neg: ["not", "never", "no", "none", "nothing", "without", "don't", "dont", "won't", "wont", "can't", "cant", "neither", "nor"],
  negHidden: ["unharmed", "unscathed", "immune", "avoid", "stop", "quit", "lose", "eliminate", "escape", "rid"],
  money: ["money", "cash", "euro", "euros", "dollar", "dollars", "pound", "pounds", "franc", "francs", "million", "millions", "billion", "billions", "salary", "bitcoin"],
  compWords: ["than"],
  compPhrases: ["as tall as", "as rich as", "as good as", "same as", "just like", "equal to"],
  love: ["love", "romance", "romantic", "boyfriend", "girlfriend", "marry", "marriage", "wedding", "sex", "sexual", "affair", "relationship"],
  dimSuffix: [],
  dimOk: new Set(),
  dimWords: ["little", "tiny", "cute", "wee"],
  wishVerbs: /\b(i wish|i would like|i'd like|i hope|i desire|it would be nice)\b/i,
  prefixDup: /^(i\s+)?(want|wish|would like)\b/i,
  forOthers: [/^\s*that\s+(my|his|her|their)\b/i, /\b(my|our)\s+\w+\s+(to (recover|heal|get)|recovers|heals|gets better|gets well|finds a job|to be happy)\b/i],
  forOthersOk: /arrange things|make it so/i,
  stop: new Set(["i","want","the","a","an","to","of","in","on","at","with","for","and","my","our","be","have","get","is","that","every","more","very"]),
  objects: /\b(car|motorbike|boat|house|apartment|flat|watch)\b/i
},
de: {
  neg: ["nicht", "nie", "niemals", "kein", "keine", "keinen", "keiner", "keinem", "keins", "nichts", "ohne", "niemand", "weder", "noch"],
  negHidden: ["unversehrt", "vermeiden", "aufhören", "aufhöre", "verlieren", "loswerden", "beseitigen", "entkommen"],
  money: ["geld", "bargeld", "euro", "euros", "dollar", "dollars", "pfund", "franken", "million", "millionen", "milliarde", "milliarden", "gehalt", "bitcoin"],
  compWords: [],
  compPhrases: ["so groß wie", "so reich wie", "so gut wie", "mehr als", "weniger als", "besser als", "genauso wie", "gleich wie"],
  love: ["liebe", "lieben", "verliebt", "freund", "freundin", "heiraten", "hochzeit", "sex", "sexuell", "beziehung", "affäre", "romanze"],
  dimSuffix: ["lein", "chen"],
  dimOk: new Set(["kuchen","sachen","lachen","machen","wochen","knochen","zeichen","drachen","rachen","suchen","kochen","sprechen","brauchen","besuchen","versuchen","brechen","riechen","kriechen","zwischen","münchen","mädchen","gleichen","reichen","zeichnen","kirchen","chen"]),
  dimWords: [],
  wishVerbs: /\b(ich möchte|ich wünsche|ich hätte gern|ich hoffe|es wäre schön)\b/i,
  prefixDup: /^(ich\s+)?(will|möchte|wünsche)\b/i,
  forOthers: [/^\s*dass\s+(mein|meine|er|sie|ihr)\b/i, /\bwill,?\s*dass\b/i, /\b(gesund wird|gesund werden|geheilt|arbeit findet|glücklich ist|glücklich sind)\b/i],
  forOthersOk: /dafür sorgen/i,
  stop: new Set(["ich","will","der","die","das","den","dem","des","ein","eine","einen","einer","einem","zu","von","in","an","auf","mit","für","und","mein","meine","meinen","sein","haben","werden","ist","jede","jeden","mehr","sehr","dass"]),
  objects: /\b(auto|wagen|motorrad|boot|haus|wohnung|uhr)\b/i
}
};

const cur = () => L[lang] || L.it;

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[.;:!?"«»„“()]/g, " ")
    .split(/\s+/)
    .map(w => w.replace(/,+$/g, "").trim())
    .filter(Boolean);
}

export function countWords(fullText) {
  const words = fullText.trim().split(/\s+/).filter(Boolean).length;
  const commas = (fullText.match(/,/g) || []).length;
  return words + commas;
}

function isDiminutivo(word, D) {
  const w = word.toLowerCase().replace(/[^a-zäöüßàèéìòù]/g, "");
  if (D.dimWords.includes(w)) return true;
  if (w.length < 6 || D.dimOk.has(w)) return false;
  return D.dimSuffix.some(s => w.endsWith(s) && w.length >= s.length + 3);
}

function significantWords(text, D) {
  return tokenize(text).filter(w => !D.stop.has(w) && w.length > 2);
}

export function similarity(a, b, D = cur()) {
  const A = new Set(significantWords(a, D));
  const B = new Set(significantWords(b, D));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

/**
 * @param {string} rest - il testo DOPO il prefisso («Io voglio» / «I want» / «Ich will»)
 * @param {Array} existing - desideri esistenti [{id, text}]
 * @param {string|null} editingId - id in modifica (escluso dal confronto seriale)
 * @param {string} prefix - prefisso nella lingua corrente
 */
export function validate(rest, existing = [], editingId = null, prefix = "Io voglio") {
  const D = cur();
  const full = prefix + " " + rest.trim();
  const errors = [], warnings = [], advice = [];
  const tokens = tokenize(rest);
  const wordCount = countWords(full);

  if (!rest.trim()) return { errors, warnings, advice, wordCount: 2, empty: true };

  // Regola 1 — prefisso corretto, niente condizionali
  if (D.prefixDup.test(rest.trim())) warnings.push(t("v_prefix_dup"));
  if (D.wishVerbs.test(rest)) errors.push(t("v_r1"));

  // Regola 2 — negazioni
  const neg = [...new Set(tokens.filter(x => D.neg.includes(x)))];
  if (neg.length) errors.push(t("v_r2", { w: neg.join(", ") }));
  const negH = [...new Set(tokens.filter(x => D.negHidden.some(n => x.startsWith(n))))];
  if (negH.length) warnings.push(t("v_r2h", { w: negH.join(", ") }));

  // Regola 3 — max 14 parole (virgole = 1 parola)
  if (wordCount > 14) errors.push(t("v_r3", { n: wordCount }));

  // Regola 4 (consiglio) — amore con persone precise
  const haAmore = tokens.some(x => D.love.some(a => x.startsWith(a)));
  const nomi = rest.match(/(?<!^)(?<![.!?]\s)\b[A-ZÄÖÜÀÈÉÌÒÙ][a-zäöüßàèéìòù]{2,}\b/g) || [];
  if (haAmore && nomi.length) advice.push(t("v_r4", { w: nomi.join(", ") }));
  else if (haAmore && /\b(con|with|mit)\s+[A-ZÄÖÜÀÈÉÌÒÙ][a-zäöüßàèéìòù]+/.test(rest)) advice.push(t("v_r4b"));

  // Regola 5 — paragoni
  const comp = D.compWords.filter(p => tokens.includes(p))
    .concat(D.compPhrases.filter(p => rest.toLowerCase().includes(p)));
  if (comp.length) warnings.push(t("v_r5", { w: comp.join(", ") }));

  // Regola 6 — desideri seriali
  for (const w of existing) {
    if (editingId && w.id === editingId) continue;
    if (similarity(full, w.text, D) >= 0.75) { warnings.push(t("v_r6", { w: w.text })); break; }
  }

  // Regola 7 — soldi
  const soldi = [...new Set(tokens.filter(x => D.money.includes(x))
    .concat([...rest.matchAll(/[€$£]/g)].map(m => m[0])))];
  if (soldi.length) errors.push(t("v_r7", { w: soldi.join(", ") }));

  // Regola 8 — chiedere per gli altri
  if (!D.forOthersOk.test(rest) && D.forOthers.some(re => re.test(rest))) warnings.push(t("v_r8"));

  // Regola 9 — diminutivi
  const dim = [...new Set(tokens.filter(x => isDiminutivo(x, D)))];
  if (dim.length) warnings.push(t("v_r9", { w: dim.join(", ") }));

  // Consiglio precisione
  if (D.objects.test(rest) && !/\b(19|20)\d{2}\b/.test(rest) && wordCount <= 6) advice.push(t("v_adv"));

  return { errors, warnings, advice, wordCount, empty: false };
}
