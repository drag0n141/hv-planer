import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const bool = (v, d = false) =>
  v == null || v === "" ? d : ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
const num = (v, d) => {
  if (v == null || v === "") return d;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Ungültiger Zahlenwert: ${v}`);
  return n;
};
const list = (v) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Liest und prüft die Konfiguration aus Umgebungsvariablen.
 * Wirft bei fehlenden Pflichtwerten, damit Fehlkonfigurationen sofort auffallen.
 */
export function loadConfig(env = process.env) {
  const authDisabled = bool(env.AUTH_DISABLED);

  const cfg = {
    port: num(env.PORT, 8080),
    appUrl: String(env.APP_URL || "").replace(/\/+$/, ""),
    dbPath: env.DB_PATH || path.resolve(here, "../data/hv-planer.sqlite"),
    webDir: env.WEB_DIR || path.resolve(here, "../../web"),
    // Gebaute neue Oberfläche (app/dist), ausgeliefert unter /v2
    appDir: env.APP_DIR || path.resolve(here, "../../app/dist"),
    authDisabled,
    sessionSecret: env.SESSION_SECRET || "",
    sessionTtlSeconds: Math.round(num(env.SESSION_TTL_HOURS, 168) * 3600),
    historyKeep: Math.round(num(env.HISTORY_KEEP, 50)),
    historyMinIntervalMs: Math.round(num(env.HISTORY_MIN_INTERVAL_MINUTES, 10) * 60_000),
    maxBodyBytes: Math.round(num(env.MAX_BODY_MB, 5) * 1024 * 1024),
    oidc: {
      providerName: env.OIDC_PROVIDER_NAME || "OIDC Provider",
      issuer: env.OIDC_ISSUER_URL || "",
      clientId: env.OIDC_CLIENT_ID || "",
      // Ohne Secret: öffentlicher Client (nur PKCE)
      clientSecret: env.OIDC_CLIENT_SECRET || "",
      scopes: env.OIDC_SCOPES || "openid email profile",
      allowHttp: bool(env.OIDC_ALLOW_HTTP),
      // Mitglieder dieser Gruppe dürfen den Gerätekatalog pflegen. Leer = niemand.
      adminGroup: String(env.OIDC_ADMIN_GROUP || "").trim(),
      groupsClaim: String(env.OIDC_GROUPS_CLAIM || "groups").trim(),
    },
  };

  if (!authDisabled) {
    const missing = [];
    if (!cfg.appUrl) missing.push("APP_URL");
    if (!cfg.oidc.issuer) missing.push("OIDC_ISSUER_URL");
    if (!cfg.oidc.clientId) missing.push("OIDC_CLIENT_ID");
    if (!cfg.sessionSecret) missing.push("SESSION_SECRET");
    if (missing.length) {
      throw new Error(`Fehlende Konfiguration: ${missing.join(", ")}`);
    }
    if (cfg.sessionSecret.length < 32) {
      throw new Error("SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
    }
  }
  if (cfg.appUrl) new URL(cfg.appUrl); // früh scheitern bei ungültiger URL

  cfg.secureCookies = cfg.appUrl.startsWith("https://");
  // Redirect-URI, die im Identity Provider eingetragen werden muss
  cfg.redirectUri = cfg.appUrl ? `${cfg.appUrl}/api/auth/oidc/callback` : "";
  return cfg;
}
