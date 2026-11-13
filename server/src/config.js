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
    baseUrl: String(env.BASE_URL || "").replace(/\/+$/, ""),
    dbPath: env.DB_PATH || path.resolve(here, "../data/hv-planer.sqlite"),
    webDir: env.WEB_DIR || path.resolve(here, "../../web"),
    authDisabled,
    sessionSecret: env.SESSION_SECRET || "",
    sessionTtlSeconds: Math.round(num(env.SESSION_TTL_HOURS, 168) * 3600),
    sharePlans: bool(env.SHARE_PLANS, false),
    historyKeep: Math.round(num(env.HISTORY_KEEP, 50)),
    historyMinIntervalMs: Math.round(num(env.HISTORY_MIN_INTERVAL_MINUTES, 10) * 60_000),
    maxBodyBytes: Math.round(num(env.MAX_BODY_MB, 5) * 1024 * 1024),
    oidc: {
      issuer: env.OIDC_ISSUER || "",
      clientId: env.OIDC_CLIENT_ID || "",
      clientSecret: env.OIDC_CLIENT_SECRET || "",
      // basic | post | none (none = öffentlicher Client, nur PKCE)
      authMethod: String(env.OIDC_AUTH_METHOD || (env.OIDC_CLIENT_SECRET ? "basic" : "none")).toLowerCase(),
      scopes: env.OIDC_SCOPES || "openid profile email",
      allowHttp: bool(env.OIDC_ALLOW_HTTP),
      allowedEmails: list(env.OIDC_ALLOWED_EMAILS).map((s) => s.toLowerCase()),
      allowedGroups: list(env.OIDC_ALLOWED_GROUPS),
      groupsClaim: env.OIDC_GROUPS_CLAIM || "groups",
    },
  };

  if (!["basic", "post", "none"].includes(cfg.oidc.authMethod)) {
    throw new Error("OIDC_AUTH_METHOD muss basic, post oder none sein.");
  }

  if (!authDisabled) {
    const missing = [];
    if (!cfg.baseUrl) missing.push("BASE_URL");
    if (!cfg.oidc.issuer) missing.push("OIDC_ISSUER");
    if (!cfg.oidc.clientId) missing.push("OIDC_CLIENT_ID");
    if (!cfg.sessionSecret) missing.push("SESSION_SECRET");
    if (cfg.oidc.authMethod !== "none" && !cfg.oidc.clientSecret) missing.push("OIDC_CLIENT_SECRET");
    if (missing.length) {
      throw new Error(`Fehlende Konfiguration: ${missing.join(", ")}`);
    }
    if (cfg.sessionSecret.length < 32) {
      throw new Error("SESSION_SECRET muss mindestens 32 Zeichen lang sein.");
    }
  }
  if (cfg.baseUrl) new URL(cfg.baseUrl); // früh scheitern bei ungültiger URL

  cfg.secureCookies = cfg.baseUrl.startsWith("https://");
  cfg.redirectUri = cfg.baseUrl ? `${cfg.baseUrl}/auth/callback` : "";
  return cfg;
}
