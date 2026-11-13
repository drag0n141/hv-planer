<script lang="ts">
  /** Gerätepalette: Katalog nach Kategorie, mit Suche. Auswahl = Gerät, das als Nächstes gesetzt wird. */
  import { app } from "../app.svelte";
  import { widthText } from "../domain/plan";
  import { defWidthMM, type CatalogEntry } from "../domain/types";
  import { editor } from "./editor.svelte";

  let { onpick }: { onpick?: () => void } = $props();
  let q = $state("");

  const groups = $derived.by(() => {
    const needle = q.trim().toLocaleLowerCase("de");
    if (!needle) return app.palette;
    return app.palette
      .map((g) => ({ ...g, items: g.items.filter((e) => `${e.label} ${e.tech}`.toLocaleLowerCase("de").includes(needle)) }))
      .filter((g) => g.items.length);
  });

  function pick(e: CatalogEntry) {
    editor.placing = editor.placing?.id === e.id ? null : e;
    if (editor.placing) onpick?.();
  }
</script>

<div class="palette">
  <div class="top">
    <input class="input" type="search" placeholder="Gerät suchen" aria-label="Gerät suchen" bind:value={q} />
    <div class="seg" role="group" aria-label="Einfügen als">
      <button class:on={editor.plan.insertStatus === "existing"} onclick={() => editor.setInsertStatus("existing")}>Bestand</button>
      <button class:on={editor.plan.insertStatus === "new"} onclick={() => editor.setInsertStatus("new")}>Neu</button>
    </div>
  </div>
  <div class="list">
    {#each groups as g (g.category)}
      <details open={q !== "" || g === groups[0] || g.items.some((e) => e.id === editor.placing?.id)}>
        <summary>{g.category}<span class="count">{g.items.length}</span></summary>
        {#each g.items as e (e.id)}
          <button class="item" class:on={editor.placing?.id === e.id} onclick={() => pick(e)}>
            <span class="name truncate">{e.label}</span>
            <span class="meta truncate">{e.tech}</span>
            <span class="width">{widthText(defWidthMM(e), e)}</span>
          </button>
        {/each}
      </details>
    {:else}
      <p class="empty">Kein Gerät gefunden.</p>
    {/each}
  </div>
</div>

<style>
  .palette {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .top {
    display: grid;
    gap: var(--s2);
    padding: var(--s3);
    border-bottom: 1px solid var(--border);
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .seg button {
    min-height: 32px;
    border: 0;
    background: var(--surface);
    font-size: var(--fs-sm);
    font-weight: 550;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .list {
    flex: 1;
    overflow: auto;
    overscroll-behavior: contain;
    padding-bottom: var(--s4);
  }
  summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: var(--tap);
    padding: 0 var(--s3);
    font-size: var(--fs-xs);
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-2);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .count {
    font-weight: 500;
    color: var(--text-3);
  }
  .item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    column-gap: var(--s2);
    width: 100%;
    min-height: var(--tap);
    padding: var(--s1) var(--s3);
    border: 0;
    border-left: 3px solid transparent;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .item:hover {
    background: var(--surface-2);
  }
  .item.on {
    background: var(--accent-soft);
    border-left-color: var(--accent);
  }
  .name {
    font-weight: 550;
  }
  .meta {
    grid-column: 1;
    font-size: var(--fs-xs);
    color: var(--text-2);
  }
  .width {
    grid-column: 2;
    grid-row: 1 / span 2;
    align-self: center;
    font-size: var(--fs-xs);
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
  }
</style>
