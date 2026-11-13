import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { isAdmin } from "../src/auth.js";
import { validateDef } from "../src/catalog.js";
import { BUILTIN_CATALOG } from "../src/catalog-builtin.js";
import { loadConfig } from "../src/config.js";
import { openDb } from "../src/db.js";
import { client, samplePlan, sessionCookie, startApp } from "./helpers.js";

const customDef = (extra = {}) => ({
  label: "Wallbox-Schütz",
  tech: "40 A",
  category: "Eigene",
  role: "control",
  width: { unit: "te", value: 2.5 },
  inputs: [{ id: "IN", label: "Eingang", kind: "L" }],
  outputs: [{ id: "OUT", label: "Ausgang", kind: "L", from: "IN", max: 1 }],
  ...extra,
});

describe("Gerätedefinitionen prüfen", () => {
  test("bereinigt gültige Definitionen", () => {
    const { def, error } = validateDef(customDef({ busbarFed: 1, unknown: "x", inputs: [{ id: "IN", kind: "L", bank: " Versorgung " }] }));
    assert.equal(error, undefined);
    assert.deepEqual(def.inputs, [{ id: "IN", label: "IN", kind: "L", bank: "Versorgung" }]);
    assert.equal(def.busbarFed, true);
    assert.equal("unknown" in def, false);
    assert.equal("busbarFeed" in def, false);
  });
  test("lehnt fehlerhafte Definitionen mit verständlicher Meldung ab", () => {
    const bad = (extra, re) => assert.match(validateDef(customDef(extra)).error, re);
    bad({ label: "  " }, /Name fehlt/);
    bad({ role: "magic" }, /Geräteart/);
    bad({ width: { unit: "te", value: 1.3 } }, /halben Schritten/);
    bad({ width: { unit: "mm", value: 0 } }, /Breite/);
    bad({ inputs: [{ id: "a b", kind: "L" }] }, /Eingangs-ID/);
    bad({ inputs: [{ id: "A", kind: "L" }, { id: "A", kind: "N" }] }, /doppelt/);
    bad({ outputs: [{ id: "O", kind: "L", from: "fehlt" }] }, /unbekannten Eingang/);
    bad({ outputs: [{ id: "O", kind: "ctrl" }] }, /Leiterart/);
    bad({ outputs: [{ id: "O", kind: "L", from: "IN", max: 0 }] }, /maximale Ziele/);
    assert.match(validateDef(null).error, /fehlt/);
  });
  test("der eingebaute Katalog besteht die eigene Prüfung unverändert", () => {
    for (const { id, ...rest } of BUILTIN_CATALOG) {
      const { def, error } = validateDef(rest);
      assert.equal(error, undefined, id);
      assert.deepEqual(def, rest, id);
    }
  });
});

describe("Admin-Erkennung", () => {
  const cfg = { adminGroup: "hv-admins", groupsClaim: "groups" };
  test("Liste, Text und fehlender Claim", () => {
    assert.equal(isAdmin({ groups: ["a", "hv-admins"] }, cfg), true);
    assert.equal(isAdmin({ groups: "a, hv-admins" }, cfg), true);
    assert.equal(isAdmin({ groups: ["hv-admins-x"] }, cfg), false);
    assert.equal(isAdmin({}, cfg), false);
    assert.equal(isAdmin({ groups: ["hv-admins"] }, { adminGroup: "", groupsClaim: "groups" }), false);
    assert.equal(isAdmin({ roles: ["hv-admins"] }, { adminGroup: "hv-admins", groupsClaim: "roles" }), true);
  });
  test("Konfiguration", () => {
    const c = loadConfig({ AUTH_DISABLED: "true", OIDC_ADMIN_GROUP: " hv-admins ", OIDC_GROUPS_CLAIM: "roles" });
    assert.equal(c.oidc.adminGroup, "hv-admins");
    assert.equal(c.oidc.groupsClaim, "roles");
    assert.equal(loadConfig({ AUTH_DISABLED: "true" }).oidc.groupsClaim, "groups");
  });
});

describe("Katalog-API", () => {
  let ctx, admin, user;
  before(async () => {
    ctx = await startApp();
    admin = client(ctx.base, sessionCookie("chef", "Chef", { admin: true }));
    user = client(ctx.base, sessionCookie("alice"));
  });
  after(() => ctx.close());

  test("Grundkatalog ist vorhanden und für alle lesbar", async () => {
    const r = await user("GET", "/api/catalog");
    assert.equal(r.status, 200);
    assert.equal(r.json.length, BUILTIN_CATALOG.length);
    assert.deepEqual(r.json.map((e) => e.id), BUILTIN_CATALOG.map((e) => e.id));
    const ls = r.json.find((e) => e.id === "builtin:ls1");
    assert.equal(ls.builtin, true);
    assert.equal(ls.hidden, false);
    assert.equal(ls.busbarFed, true);
    assert.equal((await user("GET", "/api/me")).json.admin, false);
    assert.equal((await admin("GET", "/api/me")).json.admin, true);
  });

  test("nur Admins dürfen ändern", async () => {
    assert.equal((await user("POST", "/api/catalog", customDef())).status, 403);
    assert.equal((await user("PUT", "/api/catalog/builtin%3Als1", { hidden: true })).status, 403);
    assert.equal((await user("DELETE", "/api/catalog/builtin%3Als1")).status, 403);
    // Schreibzugriffe brauchen zusätzlich den Client-Header (CSRF-Schutz)
    assert.equal((await admin("POST", "/api/catalog", customDef(), { "X-HV-Client": "" })).status, 403);
  });

  test("eigenes Gerät anlegen, ändern, ausblenden, löschen", async () => {
    const created = await admin("POST", "/api/catalog", customDef());
    assert.equal(created.status, 201);
    const id = created.json.id;
    assert.match(id, /^custom:[0-9a-f]{12}$/);
    assert.equal(created.json.builtin, false);
    assert.equal(created.json.width.value, 2.5);

    assert.equal((await admin("POST", "/api/catalog", customDef({ label: "" }))).status, 400);

    const url = `/api/catalog/${encodeURIComponent(id)}`;
    const changed = await admin("PUT", url, customDef({ label: "Wallbox", hidden: true }));
    assert.equal(changed.status, 200);
    assert.equal(changed.json.label, "Wallbox");
    assert.equal(changed.json.hidden, true);
    assert.equal((await admin("PUT", url, customDef({ role: "x" }))).status, 400);

    // Ausgeblendete Geräte sehen nur Admins
    assert.equal((await user("GET", "/api/catalog")).json.some((e) => e.id === id), false);
    assert.equal((await admin("GET", "/api/catalog")).json.some((e) => e.id === id), true);

    assert.equal((await admin("DELETE", url)).status, 200);
    assert.equal((await admin("DELETE", url)).status, 404);
    assert.equal((await admin("PUT", url, customDef())).status, 404);
  });

  test("eingebaute Geräte: nur ausblenden, nicht ändern oder löschen", async () => {
    const url = "/api/catalog/builtin%3Areserve";
    const hidden = await admin("PUT", url, customDef({ label: "Gehackt", hidden: true }));
    assert.equal(hidden.status, 200);
    assert.equal(hidden.json.label, "Reserve");
    assert.equal(hidden.json.hidden, true);
    assert.equal((await admin("DELETE", url)).status, 400);
    assert.equal((await admin("PUT", url, { hidden: false })).json.hidden, false);
  });
});

describe("Katalog-Abgleich beim Start", () => {
  test("behält 'ausgeblendet' und eigene Geräte, entfernt entfallene eingebaute", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hv-db-")), "t.sqlite");
    let db = openDb(file);
    db.setCatalogHidden("builtin:reserve", true);
    db.createCatalogEntry("custom:abc", customDef());
    db.raw.prepare("INSERT INTO catalog (id, builtin, hidden, sort, def, updated_at) VALUES ('builtin:alt', 1, 0, 99, '{}', '')").run();
    db.raw.prepare("UPDATE catalog SET def = '{\"label\":\"veraltet\"}' WHERE id = 'builtin:ls1'").run();
    db.close();

    db = openDb(file);
    const all = db.listCatalog();
    assert.equal(all.find((e) => e.id === "builtin:reserve").hidden, true);
    assert.equal(all.find((e) => e.id === "builtin:ls1").label, "LS 1P");
    assert.equal(all.some((e) => e.id === "builtin:alt"), false);
    assert.equal(all.at(-1).id, "custom:abc");
    db.close();
  });

  test("ergänzt die Schema-Spalte in Datenbanken aus Version 1", () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hv-db-")), "old.sqlite");
    let db = openDb(file);
    db.raw.exec("ALTER TABLE plans DROP COLUMN schema");
    db.raw
      .prepare("INSERT INTO plans (owner, name, data, created_at, updated_at) VALUES ('a', 'Alt', '{\"devices\":[]}', '2026-01-01', '2026-01-01')")
      .run();
    db.close();
    db = openDb(file);
    assert.equal(db.listPlans("a")[0].schema, 1);
    db.close();
  });
});

describe("Planformate nebeneinander", () => {
  let ctx, c;
  before(async () => {
    ctx = await startApp();
    c = client(ctx.base, sessionCookie("alice"));
  });
  after(() => ctx.close());

  test("die alte Oberfläche sieht nur alte Pläne, die neue alle", async () => {
    const old = (await c("POST", "/api/plans", { name: "Alt", data: samplePlan() })).json;
    const neu = (await c("POST", "/api/plans", { name: "Neu", data: { schema: 2, name: "Neu", devices: [] } })).json;

    const legacy = (await c("GET", "/api/plans")).json;
    assert.deepEqual(legacy.map((p) => p.id), [old.id]);
    const all = (await c("GET", "/api/plans?format=all")).json;
    assert.deepEqual(all.map((p) => [p.name, p.schema]).sort(), [["Alt", 1], ["Neu", 2]]);
    assert.deepEqual((await c("GET", "/api/plans?format=v2")).json.map((p) => p.id), [neu.id]);

    // Speichern im neuen Format stellt den Plan um
    const saved = await c("PUT", `/api/plans/${old.id}`, { name: "Alt", version: 1, data: { schema: 2, name: "Alt", devices: [] } });
    assert.equal(saved.status, 200);
    assert.deepEqual((await c("GET", "/api/plans")).json, []);
    assert.equal((await c("GET", `/api/plans/${old.id}`)).json.schema, 2);
  });
});

describe("Auslieferung der neuen Oberfläche", () => {
  let ctx, c;
  before(async () => {
    ctx = await startApp();
    c = client(ctx.base, sessionCookie("alice"));
  });
  after(() => ctx.close());

  test("/v2 liefert die App für alle Unterpfade, Assets mit langem Cache", async () => {
    for (const url of ["/v2", "/v2/", "/v2/p/12", "/v2/admin"]) {
      const r = await c("GET", url);
      assert.equal(r.status, 200, url);
      assert.match(await r.res.text(), /HV2/);
      assert.equal(r.res.headers.get("cache-control"), "no-cache");
    }
    const asset = await c("GET", "/v2/assets/app-abc123.js");
    assert.equal(asset.status, 200);
    assert.match(asset.res.headers.get("cache-control"), /immutable/);
    assert.equal((await c("GET", "/v2/assets/fehlt.js")).status, 404);
    // Die alte Oberfläche bleibt unter "/" erreichbar
    assert.match(await (await c("GET", "/")).res.text(), /<title>HV<\/title>/);
  });

  test("ohne Sitzung führt /v2 zur Anmeldung und danach zurück", async () => {
    const r = await client(ctx.base)("GET", "/v2/p/3");
    assert.equal(r.status, 302);
    assert.equal(r.res.headers.get("location"), "/login?redirect=%2Fv2%2Fp%2F3");
  });

  test("fehlt der Build, gibt es einen klaren Hinweis", async () => {
    const other = await startApp({ APP_DIR: path.join(os.tmpdir(), "hv-gibt-es-nicht") });
    try {
      const r = await client(other.base, sessionCookie("alice"))("GET", "/v2/");
      assert.equal(r.status, 503);
      assert.match(await r.res.text(), /nicht gebaut/);
    } finally {
      await other.close();
    }
  });
});
