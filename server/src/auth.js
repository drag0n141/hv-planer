import express from "express";
import * as oidc from "openid-client";
import { OidcStateStore } from "./oidc-state.js";
import { clearCookie, parseCookies, setCookie, sign, verify } from "./session.js";

const SESSION_COOKIE = "hv_session";
const STATE_COOKIE = "hv_oidc_state";
const STATE_COOKIE_PATH = "/api/auth/oidc";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Schutz vor Cross-Site-Anfragen: Browser setzen den Header bei Formularen
 * oder fremden Seiten nicht, und ein Cross-Origin-fetch damit würde einen
 * Preflight auslösen, den dieser Server nie freigibt.
 */
export function requireClientHeader(req, res, next) {
  if (req.get("x-hv-client") !== "1") return res.status(403).json({ error: "missing client header" });
  next();
}

/**
 * Löst ein Rücksprungziel gegen die App-URL auf und gibt nur Pfad, Query und Hash zurück.
 * Alles, was die Origin der App verlässt, wird verworfen (kein offener Redirect).
 */
export function safeRedirect(value, appUrl, fallback = "/") {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v || /[\r\n\\]/.test(v)) return fallback;
  try {
    const app = new URL(appUrl);
    const u = new URL(v, app);
    if (u.origin !== app.origin) return fallback;
    const out = u.pathname + u.search + u.hash;
    if (out.startsWith("//") || out.startsWith("/api/") || out === "/login" || out.startsWith("/login?")) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

function loginPage(providerName) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HV-Planer – Anmeldung</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f5f7;color:#20242a;display:grid;place-items:center;min-height:100vh;margin:0}
main{background:#fff;border:1px solid #c9ced6;border-radius:12px;padding:28px 32px;max-width:460px}
h1{font-size:20px;margin:0 0 10px}.err{color:#a83232}.btn{display:inline-block;margin-top:12px;padding:9px 16px;border-radius:6px;background:#2f5f9f;color:#fff;text-decoration:none}</style></head>
<body><main><h1>HV-Planer</h1><p id="msg"></p><a id="btn" class="btn" href="#" hidden>Mit ${esc(providerName)} anmelden</a>
<script>
(function(){
  var p=new URLSearchParams(location.search),msg=document.getElementById("msg"),btn=document.getElementById("btn");
  var redirect=p.get("redirect")||"/";
  var start="/api/auth/oidc/initiate?redirect="+encodeURIComponent(redirect);
  btn.href=start;
  function show(text,isErr){msg.textContent=text;msg.className=isErr?"err":"";btn.hidden=false}
  if(p.get("code")){
    msg.textContent="Anmeldung wird abgeschlossen …";
    fetch("/api/auth/oidc/exchange",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-HV-Client":"1"},body:JSON.stringify({code:p.get("code")})})
      .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j})})
      .then(function(j){location.replace(j.redirectUrl||"/")})
      .catch(function(e){show(e.message,true)});
  }else if(p.get("error")){
    show(p.get("error"),true);
  }else if(p.get("loggedout")){
    show("Du bist abgemeldet.",false);
  }else{
    location.replace(start);
  }
})();
</script></main></body></html>`;
}

/**
 * Registriert die Anmelderoute (/login, /api/auth/*) und liefert die Middleware für geschützte Pfade.
 *
 * Ablauf wie bei gängigen Self-Hosted-Apps:
 *   GET  /api/auth/oidc/initiate  → Weiterleitung zum Identity Provider (PKCE, State, Nonce)
 *   GET  /api/auth/oidc/callback  → Code beim Provider einlösen, Nutzer prüfen,
 *                                   Weiterleitung auf /login?code=<einmaliger Austausch-Code>
 *   POST /api/auth/oidc/exchange  → Austausch-Code gegen Sitzung (HttpOnly-Cookie)
 *   GET  /api/auth/oidc/config    → öffentliche Angaben für die Login-Seite
 *
 * Die OIDC-Discovery passiert lazy beim ersten Login, damit der Server auch
 * startet, wenn der Identity Provider gerade nicht erreichbar ist.
 */
export function setupAuth(app, config, log = console) {
  const { oidc: oc } = config;
  const secure = config.secureCookies;
  const now = () => Math.floor(Date.now() / 1000);
  const store = new OidcStateStore();

  let discovery = null;
  function getConfiguration() {
    if (!discovery) {
      const auth = oc.clientSecret ? oidc.ClientSecretPost(oc.clientSecret) : oidc.None();
      const options = oc.allowHttp ? { execute: [oidc.allowInsecureRequests] } : undefined;
      discovery = oidc
        .discovery(
          new URL(oc.issuer),
          oc.clientId,
          { redirect_uris: [config.redirectUri], response_types: ["code"] },
          auth,
          options
        )
        .catch((e) => {
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

  function issueSession(res, user) {
    const payload = {
      t: "session",
      sub: String(user.sub),
      name: String(user.name || user.email || user.sub).slice(0, 120),
      email: user.email ? String(user.email).slice(0, 200) : "",
      exp: now() + config.sessionTtlSeconds,
    };
    setCookie(res, SESSION_COOKIE, sign(payload, config.sessionSecret), { maxAge: config.sessionTtlSeconds, secure });
    return payload;
  }

  const toLogin = (res, params) => res.redirect(`/login?${new URLSearchParams(params)}`);

  // ----- öffentliche Routen -----
  app.get("/login", (_req, res) => {
    if (config.authDisabled) return res.redirect("/");
    res.set("Cache-Control", "no-store").type("html").send(loginPage(oc.providerName));
  });

  app.get("/api/auth/oidc/config", (_req, res) => {
    res.set("Cache-Control", "no-store").json({
      enabled: !config.authDisabled,
      providerName: oc.providerName,
    });
  });

  app.post("/api/auth/logout", requireClientHeader, (_req, res) => {
    clearCookie(res, SESSION_COOKIE, { secure });
    res.json({ ok: true });
  });

  if (!config.authDisabled) {
    app.get("/api/auth/oidc/initiate", async (req, res) => {
      try {
        const cfg = await getConfiguration();
        const redirectUrl = safeRedirect(req.query.redirect, config.appUrl);
        const state = oidc.randomState();
        const nonce = oidc.randomNonce();
        const codeVerifier = oidc.randomPKCECodeVerifier();
        const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
        store.storeState(state, { codeVerifier, nonce, redirectUrl });
        // Bindet den Ablauf an diesen Browser (Schutz vor untergeschobenen Callback-Links).
        setCookie(res, STATE_COOKIE, state, { maxAge: 600, path: STATE_COOKIE_PATH, secure });
        const url = oidc.buildAuthorizationUrl(cfg, {
          redirect_uri: config.redirectUri,
          scope: oc.scopes,
          state,
          nonce,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
        });
        res.redirect(url.href);
      } catch (e) {
        log.error?.("OIDC-Start fehlgeschlagen:", e.message);
        toLogin(res, { error: `Anmeldung nicht möglich: ${oc.providerName} ist nicht erreichbar oder falsch konfiguriert.` });
      }
    });

    app.get("/api/auth/oidc/callback", async (req, res) => {
      const { code, state, error, error_description: errorDescription } = req.query;
      const cookieState = parseCookies(req.headers.cookie)[STATE_COOKIE];
      clearCookie(res, STATE_COOKIE, { path: STATE_COOKIE_PATH, secure });

      if (error) return toLogin(res, { error: String(errorDescription || error).slice(0, 300) });
      if (typeof code !== "string" || typeof state !== "string") {
        return toLogin(res, { error: "Autorisierungscode oder State fehlt." });
      }
      const stored = store.takeState(state);
      if (!stored || !cookieState || cookieState !== state) {
        return toLogin(res, { error: "Anmeldung abgelaufen oder nicht von diesem Browser gestartet. Bitte erneut anmelden." });
      }

      try {
        const cfg = await getConfiguration();
        const tokens = await oidc.authorizationCodeGrant(cfg, new URL(req.originalUrl, config.appUrl), {
          pkceCodeVerifier: stored.codeVerifier,
          expectedState: state,
          expectedNonce: stored.nonce,
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

        if (!claims.sub || !claims.email) {
          return toLogin(res, { error: `${oc.providerName} hat die Pflicht-Claims (email, sub) nicht geliefert.`, status: "400" });
        }
        if (!isAllowed(claims)) {
          log.warn?.(`Anmeldung abgelehnt (nicht freigegeben): sub=${claims.sub}`);
          return toLogin(res, { error: "Dein Konto ist für diese Anwendung nicht freigegeben.", status: "403" });
        }

        const exchangeCode = store.createExchangeCode({
          user: {
            sub: claims.sub,
            name: claims.name || claims.preferred_username || String(claims.email).split("@")[0],
            email: claims.email,
          },
          redirectUrl: stored.redirectUrl || "/",
        });
        res.redirect(`/login?${new URLSearchParams({ code: exchangeCode })}`);
      } catch (e) {
        log.error?.("OIDC-Callback fehlgeschlagen:", e.message);
        toLogin(res, { error: `${oc.providerName} hat die Anmeldung nicht bestätigt. Bitte erneut versuchen.`, status: "400" });
      }
    });

    app.post("/api/auth/oidc/exchange", requireClientHeader, express.json({ limit: "4kb" }), (req, res) => {
      const code = req.body?.code;
      if (typeof code !== "string" || !code) return res.status(400).json({ error: "Ungültiger Code." });
      const result = store.consumeExchangeCode(code);
      if (!result) {
        return res.status(400).json({ error: "Ungültiger oder abgelaufener Login-Code. Bitte erneut anmelden." });
      }
      const user = issueSession(res, result.user);
      res.set("Cache-Control", "no-store").json({
        redirectUrl: result.redirectUrl,
        user: { name: user.name, email: user.email },
      });
    });
  }

  /** Setzt req.user oder beantwortet die Anfrage mit 401 bzw. Weiterleitung zur Login-Seite. */
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
      return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
    }
    return res.status(401).end();
  }

  return { requireAuth, store };
}
