/**
 * Bearbeitungsoperationen auf einem Plan. Alle Funktionen sind rein:
 * Sie verändern den übergebenen Plan nicht und liefern einen neuen zurück.
 */
import {
  LIMITS,
  PHASES,
  TE,
  defOf,
  defWidthMM,
  railConfig,
  railKey,
  type Device,
  type DeviceDef,
  type Link,
  type Phase,
  type Plan,
  type RailConfig,
} from "./types";
import { Wiring, isLineKind } from "./wiring";

const EPS = 0.05;
const round1 = (n: number) => Math.round(n * 10) / 10;
const clone = <T>(v: T): T => structuredClone(v);

export const railWidth = (plan: Plan) => plan.board.te * TE;
export const usesTE = (def: DeviceDef) => def.width.unit === "te";

export function devicesOnRail(plan: Plan, field: number, row: number, ignoreId?: string): Device[] {
  return plan.devices.filter((d) => d.field === field && d.row === row && d.id !== ignoreId).sort((a, b) => a.x - b.x);
}

export function isFree(plan: Plan, field: number, row: number, x: number, width: number, ignoreId?: string): boolean {
  if (x < -EPS || x + width > railWidth(plan) + EPS) return false;
  return devicesOnRail(plan, field, row, ignoreId).every((d) => x + width <= d.x + EPS || x >= d.x + d.width - EPS);
}

/** Rastet eine Rohposition ein: TE-Geräte auf halbe TE, mm-Geräte auf 0,1 mm mit Fang an Nachbarkanten. */
export function snapX(plan: Plan, def: DeviceDef, width: number, field: number, row: number, raw: number, ignoreId?: string): number {
  const max = Math.max(0, railWidth(plan) - width);
  let x = Math.min(max, Math.max(0, raw));
  if (usesTE(def)) return Math.min(max, Math.round(x / (TE / 2)) * (TE / 2));
  let best = x;
  let bestDist = 3; // Fangbereich in mm
  for (const d of devicesOnRail(plan, field, row, ignoreId)) {
    for (const edge of [d.x + d.width, d.x - width]) {
      const dist = Math.abs(edge - x);
      if (dist < bestDist && edge >= -EPS && edge <= max + EPS) {
        best = edge;
        bestDist = dist;
      }
    }
  }
  return round1(Math.min(max, Math.max(0, best)));
}

/** Nächste freie Position zur Wunschposition, null wenn die Reihe voll ist. */
export function nearestFreeX(plan: Plan, def: DeviceDef, width: number, field: number, row: number, wanted: number, ignoreId?: string): number | null {
  const x = snapX(plan, def, width, field, row, wanted, ignoreId);
  if (isFree(plan, field, row, x, width, ignoreId)) return x;
  const others = devicesOnRail(plan, field, row, ignoreId);
  const grid = (v: number, up: boolean) => (usesTE(def) ? (up ? Math.ceil(v / (TE / 2) - EPS) : Math.floor(v / (TE / 2) + EPS)) * (TE / 2) : round1(v));
  const candidates = [0, ...others.flatMap((d) => [grid(d.x + d.width, true), grid(d.x - width, false)])];
  let best: number | null = null;
  for (const c of candidates) {
    if (!isFree(plan, field, row, c, width, ignoreId)) continue;
    if (best == null || Math.abs(c - wanted) < Math.abs(best - wanted)) best = c;
  }
  return best;
}

function nextId(plan: Plan, prefix: "d" | "s"): string {
  return `${prefix}${plan.seq++}`;
}

export interface PlaceResult {
  plan: Plan;
  id: string;
}

/** Setzt ein neues Gerät. Liefert null, wenn in der Reihe kein Platz ist. */
export function placeDevice(src: Plan, def: DeviceDef, field: number, row: number, wantedX: number): PlaceResult | null {
  const width = defWidthMM(def);
  const x = nearestFreeX(src, def, width, field, row, wantedX);
  if (x == null) return null;
  const plan = clone(src);
  plan.defs[def.id] ??= clone(stripCatalogFields(def));
  const id = nextId(plan, "d");
  plan.devices.push({
    id,
    def: def.id,
    label: "",
    tech: def.tech,
    field,
    row,
    x,
    width,
    phase: "auto",
    group: "",
    status: plan.insertStatus,
    inputs: {},
  });
  // Ein Gerät, das eine Stromschiene speist, bringt sie in einer Reihe ohne Schiene gleich mit.
  if (def.busbarFeed && railConfig(plan, field, row).busbar === "none") {
    const poles = def.outputs.filter((p) => isLineKind(p.kind)).length;
    plan.rails[railKey(field, row)] = { busbar: poles >= 3 ? "3P" : "1P", start: "L1" };
  }
  return { plan, id };
}

export function stripCatalogFields(def: DeviceDef): DeviceDef {
  const { builtin: _b, hidden: _h, ...rest } = def as DeviceDef & { builtin?: boolean; hidden?: boolean };
  return rest;
}

export function moveDevice(src: Plan, id: string, field: number, row: number, wantedX: number): Plan | null {
  const cur = src.devices.find((d) => d.id === id);
  if (!cur) return null;
  const x = nearestFreeX(src, defOf(src, cur), cur.width, field, row, wantedX, id);
  if (x == null) return null;
  if (cur.field === field && cur.row === row && Math.abs(cur.x - x) < EPS) return src;
  const plan = clone(src);
  Object.assign(plan.devices.find((d) => d.id === id)!, { field, row, x });
  return plan;
}

export function updateDevice(src: Plan, id: string, patch: Partial<Omit<Device, "id" | "def" | "inputs">>): Plan {
  const plan = clone(src);
  const d = plan.devices.find((x) => x.id === id);
  if (d) Object.assign(d, patch);
  return plan;
}

/** Ändert die Breite, sofern das Gerät danach noch Platz hat. */
export function resizeDevice(src: Plan, id: string, width: number): Plan | null {
  const cur = src.devices.find((d) => d.id === id);
  if (!cur || !(width > 0)) return null;
  const w = round1(width);
  if (!isFree(src, cur.field, cur.row, cur.x, w, id)) return null;
  return updateDevice(src, id, { width: w });
}

export function removeDevice(src: Plan, id: string): Plan {
  const plan = clone(src);
  plan.devices = plan.devices.filter((d) => d.id !== id);
  dropLinksTo(plan, id);
  pruneDefs(plan);
  return plan;
}

function dropLinksTo(plan: Plan, id: string) {
  for (const d of plan.devices) {
    for (const [k, l] of Object.entries(d.inputs)) if (l.from === id) delete d.inputs[k];
  }
}

function pruneDefs(plan: Plan) {
  const used = new Set(plan.devices.map((d) => d.def));
  for (const k of Object.keys(plan.defs)) if (!used.has(k)) delete plan.defs[k];
}

/** Kopie rechts neben dem Original (oder an der nächsten freien Stelle der Reihe). Ohne Verdrahtung. */
export function duplicateDevice(src: Plan, id: string): PlaceResult | null {
  const cur = src.devices.find((d) => d.id === id);
  if (!cur) return null;
  const x = nearestFreeX(src, defOf(src, cur), cur.width, cur.field, cur.row, cur.x + cur.width);
  if (x == null) return null;
  const plan = clone(src);
  const copy: Device = { ...clone(cur), id: nextId(plan, "d"), x, inputs: {} };
  plan.devices.push(copy);
  return { plan, id: copy.id };
}

// ---------- Verdrahtung ----------

export function connect(src: Plan, deviceId: string, inputId: string, link: Link | null): Plan {
  const plan = clone(src);
  const d = plan.devices.find((x) => x.id === deviceId);
  if (!d) return src;
  if (link) d.inputs[inputId] = { from: link.from, port: link.port };
  else delete d.inputs[inputId];
  return plan;
}

/**
 * Verbindet alle passenden Eingänge eines Geräts mit einer Quelle:
 * erst gleichnamige Anschlüsse, dann gleiche Leiterart. Bereits belegte
 * Ausgänge mit begrenzter Zahl an Zielen werden übersprungen.
 */
export function autoConnect(src: Plan, deviceId: string, fromId: string): Plan {
  const w = new Wiring(src);
  const d = w.devices.get(deviceId);
  if (!d || deviceId === fromId) return src;
  const outs = w.outputsOf(fromId);
  const taken = new Set<string>();
  const freeOut = (p: (typeof outs)[number]) =>
    !taken.has(p.id) && (p.max == null || w.consumers(fromId, p.id).filter((c) => !c.implicit && c.device.id !== deviceId).length < p.max);
  const plan = clone(src);
  const target = plan.devices.find((x) => x.id === deviceId)!;
  for (const inp of w.def(d).inputs) {
    if (inp.kind === "ctrl") continue;
    const match =
      outs.find((p) => p.id === inp.id && p.kind === inp.kind && freeOut(p)) ??
      outs.find((p) => p.kind === inp.kind && freeOut(p)) ??
      (inp.kind === "L" ? outs.find((p) => isLineKind(p.kind) && freeOut(p)) : undefined);
    if (!match) continue;
    target.inputs[inp.id] = { from: fromId, port: match.id };
    if (match.max != null) taken.add(match.id);
  }
  return plan;
}

// ---------- Schrank, Reihen, Quellen ----------

export function outOfBounds(plan: Plan, board: Plan["board"]): Device[] {
  const max = board.te * TE;
  return plan.devices.filter((d) => d.field >= board.fields || d.row >= board.rows || d.x + d.width > max + EPS);
}

/** Ändert die Schrankgröße. Geräte außerhalb werden entfernt. */
export function setBoard(src: Plan, wanted: Plan["board"]): Plan {
  const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v) || lo));
  const board = { fields: clamp(wanted.fields, LIMITS.fields), rows: clamp(wanted.rows, LIMITS.rows), te: clamp(wanted.te, LIMITS.te) };
  const plan = clone(src);
  const gone = new Set(outOfBounds(plan, board).map((d) => d.id));
  plan.board = board;
  plan.devices = plan.devices.filter((d) => !gone.has(d.id));
  gone.forEach((id) => dropLinksTo(plan, id));
  for (const k of Object.keys(plan.rails)) {
    const [f, r] = k.split(":").map(Number);
    if (f >= board.fields || r >= board.rows) delete plan.rails[k];
  }
  pruneDefs(plan);
  return plan;
}

export function setRail(src: Plan, field: number, row: number, patch: Partial<RailConfig>): Plan {
  const plan = clone(src);
  plan.rails[railKey(field, row)] = { ...railConfig(plan, field, row), ...patch };
  return plan;
}

/** Tauscht zwei Reihen eines Feldes samt Geräten und Stromschiene. */
export function swapRows(src: Plan, field: number, a: number, b: number): Plan {
  if (a === b || Math.min(a, b) < 0 || Math.max(a, b) >= src.board.rows) return src;
  const plan = clone(src);
  for (const d of plan.devices) {
    if (d.field !== field) continue;
    if (d.row === a) d.row = b;
    else if (d.row === b) d.row = a;
  }
  const ka = railKey(field, a);
  const kb = railKey(field, b);
  const ra = plan.rails[ka];
  const rb = plan.rails[kb];
  delete plan.rails[ka];
  delete plan.rails[kb];
  if (ra) plan.rails[kb] = ra;
  if (rb) plan.rails[ka] = rb;
  return plan;
}

/** Verteilt die Startphasen der Stromschienen reihum (L1, L3, L2), damit die Phasen gleichmäßiger belegt sind. */
export function balancePhases(src: Plan): Plan {
  const pattern: Phase[] = ["L1", "L3", "L2"];
  const plan = clone(src);
  let i = 0;
  for (let f = 0; f < plan.board.fields; f++) {
    for (let r = 0; r < plan.board.rows; r++) {
      const cfg = railConfig(plan, f, r);
      if (cfg.busbar === "none") continue;
      plan.rails[railKey(f, r)] = { ...cfg, start: pattern[i++ % pattern.length] };
    }
  }
  return plan;
}

export function addSource(src: Plan, label: string): PlaceResult {
  const plan = clone(src);
  const id = nextId(plan, "s");
  plan.sources.push({ id, label: label.trim() || "Externe Quelle" });
  return { plan, id };
}

export function renameSource(src: Plan, id: string, label: string): Plan {
  const plan = clone(src);
  const s = plan.sources.find((x) => x.id === id);
  if (s) s.label = label;
  return plan;
}

export function removeSource(src: Plan, id: string): Plan {
  const plan = clone(src);
  plan.sources = plan.sources.filter((s) => s.id !== id);
  dropLinksTo(plan, id);
  return plan;
}

/**
 * Ersetzt die im Plan gespeicherte Definition durch den aktuellen Katalogstand.
 * Verbindungen zu Anschlüssen, die es nicht mehr gibt, werden gelöst.
 */
export function refreshDef(src: Plan, def: DeviceDef): Plan {
  if (!src.defs[def.id]) return src;
  const plan = clone(src);
  plan.defs[def.id] = clone(stripCatalogFields(def));
  const inputs = new Set(def.inputs.map((p) => p.id));
  const outputs = new Set(def.outputs.map((p) => p.id));
  for (const d of plan.devices) {
    if (d.def === def.id) {
      for (const k of Object.keys(d.inputs)) if (!inputs.has(k)) delete d.inputs[k];
    }
    for (const [k, l] of Object.entries(d.inputs)) {
      const from = plan.devices.find((x) => x.id === l.from);
      if (from?.def === def.id && !outputs.has(l.port)) delete d.inputs[k];
    }
  }
  return plan;
}

// ---------- Kennzahlen ----------

export interface Summary {
  devices: number;
  usedMM: number;
  freeMM: number;
  usedPercent: number;
  /** Abgänge (Schutzgeräte) je Außenleiter. */
  phases: Record<Phase, number>;
  newDevices: number;
}

export function summarize(plan: Plan, w = new Wiring(plan)): Summary {
  const total = plan.board.fields * plan.board.rows * railWidth(plan);
  const used = plan.devices.reduce((s, d) => s + d.width, 0);
  const phases: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  for (const d of plan.devices) {
    if (w.def(d).role !== "protection") continue;
    for (const p of w.phasesOf(d)) if (PHASES.includes(p as Phase)) phases[p as Phase]++;
  }
  return {
    devices: plan.devices.length,
    usedMM: round1(used),
    freeMM: round1(total - used),
    usedPercent: total ? Math.round((used / total) * 100) : 0,
    phases,
    newDevices: plan.devices.filter((d) => d.status === "new").length,
  };
}

/** Position eines Geräts als Text, z. B. "F1 R2 · TE 3,5" (erste TE = 1) oder "F1 R2 · 10,4 mm". */
export function positionText(d: Device, def: DeviceDef): string {
  const pos = usesTE(def) ? `TE ${(d.x / TE + 1).toLocaleString("de-DE", { maximumFractionDigits: 1 })}` : `${d.x.toLocaleString("de-DE", { maximumFractionDigits: 1 })} mm`;
  return `F${d.field + 1} R${d.row + 1} · ${pos}`;
}

export function widthText(width: number, def: DeviceDef): string {
  if (usesTE(def)) return `${(width / TE).toLocaleString("de-DE", { maximumFractionDigits: 2 })} TE`;
  return `${width.toLocaleString("de-DE", { maximumFractionDigits: 1 })} mm`;
}
