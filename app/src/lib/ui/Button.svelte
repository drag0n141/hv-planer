<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import Icon, { type IconName } from "./Icon.svelte";

  type Props = HTMLButtonAttributes & {
    variant?: "default" | "primary" | "ghost" | "danger";
    /** Auf dunkler Kopfzeile. */
    chrome?: boolean;
    icon?: IconName;
    /** Nur Symbol; label wird dann als Tooltip und für Screenreader verwendet. */
    iconOnly?: boolean;
    label?: string;
    active?: boolean;
    children?: Snippet;
  };
  let { variant = "default", chrome = false, icon, iconOnly = false, label, active = false, children, type = "button", ...rest }: Props = $props();
</script>

<button {type} class="btn {variant}" class:chrome class:icon-only={iconOnly} class:active title={iconOnly ? label : undefined} aria-label={iconOnly ? label : undefined} aria-pressed={active || undefined} {...rest}>
  {#if icon}<Icon name={icon} />{/if}
  {#if !iconOnly}
    {#if children}{@render children()}{:else}{label}{/if}
  {/if}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--s2);
    min-height: var(--tap);
    padding: 0 var(--s3);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font-size: var(--fs-md);
    font-weight: 550;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }
  @media (pointer: fine) {
    .btn {
      min-height: 34px;
    }
  }
  .btn:hover:not(:disabled) {
    background: var(--surface-2);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .icon-only {
    padding: 0;
    min-width: var(--tap);
  }
  @media (pointer: fine) {
    .icon-only {
      min-width: 34px;
    }
  }
  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
    border-color: var(--accent-hover);
  }
  .ghost {
    border-color: transparent;
    background: transparent;
  }
  .ghost:hover:not(:disabled) {
    background: var(--surface-3);
  }
  .danger {
    color: var(--danger);
    border-color: var(--danger);
  }
  .danger:hover:not(:disabled) {
    background: var(--danger-soft);
  }
  .active {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent);
  }
  .chrome {
    border-color: transparent;
    background: transparent;
    color: var(--chrome-text);
  }
  .chrome:hover:not(:disabled) {
    background: var(--chrome-border);
  }
  .chrome.active {
    background: var(--chrome-border);
    color: var(--chrome-text);
  }
  .chrome.primary {
    background: var(--accent);
    color: var(--on-accent);
  }
</style>
