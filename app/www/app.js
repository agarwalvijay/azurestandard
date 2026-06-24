/*
 * Azure Standard — native shell bootstrap.
 *
 * Runs once on cold start from the LOCAL splash page. It initializes the
 * native features that must be owned by us (push registration + AdMob), then
 * hands the WebView over to the live store. The native push token and AdMob
 * setup persist after we navigate away, so everything keeps working while the
 * user shops azurestandard.com.
 */

const CONFIG = {
  // The live store the WebView takes over once bootstrap finishes.
  STORE_URL: "https://www.azurestandard.com/",

  // Push backend (deployed on atsumilabs.com behind nginx + Let's Encrypt).
  BACKEND_URL: "https://azurestandard.atsumilabs.com",

  // Show a push-registration diagnostic on the splash and pause there on
  // failure (instead of silently continuing). Flip on when debugging push.
  DEBUG_PUSH: false,
};

const $ = (id) => document.getElementById(id);
const setStatus = (msg) => { const el = $("status"); if (el) el.textContent = msg; };

function cap() { return window.Capacitor; }
function plugin(name) {
  const c = cap();
  return c && c.Plugins ? c.Plugins[name] : undefined;
}
function isNative() {
  const c = cap();
  return !!(c && typeof c.isNativePlatform === "function" && c.isNativePlatform());
}
function platform() {
  const c = cap();
  return c && typeof c.getPlatform === "function" ? c.getPlatform() : "web";
}

/* -------------------------------------------------------- diagnostics --- */

const dbg = {
  platform: "?",
  plugin: "?",
  permBefore: "?",
  permAfter: "?",
  register: "?",
  token: "(none)",
  backend: "(not attempted)",
  regError: "(none)",
  sent: false,
};

function renderDebug() {
  if (!CONFIG.DEBUG_PUSH) return;
  let pre = $("debug");
  if (!pre) {
    pre = document.createElement("pre");
    pre.id = "debug";
    pre.style.cssText =
      "text-align:left;font-size:11px;line-height:1.5;color:#26412f;background:#eef3ec;" +
      "border:1px solid #cdddc8;border-radius:8px;padding:10px 12px;margin:14px 16px 0;" +
      "max-width:520px;white-space:pre-wrap;word-break:break-word;";
    document.querySelector(".splash").appendChild(pre);
  }
  pre.textContent =
    "PUSH DIAGNOSTIC\n" +
    "platform     : " + dbg.platform + "\n" +
    "plugin       : " + dbg.plugin + "\n" +
    "perm before  : " + dbg.permBefore + "\n" +
    "perm after   : " + dbg.permAfter + "\n" +
    "register()   : " + dbg.register + "\n" +
    "token        : " + dbg.token + "\n" +
    "backend POST : " + dbg.backend + "\n" +
    "regError     : " + dbg.regError;
}

function showContinueButton() {
  if ($("continueBtn")) return;
  const b = document.createElement("button");
  b.id = "continueBtn";
  b.textContent = "Continue to store →";
  b.style.cssText =
    "margin:14px auto 0;display:block;padding:12px 22px;font-size:15px;font-weight:600;" +
    "color:#fff;background:#6a8f3c;border:none;border-radius:10px;";
  b.onclick = goToStore;
  document.querySelector(".splash").appendChild(b);
}

/* ---------------------------------------------------------------- push --- */

async function initPush() {
  dbg.platform = platform();
  const Push = plugin("PushNotifications");
  dbg.plugin = Push ? "present" : "MISSING";
  renderDebug();
  if (!Push) return;

  // The token arrives asynchronously via 'registration'. Capture AND send it
  // BEFORE the WebView navigates away, or this page's JS (and this listener)
  // is torn down and the token is lost.
  let settle;
  const tokenSettled = new Promise((resolve) => { settle = resolve; });

  await Push.addListener("registration", async (token) => {
    dbg.token = token.value ? token.value.slice(0, 18) + "…(" + token.value.length + ")" : "(empty)";
    renderDebug();
    await sendTokenToBackend(token.value);
    dbg.sent = true;
    settle("sent");
  });
  await Push.addListener("registrationError", (err) => {
    dbg.regError = (err && (err.error || err.message)) ? (err.error || err.message) : JSON.stringify(err);
    renderDebug();
    settle("error");
  });
  await Push.addListener("pushNotificationReceived", (n) => console.log("[push] received", n));
  await Push.addListener("pushNotificationActionPerformed", (action) => {
    const link = action && action.notification && action.notification.data && action.notification.data.url;
    if (link) window.location.href = link;
  });

  try {
    dbg.permBefore = (await Push.checkPermissions()).receive;
  } catch (e) { dbg.permBefore = "check threw: " + e.message; }
  renderDebug();

  let status = dbg.permBefore;
  if (status === "prompt" || status === "prompt-with-rationale") {
    try { status = (await Push.requestPermissions()).receive; }
    catch (e) { status = "request threw: " + e.message; }
  }
  dbg.permAfter = status;
  renderDebug();

  if (status === "granted") {
    try { await Push.register(); dbg.register = "ok"; }
    catch (e) { dbg.register = "THREW: " + e.message; }
    renderDebug();
    const outcome = await Promise.race([
      tokenSettled,
      new Promise((r) => setTimeout(() => r("timeout"), 10000)),
    ]);
    if (outcome === "timeout") dbg.token = dbg.token === "(none)" ? "(none — 10s timeout)" : dbg.token;
    renderDebug();
  } else {
    dbg.register = "skipped (permission " + status + ")";
    renderDebug();
  }
}

async function sendTokenToBackend(token) {
  try {
    const Device = plugin("Device");
    let deviceId = null;
    try { const info = Device ? await Device.getId() : {}; deviceId = info.identifier || info.uuid || null; } catch (_) {}
    const res = await fetch(CONFIG.BACKEND_URL + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, platform: platform(), deviceId }),
    });
    dbg.backend = "HTTP " + res.status + (res.ok ? " ✓" : " ✗");
  } catch (e) {
    dbg.backend = "FETCH FAILED: " + e.message;
  }
  renderDebug();
}

/* ----------------------------------------------------------- handoff ---- */

function goToStore() {
  setStatus("Opening Azure Standard…");
  window.location.href = CONFIG.STORE_URL;
}

async function bootstrap() {
  if (!isNative()) {
    setStatus("Opening store (web preview)…");
    return goToStore();
  }

  setStatus("Setting up notifications…");
  await initPush().catch((e) => { dbg.regError = "init threw: " + e.message; renderDebug(); });

  const Splash = plugin("SplashScreen");
  if (Splash) { try { await Splash.hide(); } catch (_) {} }

  // In debug mode, pause on the splash if registration didn't fully succeed so
  // the diagnostic stays readable; otherwise continue to the store.
  if (CONFIG.DEBUG_PUSH && !dbg.sent) {
    setStatus("Notifications not registered — details below:");
    renderDebug();
    showContinueButton();
    return;
  }

  if (CONFIG.DEBUG_PUSH && dbg.sent) {
    setStatus("✓ Notifications registered — opening store…");
    setTimeout(goToStore, 1500);
    return;
  }

  goToStore();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bootstrap, 700);
});
