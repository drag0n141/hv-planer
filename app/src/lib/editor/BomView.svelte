<script lang="ts">
  /** Stückliste mit CSV-Export. */
  import { downloadFile, fileName } from "../api";
  import { bomCsv, buildBom } from "../domain/reports";
  import Button from "../ui/Button.svelte";
  import { editor } from "./editor.svelte";

  let onlyNew = $state(false);
  const rows = $derived(buildBom(editor.plan, onlyNew));
  const total = $derived(rows.reduce((s, r) => s + r.count, 0));

  function exportCsv() {
    downloadFile(`${fileName(editor.plan.name)}-stueckliste${onlyNew ? "-neu" : ""}.csv`, bomCsv(rows), "text/csv;charset=utf-8");
  }
</script>

<div class="view">
  <div class="bar no-print">
    <label class="check"><input type="checkbox" bind:checked={onlyNew} /> nur Neu</label>
    <span class="grow"></span>
    <Button icon="download" label="CSV" disabled={!rows.length} onclick={exportCsv} />
  </div>
  {#if rows.length === 0}
    <p class="empty">{onlyNew ? "Keine als „Neu“ markierten Geräte." : "Noch keine Geräte im Plan."}</p>
  {:else}
    <table class="table">
      <thead><tr><th class="num">Menge</th><th>Gerät</th><th>Technische Angabe</th><th>Breite</th><th class="cat">Kategorie</th></tr></thead>
      <tbody>
        {#each rows as r (r.label + r.tech + r.width)}
          <tr>
            <td class="num"><b>{r.count}</b>{#if !onlyNew && r.countNew}<div class="hint">{r.countNew} neu</div>{/if}</td>
            <td>{r.label}</td>
            <td>{r.tech}</td>
            <td class="nowrap">{r.width}</td>
            <td class="cat">{r.category}</td>
          </tr>
        {/each}
      </tbody>
      <tfoot><tr><td class="num"><b>{total}</b></td><td colspan="4">Geräte gesamt</td></tr></tfoot>
    </table>
  {/if}
</div>

<style>
  .view {
    height: 100%;
    overflow: auto;
    background: var(--surface);
  }
  .bar {
    display: flex;
    align-items: center;
    gap: var(--s3);
    padding: var(--s2) var(--s4);
    border-bottom: 1px solid var(--border);
  }
  .nowrap {
    white-space: nowrap;
  }
  tfoot td {
    padding: var(--s2) var(--s3);
    background: var(--surface-2);
  }
  @media (max-width: 600px) {
    .cat {
      display: none;
    }
  }
  @media print {
    .view {
      height: auto;
      overflow: visible;
    }
    .cat {
      display: table-cell;
    }
  }
</style>
