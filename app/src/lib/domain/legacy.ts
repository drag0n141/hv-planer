/**
 * Import von Plänen des bisherigen HV-Planers (JSON bis V6.66) in Schema 2.
 * Unbekannte Gerätetypen bleiben als Platzhalter ohne Anschlüsse erhalten.
 */
import { SCHEMA, TE, emptyPlan, type Device, type DeviceDef, type Phase, type Plan } from "./types";
import { stripCatalogFields } from "./plan";
import { Wiring, isLineKind } from "./wiring";

const BUILTIN = "builtin:";
/** Eingänge, die im neuen Katalog anders heißen: Typ → alt → neu. */
const INPUT_RENAMES: Record<string, Record<string, string>> = {
  change: { "N1.1": "N.1", N2: "N.2" },
};
/** Alte Sammelausgänge, die jetzt je Leiter getrennt sind. */
const OUTPUT_RENAMES: Record<string, Record<string, string>> = {
  term2: { OUT: "L" },
  term3: { OUT: "L" },
};

export const isLegacyPlan = (data: unknown): boolean =>
  !!data && typeof data === "object" && (data as { schema?: unknown }).schema !== SCHEMA && Array.isArray((data as { devices?: unknown }).devices);

type Raw = Record<string, any>;
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : fallback);
const nodeId = (v: unknown) => (Number(v) < 0 ? `s${Math.abs(Number(v))}` : `d${Number(v)}`);
const isPhase = (v: unknown): v is Phase => v === "L1" || v === "L2" || v === "L3";

export function importLegacy(data: Raw, catalog: DeviceDef[]): Plan {
  const byId = new Map(catalog.map((d) => [d.id, d]));
  const plan = emptyPlan(String(data.projectName ?? "").trim());
  plan.board = { fields: num(data.fields, 2), rows: num(data.rows, 5), te: num(data.te, 12) };
  plan.insertStatus = data.insertStatus === "new" ? "new" : "existing";

  const sources: Raw[] = Array.isArray(data.externalSources) ? data.externalSources : [];
  plan.sources = sources.map((s) => ({ id: nodeId(s.id), label: String(s.label || "Externe Quelle") }));
  if (!plan.sources.length && String(data.projectFeed ?? "").trim()) plan.sources = [{ id: "s1", label: String(data.projectFeed).trim() }];

  for (const [key, mode] of Object.entries((data.rowRailModes ?? {}) as Record<string, unknown>)) {
    if (mode !== "1P" && mode !== "3P") continue;
    const start = (data.phaseStarts ?? {})[key];
    plan.rails[key] = { busbar: mode, start: isPhase(start) ? start : "L1" };
  }

  const raw: Raw[] = (data.devices as Raw[]).filter((d) => d && typeof d === "object");
  const typeOf = new Map<string, string>();
  for (const r of raw) {
    const type = String(r.type ?? "custom");
    let def = byId.get(BUILTIN + type);
    if (!def) {
      // Typ gibt es im neuen Katalog nicht: als Platzhalter übernehmen.
      def = {
        id: `legacy:${type}`,
        label: String(r.label || type),
        tech: String(r.tech ?? ""),
        category: "Sonstiges",
        role: "other",
        width: { unit: "te", value: 1 },
        resizable: true,
        inputs: [],
        outputs: [],
      };
    }
    plan.defs[def.id] ??= structuredClone(stripCatalogFields(def));
    const width = r.mode === "mm" || (r.widthMM != null && r.widthTE == null) ? num(r.widthMM, 5.2) : num(r.widthTE ?? r.width, 1) * TE;
    const label = String(r.label ?? "");
    const device: Device = {
      id: nodeId(r.id),
      def: def.id,
      label: label === def.label ? "" : label,
      tech: String(r.tech ?? def.tech),
      field: num(r.field, 0),
      row: num(r.row, 0),
      x: r.xMM != null ? num(r.xMM, 0) : num(r.slot, 0) * TE,
      width,
      phase: isPhase(r.phase) ? r.phase : "auto",
      group: String(r.group ?? ""),
      status: r.installStatus === "new" ? "new" : "existing",
      inputs: {},
    };
    plan.devices.push(device);
    typeOf.set(device.id, type);
  }

  const outPort = (from: string, port: string) => OUTPUT_RENAMES[typeOf.get(from) ?? ""]?.[port] ?? port;

  // 1. Einzeln verdrahtete Eingänge
  raw.forEach((r, i) => {
    const d = plan.devices[i];
    const type = typeOf.get(d.id)!;
    const known = new Set(plan.defs[d.def].inputs.map((p) => p.id));
    for (const [key, link] of Object.entries((r.multiInputs ?? {}) as Record<string, Raw | null>)) {
      if (!link || link.sourceId == null) continue;
      const input = INPUT_RENAMES[type]?.[key] ?? key;
      if (!known.has(input)) continue;
      const from = nodeId(link.sourceId);
      d.inputs[input] = { from, port: outPort(from, String(link.sourcePort || "OUT")) };
    }
  });

  // 2. Alte Sammelverbindung "Eingang von": auf die noch freien Eingänge verteilen
  raw.forEach((r, i) => {
    if (r.inputFrom == null) return;
    const d = plan.devices[i];
    const from = nodeId(r.inputFrom);
    const w = new Wiring(plan);
    const outs = w.outputsOf(from);
    if (!outs.length) return;
    const wanted = outPort(from, String(r.inputPort || "OUT"));
    const free = plan.defs[d.def].inputs.filter((p) => p.kind !== "ctrl" && !d.inputs[p.id]);
    const lineInputs = free.filter((p) => isLineKind(p.kind));
    for (const inp of free) {
      const single = lineInputs.length === 1 && inp === lineInputs[0];
      const match =
        (single ? outs.find((p) => p.id === wanted) : undefined) ??
        outs.find((p) => p.id === inp.id && p.kind === inp.kind) ??
        outs.find((p) => p.kind === inp.kind) ??
        (inp.kind === "L" ? outs.find((p) => p.id === wanted && isLineKind(p.kind)) : undefined) ??
        (!isLineKind(inp.kind) && lineInputs.length === 0 ? outs.find((p) => p.id === wanted) : undefined);
      if (match) d.inputs[inp.id] = { from, port: match.id };
    }
  });

  const ids = [...plan.devices.map((d) => d.id), ...plan.sources.map((s) => s.id)].map((id) => Number(id.slice(1)) || 0);
  plan.seq = Math.max(0, ...ids) + 1;
  return plan;
}

const DEVICE_DEFAULTS: Partial<Device> = { label: "", tech: "", group: "", phase: "auto", status: "existing" };

/** Bringt einen geladenen Schema-2-Plan in eine vollständige Form (fehlende Felder ergänzen). */
export function normalizePlan(data: Raw): Plan {
  const base = emptyPlan();
  const plan: Plan = {
    ...base,
    ...data,
    schema: SCHEMA,
    name: String(data.name ?? ""),
    board: { ...base.board, ...(data.board ?? {}) },
    rails: { ...(data.rails ?? {}) },
    sources: Array.isArray(data.sources) ? data.sources : [],
    devices: Array.isArray(data.devices) ? data.devices.map((d: Raw): Device => ({ ...DEVICE_DEFAULTS, ...(d as Device), inputs: { ...(d.inputs ?? {}) } })) : [],
    defs: { ...(data.defs ?? {}) },
  };
  const ids = [...plan.devices.map((d) => d.id), ...plan.sources.map((s) => s.id)].map((id) => Number(String(id).slice(1)) || 0);
  plan.seq = Math.max(num(data.seq, 1), Math.max(0, ...ids) + 1);
  return plan;
}

/** Lädt Plan-Daten beliebigen Formats. */
export function loadPlanData(data: Raw, catalog: DeviceDef[]): { plan: Plan; legacy: boolean } {
  if (isLegacyPlan(data)) return { plan: importLegacy(data, catalog), legacy: true };
  return { plan: normalizePlan(data), legacy: false };
}
