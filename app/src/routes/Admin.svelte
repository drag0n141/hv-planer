<script lang="ts">
  /** Gerätekatalog pflegen (nur Admins): eigene Geräte anlegen, eingebaute ausblenden oder als Vorlage kopieren. */
  import { api } from "../lib/api";
  import { app } from "../lib/app.svelte";
  import { stripCatalogFields, widthText } from "../lib/domain/plan";
  import { PORT_KINDS, ROLES, defWidthMM, type CatalogEntry, type DeviceDef, type DeviceRole, type PortKind } from "../lib/domain/types";
  import Button from "../lib/ui/Button.svelte";
  import Dialog from "../lib/ui/Dialog.svelte";
  import { feedback } from "../lib/ui/feedback.svelte";

  const ROLE_LABEL: Record<DeviceRole, string> = {
    rcd: "RCD / FI",
    protection: "Schutzgerät (LS, Sicherung)",
    switch: "Schalter",
    distribution: "Verteilung / Klemmstein",
    terminal: "Reihenklemme",
    meter: "Messgerät",
    control: "Schalt- / Steuergerät",
    spd: "Überspannungsschutz",
    other: "Sonstiges",
  };
  const KIND_LABEL: Record<PortKind, string> = { L: "Außenleiter", L1: "L1", L2: "L2", L3: "L3", N: "N", PE: "PE", ctrl: "Steuereingang" };

  type Draft = Omit<DeviceDef, "id"> & { hidden: boolean };

  let q = $state("");
  let draft = $state<Draft | null>(null);
  let draftId = $state<string | null>(null);
  let saving = $state(false);

  const groups = $derived.by(() => {
    const needle = q.trim().toLocaleLowerCase("de");
    const out: { category: string; items: CatalogEntry[] }[] = [];
    for (const e of app.catalog) {
      if (needle && !`${e.label} ${e.tech} ${e.category}`.toLocaleLowerCase("de").includes(needle)) continue;
      let g = out.find((x) => x.category === e.category);
      if (!g) out.push((g = { category: e.category, items: [] }));
      g.items.push(e);
    }
    return out;
  });
  const categories = $derived([...new Set(app.catalog.map((e) => e.category))]);

  const blank = (): Draft => ({
    label: "",
    tech: "",
    category: categories.at(-1) ?? "Eigene Geräte",
    role: "other",
    width: { unit: "te", value: 1 },
    inputs: [],
    outputs: [],
    hidden: false,
  });

  function toDraft(e: CatalogEntry): Draft {
    return { ...structuredClone(stripCatalogFields(e)), hidden: e.hidden } as Draft;
  }

  function startNew() {
    draftId = null;
    draft = blank();
  }
  function startEdit(e: CatalogEntry) {
    draftId = e.id;
    draft = toDraft(e);
  }
  function startCopy(e: CatalogEntry) {
    draftId = null;
    draft = { ...toDraft(e), label: `${e.label} (Kopie)`, hidden: false };
  }

  const TEMPLATES: { label: string; apply: (d: Draft) => void }[] = [
    { label: "1-polig: IN → OUT", apply: (d) => ports(d, [["IN", "L"]], 1) },
    { label: "1-polig + N", apply: (d) => ports(d, [["L", "L"], ["N", "N"]], 1) },
    { label: "3-polig durchgeschleift", apply: (d) => ports(d, [["L1", "L1"], ["L2", "L2"], ["L3", "L3"]], 1) },
    { label: "3-polig + N", apply: (d) => ports(d, [["L1", "L1"], ["L2", "L2"], ["L3", "L3"], ["N", "N"]], null) },
    { label: "Ohne Anschlüsse", apply: (d) => ports(d, [], 1) },
  ];
  function ports(d: Draft, list: [string, PortKind][], max: number | null) {
    d.inputs = list.map(([id, kind]) => ({ id, label: id, kind }));
    d.outputs = list.map(([id, kind]) => ({ id: id === "IN" ? "OUT" : id, label: id === "IN" ? "OUT" : id, kind, from: id, max }));
  }

  const freeId = (taken: { id: string }[], prefix: string) => {
    let n = taken.length + 1;
    while (taken.some((p) => p.id === `${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };

  async function save() {
    if (!draft) return;
    saving = true;
    try {
      const body = $state.snapshot(draft) as Draft;
      if (draftId) await api.updateDef(draftId, body);
      else await api.createDef(body);
      await app.reloadCatalog();
      feedback.toast(draftId ? "Gerät gespeichert." : "Gerät angelegt.", "ok");
      draft = null;
    } catch (e) {
      feedback.error(e);
    } finally {
      saving = false;
    }
  }

  async function toggleHidden(e: CatalogEntry) {
    try {
      await api.updateDef(e.id, { ...stripCatalogFields(e), hidden: !e.hidden });
      await app.reloadCatalog();
    } catch (err) {
      feedback.error(err);
    }
  }

  async function remove(e: CatalogEntry) {
    if (!(await feedback.confirm("Gerät löschen", `„${e.label}“ aus dem Katalog löschen? Bestehende Pläne behalten ihre Kopie der Definition.`, { confirmLabel: "Löschen", danger: true }))) return;
    try {
      await api.deleteDef(e.id);
      await app.reloadCatalog();
    } catch (err) {
      feedback.error(err);
    }
  }
</script>

<div class="page">
  <header class="top">
    <Button chrome icon="back" iconOnly label="Zur Planliste" onclick={() => app.go("/")} />
    <h1 class="grow truncate">Gerätekatalog</h1>
  </header>

  {#if !app.me?.admin}
    <p class="empty">Der Gerätekatalog kann nur von Administratoren gepflegt werden.</p>
  {:else}
    <main>
      <div class="actions">
        <input class="input grow" type="search" placeholder="Katalog durchsuchen" aria-label="Katalog durchsuchen" bind:value={q} />
        <Button variant="primary" icon="plus" label="Neues Gerät" onclick={startNew} />
      </div>
      <p class="hint">Eingebaute Geräte kommen mit der Anwendung und lassen sich ausblenden oder als Vorlage kopieren. Eigene Geräte kannst du frei anlegen und ändern. Pläne speichern eine Kopie der verwendeten Definition; spätere Änderungen wirken dort erst nach „Auf Katalogstand bringen“.</p>

      {#each groups as g (g.category)}
        <section>
          <h3>{g.category}</h3>
          <ul class="card">
            {#each g.items as e (e.id)}
              <li class:hidden={e.hidden}>
                <div class="grow info">
                  <span class="title"><b class="truncate">{e.label}</b>
                    {#if e.builtin}<span class="badge">Eingebaut</span>{:else}<span class="badge accent">Eigenes</span>{/if}
                    {#if e.hidden}<span class="badge warn">Ausgeblendet</span>{/if}
                  </span>
                  <span class="hint truncate">{e.tech ? `${e.tech} · ` : ""}{widthText(defWidthMM(e), e)} · {ROLE_LABEL[e.role]} · {e.inputs.length} Ein- / {e.outputs.length} Ausgänge</span>
                </div>
                {#if !e.builtin}<Button variant="ghost" icon="edit" iconOnly label="Bearbeiten" onclick={() => startEdit(e)} />{/if}
                <Button variant="ghost" icon="copy" iconOnly label="Als Vorlage kopieren" onclick={() => startCopy(e)} />
                <Button variant="ghost" icon={e.hidden ? "eye" : "eyeOff"} iconOnly label={e.hidden ? "Einblenden" : "Ausblenden"} onclick={() => toggleHidden(e)} />
                {#if !e.builtin}<Button variant="ghost" icon="trash" iconOnly label="Löschen" onclick={() => remove(e)} />{/if}
              </li>
            {/each}
          </ul>
        </section>
      {:else}
        <p class="empty">Kein Gerät gefunden.</p>
      {/each}
    </main>
  {/if}
</div>

<Dialog open={draft != null} title={draftId ? "Gerät bearbeiten" : "Neues Gerät"} size="lg" onclose={() => (draft = null)}>
  {#if draft}
    <div class="stack">
      <div class="form">
        <label class="field span2"><span>Name</span><input class="input" bind:value={draft.label} placeholder="z. B. LS 1P+N" /></label>
        <label class="field span2"><span>Technische Angabe (Vorgabe)</span><input class="input" bind:value={draft.tech} placeholder="z. B. B16" /></label>
        <label class="field span2"><span>Kategorie</span><input class="input" bind:value={draft.category} list="hv-categories" /></label>
        <label class="field span2"><span>Geräteart</span>
          <select class="select" bind:value={draft.role}>{#each ROLES as r}<option value={r}>{ROLE_LABEL[r]}</option>{/each}</select>
        </label>
        <label class="field"><span>Breite</span><input class="input" type="number" inputmode="decimal" min="0.1" step={draft.width.unit === "te" ? 0.5 : 0.1} bind:value={draft.width.value} /></label>
        <label class="field"><span>Einheit</span>
          <select class="select" bind:value={draft.width.unit}><option value="te">TE (18 mm)</option><option value="mm">mm</option></select>
        </label>
        <div class="span2 checks">
          <label class="check"><input type="checkbox" bind:checked={draft.resizable} /> Breite im Plan änderbar</label>
          <label class="check"><input type="checkbox" bind:checked={draft.busbarFed} /> Wird von der Stromschiene versorgt (wie LS)</label>
          <label class="check"><input type="checkbox" bind:checked={draft.busbarFeed} /> Speist die Stromschiene rechts von sich (wie RCD)</label>
        </div>
        <datalist id="hv-categories">{#each categories as c}<option value={c}></option>{/each}</datalist>
      </div>

      <div class="row wrap">
        <h3 class="grow">Anschlüsse</h3>
        <select class="select tpl" aria-label="Vorlage für Anschlüsse" onchange={(e) => { const t = TEMPLATES[Number(e.currentTarget.value)]; if (t && draft) t.apply(draft); e.currentTarget.value = ""; }}>
          <option value="">Vorlage anwenden …</option>
          {#each TEMPLATES as t, i}<option value={i}>{t.label}</option>{/each}
        </select>
      </div>

      <div class="ports">
        <div class="ports-head"><b>Eingänge</b><Button icon="plus" label="Eingang" onclick={() => draft!.inputs.push({ id: freeId(draft!.inputs, "E"), label: "", kind: "L" })} /></div>
        {#each draft.inputs as p, i}
          <div class="port in">
            <label class="field"><span>ID</span><input class="input" bind:value={p.id} maxlength="16" /></label>
            <label class="field"><span>Beschriftung</span><input class="input" bind:value={p.label} placeholder={p.id} maxlength="24" /></label>
            <label class="field"><span>Leiter</span><select class="select" bind:value={p.kind}>{#each PORT_KINDS as k}<option value={k}>{KIND_LABEL[k]}</option>{/each}</select></label>
            <label class="field"><span>Gruppe</span><input class="input" bind:value={p.bank} placeholder="optional" maxlength="24" /></label>
            <Button variant="ghost" icon="trash" iconOnly label="Eingang entfernen" onclick={() => { const id = p.id; draft!.inputs.splice(i, 1); draft!.outputs.forEach((o) => { if (o.from === id) o.from = null; }); }} />
          </div>
        {:else}
          <p class="hint">Keine Eingänge.</p>
        {/each}
      </div>

      <div class="ports">
        <div class="ports-head"><b>Ausgänge</b><Button icon="plus" label="Ausgang" onclick={() => draft!.outputs.push({ id: freeId(draft!.outputs, "A"), label: "", kind: "L", from: draft!.inputs[0]?.id ?? null, max: 1 })} /></div>
        {#each draft.outputs as p, i}
          <div class="port out">
            <label class="field"><span>ID</span><input class="input" bind:value={p.id} maxlength="16" /></label>
            <label class="field"><span>Beschriftung</span><input class="input" bind:value={p.label} placeholder={p.id} maxlength="24" /></label>
            <label class="field"><span>Leiter</span><select class="select" bind:value={p.kind}>{#each PORT_KINDS.filter((k) => k !== "ctrl") as k}<option value={k}>{KIND_LABEL[k]}</option>{/each}</select></label>
            <label class="field"><span>Potential von</span>
              <select class="select" bind:value={p.from}>
                <option value={null}>eigenes (laut Leiter)</option>
                {#each draft.inputs as inp}<option value={inp.id}>Eingang {inp.id}</option>{/each}
              </select>
            </label>
            <label class="field"><span>Max. Ziele</span><input class="input" type="number" inputmode="numeric" min="1" max="99" placeholder="∞" value={p.max ?? ""} oninput={(e) => (p.max = e.currentTarget.value === "" ? null : Number(e.currentTarget.value))} /></label>
            <Button variant="ghost" icon="trash" iconOnly label="Ausgang entfernen" onclick={() => draft!.outputs.splice(i, 1)} />
          </div>
        {:else}
          <p class="hint">Keine Ausgänge.</p>
        {/each}
        <p class="hint">„Potential von“ legt fest, welchen Eingang der Ausgang weiterführt. So bleibt z. B. eine verdrehte Phasenfolge hinter einem RCD erhalten.</p>
      </div>
    </div>
  {/if}
  {#snippet footer()}
    <Button label="Abbrechen" onclick={() => (draft = null)} />
    <Button variant="primary" label={draftId ? "Speichern" : "Anlegen"} disabled={saving || !draft?.label.trim()} onclick={save} />
  {/snippet}
</Dialog>

<style>
  .page {
    min-height: 100dvh;
  }
  .top {
    display: flex;
    align-items: center;
    gap: var(--s2);
    padding: var(--s2);
    padding-top: max(var(--s2), env(safe-area-inset-top));
    background: var(--chrome);
    color: var(--chrome-text);
  }
  main {
    display: grid;
    gap: var(--s4);
    width: min(100%, 900px);
    margin: 0 auto;
    padding: var(--s4);
  }
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s2);
  }
  .actions .input {
    min-width: 180px;
  }
  section {
    display: grid;
    gap: var(--s2);
  }
  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: hidden;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--s1);
    padding: var(--s2) var(--s2) var(--s2) var(--s4);
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  li.hidden .info {
    opacity: 0.55;
  }
  .info {
    display: grid;
    gap: 2px;
  }
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2);
  }

  .form {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--s3);
  }
  .span2 {
    grid-column: span 2;
  }
  .checks {
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    column-gap: var(--s5);
  }
  .tpl {
    width: auto;
    max-width: 240px;
  }
  .ports {
    display: grid;
    gap: var(--s2);
    padding: var(--s3);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .ports-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .port {
    display: grid;
    align-items: end;
    gap: var(--s2);
  }
  .port.in {
    grid-template-columns: 0.8fr 1.2fr 1fr 1fr auto;
  }
  .port.out {
    grid-template-columns: 0.8fr 1.2fr 0.9fr 1.2fr 0.7fr auto;
  }
  @media (max-width: 720px) {
    .form {
      grid-template-columns: 1fr 1fr;
    }
    .port.in,
    .port.out {
      grid-template-columns: 1fr 1fr;
      padding-bottom: var(--s3);
      border-bottom: 1px solid var(--border);
    }
    li {
      flex-wrap: wrap;
      padding-left: var(--s3);
    }
    .info {
      flex-basis: 100%;
    }
  }
</style>
