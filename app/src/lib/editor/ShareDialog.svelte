<script lang="ts">
  /** Freigaben eines Plans verwalten (nur Besitzer). */
  import { api, type Share } from "../api";
  import Button from "../ui/Button.svelte";
  import Dialog from "../ui/Dialog.svelte";
  import { feedback } from "../ui/feedback.svelte";

  let { planId, onclose }: { planId: number | null; onclose: () => void } = $props();
  let shares = $state<Share[]>([]);
  let q = $state("");
  let found = $state<{ sub: string; name: string; email: string }[]>([]);
  let searched = $state(false);

  $effect(() => {
    if (planId == null) return;
    shares = [];
    q = "";
    found = [];
    searched = false;
    api.shares(planId).then((s) => (shares = s), (e) => feedback.error(e));
  });

  let timer: ReturnType<typeof setTimeout>;
  function search() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        found = q.trim() ? await api.users(q.trim()) : [];
        searched = q.trim() !== "";
      } catch (e) {
        feedback.error(e);
      }
    }, 250);
  }

  async function set(sub: string, permission: Share["permission"]) {
    try {
      shares = await api.setShare(planId!, sub, permission);
    } catch (e) {
      feedback.error(e);
    }
  }
  async function remove(sub: string) {
    try {
      await api.removeShare(planId!, sub);
      shares = shares.filter((s) => s.sub !== sub);
    } catch (e) {
      feedback.error(e);
    }
  }
  const candidates = $derived(found.filter((u) => !shares.some((s) => s.sub === u.sub)));
</script>

<Dialog open={planId != null} title="Plan teilen" {onclose}>
  <div class="stack">
    <label class="field"><span>Nutzer suchen (Name oder E-Mail)</span>
      <input class="input" type="search" bind:value={q} oninput={search} placeholder="Name oder E-Mail" />
    </label>
    {#each candidates as u (u.sub)}
      <div class="row">
        <div class="grow"><b class="truncate">{u.name}</b><div class="hint truncate">{u.email}</div></div>
        <Button label="Betrachter" onclick={() => set(u.sub, "viewer")} />
        <Button label="Bearbeiter" onclick={() => set(u.sub, "editor")} />
      </div>
    {:else}
      {#if searched}<p class="hint">Niemand gefunden. Nutzer erscheinen hier, sobald sie sich einmal angemeldet haben.</p>{/if}
    {/each}

    <h3>Freigegeben für</h3>
    {#each shares as s (s.sub)}
      <div class="row">
        <div class="grow"><b class="truncate">{s.name}</b><div class="hint truncate">{s.email}</div></div>
        <select class="select perm" value={s.permission} aria-label="Berechtigung" onchange={(e) => set(s.sub, e.currentTarget.value as Share["permission"])}>
          <option value="viewer">Betrachter</option>
          <option value="editor">Bearbeiter</option>
        </select>
        <Button variant="ghost" icon="trash" iconOnly label="Freigabe entfernen" onclick={() => remove(s.sub)} />
      </div>
    {:else}
      <p class="hint">Noch mit niemandem geteilt.</p>
    {/each}
  </div>
  {#snippet footer()}<Button variant="primary" label="Fertig" onclick={onclose} />{/snippet}
</Dialog>

<style>
  .perm {
    width: 130px;
  }
</style>
