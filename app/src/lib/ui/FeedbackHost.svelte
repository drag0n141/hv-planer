<script lang="ts">
  import Button from "./Button.svelte";
  import Dialog from "./Dialog.svelte";
  import { feedback } from "./feedback.svelte";
</script>

<div class="toasts no-print" aria-live="polite">
  {#each feedback.toasts as t (t.id)}
    <button class="toast {t.kind}" onclick={() => feedback.dismiss(t.id)}>{t.text}</button>
  {/each}
</div>

<Dialog open={feedback.pending != null} title={feedback.pending?.title ?? ""} size="sm" onclose={() => feedback.answer(false)}>
  <p>{feedback.pending?.text}</p>
  {#snippet footer()}
    <Button label="Abbrechen" onclick={() => feedback.answer(false)} />
    <Button variant={feedback.pending?.danger ? "danger" : "primary"} label={feedback.pending?.confirmLabel} onclick={() => feedback.answer(true)} />
  {/snippet}
</Dialog>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    bottom: calc(var(--s5) + env(safe-area-inset-bottom));
    z-index: 100;
    display: grid;
    gap: var(--s2);
    width: min(100vw - 2 * var(--s4), 420px);
    transform: translateX(-50%);
    pointer-events: none;
  }
  .toast {
    pointer-events: auto;
    padding: var(--s3) var(--s4);
    border: 0;
    border-radius: var(--radius);
    background: var(--chrome);
    color: var(--chrome-text);
    box-shadow: var(--shadow);
    text-align: left;
    cursor: pointer;
  }
  .toast.error {
    background: var(--danger);
    color: #fff;
  }
  .toast.ok {
    background: var(--ok);
    color: #fff;
  }
</style>
