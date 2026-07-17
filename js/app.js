// ── 101 Desideri — app principale ────────────────────────────────
import { validate, countWords } from "./validator.js";
import { t, lang, setLang, applyI18n, LANGS, PREFIX, PREFIX_RE } from "./i18n.js";

const STORAGE_KEY = "desideri101.v1";
const RULES_KEY = "desideri101.rulesRead";
const SKIP_KEY = "desideri101.skipLogin";
const MAX_BRUTTA = 150;
const MAX_BELLA = 101;
const GOAL_DAYS = 365;

// ── stato ──
let state = load();
let editingId = null;
let pendingConfirm = false;
let reading = { list: [], idx: 0 };
let fb = null;                 // Firebase attivo
let authResolved = false;      // primo onAuthStateChanged ricevuto

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
// le regole si leggono solo al primissimo accesso: se hai già desideri
// in brutta (anche arrivati dal cloud) non ha senso rileggerle.
const rulesKey = () => RULES_KEY + "." + (fb && fb.user ? fb.user.uid : "local");
const rulesRead = () =>
  state.wishes.length > 0 ||
  localStorage.getItem(rulesKey()) === "1" ||
  localStorage.getItem(RULES_KEY) === "1";
const skippedLogin = () => sessionStorage.getItem(SKIP_KEY) === "1";

function esc(s) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function toast(msg, ms = 2600) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), ms);
}

// ── percorso UX: login → regole → quaderni ──
function needsLogin() {
  if (!window.FIREBASE_CONFIG) return false;          // modalità locale pura
  if (skippedLogin()) return false;
  if (!authResolved) return true;                      // in attesa: resta sul benvenuto
  return !(fb && fb.user);
}
function updateGates() {
  document.body.classList.toggle("locked", !rulesRead());
  document.body.classList.toggle("welcome-mode", needsLogin());
  const first = !rulesRead();
  $("rulesCta").textContent = first ? t("rules_cta_first") : t("rules_cta");
}

// ── routing ──
const ROUTES = ["benvenuto", "regole", "brutta", "bella", "realizzati", "lettura"];
const GATED = ["brutta", "bella", "realizzati", "lettura"];
function route() {
  // senza hash: se le regole di questo accesso sono già lette si parte dalla brutta
  const fallback = rulesRead() ? "brutta" : "regole";
  let r = (location.hash.replace("#/", "") || fallback).split("?")[0];
  if (!ROUTES.includes(r)) r = fallback;
  if (needsLogin()) r = "benvenuto";
  else if (r === "benvenuto") r = "regole";
  else if (GATED.includes(r) && !rulesRead()) r = "regole";
  ROUTES.forEach(v => $("view-" + v).classList.toggle("hidden", v !== r));
  document.querySelectorAll("#mainNav a, .tabbar a").forEach(a =>
    a.classList.toggle("active", a.dataset.route === r));
  if (r !== "lettura") exitReadingMode();
  window.scrollTo({ top: 0 });
}
window.addEventListener("hashchange", route);

// ── lingua ──
function refreshLangUI() {
  document.querySelectorAll("#langSwitch button").forEach(b =>
    b.classList.toggle("active", b.dataset.lang === lang));
  applyI18n();
  updateGates();
  renderAll();
}
$("langSwitch").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-lang]");
  if (!b) return;
  setLang(b.dataset.lang);
  $("authError").classList.add("hidden");   // un eventuale errore resterebbe nella lingua vecchia
  refreshLangUI();
  liveValidate();
});

// ── rendering ──
const bellaWishes = () =>
  state.wishes.filter(w => w.inBella).sort((a, b) => (a.bellaOrder ?? 0) - (b.bellaOrder ?? 0));
const doneWishes = () =>
  state.wishes.filter(w => w.realized).sort((a, b) => (b.realizedAt ?? 0) - (a.realizedAt ?? 0));

function renderAll() {
  renderCounters();
  renderBrutta();
  renderBella();
  renderDone();
  renderLettura();
  renderAuthUI();
}

function renderCounters() {
  const nBrutta = state.wishes.length;
  const active = bellaWishes().filter(w => !w.realized).length;
  $("navCountBrutta").textContent = nBrutta;
  $("navCountBella").textContent = active;
  $("navCountDone").textContent = doneWishes().length;
  $("tabCountBrutta").textContent = nBrutta || "";
  $("tabCountBella").textContent = active || "";
  $("progressBrutta").style.width = Math.min(100, nBrutta / MAX_BRUTTA * 100) + "%";
  $("labelBrutta").textContent = t("rough_count", { n: nBrutta });
  $("progressBella").style.width = Math.min(100, active / MAX_BELLA * 100) + "%";
  $("labelBella").textContent = t("fair_count", { n: active, r: state.wishes.filter(w => !w.inBella).length });
}

function wishHTML(w) {
  const m = w.text.match(PREFIX_RE);
  const pfx = m ? m[0].trim() : PREFIX[lang];
  const rest = esc(w.text.replace(PREFIX_RE, ""));
  return `<span class="iv">${esc(pfx)}</span> ${rest}`;
}

function renderBrutta() {
  const q = ($("searchBrutta").value || "").toLowerCase();
  const hideBella = $("hideInBella").checked;
  const items = state.wishes
    .filter(w => !q || w.text.toLowerCase().includes(q))
    .filter(w => !hideBella || !w.inBella);
  $("listBrutta").innerHTML = items.map(w => `
    <li class="wish-item ${w.realized ? "realized" : ""}" data-id="${w.id}">
      <span class="num">${state.wishes.indexOf(w) + 1}.</span>
      <span class="text">${wishHTML(w)}${w.realized ? ' <span class="check">✓</span>' : ""}</span>
      ${w.inBella ? `<span class="badge-bella">${t("badge_fair")}</span>` : ""}
      <span class="wish-actions">
        <button class="icon-btn" data-act="star" title="${w.inBella ? t("act_demote") : t("act_promote")}">${w.inBella ? "⭐" : "☆"}</button>
        <button class="icon-btn" data-act="edit" title="${t("act_edit")}">✏️</button>
        <button class="icon-btn" data-act="del" title="${t("act_del")}">🗑</button>
      </span>
    </li>`).join("");
  $("emptyBrutta").classList.toggle("hidden", state.wishes.length > 0);
  renderMilestone();
}

const MILESTONE_KEYS = { 9: "m9", 30: "m30", 50: "m50", 101: "m101", 150: "m150" };
function renderMilestone() {
  const n = state.wishes.length;
  const keys = Object.keys(MILESTONE_KEYS).map(Number).filter(k => k <= n);
  const last = keys[keys.length - 1];
  const box = $("milestoneBox");
  if (last && n - last < 4) {
    box.textContent = t(MILESTONE_KEYS[last]);
    box.classList.remove("hidden");
  } else box.classList.add("hidden");
}

function renderBella() {
  const activeList = bellaWishes().filter(w => !w.realized);
  const notice = $("bellaNotice");
  if (bellaWishes().length === 0) notice.classList.add("hidden");
  else {
    notice.classList.remove("hidden");
    const reserve = state.wishes.filter(w => !w.inBella).length;
    if (activeList.length < MAX_BELLA)
      notice.textContent = t(reserve > 0 ? "fair_low" : "fair_low_empty", { n: activeList.length });
    else notice.textContent = t("fair_exact");
  }
  $("listBella").innerHTML = activeList.map((w, i) => `
    <li class="wish-item" data-id="${w.id}">
      <span class="num">${i + 1}.</span>
      <span class="text">${wishHTML(w)}</span>
      <span class="wish-actions">
        <button class="icon-btn" data-act="realize" title="${t("act_done")}">✓</button>
        <button class="icon-btn" data-act="edit" title="${t("act_edit")}">✏️</button>
        <button class="icon-btn" data-act="unstar" title="${t("act_back")}">↩️</button>
      </span>
    </li>`).join("");
  $("emptyBella").classList.toggle("hidden", bellaWishes().length > 0);
}

function renderDone() {
  const done = doneWishes();
  $("doneCounter").textContent = done.length ? t("done_count", { n: done.length }) : "";
  const locales = { it: "it-IT", en: "en-GB", de: "de-DE" };
  $("listDone").innerHTML = done.map(w => `
    <li class="wish-item" data-id="${w.id}">
      <span class="check-big">✓</span>
      <span class="text">${wishHTML(w)}
        ${w.realizedAt ? `<span class="done-date">${t("done_on", { d: new Date(w.realizedAt).toLocaleDateString(locales[lang]) })}</span>` : ""}
      </span>
      <span class="wish-actions">
        <button class="icon-btn" data-act="realize" title="${t("act_undone")}">↺</button>
      </span>
    </li>`).join("");
  $("emptyDone").classList.toggle("hidden", done.length > 0);
}

// ── form desiderio ──
const wishInput = $("wishInput");
const feedback = $("wishFeedback");

function liveValidate() {
  const res = validate(wishInput.value, state.wishes, editingId, PREFIX[lang]);
  const counter = $("wordCounter");
  counter.textContent = t("words_count", { n: res.wordCount });
  counter.classList.toggle("over", res.wordCount > 14);
  feedback.innerHTML =
    res.errors.map(x => `<div class="fb fb-error">⛔ ${esc(x)}</div>`).join("") +
    res.warnings.map(x => `<div class="fb fb-warn">⚠️ ${esc(x)}</div>`).join("") +
    res.advice.map(x => `<div class="fb fb-ok">💡 ${esc(x)}</div>`).join("");
  return res;
}
wishInput.addEventListener("input", () => {
  pendingConfirm = false;
  $("wishSubmit").textContent = editingId ? t("btn_save") : t("btn_add");
  liveValidate();
});

$("wishForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const rest = wishInput.value.trim().replace(/\.+$/, "");
  if (!rest) { wishInput.focus(); return; }
  const res = validate(rest, state.wishes, editingId, PREFIX[lang]);
  if (res.errors.length) { liveValidate(); toast(t("t_fix")); return; }
  if (res.warnings.length && !pendingConfirm) {
    liveValidate();
    pendingConfirm = true;
    $("wishSubmit").textContent = t("btn_save_anyway");
    return;
  }
  const text = PREFIX[lang] + " " + rest;
  if (editingId) {
    const w = state.wishes.find(x => x.id === editingId);
    if (w) { w.text = text; w.updatedAt = Date.now(); }
    toast(t("t_edited"));
    stopEditing();
  } else {
    if (state.wishes.length >= MAX_BRUTTA) { toast(t("t_rough_full")); return; }
    state.wishes.push({ id: uid(), text, inBella: false, bellaOrder: null, realized: false, realizedAt: null, createdAt: Date.now(), updatedAt: Date.now() });
    toast(t("t_added"));
  }
  wishInput.value = "";
  pendingConfirm = false;
  feedback.innerHTML = "";
  persist();
  $("wishSubmit").textContent = t("btn_add");
  $("wordCounter").textContent = t("words_count", { n: 2 });
  $("wordCounter").classList.remove("over");
  wishInput.focus();
});

function startEditing(w) {
  editingId = w.id;
  wishInput.value = w.text.replace(PREFIX_RE, "");
  $("wishSubmit").textContent = t("btn_save");
  $("wishCancelEdit").classList.remove("hidden");
  liveValidate();
  location.hash = "#/brutta";
  wishInput.focus();
  wishInput.scrollIntoView({ behavior: "smooth", block: "center" });
}
function stopEditing() {
  editingId = null;
  $("wishSubmit").textContent = t("btn_add");
  $("wishCancelEdit").classList.add("hidden");
}
$("wishCancelEdit").addEventListener("click", () => {
  wishInput.value = ""; feedback.innerHTML = ""; stopEditing();
});

$("searchBrutta").addEventListener("input", renderBrutta);
$("hideInBella").addEventListener("change", renderBrutta);

// azioni sulle liste
["listBrutta", "listBella", "listDone"].forEach(id => $(id).addEventListener("click", onListClick));
function onListClick(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".wish-item").dataset.id;
  const w = state.wishes.find(x => x.id === id);
  if (!w) return;
  const act = btn.dataset.act;

  if (act === "star") {
    if (w.inBella) {
      w.inBella = false; w.bellaOrder = null; w.realized = false; w.realizedAt = null;
      toast(t("t_demoted"));
    } else {
      const active = bellaWishes().filter(x => !x.realized).length;
      if (active >= MAX_BELLA) { toast(t("t_fair_full")); return; }
      w.inBella = true;
      w.bellaOrder = Math.max(0, ...bellaWishes().map(x => x.bellaOrder ?? 0)) + 1;
      toast(t("t_promoted"));
    }
  }
  if (act === "unstar") { w.inBella = false; w.bellaOrder = null; w.realized = false; w.realizedAt = null; toast(t("t_demoted")); }
  if (act === "edit") { startEditing(w); return; }
  if (act === "del") {
    if (!confirm(t("confirm_del") + "\n\n« " + w.text + " »")) return;
    state.wishes = state.wishes.filter(x => x.id !== id);
    if (editingId === id) { wishInput.value = ""; stopEditing(); }
    toast(t("t_deleted"));
  }
  if (act === "realize") {
    w.realized = !w.realized;
    w.realizedAt = w.realized ? Date.now() : null;
    if (w.realized) {
      const reserve = state.wishes.filter(x => !x.inBella).length;
      toast(reserve > 0 ? t("t_done", { r: reserve }) : t("t_done_noreserve"), 4200);
    }
  }
  persist();
}

// ── regole → sblocco quaderni ──
$("rulesCta").addEventListener("click", () => {
  localStorage.setItem(rulesKey(), "1");
  updateGates();
  location.hash = "#/brutta";
});

// ── lettura quotidiana ──
function renderLettura() {
  $("streakTotal").textContent = Math.min(state.readings.length, GOAL_DAYS);
  $("streakCurrent").textContent = currentStreak();
  const done = state.readings.includes(todayStr());
  $("streakToday").textContent = done ? "✓" : "—";
  $("startReading").textContent = done ? t("btn_reread") : t("btn_start_reading");
}
function currentStreak() {
  const set = new Set(state.readings);
  let streak = 0;
  const d = new Date();
  if (!set.has(todayStr())) d.setDate(d.getDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

$("startReading").addEventListener("click", () => {
  reading.list = bellaWishes();               // realizzati compresi: fa parte della tecnica
  if (reading.list.length === 0) { toast(t("t_empty_fair")); return; }
  reading.idx = 0;
  $("readingIntro").classList.add("hidden");
  $("readingDone").classList.add("hidden");
  $("readingMode").classList.remove("hidden");
  showReadingCard();
});
function showReadingCard() {
  const w = reading.list[reading.idx];
  $("readingProgress").textContent = t("reading_progress", { i: reading.idx + 1, n: reading.list.length });
  $("readingCard").innerHTML = "<div>" + wishHTML(w) + (w.realized ? ' <span class="check">✓</span>' : "") + "</div>";
  $("readPrev").disabled = reading.idx === 0;
  $("readNext").textContent = reading.idx === reading.list.length - 1 ? t("btn_fin") : t("btn_next");
}
$("readPrev").addEventListener("click", () => { if (reading.idx > 0) { reading.idx--; showReadingCard(); } });
$("readNext").addEventListener("click", () => {
  if (reading.idx < reading.list.length - 1) { reading.idx++; showReadingCard(); return; }
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

// ── Firebase / autenticazione ──
const AUTH_ERR_KEY = {
  "auth/invalid-email": "e_invalid_email",
  "auth/user-not-found": "e_user_not_found",
  "auth/wrong-password": "e_wrong",
  "auth/invalid-credential": "e_wrong",
  "auth/email-already-in-use": "e_inuse",
  "auth/weak-password": "e_weak",
  "auth/popup-closed-by-user": "e_popup",
  "auth/cancelled-popup-request": "e_popup",
  "auth/network-request-failed": "e_net"
};
function authError(e) {
  const box = $("authError");
  box.textContent = AUTH_ERR_KEY[e.code] ? t(AUTH_ERR_KEY[e.code]) : t("e_generic", { m: e.message || e });
  box.classList.remove("hidden");
}

function renderAuthUI() {
  const logged = fb && fb.user;
  $("profileChip").classList.toggle("hidden", !logged);
  if (logged) $("profileName").textContent = (fb.user.displayName || fb.user.email).split(" ")[0].split("@")[0];
  const banner = $("syncBanner");
  if (!window.FIREBASE_CONFIG) { banner.textContent = t("banner_local"); banner.classList.remove("hidden"); }
  else if (authResolved && !logged) { banner.textContent = t("banner_loggedout"); banner.classList.remove("hidden"); }
  else banner.classList.add("hidden");
}

async function initFirebase() {
  if (!window.FIREBASE_CONFIG) { authResolved = true; updateGates(); route(); renderAuthUI(); return; }
  $("authLoading").classList.remove("hidden");
  $("authForms").classList.add("hidden");
  try {
    const [{ initializeApp }, authMod, fsMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);
    const app = initializeApp(window.FIREBASE_CONFIG);
    fb = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), authMod, fsMod, user: null };
    authMod.onAuthStateChanged(fb.auth, async (user) => {
      const firstResolve = !authResolved;
      const wasLoggedOut = !fb.user;
      authResolved = true;
      fb.user = user;
      $("authLoading").classList.add("hidden");
      $("authForms").classList.remove("hidden");
      updateGates(); route(); renderAuthUI();
      if (user) {
        await cloudFirstSync();
        updateGates(); route();   // i desideri dal cloud possono sbloccare le regole
        if (!firstResolve && wasLoggedOut) location.hash = rulesRead() ? "#/brutta" : "#/regole";
      }
    });
  } catch (e) {
    console.error("Firebase init fallita:", e);
    authResolved = true;
    $("syncBanner").textContent = t("banner_offline");
    $("syncBanner").classList.remove("hidden");
    updateGates(); route();
  }
}

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
        toast(t("t_synced"));
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
  try { await fb.authMod.signInWithPopup(fb.auth, new fb.authMod.GoogleAuthProvider()); }
  catch (e) { authError(e); }
});
$("emailForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!fb) return;
  try { await fb.authMod.signInWithEmailAndPassword(fb.auth, $("authEmail").value, $("authPassword").value); }
  catch (err) { authError(err); }
});
$("signupBtn").addEventListener("click", async () => {
  if (!fb) return;
  if (!$("authEmail").value || $("authPassword").value.length < 6) { authError({ code: "auth/weak-password" }); return; }
  try {
    await fb.authMod.createUserWithEmailAndPassword(fb.auth, $("authEmail").value, $("authPassword").value);
    toast(t("t_signup_ok"));
  } catch (err) { authError(err); }
});
$("resetPwd").addEventListener("click", async () => {
  if (!fb) return;
  if (!$("authEmail").value) { authError({ code: "auth/invalid-email" }); return; }
  try { await fb.authMod.sendPasswordResetEmail(fb.auth, $("authEmail").value); toast(t("t_reset_sent")); }
  catch (err) { authError(err); }
});
$("skipLogin").addEventListener("click", () => {
  sessionStorage.setItem(SKIP_KEY, "1");
  updateGates(); route(); renderAuthUI();
});
$("profileChip").addEventListener("click", async () => {
  if (!fb || !fb.user) return;
  if (!confirm(t("logout_confirm"))) return;
  await fb.authMod.signOut(fb.auth);
  toast(t("logout_done"));
  updateGates(); route(); renderAuthUI();
});
$("syncBanner").addEventListener("click", () => {
  if (window.FIREBASE_CONFIG && fb && !fb.user) {
    sessionStorage.removeItem(SKIP_KEY);
    updateGates(); route();
  }
});

// ── avvio ──
setLang(lang);                 // imposta la classe lang-* sul body
refreshLangUI();
$("wishSubmit").textContent = t("btn_add");
$("wordCounter").textContent = t("words_count", { n: 2 });
$("startReading").textContent = t("btn_start_reading");
$("readNext").textContent = t("btn_next");
updateGates();
route();
renderAll();
initFirebase();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
