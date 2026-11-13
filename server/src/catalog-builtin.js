/**
 * Eingebauter Grundkatalog. Wird beim Start in die Datenbank synchronisiert
 * (siehe db.js) und ist im Admin-UI schreibgeschützt, aber ausblend- und duplizierbar.
 *
 * Die IDs sind stabil: Pläne und der Import alter V6-Pläne verweisen darauf.
 */

const inp = (id, kind, bank, label = id) => (bank ? { id, label, kind, bank } : { id, label, kind });
const out = (id, kind, from, max = 1, label = id) => ({ id, label, kind, from, max });
const te = (value) => ({ unit: "te", value });
const mm = (value) => ({ unit: "mm", value });

const L123 = ["L1", "L2", "L3"];
/** Pole 1:1 durchgeschleift (Eingang und Ausgang tragen denselben Namen). */
const through = (ids, max) => ({
  inputs: ids.map((id) => inp(id, id)),
  outputs: ids.map((id) => out(id, id, id, max)),
});
/** Ein Leiter rein, ein Abgang raus. */
const single = { inputs: [inp("IN", "L")], outputs: [out("OUT", "L", "IN")] };
/** Je Leiter n Abgänge: L1 → L1.1 … L1.n */
const fanout = (ids, n) => ({
  inputs: ids.map((id) => inp(id, id)),
  outputs: ids.flatMap((id) => Array.from({ length: n }, (_, i) => out(`${id}.${i + 1}`, id, id))),
});

const defs = [
  // ----- Schutzgeräte -----
  { id: "rcd2", label: "RCD 2P", tech: "40 A / 30 mA", category: "Schutzgeräte", role: "rcd", width: te(2), busbarFeed: true,
    inputs: [inp("L", "L"), inp("N", "N")], outputs: [out("L", "L", "L", null), out("N", "N", "N", null)] },
  { id: "rcd4", label: "RCD 4P", tech: "40 A / 30 mA", category: "Schutzgeräte", role: "rcd", width: te(4), busbarFeed: true,
    ...through([...L123, "N"], null) },
  { id: "ls1", label: "LS 1P", tech: "B16", category: "Schutzgeräte", role: "protection", width: te(1), busbarFed: true, ...single },
  { id: "ls3", label: "LS 3P", tech: "3×B16", category: "Schutzgeräte", role: "protection", width: te(3), busbarFed: true, ...through(L123, 1) },
  { id: "rcbo", label: "FI/LS 1P+N", tech: "B16 / 30 mA", category: "Schutzgeräte", role: "rcd", width: te(2),
    inputs: [inp("L", "L"), inp("N", "N")], outputs: [out("L", "L", "L", 1), out("N", "N", "N", 1)] },
  { id: "d02_1p", label: "Neozed D02 1P", tech: "D02 35 A", category: "Schutzgeräte", role: "protection", width: te(1.5), ...single },
  { id: "d02", label: "Neozed D02 3P", tech: "D02 35 A", category: "Schutzgeräte", role: "protection", width: te(4.5), ...through(L123, 1) },
  { id: "spd", label: "Überspannungsschutz Typ 2", tech: "SPD Typ 2", category: "Schutzgeräte", role: "spd", width: te(4),
    inputs: [...L123.map((id) => inp(id, id, "Netz")), inp("N", "N", "Netz"), inp("PE", "PE", "Ableitung")], outputs: [] },

  // ----- Schaltgeräte -----
  { id: "main", label: "Hauptschalter 4P", tech: "40 A 4P", category: "Schaltgeräte", role: "switch", width: te(4), busbarFeed: true,
    ...through([...L123, "N"], 1) },
  { id: "change", label: "Umschalter I-0-II", tech: "4P", category: "Schaltgeräte", role: "switch", width: te(4),
    inputs: [
      ...L123.map((id) => inp(`${id}.1`, id, "Netz 1")), inp("N.1", "N", "Netz 1"),
      ...L123.map((id) => inp(`${id}.2`, id, "Netz 2")), inp("N.2", "N", "Netz 2"),
    ],
    // Dargestellt wird Stellung I: die Abgänge folgen Netz 1.
    outputs: [...L123.map((id) => out(id, id, `${id}.1`)), out("N", "N", "N.1")] },
  { id: "treppe", label: "Treppenlicht", tech: "TL-Automat", category: "Schaltgeräte", role: "control", width: te(1), ...single },
  { id: "schuetz", label: "Schütz", tech: "Installationsschütz", category: "Schaltgeräte", role: "control", width: te(2), ...single },
  { id: "relais", label: "Relais", tech: "Relais", category: "Schaltgeräte", role: "control", width: te(1), ...single },
  { id: "zeitrelais_1w", label: "Zeitrelais", tech: "Multifunktion / 1 Wechsler", category: "Schaltgeräte", role: "control", width: te(1),
    inputs: [inp("A1", "L", "Versorgung"), inp("A2", "N", "Versorgung"), inp("B1", "ctrl", "Steuereingang"), inp("15", "L", "Wechsler")],
    outputs: [out("16", "L", "15", 1, "16 Öffner"), out("18", "L", "15", 1, "18 Schließer")] },

  // ----- Verteilung -----
  { id: "hla1", label: "Klemmstein einzeln", tech: "1→3", category: "Verteilung", role: "distribution", width: te(2),
    inputs: [inp("IN", "L")], outputs: [1, 2, 3].map((n) => out(`A${n}`, "L", "IN", 1, `Abgang ${n}`)) },
  { id: "hla", label: "Klemmstein kombiniert", tech: "3×1→5", category: "Verteilung", role: "distribution", width: te(4), ...fanout(L123, 5) },
  { id: "hlak5_1to3", label: "Hauptleitungs-Abzweigklemme 5P", tech: "1→3 je Leiter / 100 mm", category: "Verteilung", role: "distribution",
    width: mm(100), ...fanout([...L123, "N", "PE"], 3) },
  { id: "hlak5_1to3_compact", label: "Hauptleitungs-Abzweigklemme 5P kompakt", tech: "1→3 je Leiter / 88,8 mm", category: "Verteilung",
    role: "distribution", width: mm(88.8), ...fanout([...L123, "N", "PE"], 3) },

  // ----- Messung & Steuerung -----
  ...[1, 2, 3, 4].map((n) => ({
    id: n === 2 ? "netzteil" : `netzteil${n}`, label: `Netzteil ${n} TE`, tech: "24 V DC", category: "Messung & Steuerung", role: "other",
    width: te(n), inputs: [inp("L", "L"), inp("N", "N")], outputs: [],
  })),
  { id: "meter", label: "Energiezähler", tech: "3~ kWh", category: "Messung & Steuerung", role: "meter", width: te(4), ...through(L123, 1) },
  { id: "shelly", label: "Smart-Modul", tech: "Shelly o. ä.", category: "Messung & Steuerung", role: "control", width: te(1), ...single },
  { id: "shelly1g3", label: "Shelly 1 Gen3", tech: "1 Kanal / potentialfreies Relais", category: "Messung & Steuerung", role: "control", width: mm(42),
    inputs: [inp("L", "L", "Versorgung"), inp("N", "N", "Versorgung"), inp("SW", "ctrl", "Steuereingang"), inp("I", "L", "Relais")],
    outputs: [out("O", "L", "I")] },
  { id: "shelly2pmg4", label: "Shelly 2PM Gen4", tech: "2 Kanäle / Rollladen", category: "Messung & Steuerung", role: "control", width: mm(42),
    inputs: [inp("L", "L", "Versorgung"), inp("N", "N", "Versorgung"), inp("S1", "ctrl", "Steuereingang"), inp("S2", "ctrl", "Steuereingang")],
    outputs: [out("O1", "L", "L"), out("O2", "L", "L")] },
  { id: "shelly_pro_3em", label: "Shelly Pro 3EM", tech: "3P Energiezähler / CT", category: "Messung & Steuerung", role: "meter", width: te(1),
    inputs: [inp("LA", "L1", "Spannungsmessung"), inp("LB", "L2", "Spannungsmessung"), inp("LC", "L3", "Spannungsmessung"), inp("N", "N", "Versorgung")],
    outputs: [] },
  { id: "shelly_pro_4pm", label: "Shelly Pro 4PM", tech: "4 Kanäle / Leistungsmessung", category: "Messung & Steuerung", role: "control", width: te(3),
    inputs: [inp("L", "L", "Versorgung"), inp("N", "N", "Versorgung"), ...[1, 2, 3, 4].map((n) => inp(`E${n}`, "ctrl", "Steuereingang"))],
    outputs: [1, 2, 3, 4].map((n) => out(`O${n}`, "L", "L", 1, `Out ${n}`)) },

  // ----- Reihenklemmen -----
  { id: "term1", label: "Reihenklemme 1P", tech: "L", category: "Reihenklemmen", role: "terminal", width: mm(5.2), resizable: true, ...single },
  { id: "termN", label: "Reihenklemme N", tech: "N", category: "Reihenklemmen", role: "terminal", width: mm(5.2), resizable: true,
    inputs: [inp("IN", "N")], outputs: [out("OUT", "N", "IN")] },
  { id: "term2", label: "Reihenklemme 2P", tech: "L/N", category: "Reihenklemmen", role: "terminal", width: mm(5.2), resizable: true,
    inputs: [inp("L", "L"), inp("N", "N")], outputs: [out("L", "L", "L"), out("N", "N", "N")] },
  { id: "term3", label: "Reihenklemme 3P", tech: "L/N/PE", category: "Reihenklemmen", role: "terminal", width: mm(5.2), resizable: true,
    inputs: [inp("L", "L"), inp("N", "N"), inp("PE", "PE")], outputs: [out("L", "L", "L"), out("N", "N", "N"), out("PE", "PE", "PE")] },

  // ----- Sonstiges -----
  { id: "reserve", label: "Reserve", tech: "frei", category: "Sonstiges", role: "other", width: te(1), resizable: true, inputs: [], outputs: [] },
  { id: "custom", label: "Benutzerdefiniert", tech: "Gerät", category: "Sonstiges", role: "other", width: te(1), resizable: true, inputs: [], outputs: [] },
];

export const BUILTIN_PREFIX = "builtin:";
export const BUILTIN_CATALOG = defs.map((d) => ({ ...d, id: BUILTIN_PREFIX + d.id }));
