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

  // Push backend (see /backend). For LAN testing this is the Mac's WiFi IP;
  // swap for your deployed HTTPS URL in production.
  BACKEND_URL: "http://192.168.1.231:8080",

  // --- AdMob: wired now, ads OFF until you flip ADS_ENABLED. ---
  // Replace the test IDs with your real AdMob unit IDs when ready.
  // NOTE: the AdMob *App ID* (ca-app-pub-XXX~YYY) is configured in the native
  // manifests, not here — see README. These are the per-placement *unit* IDs.
  ADS_ENABLED: false,
  AD_UNIT_BANNER_ANDROID: "ca-app-pub-3940256099942544/6300978111", // Google test banner
  AD_UNIT_BANNER_IOS: "ca-app-pub-3940256099942544/2934735716",     // Google test banner
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

/* ---------------------------------------------------------------- push --- */

async function initPush() {
  const Push = plugin("PushNotifications");
  if (!Push) { console.warn("[push] plugin unavailable"); return; }

  // Token arrives via the 'registration' event.
  await Push.addListener("registration", (token) => {
    console.log("[push] token", token.value);
    sendTokenToBackend(token.value);
  });
  await Push.addListener("registrationError", (err) => {
    console.error("[push] registration error", err);
  });
  // Foreground delivery.
  await Push.addListener("pushNotificationReceived", (n) => {
    console.log("[push] received (foreground)", n);
  });
  // User tapped a notification — optionally deep-link into the store.
  await Push.addListener("pushNotificationActionPerformed", (action) => {
    console.log("[push] tapped", action);
    const link = action && action.notification && action.notification.data && action.notification.data.url;
    if (link) window.location.href = link;
  });

  const perm = await Push.checkPermissions();
  let status = perm.receive;
  if (status === "prompt" || status === "prompt-with-rationale") {
    status = (await Push.requestPermissions()).receive;
  }
  if (status === "granted") {
    await Push.register(); // fires 'registration' with the device token
  } else {
    console.warn("[push] permission not granted:", status);
  }
}

async function sendTokenToBackend(token) {
  try {
    const Device = plugin("Device");
    const info = Device ? await Device.getId() : { identifier: null };
    await fetch(CONFIG.BACKEND_URL + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: platform(),
        deviceId: info.identifier || info.uuid || null,
      }),
    });
    console.log("[push] token registered with backend");
  } catch (e) {
    // Non-fatal: a missing backend must never block the user from shopping.
    console.warn("[push] backend register failed (non-fatal):", e.message);
  }
}

/* --------------------------------------------------------------- admob --- */

async function initAdMob() {
  const AdMob = plugin("AdMob");
  if (!AdMob) { console.warn("[admob] plugin unavailable"); return; }
  try {
    await AdMob.initialize({
      requestTrackingAuthorization: true, // iOS ATT prompt (IDFA) for future ad targeting
      initializeForTesting: !CONFIG.ADS_ENABLED,
    });
    console.log("[admob] initialized (ads enabled:", CONFIG.ADS_ENABLED + ")");

    if (CONFIG.ADS_ENABLED) {
      const adId = platform() === "ios"
        ? CONFIG.AD_UNIT_BANNER_IOS
        : CONFIG.AD_UNIT_BANNER_ANDROID;
      await AdMob.showBanner({
        adId,
        position: "BOTTOM_CENTER",
        margin: 0,
      });
    }
  } catch (e) {
    console.warn("[admob] init failed (non-fatal):", e.message);
  }
}

/* ----------------------------------------------------------- handoff ---- */

function goToStore() {
  setStatus("Opening Azure Standard…");
  window.location.href = CONFIG.STORE_URL;
}

async function bootstrap() {
  // In a desktop browser (dev) there are no native plugins — just redirect.
  if (!isNative()) {
    setStatus("Opening store (web preview)…");
    return goToStore();
  }

  setStatus("Setting up notifications…");
  await initPush().catch((e) => console.warn("[push] init failed", e));

  setStatus("Finishing setup…");
  await initAdMob().catch((e) => console.warn("[admob] init failed", e));

  // Hide the native splash (if still up) and hand off to the store.
  const Splash = plugin("SplashScreen");
  if (Splash) { try { await Splash.hide(); } catch (_) {} }

  goToStore();
}

document.addEventListener("DOMContentLoaded", () => {
  // Small delay so the brand splash is actually seen on fast devices.
  setTimeout(bootstrap, 700);
});
