/*
 * Azure Standard — push backend (Firebase Cloud Messaging).
 *
 * Endpoints:
 *   POST /register  { token, platform, deviceId }  -> store a device token
 *   POST /send      { title, body, url?, tokens? }  -> push to all (or given) tokens
 *   GET  /tokens                                    -> list stored tokens (debug)
 *   GET  /health
 *
 * Tokens are persisted to ./tokens.json (swap for a real DB in production).
 * Auth: set ADMIN_KEY in .env and pass it as the `x-admin-key` header on /send.
 */

import "dotenv/config";
import express from "express";
import admin from "firebase-admin";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_FILE = join(__dirname, "tokens.json");
const PORT = process.env.PORT || 8080;
const ADMIN_KEY = process.env.ADMIN_KEY || "";

/* --- Firebase Admin init ------------------------------------------------ */
// Provide service-account creds via GOOGLE_APPLICATION_CREDENTIALS (path) or
// SERVICE_ACCOUNT_JSON (inline JSON). See .env.example + README.
function initFirebase() {
  if (process.env.SERVICE_ACCOUNT_JSON) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_JSON)),
    });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS env var.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  console.log("[fcm] firebase-admin initialized");
}
initFirebase();

/* --- token store -------------------------------------------------------- */
function loadTokens() {
  if (!existsSync(TOKENS_FILE)) return {};
  try { return JSON.parse(readFileSync(TOKENS_FILE, "utf8")); }
  catch { return {}; }
}
function saveTokens(map) {
  writeFileSync(TOKENS_FILE, JSON.stringify(map, null, 2));
}

/* --- app ---------------------------------------------------------------- */
const app = express();
app.use(express.json());

// CORS — the app's WebView posts from origin https://localhost (and
// capacitor://localhost on iOS), a different origin than this server, so the
// browser requires these headers (and a 204 to the OPTIONS preflight).
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/register", (req, res) => {
  const { token, platform, deviceId } = req.body || {};
  if (!token) return res.status(400).json({ error: "token required" });
  const tokens = loadTokens();
  tokens[token] = { platform: platform || "unknown", deviceId: deviceId || null, ts: Date.now() };
  saveTokens(tokens);
  console.log(`[register] ${platform} token …${token.slice(-8)}`);
  res.json({ ok: true, count: Object.keys(tokens).length });
});

app.get("/tokens", (_req, res) => {
  const tokens = loadTokens();
  res.json({ count: Object.keys(tokens).length, tokens: Object.keys(tokens) });
});

app.post("/send", async (req, res) => {
  if (ADMIN_KEY && req.get("x-admin-key") !== ADMIN_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const { title, body, url, tokens: only } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: "title and body required" });

  const store = loadTokens();
  const targets = (only && only.length ? only : Object.keys(store));
  if (!targets.length) return res.status(200).json({ ok: true, sent: 0, note: "no registered tokens" });

  const message = {
    notification: { title, body },
    data: url ? { url: String(url) } : {},
    tokens: targets,
  };

  try {
    const resp = await admin.messaging().sendEachForMulticast(message);
    // Prune tokens FCM reports as permanently invalid.
    const pruned = [];
    resp.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token") {
        delete store[targets[i]];
        pruned.push(targets[i]);
      }
    });
    if (pruned.length) saveTokens(store);
    res.json({ ok: true, sent: resp.successCount, failed: resp.failureCount, pruned: pruned.length });
  } catch (e) {
    console.error("[send] error", e);
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
