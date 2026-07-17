// ── 101 Desideri — app principale ────────────────────────────────
import { validate, countWords } from "./validator.js";

const STORAGE_KEY = "desideri101.v1";
const MAX_BRUTTA = 150;
const MAX_BELLA = 101;
const GOAL_DAYS = 365;

// ── stato ──
let state = load();
let editingId = null;         // desiderio in modifica
let pendingConfirm = false;   // "salva comunque" dopo i warning
let reading = { list: [], idx: 0 };
let fb = null;                // { auth, db, user, ... } se Firebase attivo

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* dati corrotti: si riparte */ }
  return { wishes: [], readings: [], updatedAt: 0 };
}

function persist() {
  state.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  cloudSave();
  renderAll();
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const $ = (id) => document.getElementById(id);

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(msg, ms = 2600) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), ms);
}

// ── routing ──
const ROUTES = ["regole", "brutta", "bella", "lettura", "account"];
function route() {
  const r = (location.hash.replace("#/", "") || "regole").split("?")[0];
  const view = ROUTES.includes(r) ? r : "regole";
  ROUTES.forEach(v => $("view-" + v).classList.toggle("hidden", v !== view));
  document.querySelectorAll("#mainNav a, .tabbar a").forEach(a =>
    a.classList.toggle("active", a.dataset.route === view));
  if (view !== "lettura") exitReadingMode();
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", route);

// ── rendering ──
function bellaWishes() {
  return state.wishes.filter(w => w.inBella).sort((a, b) => (a.bellaOrder ?? 0) - (b.bellaOrder ?? 0));
}

function renderAll() {
  renderCounters();
  renderBrutta();
  renderBella();
  renderLettura();
  renderDataInfo();
}

function renderCounters() {
  const nBrutta = state.wishes.length;
  const bella = bellaWishes();
  const active = bella.filter(w => !w.realized).length;
  $("navCountBrutta").textContent = nBrutta;
  $("navCountBella").textContent = active;
  $("countBrutta").textContent = nBrutta;
  $("progressBrutta").style.width = Math.min(100, nBrutta / MAX_BRUTTA * 100) + "%";
  $("countBella").textContent = active;
  $("countRealized").textContent = bella.filter(w => w.realized).length;
  $("countReserve").textContent = state.wishes.filter(w => !w.inBella).length;
  $("progressBella").style.width = Math.min(100, active / MAX_BELLA * 100) + "%";
}

function wishHTML(w) {
  const rest = esc(w.text.replace(/^io voglio\s*/i, ""));
  return `<span class="iv">Io voglio</span> ${rest}`;
}

function renderBrutta() {
  const q = ($("searchBrutta").value || "").toLowerCase();
  const hideBella = $("hideInBella").checked;
  const list = $("listBrutta");
  const items = state.wishes
    .filter(w => !q || w.text.toLowerCase().includes(q))
    .filter(w => !hideBella || !w.inBella);
  list.innerHTML = items.map((w, i) => `
    <li class="wish-item ${w.realized ? "realized" : ""}" data-id="${w.id}">
      <span class="num">${state.wishes.indexOf(w) + 1}.</span>
      <span class="text">${wishHTML(w)}</span>
      ${w.inBella ? '<span class="badge-bella">in bella ✒️</span>' : ""}
      <span class="wish-actions">
        <button class="icon-btn" data-act="star" title="${w.inBella ? "Togli dalla bella" : "Promuovi in bella"}">${w.inBella ? "⭐" : "☆"}</button>
        <button class="icon-btn" data-act="edit" title="Modifica">✏️</button>
        <button class="icon-btn" data-act="del" title="Elimina">🗑</button>
      </span>
    </li>`).join("");
  $("emptyBrutta").classList.toggle("hidden", state.wishes.length > 0);
  renderMilestone();
}

const MILESTONES = {
  9: "🍷 Nove desideri! Verso il nono… bevi qualcosa: hai appena sistemato questa vita e anche quella dopo. Ne mancano solo 141.",
  30: "⛏️ Trenta! «Ma non è possibile…» E invece sì. Da qui comincia lo scavo vero.",
  50: "🌍 Cinquanta! Da qui in poi scopri continenti interiori: America, Australia, Polinesia. E rileggi i primi 15: quanto sei cresciuto in queste settimane?",
  101: "✨ Centouno! Potresti già scegliere, ma Igor dice: arriva a 150. I 49 in più saranno la tua riserva.",
  150: "🏆 CENTOCINQUANTA! Quaderno di brutta completo. Ora la parte più noiosa (e magica): scegli i 101 con la stellina ⭐ e passali in bella."
};
function renderMilestone() {
  const n = state.wishes.length;
  const keys = Object.keys(MILESTONES).map(Number).filter(k => k <= n);
  const last = keys[keys.length - 1];
  const box = $("milestoneBox");
  if (last && n - last < 4) {   // mostra il traguardo per un po'
    box.textContent = MILESTONES[last];
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
  }
}

function renderBella() {
  const bella = bellaWishes();
  const active = bella.filter(w => !w.realized).length;
  const notice = $("bellaNotice");
  if (bella.length === 0) {
    notice.classList.add("hidden");
  } else if (active < MAX_BELLA) {
    notice.textContent = `Ne hai ${active} attivi: per l'esercizio completo devono essere sempre 101. ${state.wishes.filter(w => !w.inBella).length > 0 ? "Promuovi dalla riserva in brutta ⭐" : "Scrivi ancora in brutta ✏️"}`;
    notice.classList.remove("hidden");
  } else if (active > MAX_BELLA) {
    notice.textContent = `Sono ${active}: uno di troppo… la bella ne vuole esattamente 101. Riporta qualcuno in brutta ↩️`;
    notice.classList.remove("hidden");
  } else {
    notice.textContent = "✒️ 101 esatti. Ora: lettura una volta al giorno, per conto tuo, senza dirlo a nessuno.";
    notice.classList.remove("hidden");
  }
  $("listBella").innerHTML = bella.map((w, i) => `
    <li class="wish-item ${w.realized ? "realized" : ""}" data-id="${w.id}">
      <span class="num">${i + 1}.</span>
      <span class="text">${wishHTML(w)}</span>
      ${w.realized ? '<span class="cross">✗ realizzato</span>' : ""}
      <span class="wish-actions">
        <button class="icon-btn" data-act="realize" title="${w.realized ? "Riattiva" : "Crocetta rossa: realizzato!"}">${w.realized ? "↺" : "✗"}</button>
        <button class="icon-btn" data-act="unstar" title="Riporta in brutta">↩️</button>
      </span>
    </li>`).join("");
  $("emptyBella").classList.toggle("hidden", bella.length > 0);
}

// ── form desiderio (brutta) ──
const wishInput = $("wishInput");
const feedback = $("wishFeedback");

function liveValidate() {
  const rest = wishInput.value;
  const res = validate(rest, state.wishes, editingId);
  const counter = $("wordCounter");
  counter.textContent = `${res.wordCount} / 14 parole`;
  counter.classList.toggle("over", res.wordCount > 14);
  feedback.innerHTML =
    res.errors.map(e => `<div class="fb fb-error">⛔ ${esc(e)}</div>`).join("") +
    res.warnings.map(w => `<div class="fb fb-warn">⚠️ ${esc(w)}</div>`).join("") +
    res.advice.map(a => `<div class="fb fb-ok">💡 ${esc(a)}</div>`).join("");
  return res;
}
wishInput.addEventListener("input", () => {
  pendingConfirm = false;
  $("wishSubmit").textContent = editingId ? "Salva la modifica" : "Aggiungi al quaderno";
  liveValidate();
});

$("wishForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rest = wishInput.value.trim().replace(/\.+$/, "");
  if (!rest) { wishInput.focus(); return; }
  const res = validate(rest, state.wishes, editingId);
  if (res.errors.length) { liveValidate(); toast("Ci sono regole da sistemare ⛔"); return; }
  if (res.warnings.length && !pendingConfirm) {
    liveValidate();
    pendingConfirm = true;
    $("wishSubmit").textContent = "Va bene così, salva comunque";
    return;
  }
  const text = "Io voglio " + rest;
  if (editingId) {
    const w = state.wishes.find(w => w.id === editingId);
    if (w) { w.text = text; w.updatedAt = Date.now(); }
    toast("Desiderio riscritto ✏️");
    stopEditing();
  } else {
    if (state.wishes.length >= MAX_BRUTTA) { toast("Hai già 150 desideri: il quaderno di brutta è pieno!"); return; }
    state.wishes.push({ id: uid(), text, inBella: false, bellaOrder: null, realized: false, createdAt: Date.now(), updatedAt: Date.now() });
    toast("Scritto nel quaderno ✨");
  }
  wishInput.value = "";
  pendingConfirm = false;
  feedback.innerHTML = "";
  $("wordCounter").textContent = "2 / 14 parole";
  $("wordCounter").classList.remove("over");
  persist();
  wishInput.focus();
});

function startEditing(w) {
  editingId = w.id;
  wishInput.value = w.text.replace(/^io voglio\s*/i, "");
  $("wishSubmit").textContent = "Salva la modifica";
  $("wishCancelEdit").classList.remove("hidden");
  liveValidate();
  location.hash = "#/brutta";
  wishInput.focus();
  wishInput.scrollIntoView({ behavior: "smooth", block: "center" });
}
function stopEditing() {
  editingId = null;
  $("wishSubmit").textContent = "Aggiungi al quaderno";
  $("wishCancelEdit").classList.add("hidden");
}
$("wishCancelEdit").addEventListener("click", () => {
  wishInput.value = ""; feedback.innerHTML = ""; stopEditing();
});

$("searchBrutta").addEventListener("input", renderBrutta);
$("hideInBella").addEventListener("change", renderBrutta);

// azioni sulle liste (event delegation)
$("listBrutta").addEventListener("click", onListClick);
$("listBella").addEventListener("click", onListClick);
function onListClick(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".wish-item").dataset.id;
  const w = state.wishes.find(w => w.id === id);
  if (!w) return;
  const act = btn.dataset.act;

  if (act === "star") {
    const activeBella = bellaWishes().filter(x => !x.realized).length;
    if (activeBella >= MAX_BELLA) { toast("La bella è piena: 101 esatti. Prima liberane uno."); return; }
    w.inBella = true;
    w.bellaOrder = Math.max(0, ...bellaWishes().map(x => x.bellaOrder ?? 0)) + 1;
    toast("Promosso in bella ✒️");
  }
  if (act === "unstar") { w.inBella = false; w.bellaOrder = null; w.realized = false; toast("Riportato in brutta"); }
  if (act === "edit") { startEditing(w); return; }
  if (act === "del") {
    if (!confirm("Cancellare questo desiderio?\n\n« " + w.text + " »")) return;
    state.wishes = state.wishes.filter(x => x.id !== id);
    if (editingId === id) { wishInput.value = ""; stopEditing(); }
    toast("Cancellato 🗑");
  }
  if (act === "realize") {
    w.realized = !w.realized;
    if (w.realized) {
      const reserve = state.wishes.filter(x => !x.inBella).length;
      toast(reserve > 0
        ? "✗ Crocetta rossa! Ora promuovi uno dei " + reserve + " di riserva: sempre 101."
        : "✗ Crocetta rossa! La riserva è vuota: scrivine di nuovi in brutta.", 4200);
    }
  }
  persist();
}

// ── lettura quotidiana ──
function renderLettura() {
  const days = state.readings;
  $("streakTotal").textContent = Math.min(days.length, GOAL_DAYS);
  $("streakCurrent").textContent = currentStreak();
  const done = days.includes(todayStr());
  $("streakToday").textContent = done ? "✓" : "—";
  $("startReading").textContent = done ? "Rileggi (oggi l'hai già fatto ✓)" : "Inizia la lettura di oggi 📖";
}
function currentStreak() {
  const set = new Set(state.readings);
  let streak = 0;
  const d = new Date();
  if (!set.has(todayStr())) d.setDate(d.getDate() - 1); // la serie può continuare oggi
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

$("startReading").addEventListener("click", () => {
  reading.list = bellaWishes();
  if (reading.list.length === 0) {
    toast("La bella è vuota: prima scegli i desideri ⭐"); return;
  }
  reading.idx = 0;
  $("readingIntro").classList.add("hidden");
  $("readingDone").classList.add("hidden");
  $("readingMode").classList.remove("hidden");
  showReadingCard();
});
function showReadingCard() {
  const w = reading.list[reading.idx];
  $("readingProgress").textContent = `${reading.idx + 1} di ${reading.list.length}`;
  $("readingCard").innerHTML = "<div>" + wishHTML(w) + (w.realized ? ' <span class="cross">✗</span>' : "") + "</div>";
  $("readPrev").disabled = reading.idx === 0;
  $("readNext").textContent = reading.idx === reading.list.length - 1 ? "Fine ✨" : "avanti →";
}
$("readPrev").addEventListener("click", () => { if (reading.idx > 0) { reading.idx--; showReadingCard(); } });
$("readNext").addEventListener("click", () => {
  if (reading.idx < reading.list.length - 1) { reading.idx++; showReadingCard(); return; }
  // finita la lettura di oggi
  if (!state.readings.includes(todayStr())) state.readings.push(todayStr());
  $("readingMode").classList.add("hidden");
  $("readingDone").classList.remove("hidden");
  persist();
});
document.addEventListener("keydown", (e) => {
  if ($("readingMode").classList.contains("hidden")) return;
  if (e.key === "ArrowRight" || e.key === " ") $("readNext").click();
  if (e.key === "ArrowLeft") $("readPrev").click();
});
// swipe sul telefono per sfogliare
let touchX = null;
$("readingCard").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
$("readingCard").addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 45) return;
  dx < 0 ? $("readNext").click() : $("readPrev").click();
}, { passive: true });

$("exitReading").addEventListener("click", exitReadingMode);
$("backFromDone").addEventListener("click", () => { location.hash = "#/lettura"; exitReadingMode(); });
function exitReadingMode() {
  $("readingMode").classList.add("hidden");
  $("readingDone").classList.add("hidden");
  $("readingIntro").classList.remove("hidden");
}

// ── account / Firebase ──
$("accountBtn").addEventListener("click", () => { location.hash = "#/account"; });

const AUTH_ERRORS = {
  "auth/invalid-email": "L'email non sembra valida.",
  "auth/user-not-found": "Nessun account con questa email: prova «Crea un account».",
  "auth/wrong-password": "Password sbagliata.",
  "auth/invalid-credential": "Email o password sbagliate.",
  "auth/email-already-in-use": "C'è già un account con questa email: usa «Entra».",
  "auth/weak-password": "Password troppo corta: minimo 6 caratteri.",
  "auth/popup-closed-by-user": "Login annullato.",
  "auth/network-request-failed": "Problema di rete: riprova."
};
function authError(e) {
  const box = $("authError");
  box.textContent = AUTH_ERRORS[e.code] || ("Errore: " + (e.message || e));
  box.classList.remove("hidden");
}

async function initFirebase() {
  if (!window.FIREBASE_CONFIG) {
    $("localModeNote").classList.remove("hidden");
    $("syncBanner").textContent = "📓 Modalità locale: i quaderni sono salvati solo su questo dispositivo.";
    $("syncBanner").classList.remove("hidden");
    $("googleLogin").disabled = true;
    return;
  }
  try {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = initializeApp(window.FIREBASE_CONFIG);
    fb = {
      auth: authMod.getAuth(app),
      db: fsMod.getFirestore(app),
      authMod, fsMod, user: null
    };
    authMod.onAuthStateChanged(fb.auth, async (user) => {
      fb.user = user;
      renderAuth();
      if (user) await cloudFirstSync();
    });
  } catch (e) {
    console.error("Firebase init fallita:", e);
    $("syncBanner").textContent = "⚠️ Cloud non raggiungibile: modalità locale.";
    $("syncBanner").classList.remove("hidden");
  }
}

function renderAuth() {
  const logged = fb && fb.user;
  $("authLoggedOut").classList.toggle("hidden", !!logged);
  $("authLoggedIn").classList.toggle("hidden", !logged);
  $("authError").classList.add("hidden");
  $("accountLabel").textContent = logged ? (fb.user.displayName || fb.user.email).split(" ")[0].split("@")[0] : "Accedi";
  if (logged) {
    $("userEmail").textContent = fb.user.email;
    $("syncStatus").textContent = "☁️ Quaderni sincronizzati nel cloud.";
    $("syncBanner").classList.add("hidden");
  } else if (fb) {
    $("syncBanner").textContent = "📓 Non sei collegato: i quaderni restano su questo dispositivo. Accedi per salvarli nel cloud.";
    $("syncBanner").classList.remove("hidden");
  }
}

// primo sync dopo il login: vince il più recente
async function cloudFirstSync() {
  try {
    const { doc, getDoc } = fb.fsMod;
    const snap = await getDoc(doc(fb.db, "utenti", fb.user.uid));
    if (snap.exists()) {
      const cloud = snap.data();
      if ((cloud.updatedAt || 0) > (state.updatedAt || 0)) {
        state = { wishes: cloud.wishes || [], readings: cloud.readings || [], updatedAt: cloud.updatedAt };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        toast("☁️ Quaderni scaricati dal cloud");
        return;
      }
    }
    await cloudSave(true);
  } catch (e) { console.error("Sync:", e); }
}

let saveTimer = null;
function cloudSave(now = false) {
  if (!fb || !fb.user) return;
  clearTimeout(saveTimer);
  const doSave = async () => {
    try {
      const { doc, setDoc } = fb.fsMod;
      await setDoc(doc(fb.db, "utenti", fb.user.uid),
        { wishes: state.wishes, readings: state.readings, updatedAt: state.updatedAt, email: fb.user.email });
    } catch (e) { console.error("Salvataggio cloud:", e); }
  };
  now ? doSave() : (saveTimer = setTimeout(doSave, 900));
}

$("googleLogin").addEventListener("click", async () => {
  if (!fb) return;
  try {
    await fb.authMod.signInWithPopup(fb.auth, new fb.authMod.GoogleAuthProvider());
  } catch (e) { authError(e); }
});
$("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fb) { authError({ message: "Cloud non configurato (vedi README)." }); return; }
  try {
    await fb.authMod.signInWithEmailAndPassword(fb.auth, $("authEmail").value, $("authPassword").value);
  } catch (err) { authError(err); }
});
$("signupBtn").addEventListener("click", async () => {
  if (!fb) { authError({ message: "Cloud non configurato (vedi README)." }); return; }
  if (!$("authEmail").value || $("authPassword").value.length < 6) {
    authError({ code: "auth/weak-password" }); return;
  }
  try {
    await fb.authMod.createUserWithEmailAndPassword(fb.auth, $("authEmail").value, $("authPassword").value);
    toast("Account creato ✨ Benvenuto!");
  } catch (err) { authError(err); }
});
$("resetPwd").addEventListener("click", async () => {
  if (!fb) return;
  if (!$("authEmail").value) { authError({ code: "auth/invalid-email" }); return; }
  try {
    await fb.authMod.sendPasswordResetEmail(fb.auth, $("authEmail").value);
    toast("Email di recupero inviata 📧");
  } catch (err) { authError(err); }
});
$("logoutBtn").addEventListener("click", async () => {
  await fb.authMod.signOut(fb.auth);
  toast("Sei uscito. I dati restano anche su questo dispositivo.");
});

// ── backup / ripristino ──
function renderDataInfo() {
  $("dataInfo").textContent =
    `${state.wishes.length} desideri (${bellaWishes().length} in bella) · ${state.readings.length} letture registrate su questo dispositivo.`;
}
$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ app: "101-desideri", exportedAt: new Date().toISOString(), ...state }, null, 2)],
    { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `101-desideri-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("Backup scaricato 📥 Conservalo (Drive, iCloud, email a te stesso…)");
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.wishes)) throw new Error("formato non riconosciuto");
    const ok = confirm(`Il backup contiene ${data.wishes.length} desideri e ${(data.readings || []).length} letture.\n\nSostituisce quello che c'è adesso qui (${state.wishes.length} desideri). Procedo?`);
    if (!ok) return;
    state = { wishes: data.wishes, readings: data.readings || [], updatedAt: Date.now() };
    persist();
    renderDataInfo();
    toast("Quaderni ripristinati ✨");
  } catch (err) {
    toast("⚠️ File non valido: serve un backup creato da questa app.", 4000);
  }
});

// ── avvio ──
route();
renderAll();
initFirebase();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
