import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loadConfig } from "../src/config.js";
import { safeRedirect } from "../src/auth.js";
import { parseCookies, sign, verify } from "../src/session.js";
import { SECRET, client, samplePlan, sessionCookie, startApp } from "./helpers.js";

describe("Session-Cookies", () => {
  const future = Math.floor(Date.now() / 1000) + 60;

  test("gültiges Token wird erkannt", () => {
    const t = sign({ t: "session", sub: "a", exp: future }, SECRET);
    assert.equal(verify(t, SECRET, "session").sub, "a");
  });
  test("manipulierte Nutzlast wird abgelehnt", () => {
    const t = sign({ t: "session", sub: "a", exp: future }, SECRET);
    const [, mac] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ t: "session", sub: "admin", exp: future })).toString("base64url");
    assert.equal(verify(`${forged}.${mac}`, SECRET, "session"), null);
  });
  test("falsches Secret, falscher Typ, abgelaufen", () => {
    const t = sign({ t: "session", sub: "a", exp: future }, SECRET);
    assert.equal(verify(t, "x".repeat(48), "session"), null);
    assert.equal(verify(t, SECRET, "login"), null);
    assert.equal(verify(sign({ t: "session", sub: "a", exp: 1 }, SECRET), SECRET, "session"), null);
    assert.equal(verify("quatsch", SECRET, "session"), null);
    assert.equal(verify("", SECRET, "session"), null);
  });
  test("Cookie-Header wird geparst", () => {
    assert.deepEqual(parseCookies("a=1; b=zwei%20drei"), { a: "1", b: "zwei drei" });
  });
});

describe("Konfiguration & Redirect-Schutz", () => {
  test("Pflichtwerte werden verlangt", () => {
    assert.throws(() => loadConfig({}), /APP_URL.*OIDC_ISSUER_URL.*OIDC_CLIENT_ID.*SESSION_SECRET/);
    assert.throws(
      () => loadConfig({ APP_URL: "https://a.example", OIDC_ISSUER_URL: "https://i", OIDC_CLIENT_ID: "c", SESSION_SECRET: "kurz" }),
      /mindestens 32/
    );
    assert.throws(
      () => loadConfig({ APP_URL: "https://a.example", OIDC_ISSUER_URL: "https://i", OIDC_CLIENT_ID: "c", SESSION_SECRET: "s".repeat(40), OIDC_ENABLED: "false" }),
      /OIDC_ENABLED/
    );
  });
  test("öffentlicher Client ohne Secret ist erlaubt, Redirect-URI wird abgeleitet", () => {
    const c = loadConfig({ APP_URL: "https://a.example/", OIDC_ISSUER_URL: "https://i", OIDC_CLIENT_ID: "c", SESSION_SECRET: "s".repeat(40) });
    assert.equal(c.oidc.clientSecret, "");
    assert.equal(c.oidc.scopes, "openid email profile");
    assert.equal(c.oidc.providerName, "OIDC Provider");
    assert.equal(c.appUrl, "https://a.example");
    assert.equal(c.redirectUri, "https://a.example/api/auth/oidc/callback");
    assert.equal(c.secureCookies, true);
  });
  test("safeRedirect lässt nur Ziele innerhalb der App zu", () => {
    const app = "https://a.example";
    assert.equal(safeRedirect("/plan?x=1#h", app), "/plan?x=1#h");
    assert.equal(safeRedirect("https://a.example/plan", app), "/plan");
    assert.equal(safeRedirect("//evil.example", app), "/");
    assert.equal(safeRedirect("https://evil.example", app), "/");
    assert.equal(safeRedirect("/\\evil", app), "/");
    assert.equal(safeRedirect("/api/plans", app), "/");
    assert.equal(safeRedirect("/login?code=x", app), "/");
    assert.equal(safeRedirect(undefined, app), "/");
    assert.equal(safeRedirect(["/a"], app), "/");
  });
});

describe("API", () => {
  let ctx, alice, bob, anon;
  before(async () => {
    ctx = await startApp({ HISTORY_KEEP: "3" });
    alice = client(ctx.base, sessionCookie("alice", "Alice"));
    bob = client(ctx.base, sessionCookie("bob", "Bob"));
    anon = client(ctx.base);
  });
  after(() => ctx.close());

  test("ohne Anmeldung: API 401, Seite leitet zum Login, Health bleibt offen", async () => {
    assert.equal((await anon("GET", "/api/plans")).status, 401);
    const page = await anon("GET", "/");
    assert.equal(page.status, 302);
    assert.equal(page.res.headers.get("location"), "/login?redirect=%2F");
    assert.equal((await anon("GET", "/healthz")).status, 200);
  });

  test("gefälschtes oder abgelaufenes Cookie wird abgelehnt", async () => {
    const forged = client(ctx.base, sessionCookie("alice", "Alice", { secret: "f".repeat(48) }));
    assert.equal((await forged("GET", "/api/plans")).status, 401);
    const expired = client(ctx.base, sessionCookie("alice", "Alice", { expOffset: -10 }));
    assert.equal((await expired("GET", "/api/plans")).status, 401);
  });

  test("schreibende Anfragen brauchen den Client-Header", async () => {
    const res = await fetch(ctx.base + "/api/plans", {
      method: "POST",
      headers: { Cookie: sessionCookie("alice"), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", data: samplePlan() }),
    });
    assert.equal(res.status, 403);
  });

  test("statische Dateien nur mit Anmeldung, .md als Text", async () => {
    const ok = await alice("GET", "/");
    assert.equal(ok.status, 200);
    const md = await alice("GET", "/ANLEITUNG.md");
    assert.match(md.res.headers.get("content-type"), /text\/plain/);
  });

  test("anlegen, lesen, ändern, Konflikt, Verlauf, löschen", async () => {
    const created = await alice("POST", "/api/plans", { name: "  Haus  ", data: samplePlan({ nextId: 1 }) });
    assert.equal(created.status, 201);
    const id = created.json.id;
    assert.equal(created.json.version, 1);

    const list = await alice("GET", "/api/plans");
    assert.deepEqual(list.json.map((p) => [p.id, p.name, p.mine]), [[id, "Haus", true]]);

    const got = await alice("GET", `/api/plans/${id}`);
    assert.equal(got.json.data.projectName, "Test");

    const put1 = await alice("PUT", `/api/plans/${id}`, { name: "Haus", data: samplePlan({ nextId: 2 }), version: 1 });
    assert.equal(put1.status, 200);
    assert.equal(put1.json.version, 2);

    const stale = await alice("PUT", `/api/plans/${id}`, { name: "Haus", data: samplePlan({ nextId: 3 }), version: 1 });
    assert.equal(stale.status, 409);
    assert.equal(stale.json.version, 2);

    // Identischer Inhalt erzeugt keine neue Version
    const noop = await alice("PUT", `/api/plans/${id}`, { name: "Haus", data: samplePlan({ nextId: 2 }), version: 2 });
    assert.equal(noop.json.version, 2);

    const put2 = await alice("PUT", `/api/plans/${id}`, { name: "Haus", data: samplePlan({ nextId: 3 }), version: 2 });
    assert.equal(put2.json.version, 3);

    const hist = await alice("GET", `/api/plans/${id}/history`);
    assert.deepEqual(hist.json.map((h) => h.version), [2, 1]); // neueste zuerst
    const old = await alice("GET", `/api/plans/${id}/history/${hist.json[1].id}`);
    assert.equal(old.json.data.nextId, 1);

    const del = await alice("DELETE", `/api/plans/${id}`);
    assert.equal(del.status, 200);
    assert.equal((await alice("GET", `/api/plans/${id}`)).status, 404);
    assert.equal((await alice("GET", `/api/plans/${id}/history`)).status, 404);
  });

  test("Verlauf wird auf HISTORY_KEEP begrenzt", async () => {
    const { json } = await alice("POST", "/api/plans", { name: "Viele", data: samplePlan() });
    let v = json.version;
    for (let i = 0; i < 8; i++) {
      const r = await alice("PUT", `/api/plans/${json.id}`, { name: "Viele", data: samplePlan({ nextId: 10 + i }), version: v });
      v = r.json.version;
    }
    const hist = await alice("GET", `/api/plans/${json.id}/history`);
    assert.equal(hist.json.length, 3);
    assert.equal(hist.json[0].version, 8); // letzter Vorgänger-Stand
  });

  test("Pläne sind pro Nutzer getrennt", async () => {
    const { json } = await alice("POST", "/api/plans", { name: "Privat", data: samplePlan() });
    assert.equal((await bob("GET", `/api/plans/${json.id}`)).status, 404);
    assert.equal((await bob("PUT", `/api/plans/${json.id}`, { name: "x", data: samplePlan(), version: 1 })).status, 404);
    assert.equal((await bob("DELETE", `/api/plans/${json.id}`)).status, 404);
    assert.equal((await bob("GET", `/api/plans/${json.id}/history`)).status, 404);
    assert.ok(!(await bob("GET", "/api/plans")).json.some((p) => p.id === json.id));
  });

  test("ungültige Eingaben", async () => {
    assert.equal((await alice("POST", "/api/plans", { name: "x", data: "kein objekt" })).status, 400);
    assert.equal((await alice("POST", "/api/plans", { name: "x", data: { devices: "nein" } })).status, 400);
    assert.equal((await alice("POST", "/api/plans", { name: "x" })).status, 400);
    const { json } = await alice("POST", "/api/plans", { name: "ok", data: samplePlan() });
    assert.equal((await alice("PUT", `/api/plans/${json.id}`, { name: "ok", data: samplePlan() })).status, 400); // ohne version
    assert.equal((await alice("GET", "/api/plans/abc")).status, 404);
    assert.equal((await alice("GET", "/api/gibts-nicht")).status, 404);
    const long = await alice("POST", "/api/plans", { name: "n".repeat(500), data: samplePlan() });
    assert.equal((await alice("GET", `/api/plans/${long.json.id}`)).json.name.length, 120);
  });

  test("zu große Anfrage wird mit 413 abgewiesen", async () => {
    const big = samplePlan({ devices: [{ label: "x".repeat(6 * 1024 * 1024) }] });
    assert.equal((await alice("POST", "/api/plans", { name: "gross", data: big })).status, 413);
  });

  test("SQL-Injection über Namen bleibt wirkungslos", async () => {
    const evil = "x'); DROP TABLE plans;--";
    const { json } = await alice("POST", "/api/plans", { name: evil, data: samplePlan() });
    assert.equal((await alice("GET", `/api/plans/${json.id}`)).json.name, evil);
    assert.equal((await alice("GET", "/api/plans")).status, 200);
  });

  test("Abmelden löscht das Cookie", async () => {
    const out = await alice("POST", "/api/auth/logout");
    assert.equal(out.status, 200);
    assert.match(out.res.headers.get("set-cookie"), /hv_session=;.*Max-Age=0/);
  });
});

describe("SHARE_PLANS=true", () => {
  let ctx;
  before(async () => {
    ctx = await startApp({ SHARE_PLANS: "true" });
  });
  after(() => ctx.close());

  test("angemeldete Nutzer teilen sich die Pläne", async () => {
    const a = client(ctx.base, sessionCookie("alice", "Alice"));
    const b = client(ctx.base, sessionCookie("bob", "Bob"));
    const { json } = await a("POST", "/api/plans", { name: "Gemeinsam", data: samplePlan() });
    const seen = await b("GET", "/api/plans");
    assert.equal(seen.json[0].name, "Gemeinsam");
    assert.equal(seen.json[0].mine, false);
    assert.equal((await b("PUT", `/api/plans/${json.id}`, { name: "Gemeinsam", data: samplePlan({ nextId: 5 }), version: 1 })).status, 200);
    assert.equal((await a("GET", `/api/plans/${json.id}`)).json.updated_by, "Bob");
  });
});
