<script lang="ts">
  /**
   * Stromlaufplan, potentialorientiert: oben die Schienen L1/L2/L3/N/PE,
   * darunter je Stromkreis eine Spalte mit den durchlaufenen Geräten.
   * N und PE werden getrennt vom Außenleiterpfad geführt.
   */
  import { circuits } from "../domain/reports";
  import type { Conductor } from "../domain/types";
  import { editor } from "./editor.svelte";

  let { onopen }: { onopen: (id: string) => void } = $props();

  const list = $derived(circuits(editor.plan, editor.wiring));

  const BUS: Conductor[] = ["L1", "L2", "L3", "N", "PE"];
  const COLOR: Record<Conductor, string> = { L1: "var(--l1)", L2: "var(--l2)", L3: "var(--l3)", N: "var(--n)", PE: "var(--pe)" };
  const LEFT = 16;
  const COL = 50;
  const BOX_W = 36;
  const BOX_H = 15;
  const PITCH = 23;
  const TOP = 50;
  const busY = (c: Conductor) => 8 + BUS.indexOf(c) * 8;

  const cols = $derived(
    list.map((c, i) => ({
      c,
      cx: LEFT + COL / 2 + i * COL,
      boxes: c.steps.filter((s) => !s.source),
      feed: c.steps.find((s) => s.source)?.label ?? "",
    })),
  );
  const depth = $derived(Math.max(1, ...cols.map((x) => x.boxes.length)));
  const width = $derived(LEFT + Math.max(1, cols.length) * COL + 6);
  const height = $derived(TOP + (depth - 1) * PITCH + BOX_H + 10);
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
</script>

<div class="view">
  {#if list.length === 0}
    <p class="empty">Noch keine Stromkreise. Ein Stromkreis entsteht, sobald ein Gerät gespeist wird und selbst nichts weiter speist.</p>
  {:else}
    <div class="scroll">
      <svg viewBox="0 0 {width} {height}" style:width="{width * 2.8}px" role="img" aria-label="Stromlaufplan">
        {#each BUS as b}
          <line class="bus" x1={LEFT - 2} x2={width - 2} y1={busY(b)} y2={busY(b)} stroke={COLOR[b]} stroke-dasharray={b === "PE" ? "4 2" : undefined} />
          <text class="bus-label" x="1" y={busY(b) + 1.6}>{b}</text>
        {/each}

        {#each cols as col (col.c.deviceId)}
          {@const n = col.c.lines.length}
          {@const last = col.boxes.length - 1}
          {@const leafY = TOP + last * PITCH}
          <!-- Außenleiter: von der Schiene durch alle Geräte -->
          {#each col.c.lines as l, j}
            {@const x = col.cx + (j - (n - 1) / 2) * 4 - 4}
            <circle cx={x} cy={busY(l)} r="1.1" fill={COLOR[l]} />
            <line class="wire" x1={x} x2={x} y1={busY(l)} y2={leafY} stroke={COLOR[l]} />
          {/each}
          {#if col.c.neutral}
            {@const x = col.cx + BOX_W / 2 + 3}
            <circle cx={x} cy={busY("N")} r="1.1" fill={COLOR.N} />
            <polyline class="wire" points="{x},{busY('N')} {x},{leafY + BOX_H / 2 - 2} {col.cx + BOX_W / 2},{leafY + BOX_H / 2 - 2}" stroke={COLOR.N} />
            {#each col.boxes as s, i}
              {#if s.label === col.c.neutral && i !== last}<rect x={x - 1.4} y={TOP + i * PITCH + BOX_H / 2 - 1.4} width="2.8" height="2.8" fill={COLOR.N} />{/if}
            {/each}
          {/if}
          {#if col.c.earth}
            {@const x = col.cx + BOX_W / 2 + 6}
            <circle cx={x} cy={busY("PE")} r="1.1" fill={COLOR.PE} />
            <polyline class="wire" stroke-dasharray="3 1.5" points="{x},{busY('PE')} {x},{leafY + BOX_H / 2 + 2} {col.cx + BOX_W / 2},{leafY + BOX_H / 2 + 2}" stroke={COLOR.PE} />
          {/if}

          {#each col.boxes as s, i (s.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <g class="box role-{s.role}" class:leaf={i === last} transform="translate({col.cx - BOX_W / 2 - 4} {TOP + i * PITCH})" onclick={() => onopen(s.id)}>
              <rect width={BOX_W} height={BOX_H} rx="1.5" />
              <text x={BOX_W / 2} y="6.2" class="b-name">{cut(s.label, 15)}</text>
              <text x={BOX_W / 2} y="11.6" class="b-sub">{cut(s.sub, 20)}</text>
            </g>
          {/each}
          <text class="nr" x={col.cx - 4} y={leafY + BOX_H + 6}>{col.c.nr}</text>
        {/each}
      </svg>
    </div>

    <div class="table-scroll">
    <table class="table">
      <thead><tr><th class="num">Nr.</th><th>Stromkreis</th><th>Leiter</th><th>Pfad</th><th>N über</th><th>PE über</th></tr></thead>
      <tbody>
        {#each list as c (c.deviceId)}
          <tr class="clickable" onclick={() => onopen(c.deviceId)}>
            <td class="num">{c.nr}</td>
            <td><b>{c.label}</b>{#if c.group}<div class="hint">Gruppe {c.group}</div>{/if}</td>
            <td><span class="row">{#each c.lines as l}<span class="cond c-{l}">{l}</span>{:else}–{/each}</span></td>
            <td>{c.steps.slice(0, -1).map((s) => s.label).join(" → ") || "–"}</td>
            <td>{c.neutral || "–"}</td>
            <td>{c.earth || "–"}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  {/if}
</div>

<style>
  .view {
    height: 100%;
    overflow: auto;
    background: var(--surface);
  }
  .scroll {
    overflow-x: auto;
    padding: var(--s4);
    border-bottom: 1px solid var(--border);
  }
  svg {
    display: block;
    max-width: none;
    height: auto;
  }
  .table-scroll {
    overflow-x: auto;
  }
  .table-scroll .table {
    min-width: 640px;
  }
  text {
    font-family: var(--font);
    pointer-events: none;
  }
  .bus {
    stroke-width: 1.1;
  }
  .bus-label {
    font-size: 4.4px;
    font-weight: 650;
    fill: var(--text-2);
  }
  .wire {
    fill: none;
    stroke-width: 0.8;
  }
  .box {
    cursor: pointer;
  }
  .box rect {
    fill: var(--surface);
    stroke: var(--device-stroke);
    stroke-width: 0.45;
  }
  .box.role-rcd rect {
    stroke: #c9772b;
    stroke-width: 0.8;
  }
  .box.leaf rect {
    fill: var(--surface-3);
  }
  .box:hover rect {
    stroke: var(--accent);
  }
  .b-name {
    font-size: 4px;
    font-weight: 650;
    text-anchor: middle;
    fill: var(--text);
  }
  .b-sub {
    font-size: 3.2px;
    text-anchor: middle;
    fill: var(--text-2);
  }
  .nr {
    font-size: 4.4px;
    font-weight: 650;
    text-anchor: middle;
    fill: var(--text-2);
  }
  @media print {
    .view {
      height: auto;
      overflow: visible;
    }
    .scroll,
    .table-scroll {
      overflow: visible;
      padding: 0 0 var(--s4);
    }
    svg {
      width: 100% !important;
    }
    tr {
      break-inside: avoid;
    }
  }
</style>
