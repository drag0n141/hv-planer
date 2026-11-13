<script lang="ts">
  /** Planliste: eigene und geteilte Pläne, anlegen, importieren, teilen, löschen. */
  import { api, formatDate, type PlanMeta } from "../lib/api";
  import { app } from "../lib/app.svelte";
  import { loadPlanData } from "../lib/domain/legacy";
  import { emptyPlan } from "../lib/domain/types";
  import ShareDialog from "../lib/editor/ShareDialog.svelte";
  import Button from "../lib/ui/Button.svelte";
  import { feedback } from "../lib/ui/feedback.svelte";
  import { importAsCopy } from "./plans";

  let plans = $state<PlanMeta[] | null>(null);
  let shareId = $state<number | null>(null);
  let fileInput: HTMLInputElement | undefined = $state();

  const load = () => api.plans().then((p) => (plans = p), (e) => feedback.error(e));
  load();

  const ROLE = { owner: "", editor: "Bearbeiter", viewer: "Betrachter" } as const;

  async function create() {
    try {
      app.go(`/p/${await importAsCopy(emptyPlan("Neuer Plan"))}`);
    } catch (e) {
      feedback.error(e);
    }
  }

  async function importFile() {
    const file = fileInput?.files?.[0];
    if (!file) return;
    try {
      const { plan, legacy } = loadPlanData(JSON.parse(await file.text()), app.catalog);
      if (!plan.name) plan.name = file.name.replace(/\.json$/i, "");
      const id = await importAsCopy(plan);
      if (legacy) feedback.toast("Plan aus dem alten Format übernommen. Bitte Phasen und Verdrahtung kurz prüfen.");
      app.go(`/p/${id}`);
    } catch (e) {
      feedback.toast(e instanceof SyntaxError ? "Die Datei ist kein gültiges JSON." : "Die Datei konnte nicht gelesen werden.", "error");
    } finally {
      if (fileInput) fileInput.value = "";
    }
  }

  async function remove(p: PlanMeta) {
    if (!(await feedback.confirm("Plan löschen", `„${p.name}“ mit allen Versionen endgültig löschen?`, { confirmLabel: "Löschen", danger: true }))) return;
    try {
      await api.deletePlan(p.id);
      await load();
    } catch (e) {
      feedback.error(e);
    }
  }

  async function leave(p: PlanMeta) {
    if (!(await feedback.confirm("Freigabe verlassen", `„${p.name}“ aus deiner Liste entfernen? Der Plan selbst bleibt erhalten.`, { confirmLabel: "Verlassen" }))) return;
    try {
      await api.removeShare(p.id, app.me!.sub);
      await load();
    } catch (e) {
      feedback.error(e);
    }
  }

  async function logout() {
    await api.logout().catch(() => {});
    location.assign("/login?loggedout=1");
  }
</script>

<div class="page">
  <header class="top">
    <h1 class="grow">HV-Planer</h1>
    <span class="user truncate">{app.me?.name}</span>
    {#if app.me?.admin}<Button chrome icon="grid" label="Gerätekatalog" onclick={() => app.go("/admin")} />{/if}
    <Button chrome icon="logout" iconOnly label="Abmelden" onclick={logout} />
  </header>

  <main>
    <div class="actions">
      <Button variant="primary" icon="plus" label="Neuer Plan" onclick={create} />
      <Button icon="upload" label="JSON importieren" onclick={() => fileInput?.click()} />
      <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={importFile} />
    </div>

    {#if plans == null}
      <p class="empty">Lade …</p>
    {:else if plans.length === 0}
      <div class="empty card">
        <p><b>Noch keine Pläne.</b></p>
        <p>Lege einen neuen Plan an oder importiere eine JSON-Datei – auch aus dem bisherigen HV-Planer.</p>
      </div>
    {:else}
      <ul class="list">
        {#each plans as p (p.id)}
          <li class="card">
            <button class="open" onclick={() => app.go(`/p/${p.id}`)}>
              <span class="title">
                <b class="truncate">{p.name}</b>
                {#if p.schema !== 2}<span class="badge warn">Altformat</span>{/if}
                {#if ROLE[p.permission]}<span class="badge info">{ROLE[p.permission]}</span>{/if}
              </span>
              <span class="hint truncate">
                Geändert {formatDate(p.updated_at)}{p.updated_by ? ` von ${p.updated_by}` : ""}{!p.mine && p.owner_name ? ` · gehört ${p.owner_name}` : ""}
              </span>
            </button>
            {#if p.mine}
              {#if p.schema === 2}<Button variant="ghost" icon="share" iconOnly label="Teilen" onclick={() => (shareId = p.id)} />{/if}
              <Button variant="ghost" icon="trash" iconOnly label="Löschen" onclick={() => remove(p)} />
            {:else}
              <Button variant="ghost" icon="logout" iconOnly label="Freigabe verlassen" onclick={() => leave(p)} />
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <p class="hint foot">Pläne im Altformat lassen sich hier ansehen und als Kopie übernehmen. Die <a href="/">bisherige Oberfläche</a> bleibt für sie erreichbar.</p>
  </main>
</div>

<ShareDialog planId={shareId} onclose={() => (shareId = null)} />

<style>
  .page {
    min-height: 100dvh;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--s2);
    padding: var(--s2) var(--s2) var(--s2) var(--s4);
    padding-top: max(var(--s2), env(safe-area-inset-top));
    background: var(--chrome);
    color: var(--chrome-text);
  }
  .user {
    max-width: 40vw;
    font-size: var(--fs-sm);
    color: var(--chrome-text-2);
  }
  main {
    display: grid;
    gap: var(--s4);
    width: min(100%, 860px);
    margin: 0 auto;
    padding: var(--s4);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s2);
  }
  .list {
    display: grid;
    gap: var(--s2);
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--s1);
    padding-right: var(--s2);
  }
  li:hover {
    border-color: var(--border-strong);
  }
  .open {
    flex: 1;
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: var(--s3) var(--s4);
    border: 0;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .title {
    display: flex;
    align-items: center;
    gap: var(--s2);
    min-width: 0;
    font-size: var(--fs-lg);
  }
  .foot {
    text-align: center;
  }
  @media (max-width: 560px) {
    .top :global(.btn:not(.icon-only)) {
      padding: 0 var(--s2);
    }
  }
</style>
