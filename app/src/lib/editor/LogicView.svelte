<script lang="ts">
  /** Logikplan: Baum der Einspeisung, von den Quellen zu den Verbrauchern. */
  import { logicTree, type TreeNode } from "../domain/reports";
  import { editor } from "./editor.svelte";

  let { onopen }: { onopen: (id: string) => void } = $props();
  const tree = $derived(logicTree(editor.plan, editor.wiring));
</script>

{#snippet node(n: TreeNode)}
  <li>
    <button class="node" class:source={n.source} class:new={n.status === "new"} class:selected={editor.selectedDevice?.id === n.id} disabled={n.source} onclick={() => onopen(n.id)}>
      <span class="title">
        {#each n.via as c}<span class="cond c-{c}">{c}</span>{/each}
        <b>{n.label}</b>
      </span>
      {#if n.sub}<span class="hint">{n.sub}</span>{/if}
    </button>
    {#if n.children.length}
      <ul>{#each n.children as c (c.id)}{@render node(c)}{/each}</ul>
    {/if}
  </li>
{/snippet}

<div class="view">
  {#if tree.roots.length === 0}
    <p class="empty">Noch keine Verbindungen. Lege unter „Quellen“ eine Einspeisung an und verbinde die Geräte in ihren Eigenschaften.</p>
  {:else}
    <ul class="tree">{#each tree.roots as r (r.id)}{@render node(r)}{/each}</ul>
  {/if}
  {#if tree.loose.length}
    <section>
      <h3>Ohne Verbindung ({tree.loose.length})</h3>
      <div class="loose">
        {#each tree.loose as d (d.id)}
          <button class="node" onclick={() => onopen(d.id)}><b>{d.label || editor.wiring.def(d).label}</b><span class="hint">F{d.field + 1} R{d.row + 1}</span></button>
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  .view {
    height: 100%;
    overflow: auto;
    padding: var(--s4);
    background: var(--surface);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  /* Verbindungslinien des Baums */
  li ul {
    margin-left: 14px;
    padding-left: 14px;
    border-left: 2px solid var(--border);
  }
  li {
    position: relative;
    padding-top: var(--s2);
  }
  li ul > li::before {
    content: "";
    position: absolute;
    left: -14px;
    top: calc(var(--s2) + 18px);
    width: 12px;
    border-top: 2px solid var(--border);
  }
  .node {
    display: inline-grid;
    gap: 1px;
    max-width: 100%;
    min-height: 36px;
    padding: var(--s1) var(--s3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  .node:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .node.source {
    background: var(--chrome);
    border-color: var(--chrome);
    color: var(--chrome-text);
    cursor: default;
  }
  .node.source .hint {
    color: var(--chrome-text-2);
  }
  .node.new {
    border-color: var(--ok);
    border-style: dashed;
  }
  .node.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2);
  }
  section {
    margin-top: var(--s5);
    padding-top: var(--s4);
    border-top: 1px solid var(--border);
  }
  .loose {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s2);
    margin-top: var(--s3);
  }
  @media print {
    .view {
      height: auto;
      overflow: visible;
      padding: 0;
    }
    li {
      break-inside: avoid;
    }
  }
</style>
