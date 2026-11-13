<script lang="ts">
  /** Schrankgröße: Felder, Reihen, TE je Reihe. Warnt, bevor Geräte entfallen. */
  import { outOfBounds, setBoard } from "../domain/plan";
  import { LIMITS } from "../domain/types";
  import Button from "../ui/Button.svelte";
  import Dialog from "../ui/Dialog.svelte";
  import { editor } from "./editor.svelte";

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
  let board = $state({ fields: 2, rows: 5, te: 12 });

  $effect(() => {
    if (open) board = { ...editor.plan.board };
  });

  const valid = $derived(
    (["fields", "rows", "te"] as const).every((k) => Number.isInteger(board[k]) && board[k] >= LIMITS[k][0] && board[k] <= LIMITS[k][1]),
  );
  const lost = $derived(valid ? outOfBounds(editor.plan, board).length : 0);

  function apply() {
    editor.commit(setBoard(editor.plan, board));
    editor.select(null);
    onclose();
  }
</script>

<Dialog {open} title="Schrankgröße" size="sm" {onclose}>
  <div class="stack">
    <label class="field"><span>Felder ({LIMITS.fields[0]}–{LIMITS.fields[1]})</span>
      <input class="input" type="number" inputmode="numeric" min={LIMITS.fields[0]} max={LIMITS.fields[1]} bind:value={board.fields} />
    </label>
    <label class="field"><span>Reihen je Feld ({LIMITS.rows[0]}–{LIMITS.rows[1]})</span>
      <input class="input" type="number" inputmode="numeric" min={LIMITS.rows[0]} max={LIMITS.rows[1]} bind:value={board.rows} />
    </label>
    <label class="field"><span>TE je Reihe ({LIMITS.te[0]}–{LIMITS.te[1]})</span>
      <input class="input" type="number" inputmode="numeric" min={LIMITS.te[0]} max={LIMITS.te[1]} bind:value={board.te} />
    </label>
    {#if lost}
      <p class="warn">{lost} {lost === 1 ? "Gerät liegt" : "Geräte liegen"} außerhalb der neuen Größe und {lost === 1 ? "wird" : "werden"} entfernt.</p>
    {/if}
  </div>
  {#snippet footer()}
    <Button label="Abbrechen" onclick={onclose} />
    <Button variant={lost ? "danger" : "primary"} label={lost ? "Trotzdem ändern" : "Übernehmen"} disabled={!valid} onclick={apply} />
  {/snippet}
</Dialog>

<style>
  .warn {
    padding: var(--s3);
    border-radius: var(--radius);
    background: var(--danger-soft);
    color: var(--danger);
  }
</style>
