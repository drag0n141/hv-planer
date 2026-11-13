/** Prüfung und Normalisierung von Gerätedefinitionen aus dem Admin-UI. */

export const ROLES = ["rcd", "protection", "switch", "distribution", "terminal", "meter", "control", "spd", "other"];
export const PORT_KINDS = ["L", "L1", "L2", "L3", "N", "PE", "ctrl"];

const PORT_ID = /^[^\s|]{1,16}$/u;
const MAX_INPUTS = 40;
const MAX_OUTPUTS = 80;

const text = (v, max) => String(v ?? "").trim().slice(0, max);

/**
 * Liefert { def } mit bereinigter Definition oder { error } mit einer Meldung für den Nutzer.
 * Die ID wird hier nicht vergeben; sie kommt vom Aufrufer.
 */
export function validateDef(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Gerätedefinition fehlt." };

  const label = text(body.label, 80);
  if (!label) return { error: "Name fehlt." };
  const category = text(body.category, 40);
  if (!category) return { error: "Kategorie fehlt." };
  if (!ROLES.includes(body.role)) return { error: "Unbekannte Geräteart." };

  const unit = body.width?.unit;
  const value = Number(body.width?.value);
  if (unit !== "te" && unit !== "mm") return { error: "Breite braucht die Einheit TE oder mm." };
  if (!Number.isFinite(value) || value <= 0 || value > (unit === "te" ? 60 : 1000)) return { error: "Ungültige Breite." };
  if (unit === "te" && Math.abs(value * 2 - Math.round(value * 2)) > 1e-9) return { error: "Breite in TE nur in halben Schritten." };

  const rawIn = Array.isArray(body.inputs) ? body.inputs : [];
  const rawOut = Array.isArray(body.outputs) ? body.outputs : [];
  if (rawIn.length > MAX_INPUTS || rawOut.length > MAX_OUTPUTS) return { error: "Zu viele Anschlüsse." };

  const inputs = [];
  const inputIds = new Set();
  for (const p of rawIn) {
    const id = text(p?.id, 16);
    if (!PORT_ID.test(id)) return { error: `Ungültige Eingangs-ID „${id}“ (1–16 Zeichen, keine Leerzeichen).` };
    if (inputIds.has(id)) return { error: `Eingang „${id}“ ist doppelt.` };
    if (!PORT_KINDS.includes(p.kind)) return { error: `Eingang „${id}“: unbekannte Leiterart.` };
    inputIds.add(id);
    const port = { id, label: text(p.label, 24) || id, kind: p.kind };
    const bank = text(p.bank, 24);
    if (bank) port.bank = bank;
    inputs.push(port);
  }

  const outputs = [];
  const outputIds = new Set();
  for (const p of rawOut) {
    const id = text(p?.id, 16);
    if (!PORT_ID.test(id)) return { error: `Ungültige Ausgangs-ID „${id}“ (1–16 Zeichen, keine Leerzeichen).` };
    if (outputIds.has(id)) return { error: `Ausgang „${id}“ ist doppelt.` };
    if (!PORT_KINDS.includes(p.kind) || p.kind === "ctrl") return { error: `Ausgang „${id}“: unbekannte Leiterart.` };
    const from = p.from == null || p.from === "" ? null : String(p.from);
    if (from != null && !inputIds.has(from)) return { error: `Ausgang „${id}“ verweist auf den unbekannten Eingang „${from}“.` };
    let max = null;
    if (p.max != null && p.max !== "") {
      max = Number(p.max);
      if (!Number.isInteger(max) || max < 1 || max > 99) return { error: `Ausgang „${id}“: maximale Ziele 1–99 oder leer für unbegrenzt.` };
    }
    outputIds.add(id);
    outputs.push({ id, label: text(p.label, 24) || id, kind: p.kind, from, max });
  }

  const def = { label, tech: text(body.tech, 80), category, role: body.role, width: { unit, value }, inputs, outputs };
  if (body.resizable) def.resizable = true;
  if (body.busbarFed) def.busbarFed = true;
  if (body.busbarFeed) def.busbarFeed = true;
  return { def };
}
