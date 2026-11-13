import * as oidc from "openid-client";
import { clearCookie, parseCookies, setCookie, sign, verify } from "./session.js";

const SESSION_COOKIE = "hv_session";
const LOGIN_COOKIE = "hv_login";
const LOGIN_TTL_S = 600;

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(title, bodyHtml) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f5f7;color:#20242a;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;border:1px solid #c9ced6;border-radius:12px;padding:28px 32px;max-width:460px}
h1{font-size:20px;margin:0 0 10px}a{color:#2f5f9f}</style></head>
<body><main><h1>${esc(title)}</h1>${bodyHtml}</main></body></html>`;
}

/** Nur lokale Pfade zulassen, sonst wäre der Login ein offener Redirect. */
export function safeReturn(value) {
  const v = typeof value === "string" ? value : "";
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || /[\r\n]/.test(v)) return "/";
  if (v.startsWith("/auth/")) return "/";
  return v;
}

/**
 * Registriert /auth/*-Routen und liefert die Middleware für geschützte Pfade.
 * Die OIDC-Discovery passiert lazy beim ersten Login, damit der Server auch
 * startet, wenn der Identity Provider gerade nicht erreichbar ist.
 */
export function setupAuth(app, config, log = console) {
  const { oidc: oc } = config;
  const secure = config.secureCookies;
  const now = () => Math.floor(Date.now() / 1000);

  let discovery = null;
  function getOidc() {
    if (!discovery) {
      const auth =
        oc.authMethod === "none"
          ? oidc.None()
          : oc.authMethod === "post"
            ? oidc.ClientSecretPost(oc.clientSecret)
            : oidc.ClientSecretBasic(oc.clientSecret);
      const options = oc.allowHttp ? { execute: [oidc.allowInsecureRequests] } : undefined;
      discovery = oidc.discovery(new URL(oc.issuer), oc.clientId, {}, auth, options).catch((e) => {
        discovery = null; // beim nächsten Versuch erneut probieren
        throw e;
      });
    }
    return discovery;
  }

  function isAllowed(claims) {
    const emails = oc.allowedEmails;
    const groups = oc.allowedGroups;
    if (!emails.length && !groups.length) return true;
    if (emails.length) {
      const email = String(claims.email || "").toLowerCase();
      if (email && claims.email_verified !== false && emails.includes(email)) return true;
    }
    if (groups.length) {
      const raw = claims[oc.groupsClaim];
      const have = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
      if (have.some((g) => groups.includes(g))) return true;
    }
    return false;
  }

  function issueSession(res, claims) {
    const user = {
      t: "session",
      sub: String(claims.sub),
      name: String(claims.name || claims.preferred_username || claims.email || claims.sub).slice(0, 120),
      email: claims.email ? String(claims.email).slice(0, 200) : "",
      exp: now() + config.sessionTtlSeconds,
    };
    setCookie(res, SESSION_COOKIE, sign(user, config.sessionSecret), {
      maxAge: config.sessionTtlSeconds,
      secure,
    });
    return user;
  }

  if (!config.authDisabled) {
    app.get("/auth/login", async (req, res, next) => {
      try {
        const cfg = await getOidc();
        const codeVerifier = oidc.randomPKCECodeVerifier();
        const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
        const state = oidc.randomState();
        const nonce = oidc.randomNonce();
        const url = oidc.buildAuthorizationUrl(cfg, {
          redirect_uri: config.redirectUri,
          scope: oc.scopes,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          nonce,
        });
        setCookie(
          res,
          LOGIN_COOKIE,
          sign(
            { t: "login", cv: codeVerifier, state, nonce, ret: safeReturn(req.query.return), exp: now() + LOGIN_TTL_S },
            config.sessionSecret
          ),
          { maxAge: LOGIN_TTL_S, path: "/auth", secure }
        );
        res.redirect(url.href);
      } catch (e) {
        next(e);
      }
    });

    app.get("/auth/callback", async (req, res) => {
      const login = verify(parseCookies(req.headers.cookie)[LOGIN_COOKIE], config.sessionSecret, "login");
      clearCookie(res, LOGIN_COOKIE, { path: "/auth", secure });
      if (!login) {
        return res
          .status(400)
          .type("html")
          .send(page("Anmeldung abgelaufen", `<p>Die Anmeldung hat zu lange gedauert oder wurde nicht von hier gestartet.</p><p><a href="/auth/login">Erneut anmelden</a></p>`));
      }
      try {
        const cfg = await getOidc();
        const tokens = await oidc.authorizationCodeGrant(cfg, new URL(req.originalUrl, config.baseUrl), {
          pkceCodeVerifier: login.cv,
          expectedState: login.state,
          expectedNonce: login.nonce,
          idTokenExpected: true,
        });
        let claims = { ...tokens.claims() };

        // Fehlen E-Mail oder Gruppen im ID-Token, beim UserInfo-Endpunkt nachfragen.
        const needsGroups = oc.allowedGroups.length && claims[oc.groupsClaim] == null;
        if ((!claims.email || needsGroups) && tokens.access_token) {
          try {
            claims = { ...(await oidc.fetchUserInfo(cfg, tokens.access_token, claims.sub)), ...claims };
          } catch (e) {
            log.warn?.("UserInfo-Abfrage fehlgeschlagen:", e.message);
          }
        }

        if (!isAllowed(claims)) {
          log.warn?.(`Anmeldung abgelehnt (nicht freigegeben): sub=${claims.sub}`);
          return res
            .status(403)
            .type("html")
            .send(page("Kein Zugriff", `<p>Dein Konto ist für diese Anwendung nicht freigegeben.</p><p><a href="/auth/logged-out">Zurück</a></p>`));
        }
        issueSession(res, claims);
        res.redirect(login.ret || "/");
      } catch (e) {
        log.error?.("OIDC-Callback fehlgeschlagen:", e.message);
        res
          .status(400)
          .type("html")
          .send(page("Anmeldung fehlgeschlagen", `<p>Der Identity Provider hat die Anmeldung nicht bestätigt.</p><p><a href="/auth/login">Erneut versuchen</a></p>`));
      }
    });
  }

  app.get("/auth/logged-out", (_req, res) => {
    res.type("html").send(page("Abgemeldet", `<p>Du bist abgemeldet.</p><p><a href="/auth/login">Wieder anmelden</a></p>`));
  });

  app.post("/auth/logout", requireClientHeader, (_req, res) => {
    clearCookie(res, SESSION_COOKIE, { secure });
    res.json({ ok: true });
  });

  /** Setzt req.user oder beantwortet die Anfrage mit 401 bzw. Weiterleitung zum Login. */
  function requireAuth(req, res, next) {
    if (config.authDisabled) {
      req.user = { sub: "dev", name: "Entwicklung", email: "" };
      return next();
    }
    const session = verify(parseCookies(req.headers.cookie)[SESSION_COOKIE], config.sessionSecret, "session");
    if (session) {
      req.user = session;
      // Gleitende Laufzeit: bei weniger als halber Restzeit Cookie erneuern.
      if (session.exp - now() < config.sessionTtlSeconds / 2) issueSession(res, session);
      return next();
    }
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "unauthorized" });
    if (req.method === "GET" || req.method === "HEAD") {
      return res.redirect(`/auth/login?return=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(401).end();
  }

  return { requireAuth };
}

/**
 * Schutz vor Cross-Site-Anfragen: Browser setzen den Header bei Formularen
 * oder fremden Seiten nicht, und ein Cross-Origin-fetch damit würde einen
 * Preflight auslösen, den dieser Server nie freigibt.
 */
export function requireClientHeader(req, res, next) {
  if (req.get("x-hv-client") !== "1") return res.status(403).json({ error: "missing client header" });
  next();
}
