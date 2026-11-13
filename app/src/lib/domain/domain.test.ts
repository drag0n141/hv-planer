import { describe, expect, it } from "vitest";
// @ts-ignore – reine JS-Datendatei des Servers
import { BUILTIN_CATALOG } from "../../../../server/src/catalog-builtin.js";
import { importLegacy, isLegacyPlan, loadPlanData } from "./legacy";
import {
  addSource,
  autoConnect,
  balancePhases,
  connect,
  duplicateDevice,
  isFree,
  moveDevice,
  placeDevice,
  refreshDef,
  removeDevice,
  resizeDevice,
  setBoard,
  setRail,
  summarize,
  swapRows,
} from "./plan";
import { bomCsv, buildBom, checkPlan, circuits, deviceList, logicTree } from "./reports";
import { TE, emptyPlan, type DeviceDef, type Plan } from "./types";
import { Wiring } from "./wiring";

const catalog = BUILTIN_CATALOG as DeviceDef[];
const def = (id: string) => catalog.find((d) => d.id === `builtin:${id}`)!;

function place(plan: Plan, type: string, row: number, te: number, field = 0): [Plan, string] {
  const r = placeDevice(plan, def(type), field, row, te * TE);
  if (!r) throw new Error(`kein Platz für ${type}`);
  return [r.plan, r.id];
}

/** Quelle → RCD 4P → drei LS auf 3P-Schiene, Klemme hinter dem ersten LS. */
function sample() {
  let plan = emptyPlan("Test");
  const src = addSource(plan, "HAK");
  plan = src.plan;
  let rcd: string, a: string, b: string, c: string, term: string;
  [plan, rcd] = place(plan, "rcd4", 0, 0);
  [plan, a] = place(plan, "ls1", 0, 4);
  [plan, b] = place(plan, "ls1", 0, 5);
  [plan, c] = place(plan, "ls1", 0, 6);
  [plan, term] = place(plan, "term3", 1, 0);
  plan = autoConnect(plan, rcd, src.id);
  plan = connect(plan, term, "L", { from: a, port: "OUT" });
  return { plan, src: src.id, rcd, a, b, c, term };
}

describe("Katalog", () => {
  it("hat eindeutige IDs und in sich stimmige Anschlüsse", () => {
    expect(new Set(catalog.map((d) => d.id)).size).toBe(catalog.length);
    for (const d of catalog) {
      const inputs = new Set(d.inputs.map((p) => p.id));
      expect(inputs.size, d.id).toBe(d.inputs.length);
      expect(new Set(d.outputs.map((p) => p.id)).size, d.id).toBe(d.outputs.length);
      for (const o of d.outputs) if (o.from) expect(inputs.has(o.from), `${d.id}.${o.id}`).toBe(true);
    }
  });
});

describe("Platzieren", () => {
  it("rastet auf halbe TE und weicht belegten Plätzen aus", () => {
    let plan = emptyPlan();
    let a: string, b: string;
    [plan, a] = place(plan, "ls1", 0, 2.2);
    expect(plan.devices[0].x).toBe(2 * TE);
    [plan, b] = place(plan, "ls1", 0, 2);
    const second = plan.devices.find((d) => d.id === b)!;
    expect(second.x === 1 * TE || second.x === 3 * TE).toBe(true);
    expect(isFree(plan, 0, 0, 2 * TE, TE)).toBe(false);
    expect(a).not.toBe(b);
  });

  it("lehnt ab, wenn die Reihe voll ist", () => {
    let plan = emptyPlan();
    plan = setBoard(plan, { fields: 1, rows: 1, te: 6 });
    [plan] = place(plan, "rcd4", 0, 0);
    [plan] = place(plan, "rcd2", 0, 4);
    expect(placeDevice(plan, def("ls1"), 0, 0, 0)).toBeNull();
  });

  it("fängt Reihenklemmen an Nachbarkanten", () => {
    let plan = emptyPlan();
    [plan] = place(plan, "term1", 0, 0);
    const r = placeDevice(plan, def("term1"), 0, 0, 6.4)!;
    expect(r.plan.devices[1].x).toBeCloseTo(5.2);
  });

  it("verschiebt, dupliziert, ändert Breite und löscht samt Verbindungen", () => {
    const s = sample();
    const moved = moveDevice(s.plan, s.c, 0, 1, 2 * TE)!;
    expect(moved.devices.find((d) => d.id === s.c)).toMatchObject({ row: 1, x: 2 * TE });
    const dup = duplicateDevice(s.plan, s.term)!;
    expect(dup.plan.devices.find((d) => d.id === dup.id)).toMatchObject({ x: 5.2, inputs: {} });
    expect(resizeDevice(s.plan, s.a, 2 * TE)).toBeNull(); // b sitzt direkt daneben
    expect(resizeDevice(s.plan, s.c, 2 * TE)).not.toBeNull();
    const gone = removeDevice(s.plan, s.a);
    expect(gone.devices.find((d) => d.id === s.term)!.inputs).toEqual({});
    expect(s.plan.devices.find((d) => d.id === s.term)!.inputs.L).toBeDefined(); // Original unverändert
  });

  it("entfernt beim Verkleinern Geräte außerhalb und tauscht Reihen", () => {
    const s = sample();
    const small = setBoard(s.plan, { fields: 1, rows: 1, te: 12 });
    expect(small.devices.some((d) => d.id === s.term)).toBe(false);
    const swapped = swapRows(s.plan, 0, 0, 1);
    expect(swapped.devices.find((d) => d.id === s.term)!.row).toBe(0);
    expect(swapped.rails["0:1"].busbar).toBe("3P");
    expect(swapped.rails["0:0"]).toBeUndefined();
  });
});

describe("Phasen und Stromschiene", () => {
  it("legt beim Setzen eines RCD 4P eine 3P-Schiene an und verteilt die Phasen", () => {
    const s = sample();
    const w = new Wiring(s.plan);
    expect(s.plan.rails["0:0"]).toEqual({ busbar: "3P", start: "L1" });
    expect([s.a, s.b, s.c].map((id) => w.phaseText(w.devices.get(id)!))).toEqual(["L1", "L2", "L3"]);
  });

  it("leitet die Einspeisung über die Schiene aus dem RCD ab", () => {
    const s = sample();
    const w = new Wiring(s.plan);
    expect(w.link(w.devices.get(s.b)!, "IN")).toEqual({ from: s.rcd, port: "L2", implicit: true });
    expect(w.children(s.rcd).map((d) => d.id)).toEqual([s.a, s.b, s.c]);
  });

  it("übernimmt eine verdrehte Phasenfolge hinter dem RCD", () => {
    const s = sample();
    let plan = connect(s.plan, s.rcd, "L1", { from: s.src, port: "L2" });
    plan = connect(plan, s.rcd, "L2", { from: s.src, port: "L3" });
    plan = connect(plan, s.rcd, "L3", { from: s.src, port: "L1" });
    const w = new Wiring(plan);
    expect([s.a, s.b, s.c].map((id) => w.phaseText(w.devices.get(id)!))).toEqual(["L2", "L3", "L1"]);
    expect(w.phaseText(w.devices.get(s.term)!)).toBe("L2");
    // Die Klemme L1 des RCD bleibt L1, speist aber L2.
    expect(w.link(w.devices.get(s.a)!, "IN")!.port).toBe("L1");
  });

  it("beachtet Startphase, 1P-Schienen und feste Phasen", () => {
    let plan = emptyPlan();
    let a: string, b: string;
    [plan, a] = place(plan, "ls1", 0, 0);
    [plan, b] = place(plan, "ls1", 0, 1);
    expect(new Wiring(plan).phaseText(plan.devices[0])).toBe("–");
    plan = setRail(plan, 0, 0, { busbar: "3P", start: "L3" });
    let w = new Wiring(plan);
    expect([a, b].map((id) => w.phaseText(w.devices.get(id)!))).toEqual(["L3", "L1"]);
    plan = setRail(plan, 0, 0, { busbar: "1P", start: "L2" });
    w = new Wiring(plan);
    expect([a, b].map((id) => w.phaseText(w.devices.get(id)!))).toEqual(["L2", "L2"]);
    plan = setRail(plan, 0, 0, { busbar: "none" });
    plan.devices[0].phase = "L3";
    expect(new Wiring(plan).phaseText(plan.devices[0])).toBe("L3");
  });

  it("1-phasige Schiene hinter einem RCD 4P folgt der eingestellten Phase", () => {
    const s = sample();
    let plan = setRail(s.plan, 0, 0, { busbar: "1P", start: "L2" });
    let w = new Wiring(plan);
    expect([s.a, s.b, s.c].map((id) => w.phaseText(w.devices.get(id)!))).toEqual(["L2", "L2", "L2"]);
    expect(w.link(w.devices.get(s.a)!, "IN")).toEqual({ from: s.rcd, port: "L2", implicit: true });
    // verdreht eingespeist: am Pol L2 des RCD liegt L3 an
    plan = connect(plan, s.rcd, "L2", { from: s.src, port: "L3" });
    w = new Wiring(plan);
    expect(w.phaseText(w.devices.get(s.a)!)).toBe("L3");
  });

  it("trennt Schienenabschnitte nach RCD-Gruppe", () => {
    let plan = emptyPlan();
    plan = setBoard(plan, { fields: 1, rows: 1, te: 24 });
    let r1: string, r2: string, ls: string;
    [plan, r1] = place(plan, "rcd4", 0, 0);
    [plan, r2] = place(plan, "rcd4", 0, 8);
    [plan, ls] = place(plan, "ls1", 0, 12);
    let w = new Wiring(plan);
    expect(w.link(w.devices.get(ls)!, "IN")!.from).toBe(r2);
    plan.devices.find((d) => d.id === r1)!.group = "A";
    plan.devices.find((d) => d.id === r2)!.group = "B";
    plan.devices.find((d) => d.id === ls)!.group = "A";
    w = new Wiring(plan);
    expect(w.link(w.devices.get(ls)!, "IN")!.from).toBe(r1);
  });

  it("verteilt Startphasen beim Ausgleichen reihum", () => {
    let plan = emptyPlan();
    for (const r of [0, 1, 2]) plan = setRail(plan, 0, r, { busbar: "3P" });
    expect([0, 1, 2].map((r) => balancePhases(plan).rails[`0:${r}`].start)).toEqual(["L1", "L3", "L2"]);
  });

  it("bricht bei Schleifen ab statt endlos zu rechnen", () => {
    let plan = emptyPlan();
    let a: string, b: string;
    [plan, a] = place(plan, "relais", 0, 0);
    [plan, b] = place(plan, "relais", 0, 2);
    plan = connect(plan, a, "IN", { from: b, port: "OUT" });
    plan = connect(plan, b, "IN", { from: a, port: "OUT" });
    const w = new Wiring(plan);
    expect(w.phaseText(w.devices.get(a)!)).toBe("–");
    expect(checkPlan(plan).some((i) => i.text.includes("Schleife"))).toBe(true);
    expect(() => logicTree(plan)).not.toThrow();
    expect(() => circuits(plan)).not.toThrow();
  });
});

describe("Verdrahten", () => {
  it("verbindet mehrpolige Geräte passend und achtet auf belegte Ausgänge", () => {
    const s = sample();
    expect(s.plan.devices.find((d) => d.id === s.rcd)!.inputs).toEqual({
      L1: { from: s.src, port: "L1" },
      L2: { from: s.src, port: "L2" },
      L3: { from: s.src, port: "L3" },
      N: { from: s.src, port: "N" },
    });
    // Zweite Klemme am selben LS: der Ausgang ist schon belegt (max 1).
    let plan = s.plan;
    let t2: string;
    [plan, t2] = place(plan, "term1", 1, 1);
    plan = autoConnect(plan, t2, s.a);
    expect(plan.devices.find((d) => d.id === t2)!.inputs).toEqual({});
  });
});

describe("Auswertungen", () => {
  it("meldet offene und falsche Verbindungen", () => {
    const s = sample();
    let plan = connect(s.plan, s.term, "N", { from: s.a, port: "OUT" });
    plan = connect(plan, s.term, "PE", { from: "d999", port: "X" });
    const texts = checkPlan(plan).map((i) => `${i.level}:${i.text}`);
    expect(texts.some((t) => t.startsWith("error") && t.includes("erwartet N"))).toBe(true);
    expect(texts.some((t) => t.startsWith("error") && t.includes("nicht mehr gibt"))).toBe(true);
    expect(texts.some((t) => t.startsWith("info") && t.includes("kein zugeordnetes Ziel"))).toBe(true);
    expect(checkPlan(s.plan).filter((i) => i.level === "error")).toEqual([]);
  });

  it("baut Stückliste, CSV und Elementliste", () => {
    const s = sample();
    const plan = structuredClone(s.plan);
    plan.devices.find((d) => d.id === s.c)!.status = "new";
    const ls = buildBom(plan).find((r) => r.label === "LS 1P")!;
    expect(ls).toMatchObject({ count: 3, countNew: 1, width: "1 TE" });
    expect(buildBom(plan, true)).toHaveLength(1);
    const csv = bomCsv(buildBom(plan));
    expect(csv.startsWith("﻿Menge;davon neu;Gerät")).toBe(true);
    expect(csv).toContain("3;1;LS 1P;B16;1 TE;Schutzgeräte");
    const row = deviceList(plan).find((r) => r.id === s.term)!;
    expect(row).toMatchObject({ position: "F1 R2 · 0 mm", phase: "L1", from: "LS 1P" });
    expect(deviceList(plan).find((r) => r.id === s.rcd)!.from).toBe("HAK · L1, HAK · L2, HAK · L3, HAK · N");
  });

  it("bildet Logikplan und Stromkreise", () => {
    const s = sample();
    const tree = logicTree(s.plan);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0].children[0].id).toBe(s.rcd);
    expect(tree.roots[0].children[0].children.map((n) => n.id)).toEqual([s.a, s.b, s.c]);
    expect(tree.roots[0].children[0].children[0].children[0]).toMatchObject({ id: s.term, via: ["L1"] });
    const list = circuits(s.plan);
    expect(list).toHaveLength(3);
    const first = list.find((c) => c.deviceId === s.term)!;
    expect(first.steps.map((x) => x.id)).toEqual([s.src, s.rcd, s.a, s.term]);
    expect(first).toMatchObject({ lines: ["L1"], neutral: "RCD 4P" });
    // N läuft durch RCD und Klemme, am LS 1P vorbei; PE führt nur die Klemme
    expect(first.steps.map((x) => [x.n, x.pe])).toEqual([[true, true], [true, false], [false, false], [true, true]]);
  });

  it("zählt Abgänge je Phase", () => {
    const s = sample();
    expect(summarize(s.plan)).toMatchObject({ devices: 5, phases: { L1: 1, L2: 1, L3: 1 } });
  });
});

describe("Katalogänderungen", () => {
  it("aktualisiert die Momentaufnahme und löst Verbindungen zu entfernten Anschlüssen", () => {
    const s = sample();
    expect(s.plan.defs["builtin:term3"].inputs).toHaveLength(3);
    const slim = { ...def("term3"), inputs: def("term3").inputs.filter((p) => p.id !== "L"), outputs: [] };
    const plan = refreshDef(s.plan, slim);
    expect(plan.devices.find((d) => d.id === s.term)!.inputs).toEqual({});
  });
});

describe("Import alter Pläne", () => {
  const legacy = {
    version: "6.66",
    projectName: "Altbau",
    externalSources: [{ id: -1, externalSource: true, label: "HAK / EVU" }],
    nextSourceId: -2,
    fields: 1,
    rows: 3,
    te: 12,
    phaseStarts: { "0:0": "L2" },
    rowRailModes: { "0:0": "3P" },
    nextId: 8,
    devices: [
      { id: 1, type: "rcd4", label: "RCD 4P", tech: "40A / 30mA", mode: "te", widthTE: 4, phase: "3P", group: "A", inputFrom: null, inputPort: "OUT", field: 0, row: 0, xMM: 0,
        multiInputs: { L1: { sourceId: -1, sourcePort: "L1" }, L2: { sourceId: -1, sourcePort: "L2" }, L3: { sourceId: -1, sourcePort: "L3" }, N: { sourceId: -1, sourcePort: "N" } } },
      { id: 2, type: "ls1", label: "Küche", tech: "B16A", mode: "te", widthTE: 1, phase: "auto", group: "A", inputFrom: 1, inputPort: "L3", installStatus: "new", field: 0, row: 0, xMM: 72 },
      { id: 3, type: "ls3", label: "Herd", tech: "3×B16A", mode: "te", widthTE: 3, phase: "3P", inputFrom: 1, inputPort: "L1", field: 0, row: 0, xMM: 90 },
      { id: 4, type: "term3", label: "X1", tech: "L/N/PE", mode: "mm", widthMM: 5.2, phase: "auto", inputFrom: 2, inputPort: "OUT", field: 0, row: 1, xMM: 0 },
      { id: 5, type: "term1", label: "X2", tech: "1P", mode: "mm", widthMM: 5.2, phase: "auto", inputFrom: 4, inputPort: "OUT", field: 0, row: 1, xMM: 5.2 },
      { id: 6, type: "wallbox_xy", label: "Lastmanager", tech: "", widthTE: 2, phase: "none", field: 0, row: 2, slot: 3 },
      { id: 7, type: "change", label: "Umschalter", tech: "4P", widthTE: 4, phase: "3P", field: 0, row: 2, xMM: 90, multiInputs: { N2: { sourceId: -1, sourcePort: "N" } } },
    ],
  };

  it("erkennt das Altformat", () => {
    expect(isLegacyPlan(legacy)).toBe(true);
    expect(isLegacyPlan(emptyPlan())).toBe(false);
  });

  it("übernimmt Geometrie, Schienen, Quellen und Verdrahtung", () => {
    const { plan, legacy: wasLegacy } = loadPlanData(legacy, catalog);
    expect(wasLegacy).toBe(true);
    expect(plan).toMatchObject({ name: "Altbau", board: { fields: 1, rows: 3, te: 12 }, rails: { "0:0": { busbar: "3P", start: "L2" } }, seq: 8 });
    expect(plan.sources).toEqual([{ id: "s1", label: "HAK / EVU" }]);
    const by = (id: string) => plan.devices.find((d) => d.id === id)!;
    expect(by("d1")).toMatchObject({ def: "builtin:rcd4", label: "", group: "A", width: 72 });
    expect(by("d1").inputs.N).toEqual({ from: "s1", port: "N" });
    expect(by("d2")).toMatchObject({ label: "Küche", status: "new", inputs: { IN: { from: "d1", port: "L3" } } });
    expect(by("d3").inputs).toEqual({ L1: { from: "d1", port: "L1" }, L2: { from: "d1", port: "L2" }, L3: { from: "d1", port: "L3" } });
    expect(by("d4").inputs).toEqual({ L: { from: "d2", port: "OUT" } });
    expect(by("d5").inputs).toEqual({ IN: { from: "d4", port: "L" } });
    expect(by("d6")).toMatchObject({ def: "legacy:wallbox_xy", x: 54, width: 36 });
    expect(by("d7").inputs).toEqual({ "N.2": { from: "s1", port: "N" } });
    const w = new Wiring(plan);
    expect(w.phaseText(by("d5"))).toBe("L3");
    expect(checkPlan(plan).filter((i) => i.level === "error")).toEqual([]);
  });

  it("verarbeitet den Import ohne Katalog nicht kaputt", () => {
    const plan = importLegacy(legacy, []);
    expect(plan.devices).toHaveLength(7);
    expect(Object.keys(plan.defs).every((k) => k.startsWith("legacy:"))).toBe(true);
  });
});
