/**
 * Elektrische Auswertung eines Plans: Welche Quelle speist welchen Eingang,
 * welches Potential liegt an welchem Anschluss an.
 *
 * Die Logik kennt keine Gerätetypen. Sie arbeitet nur mit den Angaben aus der
 * Gerätedefinition (Anschlüsse, busbarFed, busbarFeed).
 */
import {
  PHASES,
  TE,
  defOf,
  isSourceId,
  railConfig,
  type Conductor,
  type Device,
  type DeviceDef,
  type ExternalSource,
  type InputPort,
  type Link,
  type OutputPort,
  type Phase,
  type Plan,
  type PortKind,
} from "./types";

const EPS = 0.05;

export interface EffectiveLink extends Link {
  /** true = nicht verdrahtet, sondern über die Stromschiene der Reihe abgeleitet. */
  implicit: boolean;
}

export interface Consumer {
  device: Device;
  input: string;
  implicit: boolean;
}

export const isLineKind = (k: PortKind) => k === "L" || k === "L1" || k === "L2" || k === "L3";
export const isPhase = (c: Conductor | null | undefined): c is Phase => c === "L1" || c === "L2" || c === "L3";

export class Wiring {
  readonly devices = new Map<string, Device>();
  readonly sources = new Map<string, ExternalSource>();
  private rails = new Map<string, Device[]>();
  private linkCache = new Map<string, EffectiveLink | null>();
  private consumerMap: Map<string, Consumer[]> | null = null;

  constructor(readonly plan: Plan) {
    for (const s of plan.sources) this.sources.set(s.id, s);
    for (const d of plan.devices) {
      this.devices.set(d.id, d);
      const key = `${d.field}:${d.row}`;
      let list = this.rails.get(key);
      if (!list) this.rails.set(key, (list = []));
      list.push(d);
    }
    for (const list of this.rails.values()) list.sort((a, b) => a.x - b.x);
  }

  def(d: Device): DeviceDef {
    return defOf(this.plan, d);
  }

  /** Geräte einer Reihe, von links nach rechts. */
  onRail(field: number, row: number): Device[] {
    return this.rails.get(`${field}:${row}`) ?? [];
  }

  /** Alle Geräte in Lesereihenfolge: Feld, Reihe, Position. */
  ordered(): Device[] {
    return [...this.plan.devices].sort((a, b) => a.field - b.field || a.row - b.row || a.x - b.x);
  }

  nodeLabel(id: string): string {
    const s = this.sources.get(id);
    if (s) return s.label;
    const d = this.devices.get(id);
    return d ? d.label || this.def(d).label : "?";
  }

  /** Ausgänge eines Geräts oder einer externen Quelle. */
  outputsOf(id: string): OutputPort[] {
    if (isSourceId(id)) {
      if (!this.sources.has(id)) return [];
      return (["L1", "L2", "L3", "N", "PE"] as const).map((c) => ({ id: c, label: c, kind: c, from: null, max: null }));
    }
    const d = this.devices.get(id);
    return d ? this.def(d).outputs : [];
  }

  hasOutput(id: string, port: string): boolean {
    return this.outputsOf(id).some((p) => p.id === port);
  }

  // ---------- Stromschiene ----------

  /** Nächstes links sitzendes Gerät der Reihe, das die Stromschiene speist. */
  busbarFeeder(field: number, row: number, x: number, group = ""): Device | null {
    let best: Device | null = null;
    for (const d of this.onRail(field, row)) {
      if (d.x + d.width > x + EPS) break;
      if (!this.def(d).busbarFeed) continue;
      if (group && d.group && d.group !== group) continue;
      best = d;
    }
    return best;
  }

  /** Phase der Stromschiene an Position x (mm), null ohne Schiene. */
  busbarPhaseAt(field: number, row: number, x: number, group = "", seen = new Set<string>()): Phase | null {
    const cfg = railConfig(this.plan, field, row);
    if (cfg.busbar === "none") return null;
    const base = rotate(cfg.start);
    const feeder = this.busbarFeeder(field, row, x, group);
    if (!feeder) {
      if (cfg.busbar === "1P") return cfg.start;
      return base[mod3(Math.floor(x / TE + EPS))];
    }
    const lineOuts = this.def(feeder).outputs.filter((p) => isLineKind(p.kind));
    const pot = (p: OutputPort) => this.outputPotential(feeder.id, p.id, seen);
    if (lineOuts.length < 3) {
      // Einpoliger Einspeiser (z. B. RCD 2P): die Schiene führt dessen Phase.
      const first = lineOuts.map(pot).find(isPhase);
      return first ?? cfg.start;
    }
    if (cfg.busbar === "1P") {
      // 1-phasige Schiene hinter einem mehrpoligen Gerät: sie hängt an dem Pol, den die
      // eingestellte Phase benennt, und führt, was dort tatsächlich anliegt.
      const port = lineOuts.find((p) => p.kind === cfg.start);
      const c = port ? pot(port) : null;
      return isPhase(c) ? c : cfg.start;
    }
    // Die Schiene übernimmt die tatsächlich am Einspeisegerät anliegende Phasenfolge.
    const actual = base.map((nominal) => {
      const port = lineOuts.find((p) => p.kind === nominal);
      const c = port ? pot(port) : null;
      return isPhase(c) ? c : nominal;
    });
    const origin = feeder.x + feeder.width;
    return actual[mod3(Math.floor((x - origin) / TE + EPS))];
  }

  // ---------- Verbindungen ----------

  /** Verdrahtete oder über die Stromschiene abgeleitete Quelle eines Eingangs. */
  link(d: Device, inputId: string): EffectiveLink | null {
    const key = `${d.id}|${inputId}`;
    const hit = this.linkCache.get(key);
    if (hit !== undefined) return hit;
    const result = this.computeLink(d, inputId);
    this.linkCache.set(key, result);
    return result;
  }

  private computeLink(d: Device, inputId: string): EffectiveLink | null {
    const explicit = d.inputs[inputId];
    if (explicit) {
      return this.hasOutput(explicit.from, explicit.port) ? { ...explicit, implicit: false } : null;
    }
    const slot = this.busbarSlot(d, inputId);
    if (slot == null) return null;
    const phase = this.busbarPhaseAt(d.field, d.row, slot, d.group);
    const feeder = this.busbarFeeder(d.field, d.row, slot, d.group);
    if (!phase || !feeder) return null;
    const port = this.def(feeder)
      .outputs.filter((p) => isLineKind(p.kind))
      .find((p) => this.outputPotential(feeder.id, p.id) === phase);
    return port ? { from: feeder.id, port: port.id, implicit: true } : null;
  }

  /** Position (mm) des Pols auf der Stromschiene, falls dieser Eingang von ihr gespeist wird. */
  private busbarSlot(d: Device, inputId: string): number | null {
    const def = this.def(d);
    if (!def.busbarFed) return null;
    if (railConfig(this.plan, d.field, d.row).busbar === "none") return null;
    const poles = def.inputs.filter((p) => isLineKind(p.kind));
    const i = poles.findIndex((p) => p.id === inputId);
    return i < 0 ? null : d.x + i * TE;
  }

  /** Potential an einem Eingang. null = unbekannt. */
  inputPotential(d: Device, inputId: string, seen = new Set<string>()): Conductor | null {
    const port = this.def(d).inputs.find((p) => p.id === inputId);
    if (!port || port.kind === "ctrl") return null;
    const explicit = d.inputs[inputId];
    if (explicit && this.hasOutput(explicit.from, explicit.port)) {
      return this.outputPotential(explicit.from, explicit.port, seen);
    }
    const slot = this.busbarSlot(d, inputId);
    if (slot != null) {
      const p = this.busbarPhaseAt(d.field, d.row, slot, d.group, seen);
      if (p) return p;
    }
    return nominal(port, d);
  }

  /** Potential an einem Ausgang eines Geräts oder einer Quelle. null = unbekannt. */
  outputPotential(id: string, portId: string, seen = new Set<string>()): Conductor | null {
    if (isSourceId(id)) return this.sources.has(id) && isConductor(portId) ? portId : null;
    const d = this.devices.get(id);
    if (!d) return null;
    const port = this.def(d).outputs.find((p) => p.id === portId);
    if (!port) return null;
    const key = `${id}|${portId}`;
    if (seen.has(key)) return null; // Schleife in der Verdrahtung
    seen.add(key);
    try {
      if (port.from) return this.inputPotential(d, port.from, seen);
      return nominal(port, d);
    } finally {
      seen.delete(key);
    }
  }

  /** Alle Eingänge, die an einem Ausgang hängen (verdrahtet oder über Stromschiene). */
  consumers(id: string, port: string): Consumer[] {
    if (!this.consumerMap) {
      const map = new Map<string, Consumer[]>();
      for (const d of this.ordered()) {
        for (const inp of this.def(d).inputs) {
          const l = this.link(d, inp.id);
          if (!l) continue;
          const key = `${l.from}|${l.port}`;
          let list = map.get(key);
          if (!list) map.set(key, (list = []));
          list.push({ device: d, input: inp.id, implicit: l.implicit });
        }
      }
      this.consumerMap = map;
    }
    return this.consumerMap.get(`${id}|${port}`) ?? [];
  }

  /** Alle Verbraucher eines Geräts bzw. einer Quelle, je Gerät einmal. */
  children(id: string): Device[] {
    const out: Device[] = [];
    for (const p of this.outputsOf(id)) {
      for (const c of this.consumers(id, p.id)) if (!out.includes(c.device)) out.push(c.device);
    }
    return out;
  }

  /** Erster Außenleiter-Eingang mit Quelle; bestimmt, unter welchem Gerät ein Gerät im Baum hängt. */
  primaryLink(d: Device): EffectiveLink | null {
    const inputs = this.def(d).inputs;
    for (const want of [isLineKind, (k: PortKind) => k === "N" || k === "PE", () => true]) {
      for (const p of inputs) {
        if (!want(p.kind)) continue;
        const l = this.link(d, p.id);
        if (l) return l;
      }
    }
    return null;
  }

  /** Kette der speisenden Geräte, vom Gerät selbst aufwärts bis zur Quelle. */
  chain(d: Device): string[] {
    const ids = [d.id];
    let cur: Device | undefined = d;
    while (cur) {
      const l = this.primaryLink(cur);
      if (!l || ids.includes(l.from)) break;
      ids.push(l.from);
      cur = this.devices.get(l.from);
    }
    return ids;
  }

  /** Außenleiter, die an einem Gerät anliegen (über Eingänge, sonst Ausgänge). */
  phasesOf(d: Device): Conductor[] {
    const def = this.def(d);
    const found: Conductor[] = [];
    const add = (c: Conductor | null) => {
      if (c && !found.includes(c)) found.push(c);
    };
    const ins = def.inputs.filter((p) => p.kind !== "ctrl");
    if (ins.length) ins.forEach((p) => add(this.inputPotential(d, p.id)));
    else def.outputs.forEach((p) => add(this.outputPotential(d.id, p.id)));
    return found;
  }

  /** Kurztext für Listen: "L2", "3P", "L1 + N", "–". */
  phaseText(d: Device): string {
    const all = this.phasesOf(d);
    const lines = all.filter(isPhase).sort();
    if (lines.length === 3) return "3P";
    if (lines.length) return lines.join("/");
    if (all.includes("N")) return "N";
    if (all.includes("PE")) return "PE";
    return "–";
  }
}

function nominal(port: InputPort | OutputPort, d: Device): Conductor | null {
  if (port.kind === "ctrl") return null;
  if (port.kind === "L") return d.phase === "auto" ? null : d.phase;
  return port.kind;
}

const isConductor = (v: string): v is Conductor => v === "L1" || v === "L2" || v === "L3" || v === "N" || v === "PE";
const mod3 = (n: number) => ((n % 3) + 3) % 3;
function rotate(start: Phase): Phase[] {
  const i = Math.max(0, PHASES.indexOf(start));
  return [...PHASES.slice(i), ...PHASES.slice(0, i)];
}
