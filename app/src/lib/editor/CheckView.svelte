<script lang="ts">
  /** Plausibilitätscheck des logischen Modells. */
  import { checkPlan } from "../domain/reports";
  import { editor } from "./editor.svelte";

  let { onopen }: { onopen: (id: string) => void } = $props();
  const issues = $derived(checkPlan(editor.plan, editor.wiring));
  const LABEL = { error: "Fehler", warn: "Warnung", info: "Hinweis" } as const;
</script>

<div class="view">
  {#if issues.length === 0}
    <div class="okbox"><b>Keine auffälligen Stellen gefunden.</b></div>
  {:else}
    <p class="muted">{issues.length} {issues.length === 1 ? "Hinweis" : "Hinweise"}</p>
    <ul>
      {#each issues as i}
        <li>
          <button disabled={!i.deviceId} onclick={() => i.deviceId && onopen(i.deviceId)}>
            <span class="badge {i.level}">{LABEL[i.level]}</span>
            <span>{i.text}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="hint">Der Check bewertet nur das logische Modell: offene Klemmen, ungültige Verweise, ungenutzte Abgänge. Er ist keine Norm-, Selektivitäts- oder Ausführungsprüfung.</p>
</div>

<style>
  .view {
    display: grid;
    align-content: start;
    gap: var(--s3);
    height: 100%;
    overflow: auto;
    padding: var(--s4);
    background: var(--surface);
  }
  .okbox {
    padding: var(--s4);
    border-radius: var(--radius);
    background: var(--ok-soft);
    color: var(--ok);
  }
  ul {
    display: grid;
    gap: var(--s2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li button {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    align-items: start;
    gap: var(--s3);
    width: 100%;
    padding: var(--s3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }
  li button:hover:not(:disabled) {
    background: var(--surface-2);
  }
  li .badge {
    justify-self: start;
  }
  @media print {
    .view {
      height: auto;
      overflow: visible;
      padding: 0;
    }
  }
</style>
