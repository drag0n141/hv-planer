<script lang="ts">
  /**
   * Schrankansicht als SVG. Alle Maße sind Millimeter; die Darstellung skaliert
   * über die viewBox auf jede Bildschirmgröße (Verschieben, Zoomen, Pinch).
   */
  import { untrack } from "svelte";
  import { nearestFreeX } from "../domain/plan";
  import { TE, defWidthMM, railConfig, type Conductor, type Device, type DeviceDef } from "../domain/types";
  import Button from "../ui/Button.svelte";
  import { editor } from "./editor.svelte";

  const PAD = 10;
  const LABEL_W = 12;
  const GAP = 18;
  const HEAD = 14;
  const ROW_H = 94;
  const ROW_TOP = 6;
  const DEV_H = 72;
  const BAR_Y = DEV_H + 3;
  const BAR_H = 5;
  const MARGIN = 8;

  const plan = $derived(editor.plan);
  const w = $derived(editor.wiring);
  const railW = $derived(plan.board.te * TE);
  const fieldW = $derived(LABEL_W + 2 * PAD + railW);
  const totalW = $derived(plan.board.fields * fieldW + (plan.board.fields - 1) * GAP);
  const totalH = $derived(HEAD + plan.board.rows * ROW_H + PAD / 2);

  const fieldX = (f: number) => f * (fieldW + GAP);
  const railX = (f: number) => fieldX(f) + PAD + LABEL_W;
  const railY = (r: number) => HEAD + r * ROW_H + ROW_TOP;

  // ---------- Ansicht ----------
  let host: HTMLDivElement | undefined = $state();
  let svg: SVGSVGElement | undefined = $state();
  let cw = $state(800);
  let ch = $state(500);
  let vb = $state({ x: 0, y: 0, w: 800, h: 500 });
  let fitted = false;
  let printing = $state(false);

  const scale = $derived(cw / vb.w); // Bildschirmpixel je mm

  function fit() {
    const w0 = totalW + 2 * MARGIN;
    const h0 = totalH + 2 * MARGIN;
    const aspect = cw / Math.max(1, ch);
    let vw = w0;
    let vh = w0 / aspect;
    if (vh < h0) {
      vh = h0;
      vw = h0 * aspect;
    }
    vb = { x: -MARGIN - (vw - w0) / 2, y: -MARGIN - (vh - h0) / 2, w: vw, h: vh };
  }

  /** Auf schmalen Bildschirmen passt der ganze Schrank selten lesbar: oben links mit lesbarer Größe starten. */
  function initialFit() {
    fit();
    const minScale = 1.6;
    if (cw < 700 && cw / vb.w < minScale && plan.board.fields > 0) {
      const vw = Math.min(totalW + 2 * MARGIN, Math.max(fieldW + 2 * MARGIN, cw / minScale));
      vb = { x: -MARGIN, y: -MARGIN, w: vw, h: vw / (cw / Math.max(1, ch)) };
    }
  }

  function zoomAt(factor: number, cx = cw / 2, cy = ch / 2) {
    const minW = 60;
    const maxW = Math.max(totalW, totalH * (cw / ch)) * 2.5;
    const nw = Math.min(maxW, Math.max(minW, vb.w / factor));
    const k = nw / vb.w;
    const wx = vb.x + (cx / cw) * vb.w;
    const wy = vb.y + (cy / ch) * vb.h;
    vb = { x: wx - (cx / cw) * nw, y: wy - (cy / ch) * vb.h * k, w: nw, h: vb.h * k };
  }

  $effect(() => {
    if (!host) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width < 10 || height < 10) return;
      const first = !fitted;
      // Sichtbare Mitte beibehalten, Seitenverhältnis an den neuen Platz anpassen
      const cx = vb.x + vb.w / 2;
      const cy = vb.y + vb.h / 2;
      const keepScale = cw / vb.w;
      cw = width;
      ch = height;
      if (first) {
        fitted = true;
        initialFit();
      } else {
        const nw = width / keepScale;
        const nh = height / keepScale;
        vb = { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
      }
    });
    ro.observe(host);
    return () => ro.disconnect();
  });

  // Ausgewähltes Gerät in den Blick holen, wenn es von außen (Liste, Suche) gewählt wurde.
  $effect(() => {
    if (!editor.focusTick) return;
    // Nur auf ausdrückliche Anforderung reagieren, nicht auf jede Planänderung oder jedes Verschieben.
    untrack(() => {
      const d = editor.selectedDevice;
      if (!d) return;
      const x = railX(d.field) + d.x + d.width / 2;
      const y = railY(d.row) + DEV_H / 2;
      // Schmal liegt das Eigenschaften-Blatt über der unteren Hälfte: nur der obere Teil zählt als sichtbar.
      const visible = sheetCovers() ? 0.36 : 1;
      const inside = x > vb.x + 10 && x < vb.x + vb.w - 10 && y > vb.y + 10 && y < vb.y + vb.h * visible - 10;
      if (!inside) vb = { ...vb, x: x - vb.w / 2, y: y - (vb.h * visible) / 2 };
    });
  });

  const sheetCovers = () => innerWidth < 700;

  // Detailansicht: eine Reihe bildschirmfüllend zeigen
  $effect(() => {
    const z = editor.railZoom;
    if (!z) return;
    untrack(() => {
      const vw = railW + LABEL_W + 2 * PAD;
      const vh = vw / (cw / Math.max(1, ch));
      vb = { x: fieldX(z.field), y: railY(z.row) + (DEV_H + BAR_H) / 2 - vh / 2, w: vw, h: vh };
      editor.railZoom = null;
    });
  });

  $effect(() => {
    const before = () => (printing = true);
    const after = () => (printing = false);
    addEventListener("beforeprint", before);
    addEventListener("afterprint", after);
    return () => {
      removeEventListener("beforeprint", before);
      removeEventListener("afterprint", after);
    };
  });

  const viewBox = $derived(printing ? `${-MARGIN} ${-MARGIN} ${totalW + 2 * MARGIN} ${totalH + 2 * MARGIN}` : `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);

  // ---------- Zeiger ----------
  interface Hit {
    field: number;
    row: number;
    /** Position auf der Hutschiene in mm. */
    x: number;
    onRail: boolean;
  }

  function toWorld(e: { clientX: number; clientY: number }) {
    const r = svg!.getBoundingClientRect();
    return { x: vb.x + ((e.clientX - r.left) / r.width) * vb.w, y: vb.y + ((e.clientY - r.top) / r.height) * vb.h };
  }

  function hitRail(p: { x: number; y: number }): Hit | null {
    const field = Math.floor((p.x + GAP / 2) / (fieldW + GAP));
    const row = Math.floor((p.y - HEAD) / ROW_H);
    if (field < 0 || field >= plan.board.fields || row < 0 || row >= plan.board.rows) return null;
    const x = p.x - railX(field);
    return { field, row, x, onRail: x >= -PAD && x <= railW + PAD };
  }

  type Ghost = { field: number; row: number; x: number; width: number; ok: boolean };
  let ghost = $state<Ghost | null>(null);
  /** Gerät, das gerade gezogen wird. */
  let draggingId = $state<string | null>(null);

  function ghostFor(def: DeviceDef, width: number, hit: Hit, grabOffset: number, ignoreId?: string): Ghost {
    const wanted = hit.x - grabOffset;
    const x = nearestFreeX(plan, def, width, hit.field, hit.row, wanted, ignoreId);
    return { field: hit.field, row: hit.row, x: x ?? Math.max(0, Math.min(railW - width, wanted)), width, ok: x != null };
  }

  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: null | {
    kind: "pending" | "pan" | "drag" | "pinch";
    startX: number;
    startY: number;
    vb0: typeof vb;
    deviceId: string | null;
    railRow: { field: number; row: number } | null;
    grab: number;
    pinch0: number;
    timer: ReturnType<typeof setTimeout> | null;
  } = null;

  const MOVE_TOLERANCE = 6;

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    try {
      svg!.setPointerCapture(e.pointerId);
    } catch {
      /* Zeiger ist schon wieder weg (z. B. sehr kurzer Tipp) */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (gesture?.timer) clearTimeout(gesture.timer);
      gesture = { kind: "pinch", startX: (a.x + b.x) / 2, startY: (a.y + b.y) / 2, vb0: { ...vb }, deviceId: null, railRow: null, grab: 0, pinch0: Math.hypot(a.x - b.x, a.y - b.y), timer: null };
      ghost = null;
      return;
    }
    const target = e.target as Element;
    const deviceId = target.closest<SVGGElement>("[data-device]")?.dataset.device ?? null;
    const railEl = target.closest<SVGGElement>("[data-rail]");
    const railRow = railEl ? { field: Number(railEl.dataset.field), row: Number(railEl.dataset.row) } : null;
    const d = deviceId ? w.devices.get(deviceId) : null;
    const p = toWorld(e);
    gesture = { kind: "pending", startX: e.clientX, startY: e.clientY, vb0: { ...vb }, deviceId, railRow, grab: d ? p.x - railX(d.field) - d.x : 0, pinch0: 0, timer: null };
    // Touch: Gerät erst nach langem Drücken ziehen, sonst verschiebt die Geste die Ansicht.
    if (d && editor.editing && !editor.placing && e.pointerType !== "mouse") {
      const g = gesture;
      g.timer = setTimeout(() => {
        if (gesture === g && g.kind === "pending") {
          g.kind = "drag";
          draggingId = d.id;
          editor.selectDevice(d.id);
          navigator.vibrate?.(10);
          ghost = { field: d.field, row: d.row, x: d.x, width: d.width, ok: true };
        }
      }, 380);
    }
  }

  function onpointermove(e: PointerEvent) {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture;

    if (!g) {
      // Maus ohne gedrückte Taste: Vorschau beim Platzieren
      if (editor.placing && editor.editing && e.pointerType === "mouse") {
        const hit = hitRail(toWorld(e));
        const width = defWidthMM(editor.placing);
        ghost = hit?.onRail ? ghostFor(editor.placing, width, hit, width / 2) : null;
      }
      return;
    }

    if (g.kind === "pinch" && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const r = svg!.getBoundingClientRect();
      const k = Math.min(g.vb0.w / 60, Math.max(0.2, dist / Math.max(1, g.pinch0)));
      const nw = g.vb0.w / k;
      const nh = g.vb0.h / k;
      // Der Punkt unter dem Startmittelpunkt wandert mit dem aktuellen Mittelpunkt mit
      const wx = g.vb0.x + ((g.startX - r.left) / r.width) * g.vb0.w;
      const wy = g.vb0.y + ((g.startY - r.top) / r.height) * g.vb0.h;
      vb = { x: wx - ((cx - r.left) / r.width) * nw, y: wy - ((cy - r.top) / r.height) * nh, w: nw, h: nh };
      return;
    }

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.kind === "pending" && Math.hypot(dx, dy) > MOVE_TOLERANCE) {
      if (g.timer) clearTimeout(g.timer);
      const d = g.deviceId ? w.devices.get(g.deviceId) : null;
      if (d && editor.editing && !editor.placing && e.pointerType === "mouse") {
        g.kind = "drag";
        draggingId = d.id;
        editor.selectDevice(d.id);
      } else g.kind = "pan";
    }
    if (g.kind === "pan") {
      vb = { ...vb, x: g.vb0.x - dx / scale, y: g.vb0.y - dy / scale };
    } else if (g.kind === "drag" && g.deviceId) {
      const d = w.devices.get(g.deviceId);
      const hit = hitRail(toWorld(e));
      if (d && hit) ghost = ghostFor(w.def(d), d.width, hit, g.grab, d.id);
    }
  }

  function onpointerup(e: PointerEvent) {
    pointers.delete(e.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.timer) clearTimeout(g.timer);
    if (g.kind === "pinch") {
      if (pointers.size < 2) gesture = null;
      return;
    }
    gesture = null;
    draggingId = null;

    if (g.kind === "drag" && g.deviceId) {
      const gh = ghost;
      ghost = null;
      if (gh?.ok) editor.move(g.deviceId, gh.field, gh.row, gh.x);
      return;
    }
    if (g.kind !== "pending") return;

    // Antippen bzw. Klick
    const hit = hitRail(toWorld(e));
    if (editor.placing && editor.editing) {
      if (hit?.onRail) {
        editor.place(hit.field, hit.row, hit.x - defWidthMM(editor.placing) / 2, { select: !sheetCovers() });
        if (e.pointerType !== "mouse") ghost = null;
      }
      return;
    }
    if (g.deviceId) editor.selectDevice(g.deviceId, { focus: sheetCovers() });
    else if (g.railRow) editor.select({ kind: "rail", ...g.railRow });
    else editor.select(null);
  }

  function onpointercancel(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (gesture?.timer) clearTimeout(gesture.timer);
    gesture = null;
    draggingId = null;
    ghost = null;
  }

  function onwheel(e: WheelEvent) {
    e.preventDefault();
    const r = svg!.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
    } else {
      const unit = e.deltaMode === 1 ? 16 : 1;
      const dx = (e.shiftKey ? e.deltaY : e.deltaX) * unit;
      const dy = (e.shiftKey ? 0 : e.deltaY) * unit;
      vb = { ...vb, x: vb.x + dx / scale, y: vb.y + dy / scale };
    }
  }

  // ---------- Darstellung ----------
  const COLOR: Record<Conductor, string> = { L1: "var(--l1)", L2: "var(--l2)", L3: "var(--l3)", N: "var(--n)", PE: "var(--pe)" };

  /** Farbstreifen am unteren Gerätrand: ein Segment je Pol. */
  function poles(d: Device): (Conductor | null)[] {
    const def = w.def(d);
    const ins = def.inputs.filter((p) => p.kind !== "ctrl");
    if (ins.length) return ins.map((p) => w.inputPotential(d, p.id));
    return def.outputs.map((p) => w.outputPotential(d.id, p.id));
  }

  /** Schriftgröße für hochkant beschriftete, schmale Geräte. */
  const narrowSize = (width: number) => Math.min(7, Math.max(2.8, width * 0.42));
  const fit2 = (s: string, mm: number, size: number) => {
    const max = Math.max(1, Math.floor(mm / (size * 0.56)));
    return s.length > max ? s.slice(0, Math.max(1, max - 1)) + "…" : s;
  };

  interface Shape {
    d: Device;
    x: number;
    y: number;
    name: string;
    kind: string;
    tech: string;
    poles: (Conductor | null)[];
    narrow: boolean;
    role: string;
  }

  const shapes = $derived<Shape[]>(
    plan.devices
      .filter((d) => d.field < plan.board.fields && d.row < plan.board.rows)
      .map((d) => {
        const def = w.def(d);
        return { d, x: railX(d.field) + d.x, y: railY(d.row), name: d.label, kind: def.label, tech: d.tech, poles: poles(d), narrow: d.width < 30, role: def.role };
      }),
  );

  /** Geräte, die mit der Auswahl verbunden sind (speisen sie oder hängen daran). */
  const related = $derived.by(() => {
    const d = editor.selectedDevice;
    const ids = new Set<string>();
    if (!d) return ids;
    for (const p of w.def(d).inputs) {
      const l = w.link(d, p.id);
      if (l) ids.add(l.from);
    }
    for (const c of w.children(d.id)) ids.add(c.id);
    return ids;
  });

  const rails = $derived.by(() => {
    const out: { f: number; r: number; x: number; y: number; bar: (Conductor | null | undefined)[]; selected: boolean }[] = [];
    const sel = editor.selection;
    for (let f = 0; f < plan.board.fields; f++) {
      for (let r = 0; r < plan.board.rows; r++) {
        const cfg = railConfig(plan, f, r);
        // Unter einem einspeisenden Gerät (RCD, Hauptschalter) liegt keine Schiene: sie beginnt an dessen Abgang.
        const feeders = w.onRail(f, r).filter((d) => w.def(d).busbarFeed);
        const covered = (x: number) => feeders.some((d) => x > d.x && x < d.x + d.width);
        const bar =
          cfg.busbar === "none" ? [] : Array.from({ length: plan.board.te }, (_, i) => (covered(i * TE + TE / 2) ? undefined : w.busbarPhaseAt(f, r, i * TE + 1)));
        out.push({ f, r, x: railX(f), y: railY(r), bar, selected: sel?.kind === "rail" && sel.field === f && sel.row === r });
      }
    }
    return out;
  });

  const cursor = $derived(editor.placing && editor.editing ? "copy" : "grab");
</script>

<div class="board" bind:this={host}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svg}
    {viewBox}
    role="application"
    aria-label="Schrankansicht"
    style:cursor
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    {onpointercancel}
    onpointerleave={() => {
      if (!gesture) ghost = null;
    }}
    {onwheel}
  >
    {#each { length: plan.board.fields } as _, f}
      <rect class="field" x={fieldX(f)} y="0" width={fieldW} height={totalH} rx="3" />
      <text class="field-title" x={fieldX(f) + PAD} y="9.5">Feld {f + 1}</text>
    {/each}

    {#each rails as rail (`${rail.f}:${rail.r}`)}
      <g data-rail data-field={rail.f} data-row={rail.r} class="rail" class:selected={rail.selected}>
        <rect class="rail-hit" x={fieldX(rail.f) + 1} y={rail.y - ROW_TOP + 1} width={fieldW - 2} height={ROW_H - 2} rx="2" />
        <text class="rail-label" x={fieldX(rail.f) + PAD / 2 + LABEL_W / 2} y={rail.y + DEV_H / 2 + 2}>R{rail.r + 1}</text>
        <rect class="din" x={rail.x - 3} y={rail.y + DEV_H / 2 - 8} width={railW + 6} height="16" rx="1" />
        {#each { length: plan.board.te + 1 } as _, i}
          <line class="tick" x1={rail.x + i * TE} x2={rail.x + i * TE} y1={rail.y + DEV_H / 2 - 8} y2={rail.y + DEV_H / 2 + 8} />
        {/each}
        {#each rail.bar as c, i}
          {#if c !== undefined}
            <rect class="bar" x={rail.x + i * TE + 0.4} y={rail.y + BAR_Y} width={TE - 0.8} height={BAR_H} fill={c ? COLOR[c] : "var(--unknown)"} />
          {/if}
        {/each}
      </g>
    {/each}

    {#each shapes as s (s.d.id)}
      {@const sel = editor.selectedDevice?.id === s.d.id}
      <g
        data-device={s.d.id}
        class="device role-{s.role}"
        class:selected={sel}
        class:related={related.has(s.d.id)}
        class:new={s.d.status === "new"}
        class:dim={(editor.matches != null && !editor.matches.has(s.d.id)) || draggingId === s.d.id}
        transform="translate({s.x} {s.y})"
      >
        <rect class="body" width={s.d.width} height={DEV_H} rx="1.2" />
        <rect class="role" x="0.6" y="0.6" width={Math.max(0, s.d.width - 1.2)} height="3.4" rx="0.8" />
        {#if s.poles.length}
          {@const pw = (s.d.width - 1.2) / s.poles.length}
          {#each s.poles as c, i}
            <rect class="pole" x={0.6 + i * pw} y={DEV_H - 6.6} width={pw} height="6" fill={c ? COLOR[c] : "var(--unknown)"} />
          {/each}
        {/if}
        {#if s.narrow}
          <text class="t-name" font-size={narrowSize(s.d.width)} transform="translate({s.d.width / 2} {DEV_H - 9}) rotate(-90)" dominant-baseline="central">
            {fit2(s.name || s.kind, DEV_H - 16, narrowSize(s.d.width))}
          </text>
        {:else}
          <text class="t-name" x={s.d.width / 2} y="18" text-anchor="middle" font-size="6.4">{fit2(s.name || s.kind, s.d.width - 3, 6.4)}</text>
          {#if s.name}<text class="t-sub" x={s.d.width / 2} y="27" text-anchor="middle" font-size="4.8">{fit2(s.kind, s.d.width - 3, 4.8)}</text>{/if}
          <text class="t-tech" x={s.d.width / 2} y={DEV_H - 11} text-anchor="middle" font-size="5">{fit2(s.tech, s.d.width - 3, 5)}</text>
        {/if}
        {#if s.d.status === "new"}<circle class="new-dot" cx={s.d.width - 3} cy="7.5" r="1.6" />{/if}
      </g>
    {/each}

    {#if ghost}
      <rect class="ghost" class:bad={!ghost.ok} x={railX(ghost.field) + ghost.x} y={railY(ghost.row)} width={ghost.width} height={DEV_H} rx="1.2" />
    {/if}
  </svg>

  <div class="zoom no-print">
    <Button icon="plus" iconOnly label="Vergrößern" onclick={() => zoomAt(1.3)} />
    <Button icon="minus" iconOnly label="Verkleinern" onclick={() => zoomAt(1 / 1.3)} />
    <Button icon="fit" iconOnly label="Ganzen Schrank zeigen" onclick={fit} />
  </div>
</div>

<style>
  .board {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--board-bg);
    overflow: hidden;
  }
  svg {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  svg:active {
    cursor: grabbing;
  }
  text {
    font-family: var(--font);
    pointer-events: none;
  }
  .field {
    fill: var(--field-bg);
    stroke: var(--border-strong);
    stroke-width: 0.4;
  }
  .field-title {
    font-size: 6px;
    font-weight: 650;
    fill: var(--text-2);
  }
  .rail-hit {
    fill: transparent;
  }
  .rail.selected .rail-hit {
    fill: var(--accent-soft);
    stroke: var(--accent);
    stroke-width: 0.5;
  }
  .rail-label {
    font-size: 5.4px;
    font-weight: 650;
    fill: var(--text-3);
    text-anchor: middle;
  }
  .rail.selected .rail-label {
    fill: var(--accent);
  }
  .din {
    fill: var(--rail);
    opacity: 0.55;
  }
  .tick {
    stroke: var(--field-bg);
    stroke-width: 0.3;
  }
  .bar {
    stroke: var(--border-strong);
    stroke-width: 0.15;
  }

  .device {
    cursor: pointer;
  }
  .body {
    fill: var(--device);
    stroke: var(--device-stroke);
    stroke-width: 0.45;
  }
  .role {
    fill: var(--text-3);
  }
  .role-rcd .role {
    fill: #c9772b;
  }
  .role-protection .role {
    fill: #56708f;
  }
  .role-switch .role {
    fill: #b3261e;
  }
  .role-distribution .role {
    fill: #7a5aa6;
  }
  .role-terminal .role {
    fill: #9aa3ad;
  }
  .role-meter .role,
  .role-control .role {
    fill: #2a8c82;
  }
  .role-spd .role {
    fill: #c2a100;
  }
  .pole {
    stroke: var(--device);
    stroke-width: 0.25;
  }
  .t-name {
    font-weight: 650;
    fill: var(--device-text);
  }
  .t-sub,
  .t-tech {
    fill: var(--text-2);
  }
  .new .body {
    stroke: var(--ok);
    stroke-width: 0.8;
    stroke-dasharray: 2.4 1.2;
  }
  .new-dot {
    fill: var(--ok);
  }
  .related .body {
    stroke: var(--accent);
    stroke-width: 0.9;
    stroke-dasharray: 1.5 1;
  }
  .selected .body {
    stroke: var(--accent);
    stroke-width: 1.3;
    stroke-dasharray: none;
  }
  .dim {
    opacity: 0.22;
  }
  .ghost {
    fill: var(--accent);
    fill-opacity: 0.18;
    stroke: var(--accent);
    stroke-width: 0.8;
    stroke-dasharray: 2 1.2;
    pointer-events: none;
  }
  .ghost.bad {
    fill: var(--danger);
    stroke: var(--danger);
  }

  .zoom {
    position: absolute;
    right: var(--s3);
    bottom: calc(var(--s3) + env(safe-area-inset-bottom));
    display: grid;
    gap: var(--s1);
    padding: var(--s1);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  @media print {
    .board {
      height: auto;
      overflow: visible;
    }
    svg {
      height: auto;
      max-height: 170mm;
    }
  }
</style>
