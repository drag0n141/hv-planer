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
