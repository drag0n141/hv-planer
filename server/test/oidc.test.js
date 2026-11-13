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
      BASE_URL: base,
      OIDC_ISSUER: issuer,
      OIDC_CLIENT_ID: clientId,
      ...(method === "none" ? {} : { OIDC_CLIENT_SECRET: "geheim-" + method }),
      OIDC_AUTH_METHOD: method,
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

    const redirect = `${base}/auth/callback`;
    provider = new Provider(issuer, {
      clients: [
        { client_id: "hv-basic", client_secret: "geheim-basic", redirect_uris: [redirect], token_endpoint_auth_method: "client_secret_basic" },
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

  for (const method of ["basic", "post", "none"]) {
    test(`vollständiger Login (Client-Authentifizierung: ${method})`, async () => {
      const a = await startApp(method);
      try {
        const jar = new Jar();

        // 1. ohne Sitzung: API 401, Seite leitet zum Login
        assert.equal((await request(jar, `${base}/api/plans`)).status, 401);
        const entry = await request(jar, `${base}/`);
        assert.equal(entry.status, 302);
        assert.equal(entry.headers.get("location"), "/auth/login?return=%2F");

        // 2. Login beim Provider
        const start = await request(jar, `${base}/auth/login?return=%2F`);
        assert.equal(start.status, 302);
        const authUrl = new URL(start.headers.get("location"));
        assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
        assert.ok(authUrl.searchParams.get("code_challenge"));
        assert.ok(authUrl.searchParams.get("state"));
        assert.ok(authUrl.searchParams.get("nonce"));
        assert.match(start.headers.get("set-cookie"), /hv_login=.*HttpOnly.*SameSite=Lax/);

        const { callbackUrl } = await browserLogin(jar, authUrl.href, "alice", { stopAtCallbackOf: `${base}/auth/callback` });

        // 3. Rücksprung → Sitzung
        const cb = await request(jar, callbackUrl);
        assert.equal(cb.status, 302, "Callback sollte weiterleiten");
        assert.equal(cb.headers.get("location"), "/");
        assert.ok(jar.get("hv_session"), "Session-Cookie fehlt");
        assert.equal(jar.get("hv_login"), undefined, "Login-Cookie sollte gelöscht sein");

        // 4. Sitzung nutzbar
        const me = await request(jar, `${base}/api/me`);
        assert.equal(me.status, 200);
        assert.equal((await me.json()).name, "Nutzer alice");
        assert.equal((await request(jar, `${base}/`)).status, 200);

        // 5. Code lässt sich nicht erneut einlösen
        const replayJar = new Jar();
        replayJar.cookies = new Map([...jar.cookies].filter(([k]) => !k.startsWith("hv_session")));
        const prep = await request(replayJar, `${base}/auth/login`);
        assert.equal(prep.status, 302);
        const replay = await request(replayJar, callbackUrl); // alter Code, neuer Login-Cookie
        assert.equal(replay.status, 400);
      } finally {
        await stopApp(a);
      }
    });
  }

  test("Freigabeliste für E-Mail-Adressen", async () => {
    const a = await startApp("basic", { OIDC_ALLOWED_EMAILS: "alice@example.com, Bob@Example.com" });
    try {
      const attempt = async (account) => {
        const jar = new Jar();
        const start = await request(jar, `${base}/auth/login`);
        const { callbackUrl } = await browserLogin(jar, start.headers.get("location"), account, { stopAtCallbackOf: `${base}/auth/callback` });
        const cb = await request(jar, callbackUrl);
        return { cb, jar };
      };
      const ok = await attempt("bob");
      assert.equal(ok.cb.status, 302);
      assert.ok(ok.jar.get("hv_session"));

      const denied = await attempt("mallory");
      assert.equal(denied.cb.status, 403);
      assert.equal(denied.jar.get("hv_session"), undefined);
      assert.equal((await request(denied.jar, `${base}/api/me`)).status, 401);
    } finally {
      await stopApp(a);
    }
  });

  test("Freigabe über Gruppen-Claim", async () => {
    const a = await startApp("basic", { OIDC_ALLOWED_GROUPS: "hv-users", OIDC_SCOPES: "openid profile email groups" });
    try {
      const attempt = async (account) => {
        const jar = new Jar();
        const start = await request(jar, `${base}/auth/login`);
        const { callbackUrl } = await browserLogin(jar, start.headers.get("location"), account, { stopAtCallbackOf: `${base}/auth/callback` });
        return { cb: await request(jar, callbackUrl), jar };
      };
      assert.equal((await attempt("dave")).cb.status, 403);
      const carol = await attempt("carol");
      assert.equal(carol.cb.status, 302);
      assert.ok(carol.jar.get("hv_session"));
    } finally {
      await stopApp(a);
    }
  });

  test("falscher State oder fehlendes Login-Cookie werden abgewiesen", async () => {
    const a = await startApp("basic");
    try {
      const jar = new Jar();
      const start = await request(jar, `${base}/auth/login`);
      const { callbackUrl } = await browserLogin(jar, start.headers.get("location"), "alice", { stopAtCallbackOf: `${base}/auth/callback` });

      const tampered = new URL(callbackUrl);
      tampered.searchParams.set("state", "gefaelscht");
      const bad = await request(jar, tampered.href);
      assert.equal(bad.status, 400);
      assert.equal(jar.get("hv_session"), undefined);

      const noCookie = await request(new Jar(), callbackUrl);
      assert.equal(noCookie.status, 400);
    } finally {
      await stopApp(a);
    }
  });

  test("Rücksprungziel nach dem Login bleibt erhalten, externe Ziele nicht", async () => {
    const a = await startApp("basic");
    try {
      for (const [ret, expected] of [
        ["/ANLEITUNG.md", "/ANLEITUNG.md"],
        ["//evil.example/x", "/"],
        ["https://evil.example", "/"],
      ]) {
        const jar = new Jar();
        const start = await request(jar, `${base}/auth/login?return=${encodeURIComponent(ret)}`);
        const { callbackUrl } = await browserLogin(jar, start.headers.get("location"), "alice", { stopAtCallbackOf: `${base}/auth/callback` });
        const cb = await request(jar, callbackUrl);
        assert.equal(cb.headers.get("location"), expected, ret);
      }
    } finally {
      await stopApp(a);
    }
  });
});
