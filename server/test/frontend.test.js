import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { startApp } from "./helpers.js";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage(base, { fileMode = false } = {}) {
  let html = fs.readFileSync(path.join(WEB, "index.html"), "utf8");
  html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, {
    url: fileMode ? "file:///tmp/index.html" : base + "/",
    runScripts: "outside-only",
    pretendToBeVisual: true,
    beforeParse(w) {
      w.fetch = (u, o) => fetch(new URL(u, base), o);
      w.confirm = () => true;
      w.alert = (m) => { w.__alerts = [...(w.__alerts || []), m]; };
      w.prompt = (_m, d) => d;
      w.HTMLCanvasElement.prototype.getContext = () => null;
      w.scrollTo = () => {};
      w.structuredClone = structuredClone;
    },
  });
  for (const f of ["components.js", "app.js"]) dom.window.eval(fs.readFileSync(path.join(WEB, f), "utf8"));
  await sleep(300);
  return dom;
}
const $ = (d, s) => d.window.document.querySelector(s);
const setName = (d, v) => { const i = $(d, "#projectName"); i.value = v; i.dispatchEvent(new d.window.Event("input", { bubbles: true })); };

test("Frontend: Server-Modus, Speichern, Autosave, Konflikt, Verlauf, Löschen", { timeout: 60000 }, async () => {
  const s = await startApp({ AUTH_DISABLED: "true", WEB_DIR: WEB, HISTORY_MIN_INTERVAL_MINUTES: "0" });
  let dom;
  try {
    dom = await openPage(s.base);
    assert.equal($(dom, "#serverBar").hidden, false, "Serverleiste sichtbar");
    assert.equal($(dom, "#saveBtn").textContent, "Export JSON");
    assert.equal($(dom, "#plansModal").hidden, false, "Planliste öffnet sich bei leerem Editor");
    assert.match($(dom, "#plansList").textContent, /Noch keine Pläne/);

    // Erstes Speichern legt einen Plan an
    setName(dom, "Zählerschrank EG");
    $(dom, "#serverSaveBtn").click();
    await sleep(600);
    let list = s.db.listPlans("dev", true);
    assert.equal(list.length, 1);
    assert.equal(list[0].name, "Zählerschrank EG");
    assert.equal(list[0].version, 1);
    assert.match($(dom, "#serverStatus").textContent, /Gespeichert/);

    // Autosave nach Änderung
    setName(dom, "Zählerschrank EG neu");
    await sleep(6000);
    list = s.db.listPlans("dev", true);
    assert.equal(list[0].name, "Zählerschrank EG neu");
    assert.equal(list[0].version, 2);
    assert.equal(list.length, 1, "Autosave legt keinen zweiten Plan an");

    // Verlauf enthält Vorversion
    const hist = s.db.listHistory(list[0].id);
    assert.equal(hist.length >= 1, true);

    // Konflikt: Server-Stand extern ändern, dann manuell speichern -> confirm(true) überschreibt
    const cur = s.db.getPlan(list[0].id);
    s.db.updatePlan({ id: cur.id, name: "extern", data: cur.data, expectedVersion: cur.version, editorName: "x" });
    setName(dom, "lokal gewinnt");
    $(dom, "#serverSaveBtn").click();
    await sleep(800);
    assert.equal(s.db.getPlan(cur.id).name, "lokal gewinnt");

    // Planliste: Öffnen / Verlauf wiederherstellen
    $(dom, "#plansBtn").click();
    await sleep(500);
    assert.match($(dom, "#plansList").textContent, /lokal gewinnt/);
    [...dom.window.document.querySelectorAll("#plansList button")].find((b) => b.textContent === "Verlauf").click();
    await sleep(500);
    const restore = [...dom.window.document.querySelectorAll("#plansList .history-line button")];
    assert.ok(restore.length >= 1, "Wiederherstellen-Button vorhanden");
    restore[restore.length - 1].click();
    await sleep(800);
    assert.equal($(dom, "#plansModal").hidden, true);
    assert.notEqual($(dom, "#projectName").value, "lokal gewinnt", "ältere Version geladen");
    await sleep(5500);
    assert.equal(s.db.getPlan(cur.id).name, $(dom, "#projectName").value, "wiederhergestellte Version wird gespeichert");

    // Reset löst Verknüpfung: Autosave darf Plan nicht leeren
    const before = s.db.getPlan(cur.id);
    $(dom, "#resetBtn").click();
    await sleep(5500);
    const after = s.db.getPlan(cur.id);
    assert.equal(after.version, before.version, "Plan nach Reset unverändert");
    assert.equal(after.name, before.name);

    // Löschen
    $(dom, "#plansBtn").click();
    await sleep(500);
    [...dom.window.document.querySelectorAll("#plansList button")].find((b) => b.textContent === "Löschen").click();
    await sleep(600);
    assert.equal(s.db.listPlans("dev", true).length, 0);
    assert.deepEqual(dom.window.__alerts || [], []);
  } finally {
    dom?.window.close();
    await s.close();
  }
});

test("Frontend: Standalone (file://) bleibt unverändert", async () => {
  const dom = await openPage("http://127.0.0.1:1", { fileMode: true });
  try {
    assert.equal($(dom, "#serverBar").hidden, true);
    assert.equal($(dom, "#saveBtn").textContent, "Plan speichern");
  } finally { dom.window.close(); }
});

test("Frontend: Server ohne Sitzung (401) -> Standalone-Modus", async () => {
  const s = await startApp({ WEB_DIR: WEB });
  let dom;
  try {
    dom = await openPage(s.base);
    assert.equal($(dom, "#serverBar").hidden, true);
  } finally { dom?.window.close(); await s.close(); }
});

test("Frontend: Teilen-Panel und Nur-Lesen für Betrachter", { timeout: 60000 }, async () => {
  const s = await startApp({ AUTH_DISABLED: "true", WEB_DIR: WEB });
  let dom;
  try {
    s.db.upsertUser({ sub: "bob", name: "Bob Beispiel", email: "bob@example.com" });
    dom = await openPage(s.base);
    setName(dom, "Mein Plan");
    $(dom, "#serverSaveBtn").click();
    await sleep(600);
    const mine = s.db.listPlans("dev")[0];

    // Teilen: Nutzer suchen und als Bearbeiter hinzufügen
    $(dom, "#plansBtn").click();
    await sleep(500);
    const doc = dom.window.document;
    [...doc.querySelectorAll("#plansList button")].find((b) => b.textContent === "Teilen").click();
    await sleep(600);
    const search = doc.querySelector("#plansList .plan-share input[type=search]");
    assert.ok(search, "Suchfeld vorhanden");
    search.value = "bob";
    search.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    await sleep(900);
    assert.match(doc.querySelector(".share-results").textContent, /Bob Beispiel/);
    const sel = doc.querySelector(".share-results select");
    sel.value = "editor";
    [...doc.querySelectorAll(".share-results button")].find((b) => b.textContent === "Hinzufügen").click();
    await sleep(800);
    assert.deepEqual(s.db.listShares(mine.id).map((x) => [x.sub, x.permission]), [["bob", "editor"]]);
    assert.match(doc.querySelector(".plan-share").textContent, /Bob Beispiel/);

    // Betrachter-Plan von Bob: öffnen, ändern, es darf nichts gespeichert werden
    const bobPlan = s.db.createPlan({ owner: "bob", ownerName: "Bob Beispiel", name: "Bobs Plan", data: JSON.stringify({ version: "6.66", projectName: "Bobs Plan", devices: [], nextId: 1 }) });
    s.db.setShare(bobPlan.id, "dev", "viewer");
    $(dom, "#plansBtn").click();
    await sleep(100);
    $(dom, "#plansCloseBtn").click();
    $(dom, "#plansBtn").click();
    await sleep(600);
    const rows = [...doc.querySelectorAll("#plansList .plan-row")];
    const row = rows.find((r) => r.textContent.includes("Bobs Plan"));
    assert.match(row.textContent, /Betrachter/);
    assert.equal([...row.querySelectorAll("button")].some((b) => b.textContent === "Verlauf" || b.textContent === "Teilen"), false);
    [...row.querySelectorAll("button")].find((b) => b.textContent === "Öffnen").click();
    await sleep(900);
    assert.match($(dom, "#serverStatus").textContent, /Nur lesen/);
    setName(dom, "Fremde Änderung");
    await sleep(5500);
    assert.equal(s.db.getPlan(bobPlan.id).version, 1, "Betrachter speichert nichts");
    $(dom, "#serverSaveBtn").click();
    await sleep(500);
    assert.equal(s.db.getPlan(bobPlan.id).version, 1);
    assert.match($(dom, "#serverStatus").textContent, /Nur lesen/);
  } finally {
    dom?.window.close();
    await s.close();
  }
});

test("Frontend: bis zu 8 Felder auswählbar", async () => {
  const dom = await openPage("http://127.0.0.1:1", { fileMode: true });
  try {
    const sel = $(dom, "#fieldCount");
    assert.equal(sel.options.length, 8);
    sel.value = "5";
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    await sleep(200);
    assert.equal(dom.window.document.querySelectorAll("#board .field, .board .field").length, 5);
  } finally { dom.window.close(); }
});

test("Frontend: 'Zur Auswahl springen' ist standardmäßig aus", async () => {
  const dom = await openPage("http://127.0.0.1:1", { fileMode: true });
  try {
    assert.equal($(dom, "#autoJump").checked, false);
  } finally { dom.window.close(); }
});

test("Frontend: Reihe nach unten/oben tauschen (Geräte, Stromschiene, Startphase)", { timeout: 30000 }, async () => {
  const s = await startApp({ AUTH_DISABLED: "true", WEB_DIR: WEB });
  let dom;
  try {
    const dev = (id, row, field = 0) => ({ id, type: "ls1", label: "B16", tech: "LS", mode: "te", widthTE: 1, field, row, xMM: 0, phase: "L1", inputFrom: null, inputPort: "OUT", installStatus: "existing" });
    const data = {
      version: "6.66", projectName: "Reihen", fields: 2, rows: 3, te: 12, nextId: 4,
      devices: [dev(1, 0), dev(2, 1), dev(3, 0, 1)],
      rowRailModes: { "0:0": "3P" }, phaseStarts: { "0:0": "L2" },
    };
    const created = s.db.createPlan({ owner: "dev", ownerName: "Entwicklung", name: "Reihen", data: JSON.stringify(data) });
    dom = await openPage(s.base);
    const doc = dom.window.document;
    [...doc.querySelectorAll("#plansList button")].find((b) => b.textContent === "Öffnen").click();
    await sleep(900);

    const btn = (label, field, row) => doc.querySelector(`button.row-move-btn[aria-label="${label} (Feld ${field} Reihe ${row})"]`);
    assert.equal(btn("Reihe nach oben", 1, 1).disabled, true, "oberste Reihe: Pfeil hoch deaktiviert");
    assert.equal(btn("Reihe nach unten", 1, 3).disabled, true, "unterste Reihe: Pfeil runter deaktiviert");
    btn("Reihe nach unten", 1, 1).click(); // Feld 1: Reihe 1 <-> Reihe 2
    await sleep(5500); // Autosave
    let saved = JSON.parse(s.db.getPlan(created.id).data);
    const rowOf = (id) => saved.devices.find((d) => d.id === id);
    assert.equal(rowOf(1).row, 1);
    assert.equal(rowOf(2).row, 0);
    assert.equal(rowOf(3).row, 0, "anderes Feld bleibt unberührt");
    assert.equal(saved.rowRailModes["0:1"], "3P");
    assert.equal(saved.phaseStarts["0:1"], "L2");
    assert.equal(saved.rowRailModes["0:0"], undefined);
    assert.equal(saved.phaseStarts["0:0"], undefined);

    btn("Reihe nach oben", 1, 2).click(); // zurück
    await sleep(5500);
    saved = JSON.parse(s.db.getPlan(created.id).data);
    assert.equal(rowOf(1).row, 0);
    assert.equal(rowOf(2).row, 1);
    assert.equal(saved.rowRailModes["0:0"], "3P");
  } finally {
    dom?.window.close();
    await s.close();
  }
});
