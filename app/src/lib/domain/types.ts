/** Plan- und Katalogformat des HV-Planers (Schema 2). Reine Daten, keine UI. */

export const SCHEMA = 2;
/** Breite einer Teilungseinheit in mm. */
export const TE = 18;

export type Phase = "L1" | "L2" | "L3";
export type Conductor = Phase | "N" | "PE";
export const PHASES: readonly Phase[] = ["L1", "L2", "L3"];
export const CONDUCTORS: readonly Conductor[] = ["L1", "L2", "L3", "N", "PE"];

/**
 * Art eines Anschlusses:
 *  L        beliebiger Außenleiter
 *  L1/L2/L3 Pol eines mehrpoligen Geräts (Klemmenname; die anliegende Phase darf abweichen)
 *  N, PE    Neutral- bzw. Schutzleiter
 *  ctrl     Steuereingang, wird elektrisch nicht ausgewertet
 */
export type PortKind = "L" | Phase | "N" | "PE" | "ctrl";
export const PORT_KINDS: readonly PortKind[] = ["L", "L1", "L2", "L3", "N", "PE", "ctrl"];

export interface InputPort {
  id: string;
  label: string;
  kind: PortKind;
  /** Optionale Gruppierung in der Oberfläche, z. B. "Versorgung" oder "Netz 2". */
  bank?: string;
}

export interface OutputPort {
  id: string;
  label: string;
  kind: PortKind;
  /** Eingang, dessen Potential dieser Ausgang weitergibt. null = eigenes Potential laut kind. */
  from: string | null;
  /** Maximale Zahl angeschlossener Ziele, null = unbegrenzt. */
  max: number | null;
}

export type DeviceRole =
  | "rcd"
  | "protection"
  | "switch"
  | "distribution"
  | "terminal"
  | "meter"
  | "control"
  | "spd"
  | "other";
export const ROLES: readonly DeviceRole[] = [
  "rcd",
  "protection",
  "switch",
  "distribution",
  "terminal",
  "meter",
  "control",
  "spd",
  "other",
];

export interface DeviceDef {
  id: string;
  label: string;
  tech: string;
  category: string;
  role: DeviceRole;
  width: { unit: "te" | "mm"; value: number };
  /** Breite darf pro Gerät im Plan geändert werden. */
  resizable?: boolean;
  /** Bezieht seine Außenleiter von der Stromschiene der Reihe, solange nichts verdrahtet ist. */
  busbarFed?: boolean;
  /** Speist die Stromschiene rechts von sich (z. B. RCD, Hauptschalter). */
  busbarFeed?: boolean;
  inputs: InputPort[];
  outputs: OutputPort[];
}

/** Katalogeintrag, wie ihn der Server liefert. */
export interface CatalogEntry extends DeviceDef {
  builtin: boolean;
  hidden: boolean;
}

/** Verweis auf einen Ausgang eines Geräts oder einer externen Quelle. */
export interface Link {
  from: string;
  port: string;
}

export interface Device {
  id: string;
  /** Schlüssel in Plan.defs. */
  def: string;
  label: string;
  tech: string;
  field: number;
  row: number;
  /** Linke Kante auf der Hutschiene in mm. */
  x: number;
  /** Breite in mm. */
  width: number;
  /** Fest vorgegebene Phase für unverdrahtete Geräte; "auto" = ableiten. */
  phase: Phase | "auto";
  /** RCD-Gruppe (frei wählbarer Name). */
  group: string;
  status: "existing" | "new";
  /** Verdrahtung: Eingangs-ID → Quelle. */
  inputs: Record<string, Link>;
  note?: string;
}

export interface ExternalSource {
  id: string;
  label: string;
}

export interface RailConfig {
  busbar: "none" | "1P" | "3P";
  start: Phase;
}

export interface Plan {
  schema: typeof SCHEMA;
  name: string;
  board: { fields: number; rows: number; te: number };
  /** Stromschienen je Reihe, Schlüssel "feld:reihe" (nullbasiert). */
  rails: Record<string, RailConfig>;
  sources: ExternalSource[];
  devices: Device[];
  /** Momentaufnahme der verwendeten Katalogdefinitionen. */
  defs: Record<string, DeviceDef>;
  insertStatus: "existing" | "new";
  /** Fortlaufender Zähler für neue IDs. */
  seq: number;
}

export const LIMITS = { fields: [1, 8], rows: [1, 12], te: [6, 48] } as const;

export const railKey = (field: number, row: number) => `${field}:${row}`;

export function emptyPlan(name = ""): Plan {
  return {
    schema: SCHEMA,
    name,
    board: { fields: 2, rows: 5, te: 12 },
    rails: {},
    sources: [],
    devices: [],
    defs: {},
    insertStatus: "existing",
    seq: 1,
  };
}

export function railConfig(plan: Plan, field: number, row: number): RailConfig {
  return plan.rails[railKey(field, row)] ?? { busbar: "none", start: "L1" };
}

export const SOURCE_PORTS: readonly Conductor[] = CONDUCTORS;
export const isSourceId = (id: string) => id.startsWith("s");

export function defOf(plan: Plan, device: Device): DeviceDef {
  return plan.defs[device.def] ?? MISSING_DEF;
}

export const MISSING_DEF: DeviceDef = {
  id: "missing",
  label: "Unbekanntes Gerät",
  tech: "",
  category: "Sonstiges",
  role: "other",
  width: { unit: "te", value: 1 },
  resizable: true,
  inputs: [],
  outputs: [],
};

export const defWidthMM = (def: DeviceDef) => (def.width.unit === "mm" ? def.width.value : def.width.value * TE);
