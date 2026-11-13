<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";

  type Props = {
    open: boolean;
    title: string;
    /** Breite auf großen Bildschirmen. */
    size?: "sm" | "md" | "lg";
    onclose: () => void;
    children: Snippet;
    footer?: Snippet;
  };
  let { open, title, size = "md", onclose, children, footer }: Props = $props();
  let el: HTMLDialogElement | undefined = $state();

  $effect(() => {
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  });
</script>

<dialog
  bind:this={el}
  class={size}
  oncancel={(e) => {
    e.preventDefault();
    onclose();
  }}
  onclick={(e) => {
    if (e.target === el) onclose();
  }}
>
  {#if open}
    <header>
      <h2 class="truncate">{title}</h2>
      <Button variant="ghost" icon="close" iconOnly label="Schließen" onclick={onclose} />
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  {/if}
</dialog>

<style>
  dialog {
    width: min(100vw - 2 * var(--s4), 560px);
    max-height: min(100dvh - 2 * var(--s4), 760px);
    padding: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  dialog[open] {
    display: flex;
    flex-direction: column;
  }
  dialog.sm {
    width: min(100vw - 2 * var(--s4), 420px);
  }
  dialog.lg {
    width: min(100vw - 2 * var(--s4), 900px);
  }
  dialog::backdrop {
    background: rgb(10 16 24 / 0.55);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s3);
    padding: var(--s2) var(--s2) var(--s2) var(--s4);
    border-bottom: 1px solid var(--border);
  }
  .body {
    padding: var(--s4);
    overflow: auto;
    overscroll-behavior: contain;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: var(--s2);
    padding: var(--s3) var(--s4);
    border-top: 1px solid var(--border);
    background: var(--surface-2);
  }
  /* Auf dem Handy als Vollbild, damit Formulare Platz haben */
  @media (max-width: 600px) {
    dialog,
    dialog.sm,
    dialog.lg {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      margin: 0;
      border: 0;
      border-radius: 0;
    }
    .body {
      flex: 1;
    }
    footer {
      padding-bottom: max(var(--s3), env(safe-area-inset-bottom));
    }
  }
</style>
