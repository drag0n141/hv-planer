<script lang="ts">
  /** Elementliste: Tabelle auf breiten, Karten auf schmalen Bildschirmen. */
  import { deviceList } from "../domain/reports";
  import { editor } from "./editor.svelte";

  let { onopen }: { onopen: (id: string) => void } = $props();
  const rows = $derived(deviceList(editor.plan, editor.wiring).filter((r) => !editor.matches || editor.matches.has(r.id)));
  const selected = $derived(editor.selectedDevice?.id);
</script>

<div class="view">
  {#if rows.length === 0}
    <p class="empty">{editor.plan.devices.length ? "Kein Gerät passt zur Suche." : "Noch keine Geräte im Plan."}</p>
  {:else}
    <table class="table wide">
      <thead>
        <tr><th>Position</th><th>Gerät</th><th>Phase</th><th>Bezeichnung</th><th>Eingang von</th><th>Ausgang zu</th></tr>
      </thead>
      <tbody>
        {#each rows as r (r.id)}
          <tr class="clickable" class:selected={selected === r.id} onclick={() => onopen(r.id)}>
            <td class="nowrap">{r.position}</td>
            <td>{r.device}<div class="hint">{r.tech}</div></td>
            <td class="nowrap">{r.phase}</td>
            <td>{r.label}{#if r.status === "new"} <span class="badge new">Neu</span>{/if}{#if r.group} <span class="badge">{r.group}</span>{/if}</td>
            <td>{r.from}</td>
            <td>{r.to}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <ul class="cards">
      {#each rows as r (r.id)}
        <li>
          <button class:selected={selected === r.id} onclick={() => onopen(r.id)}>
            <span class="head"><b class="truncate">{r.label || r.device}</b><span class="phase">{r.phase}</span></span>
            <span class="hint truncate">{r.position} · {r.label ? `${r.device} · ` : ""}{r.tech}</span>
            {#if r.from}<span class="line truncate">← {r.from}</span>{/if}
            {#if r.to}<span class="line truncate">→ {r.to}</span>{/if}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .view {
    height: 100%;
    overflow: auto;
    background: var(--surface);
  }
  .nowrap {
    white-space: nowrap;
  }
  .cards {
    display: none;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .cards button {
    display: grid;
    gap: 2px;
    width: 100%;
    padding: var(--s3) var(--s4);
    border: 0;
    border-bottom: 1px solid var(--border);
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .cards button.selected {
    background: var(--accent-soft);
  }
  .head {
    display: flex;
    justify-content: space-between;
    gap: var(--s3);
  }
  .phase {
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .line {
    font-size: var(--fs-sm);
    color: var(--text-2);
  }
  @media (max-width: 760px) {
    .wide {
      display: none;
    }
    .cards {
      display: block;
    }
  }
  @media print {
    .view {
      height: auto;
      overflow: visible;
    }
    .wide {
      display: table;
    }
    .cards {
      display: none;
    }
  }
</style>
