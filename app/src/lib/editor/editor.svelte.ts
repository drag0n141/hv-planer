/** Zustand des geöffneten Plans: Daten, Auswahl, Undo/Redo, Speichern. */
import { ApiError, api, type Permission } from "../api";
import { app } from "../app.svelte";
import { loadPlanData } from "../domain/legacy";
import * as ops from "../domain/plan";
import { emptyPlan, type Device, type DeviceDef, type Link, type Plan, type RailConfig } from "../domain/types";
import { Wiring } from "../domain/wiring";
import { feedback } from "../ui/feedback.svelte";

export type Selection = { kind: "device"; id: string } | { kind: "rail"; field: number; row: number } | null;
export type View = "board" | "list" | "logic" | "circuits" | "bom" | "check";
export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface Meta {
  id: number;
  version: number;
  permission: Permission;
  ownerName: string | null;
  mine: boolean;
}

const UNDO_LIMIT = 100;
const AUTOSAVE_MS = 2500;
const COALESCE_MS = 1200;

export class Editor {
  plan = $state.raw<Plan>(emptyPlan());
  meta = $state<Meta | null>(null);
  /** Plan stammt aus dem alten Format und wird nur als Vorschau gezeigt. */
  legacy = $state(false);
  selection = $state<Selection>(null);
  /** Gerät aus der Palette, das als Nächstes gesetzt wird. */
  placing = $state.raw<DeviceDef | null>(null);
  editing = $state(false);
  view = $state<View>("board");
  query = $state("");
  saveState = $state<SaveState>("saved");
  /** Wird hochgezählt, wenn die Schrankansicht ein Gerät in den Blick holen soll. */
  focusTick = $state(0);
  /** Reihe, auf die die Schrankansicht zoomen soll (Detailansicht Hutschiene). */
  railZoom = $state.raw<{ field: number; row: number } | null>(null);

  private undoStack = $state.raw<Plan[]>([]);
  private redoStack = $state.raw<Plan[]>([]);
  private lastKey = "";
  private lastAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> | null = null;

  wiring = $derived(new Wiring(this.plan));
  canEdit = $derived(this.meta != null && this.meta.permission !== "viewer" && !this.legacy);
  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);
  selectedDevice = $derived.by<Device | null>(() => {
    const s = this.selection;
    return s?.kind === "device" ? (this.wiring.devices.get(s.id) ?? null) : null;
  });
  /** IDs der Geräte, die zur Suche passen; null ohne Suchbegriff. */
  matches = $derived.by<Set<string> | null>(() => {
    const q = this.query.trim().toLocaleLowerCase("de");
    if (!q) return null;
    const hit = new Set<string>();
    for (const d of this.plan.devices) {
      const def = this.wiring.def(d);
      if ([d.label, d.tech, def.label, d.group, d.note ?? ""].some((t) => t.toLocaleLowerCase("de").includes(q))) hit.add(d.id);
    }
    return hit;
  });

  // ---------- Laden und Speichern ----------

  async open(id: number) {
    this.reset();
    const p = await api.plan(id);
    const { plan, legacy } = loadPlanData(p.data, app.catalog);
    if (!plan.name) plan.name = p.name;
    this.plan = plan;
    this.legacy = legacy;
    this.meta = { id: p.id, version: p.version, permission: p.permission, ownerName: p.owner_name, mine: p.mine };
    const roomy = matchMedia("(pointer: fine)").matches && innerWidth >= 900;
    this.editing = this.canEdit && roomy;
  }

  private reset() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.plan = emptyPlan();
    this.meta = null;
    this.legacy = false;
    this.selection = null;
    this.placing = null;
    this.view = "board";
    this.query = "";
    this.saveState = "saved";
    this.undoStack = [];
    this.redoStack = [];
  }

  close() {
    this.reset();
  }

  get dirty() {
    return this.saveState !== "saved";
  }

  private schedule() {
    this.saveState = "dirty";
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.save(), AUTOSAVE_MS);
  }

  /** Speichert sofort. Bei einem Konflikt bleibt der Zustand "conflict", bis der Nutzer entscheidet. */
  async save({ overwrite = false } = {}): Promise<void> {
    if (!this.meta || !this.canEdit) return;
    if (this.saving) await this.saving;
    if (this.saveState === "saved" && !overwrite) return;
    if (this.saveState === "conflict" && !overwrite) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const meta = this.meta;
    const sent = this.plan;
    this.saveState = "saving";
    this.saving = (async () => {
      try {
        if (overwrite) meta.version = (await api.plan(meta.id)).version;
        const r = await api.savePlan(meta.id, sent.name.trim() || "Unbenannter Plan", sent, meta.version);
        meta.version = r.version;
        // Zwischenzeitliche Änderungen bleiben "dirty" und werden vom Timer gespeichert.
        if (this.plan === sent) this.saveState = "saved";
        else this.schedule();
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) this.saveState = "conflict";
        else {
          this.saveState = "error";
          feedback.error(e);
        }
      }
    })();
    await this.saving;
    this.saving = null;
  }

  /** Verwirft lokale Änderungen und lädt den Serverstand. */
  async reload() {
    if (this.meta) await this.open(this.meta.id);
  }

  // ---------- Änderungen ----------

  /**
   * Übernimmt einen neuen Planstand. Aufeinanderfolgende Änderungen mit gleichem
   * key (z. B. Tippen in einem Textfeld) ergeben einen einzigen Undo-Schritt.
   */
  commit(next: Plan | null | undefined, key = ""): boolean {
    if (!next || next === this.plan || !this.canEdit) return false;
    const now = Date.now();
    const coalesce = key !== "" && key === this.lastKey && now - this.lastAt < COALESCE_MS;
    if (!coalesce) this.undoStack = [...this.undoStack.slice(-(UNDO_LIMIT - 1)), this.plan];
    this.redoStack = [];
    this.lastKey = key;
    this.lastAt = now;
    this.plan = next;
    this.schedule();
    return true;
  }

  undo() {
    const prev = this.undoStack.at(-1);
    if (!prev || !this.canEdit) return;
    this.undoStack = this.undoStack.slice(0, -1);
    this.redoStack = [...this.redoStack, this.plan];
    this.apply(prev);
  }

  redo() {
    const next = this.redoStack.at(-1);
    if (!next || !this.canEdit) return;
    this.redoStack = this.redoStack.slice(0, -1);
    this.undoStack = [...this.undoStack, this.plan];
    this.apply(next);
  }

  private apply(plan: Plan) {
    this.plan = plan;
    this.lastKey = "";
    const s = this.selection;
    if (s?.kind === "device" && !plan.devices.some((d) => d.id === s.id)) this.selection = null;
    this.schedule();
  }

  // ---------- Aktionen ----------

  select(sel: Selection, { focus = false } = {}) {
    this.selection = sel;
    if (focus) this.focusTick++;
  }

  zoomToRail(field: number, row: number) {
    this.view = "board";
    this.railZoom = { field, row };
  }

  selectDevice(id: string, opts?: { focus?: boolean }) {
    this.select({ kind: "device", id }, opts);
  }

  /** select = false lässt die Auswahl leer, damit auf dem Handy kein Blatt den Schrank verdeckt. */
  place(field: number, row: number, x: number, { select = true } = {}) {
    if (!this.placing) return;
    const r = ops.placeDevice(this.plan, this.placing, field, row, x);
    if (!r) return feedback.toast("Kein Platz in dieser Reihe.", "error");
    this.commit(r.plan);
    this.selection = select ? { kind: "device", id: r.id } : null;
  }

  move(id: string, field: number, row: number, x: number) {
    const next = ops.moveDevice(this.plan, id, field, row, x);
    if (!next) feedback.toast("Kein Platz in dieser Reihe.", "error");
    else this.commit(next);
  }

  /** Verschiebt das ausgewählte Gerät um einen Rasterschritt. */
  nudge(dir: -1 | 1) {
    const d = this.selectedDevice;
    if (!d) return;
    const step = ops.usesTE(this.wiring.def(d)) ? 9 : 0.5;
    const x = d.x + dir * step;
    if (ops.isFree(this.plan, d.field, d.row, x, d.width, d.id)) this.commit(ops.updateDevice(this.plan, d.id, { x: Math.round(x * 10) / 10 }), `nudge:${d.id}`);
  }

  patch(id: string, patch: Parameters<typeof ops.updateDevice>[2], key = "") {
    this.commit(ops.updateDevice(this.plan, id, patch), key && `${key}:${id}`);
  }

  resize(id: string, width: number) {
    const next = ops.resizeDevice(this.plan, id, width);
    if (!next) feedback.toast("Für diese Breite ist kein Platz.", "error");
    else this.commit(next, `width:${id}`);
  }

  removeSelected() {
    const d = this.selectedDevice;
    if (!d) return;
    this.commit(ops.removeDevice(this.plan, d.id));
    this.selection = null;
  }

  duplicateSelected() {
    const d = this.selectedDevice;
    if (!d) return;
    const r = ops.duplicateDevice(this.plan, d.id);
    if (!r) return feedback.toast("Kein Platz für eine Kopie in dieser Reihe.", "error");
    this.commit(r.plan);
    this.selection = { kind: "device", id: r.id };
  }

  connect(deviceId: string, inputId: string, link: Link | null) {
    this.commit(ops.connect(this.plan, deviceId, inputId, link));
  }

  autoConnect(deviceId: string, fromId: string) {
    const next = ops.autoConnect(this.plan, deviceId, fromId);
    if (next === this.plan || JSON.stringify(next.devices) === JSON.stringify(this.plan.devices)) {
      feedback.toast("Keine passenden freien Anschlüsse gefunden.");
      return;
    }
    this.commit(next);
  }

  setRail(field: number, row: number, patch: Partial<RailConfig>) {
    this.commit(ops.setRail(this.plan, field, row, patch));
  }

  swapRows(field: number, a: number, b: number) {
    if (this.commit(ops.swapRows(this.plan, field, a, b))) this.selection = { kind: "rail", field, row: b };
  }

  rename(name: string) {
    this.commit({ ...this.plan, name }, "name");
  }

  setInsertStatus(status: Plan["insertStatus"]) {
    this.commit({ ...this.plan, insertStatus: status });
  }
}

export const editor = new Editor();
