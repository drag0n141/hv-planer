<script lang="ts">
  /** Externe Quellen: logische Einspeisungen außerhalb des Schranks (belegen keine TE). */
  import { addSource, removeSource, renameSource } from "../domain/plan";
  import Button from "../ui/Button.svelte";
  import Dialog from "../ui/Dialog.svelte";
  import { editor } from "./editor.svelte";

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  const edit = $derived(editor.editing && editor.canEdit);
  const uses = (id: string) => editor.plan.devices.filter((d) => Object.values(d.inputs).some((l) => l.from === id)).length;
</script>

<Dialog {open} title="Externe Quellen" {onclose}>
  <div class="stack">
    <p class="muted">Eine Quelle steht für eine Zuleitung von außen, z. B. „HAK / EVU“ oder „Zählerschrank · D02 40 A“. Sie stellt L1, L2, L3, N und PE bereit.</p>
    {#each editor.plan.sources as s (s.id)}
      <div class="row">
        <input class="input grow" value={s.label} disabled={!edit} aria-label="Name der Quelle" oninput={(e) => editor.commit(renameSource(editor.plan, s.id, e.currentTarget.value), `source:${s.id}`)} />
        <span class="hint">{uses(s.id)} Geräte</span>
        {#if edit}<Button variant="ghost" icon="trash" iconOnly label="Quelle löschen" onclick={() => editor.commit(removeSource(editor.plan, s.id))} />{/if}
      </div>
    {:else}
      <p class="empty">Noch keine Quelle angelegt.</p>
    {/each}
    {#if edit}
      <div><Button icon="plus" label="Quelle hinzufügen" onclick={() => editor.commit(addSource(editor.plan, editor.plan.sources.length ? "Externe Quelle" : "HAK / EVU").plan)} /></div>
    {/if}
  </div>
  {#snippet footer()}<Button variant="primary" label="Fertig" onclick={onclose} />{/snippet}
</Dialog>
