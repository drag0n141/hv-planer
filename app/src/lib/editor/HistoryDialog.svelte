<script lang="ts">
  /** Versionsverlauf: ältere Stände ansehen und wiederherstellen (als neue Version). */
  import { api, formatDate, type HistoryEntry } from "../api";
  import { app } from "../app.svelte";
  import { loadPlanData } from "../domain/legacy";
  import Button from "../ui/Button.svelte";
  import Dialog from "../ui/Dialog.svelte";
  import { feedback } from "../ui/feedback.svelte";
  import { editor } from "./editor.svelte";

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  let entries = $state<HistoryEntry[] | null>(null);

  $effect(() => {
    if (!open || !editor.meta) return;
    entries = null;
    api.history(editor.meta.id).then((h) => (entries = h), (e) => feedback.error(e));
  });

  async function restore(h: HistoryEntry) {
    if (!(await feedback.confirm("Version wiederherstellen", `Den Stand vom ${formatDate(h.saved_at)} wiederherstellen? Der aktuelle Stand bleibt im Verlauf und über „Rückgängig“ erreichbar.`, { confirmLabel: "Wiederherstellen" }))) return;
    try {
      const entry = await api.historyEntry(editor.meta!.id, h.id);
      const { plan } = loadPlanData(entry.data, app.catalog);
      if (!plan.name) plan.name = entry.name;
      editor.commit(plan);
      editor.select(null);
      await editor.save();
      onclose();
    } catch (e) {
      feedback.error(e);
    }
  }
</script>

<Dialog {open} title="Verlauf" {onclose}>
  {#if entries == null}
    <p class="empty">Lade …</p>
  {:else if entries.length === 0}
    <p class="empty">Noch keine älteren Versionen. Beim Speichern wird regelmäßig der vorherige Stand aufbewahrt.</p>
  {:else}
    <div class="stack">
      {#each entries as h (h.id)}
        <div class="row">
          <div class="grow"><b>{formatDate(h.saved_at)}</b><div class="hint truncate">Version {h.version}{h.saved_by ? ` · ${h.saved_by}` : ""} · {h.name}</div></div>
          {#if editor.canEdit}<Button label="Wiederherstellen" onclick={() => restore(h)} />{/if}
        </div>
      {/each}
    </div>
  {/if}
</Dialog>
