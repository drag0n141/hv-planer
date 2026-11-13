/** Auswertungen: Plausibilität, Stückliste, Logikplan, Stromkreise. */
import { isSourceId, type Conductor, type Device, type Plan } from "./types";
import { positionText, railWidth, widthText } from "./plan";
import { Wiring, isLineKind, isPhase } from "./wiring";

// ---------- Plausibilität ----------

export interface Issue {
  level: "error" | "warn" | "info";
  text: string;
  deviceId?: string;
}

const EPS = 0.05;

export function checkPlan(plan: Plan, w = new Wiring(plan)): Issue[] {
  const issues: Issue[] = [];
  const name = (d: Device) => `${positionText(d, w.def(d))} · ${d.label || w.def(d).label}`;
  const push = (level: Issue["level"], d: Device, text: string) => issues.push({ level, deviceId: d.id, text: `${name(d)}: ${text}` });
  const devices = w.ordered();

  for (const d of devices) {
    const def = w.def(d);
    if (!plan.defs[d.def]) push("error", d, "Gerätedefinition fehlt im Plan.");
    if (d.field < 0 || d.field >= plan.board.fields || d.row < 0 || d.row >= plan.board.rows || d.x < -EPS || d.x + d.width > railWidth(plan) + EPS) {
      push("error", d, "liegt außerhalb der konfigurierten Verteilung.");
    }

    for (const [inputId, l] of Object.entries(d.inputs)) {
      const port = def.inputs.find((p) => p.id === inputId);
      if (!port) {
        push("error", d, `Verbindung an unbekanntem Eingang „${inputId}“.`);
        continue;
      }
      if (!w.hasOutput(l.from, l.port)) {
        push("error", d, `Eingang ${port.label} verweist auf eine Quelle, die es nicht mehr gibt.`);
        continue;
      }
      const pot = w.outputPotential(l.from, l.port);
      if (pot && port.kind !== "ctrl") {
        const wantsLine = isLineKind(port.kind);
        if (wantsLine !== isPhase(pot) || (!wantsLine && port.kind !== pot)) {
          push("error", d, `Eingang ${port.label} erwartet ${wantsLine ? "einen Außenleiter" : port.kind}, angeschlossen ist ${pot}.`);
        }
      }
    }

    for (const out of def.outputs) {
      const wired = w.consumers(d.id, out.id).filter((c) => !c.implicit);
      if (out.max != null && wired.length > out.max) {
        push("error", d, `Ausgang ${out.label} ist ${wired.length}-fach belegt (höchstens ${out.max}).`);
      }
    }

    if (hasLoop(w, d)) push("error", d, "Verdrahtung bildet eine Schleife.");

    const fed = def.inputs.some((p) => w.link(d, p.id));
    const used = def.outputs.some((p) => w.consumers(d.id, p.id).length > 0);
    if (def.role === "terminal" && !fed) push("warn", d, "Klemme hat keinen zugeordneten Einspeisepfad.");
    if (def.role === "rcd" && !used) push("warn", d, "RCD hat keinen zugeordneten Abgang.");
    if (def.role === "protection" && !used) push("info", d, "Schutzgerät hat kein zugeordnetes Ziel.");
    if ((def.role === "rcd" || def.role === "protection") && def.inputs.length && !fed) push("info", d, "hat keine Einspeisung.");
  }

  for (let f = 0; f < plan.board.fields; f++) {
    for (let r = 0; r < plan.board.rows; r++) {
      const rail = w.onRail(f, r);
      for (let i = 1; i < rail.length; i++) {
        if (rail[i].x < rail[i - 1].x + rail[i - 1].width - EPS) push("error", rail[i], "überlappt mit dem Gerät links daneben.");
      }
    }
  }
  const order = { error: 0, warn: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}

function hasLoop(w: Wiring, start: Device): boolean {
  const seen = new Set<string>();
  const stack = Object.values(start.inputs).map((l) => l.from);
  while (stack.length) {
    const id = stack.pop()!;
    if (id === start.id) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = w.devices.get(id);
    if (d) stack.push(...Object.values(d.inputs).map((l) => l.from));
  }
  return false;
}

// ---------- Stückliste ----------

export interface BomRow {
  label: string;
  tech: string;
  width: string;
  category: string;
  count: number;
  countNew: number;
}

export function buildBom(plan: Plan, onlyNew = false): BomRow[] {
  const rows = new Map<string, BomRow>();
  for (const d of plan.devices) {
    if (onlyNew && d.status !== "new") continue;
    const def = plan.defs[d.def];
    const label = def?.label ?? "Unbekanntes Gerät";
    const width = def ? widthText(d.width, def) : `${d.width} mm`;
    const key = [label, d.tech, width].join("\u0000");
    let row = rows.get(key);
    if (!row) rows.set(key, (row = { label, tech: d.tech, width, category: def?.category ?? "Sonstiges", count: 0, countNew: 0 }));
    row.count++;
    if (d.status === "new") row.countNew++;
  }
  return [...rows.values()].sort((a, b) => a.category.localeCompare(b.category, "de") || a.label.localeCompare(b.label, "de") || a.tech.localeCompare(b.tech, "de"));
}

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV mit Semikolon und BOM, damit Excel Umlaute und Spalten richtig erkennt. */
export function bomCsv(rows: BomRow[]): string {
  const lines = [["Menge", "davon neu", "Gerät", "Technische Angabe", "Breite", "Kategorie"], ...rows.map((r) => [r.count, r.countNew, r.label, r.tech, r.width, r.category])];
  return "﻿" + lines.map((l) => l.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

// ---------- Elementliste ----------

export interface ListRow {
  id: string;
  position: string;
  device: string;
  tech: string;
  phase: string;
  label: string;
  from: string;
  to: string;
  status: Device["status"];
  group: string;
}

export function deviceList(plan: Plan, w = new Wiring(plan)): ListRow[] {
  return w.ordered().map((d) => {
    const def = w.def(d);
    const from: string[] = [];
    for (const p of def.inputs) {
      const l = w.link(d, p.id);
      if (!l) continue;
      const text = `${w.nodeLabel(l.from)}${portSuffix(w, l.from, l.port)}`;
      if (!from.includes(text)) from.push(text);
    }
    const to: string[] = [];
    for (const child of w.children(d.id)) to.push(child.label || w.def(child).label);
    return {
      id: d.id,
      position: positionText(d, def),
      device: def.label,
      tech: d.tech,
      phase: w.phaseText(d),
      label: d.label,
      from: from.join(", "),
      to: to.join(", "),
      status: d.status,
      group: d.group,
    };
  });
}

function portSuffix(w: Wiring, id: string, port: string): string {
  const outs = w.outputsOf(id);
  if (outs.length <= 1) return "";
  return ` · ${outs.find((p) => p.id === port)?.label ?? port}`;
}

// ---------- Logikplan ----------

export interface TreeNode {
  id: string;
  label: string;
  sub: string;
  /** Leiter, über die dieser Knoten an seinem Elternknoten hängt. */
  via: Conductor[];
  phase: string;
  source: boolean;
  status?: Device["status"];
  children: TreeNode[];
}

export interface LogicTree {
  roots: TreeNode[];
  /** Geräte ohne jede Verbindung. */
  loose: Device[];
}

export function logicTree(plan: Plan, w = new Wiring(plan)): LogicTree {
  const parentOf = new Map<string, string>();
  for (const d of plan.devices) {
    const l = w.primaryLink(d);
    if (l) parentOf.set(d.id, l.from);
  }
  const kids = new Map<string, Device[]>();
  for (const d of w.ordered()) {
    const p = parentOf.get(d.id);
    if (!p) continue;
    let list = kids.get(p);
    if (!list) kids.set(p, (list = []));
    list.push(d);
  }
  const build = (id: string, trail: Set<string>): TreeNode => {
    const d = w.devices.get(id);
    const via: Conductor[] = [];
    if (d) {
      const parent = parentOf.get(id);
      for (const p of w.def(d).inputs) {
        const l = w.link(d, p.id);
        const c = l && l.from === parent ? w.outputPotential(l.from, l.port) : null;
        if (c && !via.includes(c)) via.push(c);
      }
    }
    const next = new Set(trail).add(id);
    return {
      id,
      label: w.nodeLabel(id),
      sub: d ? [w.def(d).label !== w.nodeLabel(id) ? w.def(d).label : "", d.tech].filter(Boolean).join(" · ") : "Externe Quelle",
      via,
      phase: d ? w.phaseText(d) : "",
      source: isSourceId(id),
      status: d?.status,
      children: (kids.get(id) ?? []).filter((c) => !next.has(c.id)).map((c) => build(c.id, next)),
    };
  };
  const roots: TreeNode[] = plan.sources.map((s) => build(s.id, new Set()));
  const loose: Device[] = [];
  for (const d of w.ordered()) {
    if (parentOf.has(d.id)) continue;
    if (kids.has(d.id)) roots.push(build(d.id, new Set()));
    else loose.push(d);
  }
  return { roots, loose };
}

// ---------- Stromkreise (Stromlaufplan) ----------

export interface CircuitStep {
  id: string;
  label: string;
  sub: string;
  role: string;
  source: boolean;
}

export interface Circuit {
  nr: number;
  /** Endgerät des Stromkreises. */
  deviceId: string;
  label: string;
  /** Außenleiter am Endgerät. */
  lines: Conductor[];
  /** Herkunft von N und PE als Text, leer wenn nicht geführt. */
  neutral: string;
  earth: string;
  /** Pfad von der Einspeisung bis zum Endgerät. */
  steps: CircuitStep[];
  group: string;
}

/**
 * Ein Stromkreis endet an jedem Gerät, das gespeist wird und selbst nichts weiter speist.
 * N und PE werden unabhängig vom Außenleiterpfad ermittelt: aus der eigenen Verdrahtung,
 * sonst aus dem ersten vorgelagerten Gerät, das den Leiter führt.
 */
export function circuits(plan: Plan, w = new Wiring(plan)): Circuit[] {
  const out: Circuit[] = [];
  for (const d of w.ordered()) {
    const def = w.def(d);
    if (!def.inputs.some((p) => w.link(d, p.id))) continue;
    if (def.outputs.some((p) => w.consumers(d.id, p.id).length)) continue;
    const chainIds = w.chain(d);
    const steps: CircuitStep[] = [...chainIds].reverse().map((id) => {
      const dev = w.devices.get(id);
      return {
        id,
        label: w.nodeLabel(id),
        sub: dev ? dev.tech : "Quelle",
        role: dev ? w.def(dev).role : "source",
        source: isSourceId(id),
      };
    });
    const all = w.phasesOf(d);
    const group = chainIds.map((id) => w.devices.get(id)?.group).find(Boolean) ?? "";
    out.push({
      nr: out.length + 1,
      deviceId: d.id,
      label: d.label || def.label,
      lines: all.filter(isPhase).sort(),
      neutral: conductorOrigin(w, d, chainIds, "N"),
      earth: conductorOrigin(w, d, chainIds, "PE"),
      steps,
      group,
    });
  }
  return out;
}

function conductorOrigin(w: Wiring, d: Device, chainIds: string[], c: "N" | "PE"): string {
  const own = w.def(d).inputs.find((p) => p.kind === c);
  if (own) {
    const l = w.link(d, own.id);
    if (l) return w.nodeLabel(l.from);
  }
  // Nur Geräte, die den Leiter überhaupt führen, bekommen eine Herkunft.
  const carries = own || w.def(d).role === "protection" || w.def(d).role === "terminal";
  if (!carries) return "";
  for (const id of chainIds.slice(1)) {
    if (w.outputsOf(id).some((p) => p.kind === c)) return w.nodeLabel(id);
  }
  return "";
}
