import assert from "node:assert/strict";
import net from "node:net";
import { after, before, describe, test } from "node:test";
import Provider from "oidc-provider";
import { createApp } from "../src/index.js";
import { loadConfig } from "../src/config.js";
import { SECRET, makeWebDir } from "./helpers.js";

/**
 * Ende-zu-Ende-Test des Anmeldeablaufs gegen einen echten OIDC-Provider
 * (node-oidc-provider mit Dev-Login). Geprüft werden Authorization Code mit
 * PKCE, State/Nonce, die drei Client-Authentifizierungen und die Freigabelisten.
 */

const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

/** Minimaler Cookie-Speicher mit Pfad-Auswertung (alle Server laufen auf 127.0.0.1). */
class Jar {
  cookies = new Map();
  header(path) {
    return [...this.cookies.values()]
      .filter((c) => path.startsWith(c.path))
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
  }
  store(res, defaultPath = "/") {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const path = attrs.find((a) => /^path=/i.test(a))?.slice(5) ?? defaultPath;
      const maxAge = attrs.find((a) => /^max-age=/i.test(a))?.slice(8);
      const key = `${name}|${path}`;
      if (value === "" || maxAge === "0") this.cookies.delete(key);
      else this.cookies.set(key, { name, value, path });
    }
  }
  get(name) {
    return [...this.cookies.values()].find((c) => c.name === name)?.value;
  }
}

async function request(jar, url, init = {}) {
  const u = new URL(url);
  // Keine wiederverwendeten Verbindungen: Die Test-App startet mehrfach auf demselben Port.
  const headers = { Connection: "close", ...(init.headers || {}) };
  const cookie = jar.header(u.pathname);
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(url, { ...init, headers, redirect: "manual" });
  jar.store(res, u.pathname.replace(/\/[^/]*$/, "/") || "/");
  return res;
}

/** Folgt Weiterleitungen und füllt die Dev-Formulare des Providers aus. */
async function browserLogin(jar, startUrl, account, { stopAtCallbackOf } = {}) {
  let url = startUrl;
  for (let i = 0; i < 20; i++) {
    if (stopAtCallbackOf && url.startsWith(stopAtCallbackOf)) return { callbackUrl: url };
    const res = await request(jar, url);
    if (res.status >= 300 && res.status < 400) {
      url = new URL(res.headers.get("location"), url).href;
      continue;
    }
    const body = await res.text();
    const formHtml = body.match(/<form[\s\S]*?<\/form>/)?.[0];
    const action = formHtml?.match(/action="([^"]+)"/)?.[1];
    if (res.status === 200 && action) {
      // Versteckte Felder (z. B. prompt=login|consent) übernehmen, Zugangsdaten ergänzen
      const form = new URLSearchParams();
      for (const m of formHtml.matchAll(/<input[^>]*>/g)) {
        const name = m[0].match(/name="([^"]+)"/)?.[1];
        if (!name) continue;
        if (/type="hidden"/.test(m[0])) form.set(name, m[0].match(/value="([^"]*)"/)?.[1] ?? "");
        else if (name === "login") form.set(name, account);
        else form.set(name, "egal");
      }
      const post = await request(jar, new URL(action, url).href, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      });
      assert.ok(post.status >= 300 && post.status < 400, `Formular ${action} → ${post.status}`);
      url = new URL(post.headers.get("location"), url).href;
      continue;
    }
    return { res, body, url };
  }
  throw new Error("Zu viele Weiterleitungen");
}

describe("OIDC-Anmeldung gegen Test-Provider", () => {
  let provider, providerServer, issuer, appPort, base, webDir;
  const apps = [];

  async function startApp(method, extra = {}) {
    const clientId = `hv-${method}`;
    const config = loadConfig({
      APP_URL: base,
      OIDC_ISSUER_URL: issuer,
      OIDC_PROVIDER_NAME: "Test-IdP",
      OIDC_CLIENT_ID: clientId,
      ...(method === "none" ? {} : { OIDC_CLIENT_SECRET: "geheim-" + method }),
      OIDC_ALLOW_HTTP: "true",
      SESSION_SECRET: SECRET,
      DB_PATH: ":memory:",
      WEB_DIR: webDir,
      PORT: String(appPort),
      ...extra,
    });
    const { app, db } = createApp(config, { warn() {}, error() {}, log() {} });
    const server = await new Promise((r) => {
      const s = app.listen(appPort, "127.0.0.1", () => r(s));
    });
    apps.push({ server, db });
    return { config, server, db };
  }

  async function stopApp({ server, db }) {
    await new Promise((r) => server.close(r));
    db.close();
    apps.splice(apps.findIndex((a) => a.server === server), 1);
  }

  before(async () => {
    webDir = makeWebDir();
    const providerPort = await freePort();
    appPort = await freePort();
    issuer = `http://127.0.0.1:${providerPort}`;
    base = `http://127.0.0.1:${appPort}`;

    const redirect = `${base}/api/auth/oidc/callback`;
    provider = new Provider(issuer, {
      clients: [
        { client_id: "hv-post", client_secret: "geheim-post", redirect_uris: [redirect], token_endpoint_auth_method: "client_secret_post" },
        { client_id: "hv-none", redirect_uris: [redirect], token_endpoint_auth_method: "none" },
      ],
      claims: { openid: ["sub"], email: ["email", "email_verified"], profile: ["name"], groups: ["groups"] },
      scopes: ["openid", "email", "profile", "groups"],
      features: { devInteractions: { enabled: true } },
      cookies: { keys: ["k".repeat(32)] },
      pkce: { required: () => true },
      async findAccount(_ctx, id) {
        return {
          accountId: id,
          async claims() {
            return {
              sub: id,
              email: `${id}@example.com`,
              email_verified: true,
              name: `Nutzer ${id}`,
              groups: id === "carol" ? ["hv-users"] : [],
            };
          },
        };
      },
    });
    providerServer = await new Promise((r) => {
      const s = provider.listen(providerPort, "127.0.0.1", () => r(s));
    });
  });

  after(async () => {
    for (const a of [...apps]) await stopApp(a);
    await new Promise((r) => providerServer.close(r));
  });

  /** Kompletter Browser-Ablauf bis zum Callback; liefert die Callback-URL des Providers. */
  async function startLogin(jar, account, redirect) {
    const q = redirect === undefined ? "" : `?redirect=${encodeURIComponent(redirect)}`;
    const start = await request(jar, `${base}/api/auth/oidc/initiate${q}`);
    assert.equal(start.status, 302);
    const authUrl = start.headers.get("location");
    const { callbackUrl } = await browserLogin(jar, authUrl, account, { stopAtCallbackOf: `${base}/api/auth/oidc/callback` });
    return { start, authUrl, callbackUrl };
  }
  const exchange = (jar, code) =>
    request(jar, `${base}/api/auth/oidc/exchange`, {
      method: "POST",
      headers: { "X-HV-Client": "1", "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  /** Callback aufrufen und, falls erfolgreich, den Austausch-Code einlösen. */
  async function finishLogin(jar, callbackUrl) {
    const cb = await request(jar, callbackUrl);
    const loc = cb.status === 302 ? new URL(cb.headers.get("location"), base) : null;
    const code = loc?.searchParams.get("code");
    if (!code) return { cb, loc };
    return { cb, loc, code, ex: await exchange(jar, code) };
  }

  for (const method of ["post", "none"]) {
    test(`vollständiger Login (${method === "post" ? "Client mit Secret" : "öffentlicher Client"})`, async () => {
      const a = await startApp(method);
      try {
        const jar = new Jar();

        // 1. ohne Sitzung: API 401, Seite leitet zur Login-Seite, /login und /config sind öffentlich
        assert.equal((await request(jar, `${base}/api/plans`)).status, 401);
        const entry = await request(jar, `${base}/`);
        assert.equal(entry.status, 302);
        assert.equal(entry.headers.get("location"), "/login?redirect=%2F");
        const loginPage = await request(jar, `${base}/login`);
        assert.equal(loginPage.status, 200);
        assert.match(await loginPage.text(), /Mit Test-IdP anmelden/);
        const pub = await (await request(jar, `${base}/api/auth/oidc/config`)).json();
        assert.deepEqual(pub, { enabled: true, providerName: "Test-IdP" });

        // 2. Start beim Provider (PKCE, State, Nonce, Browser-Bindung)
        const { start, authUrl, callbackUrl } = await startLogin(jar, "alice", "/");
        const u = new URL(authUrl);
        assert.equal(u.searchParams.get("code_challenge_method"), "S256");
        assert.ok(u.searchParams.get("code_challenge"));
        assert.ok(u.searchParams.get("state"));
        assert.ok(u.searchParams.get("nonce"));
        assert.equal(u.searchParams.get("redirect_uri"), `${base}/api/auth/oidc/callback`);
        assert.equal(u.searchParams.get("scope"), "openid email profile");
        assert.match(start.headers.get("set-cookie"), /hv_oidc_state=.*HttpOnly.*SameSite=Lax/);

        // 3. Callback → einmaliger Code, noch keine Sitzung
        const { cb, loc, code, ex } = await finishLogin(jar, callbackUrl);
        assert.equal(cb.status, 302);
        assert.equal(loc.pathname, "/login");
        assert.ok(code, "Austausch-Code fehlt");
        assert.equal(jar.get("hv_oidc_state"), undefined, "Bindungs-Cookie sollte gelöscht sein");

        // 4. Austausch → Sitzung
        assert.equal(ex.status, 200);
        const body = await ex.json();
        assert.equal(body.redirectUrl, "/");
        assert.equal(body.user.name, "Nutzer alice");
        assert.ok(jar.get("hv_session"), "Session-Cookie fehlt");
        const me = await request(jar, `${base}/api/me`);
        assert.equal(me.status, 200);
        assert.equal((await me.json()).email, "alice@example.com");
        assert.equal((await request(jar, `${base}/`)).status, 200);

        // 5. Code ist einmalig
        assert.equal((await exchange(new Jar(), code)).status, 400);

        // 6. Abmelden
        const out = await request(jar, `${base}/api/auth/logout`, { method: "POST", headers: { "X-HV-Client": "1" } });
        assert.equal(out.status, 200);
        assert.equal(jar.get("hv_session"), undefined);
        assert.equal((await request(jar, `${base}/api/me`)).status, 401);
      } finally {
        await stopApp(a);
      }
    });
  }

  test("Austausch braucht Client-Header und gültigen Code", async () => {
    const a = await startApp("post");
    try {
      const jar = new Jar();
      const noHeader = await request(jar, `${base}/api/auth/oidc/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "x" }),
      });
      assert.equal(noHeader.status, 403);
      assert.equal((await exchange(jar, "gibt-es-nicht")).status, 400);
      assert.equal((await exchange(jar, undefined)).status, 400);
      assert.equal(jar.get("hv_session"), undefined);
    } finally {
      await stopApp(a);
    }
  });

  test("Freigabeliste für E-Mail-Adressen", async () => {
    const a = await startApp("post", { OIDC_ALLOWED_EMAILS: "alice@example.com, Bob@Example.com" });
    try {
      const attempt = async (account) => {
        const jar = new Jar();
        const { callbackUrl } = await startLogin(jar, account);
        return { ...(await finishLogin(jar, callbackUrl)), jar };
      };
      const ok = await attempt("bob");
      assert.equal(ok.ex.status, 200);
      assert.ok(ok.jar.get("hv_session"));

      const denied = await attempt("mallory");
      assert.equal(denied.cb.status, 302);
      assert.equal(denied.loc.pathname, "/login");
      assert.equal(denied.loc.searchParams.get("status"), "403");
      assert.match(denied.loc.searchParams.get("error"), /nicht freigegeben/);
      assert.equal(denied.code, undefined);
      assert.equal((await request(denied.jar, `${base}/api/me`)).status, 401);
    } finally {
      await stopApp(a);
    }
  });

  test("Freigabe über Gruppen-Claim", async () => {
    const a = await startApp("post", { OIDC_ALLOWED_GROUPS: "hv-users", OIDC_SCOPES: "openid email profile groups" });
    try {
      const attempt = async (account) => {
        const jar = new Jar();
        const { callbackUrl } = await startLogin(jar, account);
        return { ...(await finishLogin(jar, callbackUrl)), jar };
      };
      assert.equal((await attempt("dave")).loc.searchParams.get("status"), "403");
      const carol = await attempt("carol");
      assert.equal(carol.ex.status, 200);
      assert.ok(carol.jar.get("hv_session"));
    } finally {
      await stopApp(a);
    }
  });

  test("falscher State, fehlende Browser-Bindung und Wiederholung werden abgewiesen", async () => {
    const a = await startApp("post");
    try {
      const jar = new Jar();
      const { callbackUrl } = await startLogin(jar, "alice");

      const tampered = new URL(callbackUrl);
      tampered.searchParams.set("state", "gefaelscht");
      const bad = await request(jar, tampered.href);
      assert.equal(new URL(bad.headers.get("location"), base).searchParams.has("code"), false);

      // Der State wurde durch den Fehlversuch nicht verbraucht, aber das Bindungs-Cookie ist weg:
      // ein untergeschobener Callback-Link in einem fremden Browser (ohne Cookie) scheitert.
      const stranger = await request(new Jar(), callbackUrl);
      const loc = new URL(stranger.headers.get("location"), base);
      assert.equal(loc.searchParams.has("code"), false);
      assert.match(loc.searchParams.get("error"), /nicht von diesem Browser/);

      // Wiederverwendung desselben Callbacks im selben Browser: State ist verbraucht
      const jar2 = new Jar();
      const first = await startLogin(jar2, "alice");
      const r1 = await finishLogin(jar2, first.callbackUrl);
      assert.equal(r1.ex.status, 200);
      const replay = await request(jar2, first.callbackUrl);
      assert.equal(new URL(replay.headers.get("location"), base).searchParams.has("code"), false);
    } finally {
      await stopApp(a);
    }
  });

  test("Provider-Fehler werden auf der Login-Seite angezeigt", async () => {
    const a = await startApp("post");
    try {
      const res = await request(new Jar(), `${base}/api/auth/oidc/callback?error=access_denied&error_description=Abgelehnt`);
      const loc = new URL(res.headers.get("location"), base);
      assert.equal(loc.pathname, "/login");
      assert.equal(loc.searchParams.get("error"), "Abgelehnt");
      assert.equal((await request(new Jar(), `${base}/api/auth/oidc/callback`)).status, 302);
    } finally {
      await stopApp(a);
    }
  });

  test("Rücksprungziel nach dem Login bleibt erhalten, externe Ziele nicht", async () => {
    const a = await startApp("post");
    try {
      for (const [ret, expected] of [
        ["/ANLEITUNG.md", "/ANLEITUNG.md"],
        ["//evil.example/x", "/"],
        ["https://evil.example", "/"],
        ["/api/plans", "/"],
      ]) {
        const jar = new Jar();
        const { callbackUrl } = await startLogin(jar, "alice", ret);
        const { ex } = await finishLogin(jar, callbackUrl);
        assert.equal((await ex.json()).redirectUrl, expected, ret);
      }
    } finally {
      await stopApp(a);
    }
  });
});
