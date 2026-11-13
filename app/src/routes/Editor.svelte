<script lang="ts">
  import { downloadFile, fileName, formatDate } from "../lib/api";
  import { app } from "../lib/app.svelte";
  import { balancePhases } from "../lib/domain/plan";
  import { checkPlan } from "../lib/domain/reports";
  import BoardDialog from "../lib/editor/BoardDialog.svelte";
  import Board from "../lib/editor/Board.svelte";
  import BomView from "../lib/editor/BomView.svelte";
  import CheckView from "../lib/editor/CheckView.svelte";
  import CircuitView from "../lib/editor/CircuitView.svelte";
  import { editor, type View } from "../lib/editor/editor.svelte";
  import HelpDialog from "../lib/editor/HelpDialog.svelte";
  import HistoryDialog from "../lib/editor/HistoryDialog.svelte";
  import Inspector from "../lib/editor/Inspector.svelte";
  import ListView from "../lib/editor/ListView.svelte";
  import LogicView from "../lib/editor/LogicView.svelte";
  import Palette from "../lib/editor/Palette.svelte";
  import ShareDialog from "../lib/editor/ShareDialog.svelte";
  import SourcesDialog from "../lib/editor/SourcesDialog.svelte";
  import Button from "../lib/ui/Button.svelte";
  import { feedback } from "../lib/ui/feedback.svelte";
  import { importAsCopy } from "./plans";

  let { id }: { id: number } = $props();

  let status = $state<"loading" | "ready" | "error">("loading");
  let error = $state("");
  let menuOpen = $state(false);
  let paletteOpen = $state(false);
  let dialog = $state<null | "board" | "sources" | "history" | "share" | "help">(null);

  $effect(() => {
    status = "loading";
    editor.open(id).then(
      () => (status = "ready"),
      (e) => {
        error = e.message;
        status = "error";
      },
    );
    return () => editor.close();
  });

  const VIEWS: { id: View; label: string }[] = [
    { id: "board", label: "Schrank" },
    { id: "list", label: "Liste" },
    { id: "logic", label: "Logikplan" },
    { id: "circuits", label: "Stromlaufplan" },
    { id: "bom", label: "Stückliste" },
    { id: "check", label: "Prüfung" },
  ];
  const viewLabel = $derived(VIEWS.find((v) => v.id === editor.view)!.label);
  const errors = $derived(status === "ready" ? checkPlan(editor.plan, editor.wiring).filter((i) => i.level === "error").length : 0);
  const edit = $derived(editor.editing && editor.canEdit);
  const hasSelection = $derived(editor.selection != null);

  const SAVE_TEXT = { saved: "Gespeichert", dirty: "Ungespeichert", saving: "Speichert …", error: "Nicht gespeichert", conflict: "Konflikt" } as const;

  async function back() {
    await editor.save();
    app.go("/");
  }

  function open(deviceId: string) {
    editor.selectDevice(deviceId, { focus: true });
  }

  function nextMatch() {
    const ids = editor.wiring.ordered().filter((d) => editor.matches?.has(d.id)).map((d) => d.id);
    if (!ids.length) return;
    const i = ids.indexOf(editor.selectedDevice?.id ?? "");
    editor.selectDevice(ids[(i + 1) % ids.length], { focus: true });
  }

  function menu(action: () => void) {
    menuOpen = false;
    action();
  }

  function exportJson() {
    downloadFile(`${fileName(editor.plan.name)}.json`, JSON.stringify(editor.plan, null, 2), "application/json");
  }

  async function adopt() {
    try {
      const newId = await importAsCopy(editor.plan);
      app.go(`/p/${newId}`);
    } catch (e) {
      feedback.error(e);
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (status !== "ready" || dialog || feedback.pending) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (mod && key === "s") {
      e.preventDefault();
      void editor.save();
      return;
    }
    const t = e.target as HTMLElement;
    if (t.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "Escape") {
      if (menuOpen) menuOpen = false;
      else if (paletteOpen) paletteOpen = false;
      else if (editor.placing) editor.placing = null;
      else editor.select(null);
      return;
    }
    if (!edit) return;
    if (mod && key === "z") {
      e.preventDefault();
      if (e.shiftKey) editor.redo();
      else editor.undo();
    } else if (mod && key === "y") {
      e.preventDefault();
      editor.redo();
    } else if (mod && key === "d") {
      e.preventDefault();
      editor.duplicateSelected();
    } else if ((e.key === "Delete" || e.key === "Backspace") && editor.selectedDevice) {
      e.preventDefault();
      editor.removeSelected();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      if (editor.selectedDevice) {
        e.preventDefault();
        editor.nudge(e.key === "ArrowLeft" ? -1 : 1);
      }
    }
  }

  function onbeforeunload(e: BeforeUnloadEvent) {
    if (editor.dirty && editor.canEdit) {
      void editor.save();
      e.preventDefault();
    }
  }
</script>

<svelte:window {onkeydown} {onbeforeunload} />

{#if status === "loading"}
  <p class="empty">Lade Plan …</p>
{:else if status === "error"}
  <div class="empty stack">
    <p>{error}</p>
    <div><Button label="Zur Planliste" onclick={() => app.go("/")} /></div>
  </div>
{:else}
  <div class="editor">
    <header class="top no-print">
      <Button chrome icon="back" iconOnly label="Zur Planliste" onclick={back} />
      <input class="name" value={editor.plan.name} placeholder="Unbenannter Plan" aria-label="Planname" disabled={!edit} oninput={(e) => editor.rename(e.currentTarget.value)} />
      {#if editor.canEdit}
        <span class="save {editor.saveState}" title={SAVE_TEXT[editor.saveState]}><i></i><span>{SAVE_TEXT[editor.saveState]}</span></span>
      {:else}
        <span class="save readonly"><span>{editor.legacy ? "Altformat" : "Nur lesen"}</span></span>
      {/if}
      {#if edit}
        <Button chrome icon="undo" iconOnly label="Rückgängig (Strg+Z)" disabled={!editor.canUndo} onclick={() => editor.undo()} />
        <Button chrome icon="redo" iconOnly label="Wiederholen (Strg+Y)" disabled={!editor.canRedo} onclick={() => editor.redo()} />
      {/if}
      {#if editor.canEdit}
        <Button chrome icon="edit" aria-label="Bearbeiten" title="Zwischen Ansehen und Bearbeiten wechseln" active={editor.editing} onclick={() => { editor.editing = !editor.editing; editor.placing = null; paletteOpen = false; }}>
          <span class="wide-only">Bearbeiten</span>
        </Button>
      {/if}
      <div class="menu-wrap">
        <Button chrome icon="more" iconOnly label="Menü" onclick={() => (menuOpen = !menuOpen)} />
        {#if menuOpen}
          <button class="backdrop" aria-label="Menü schließen" onclick={() => (menuOpen = false)}></button>
          <div class="menu" role="menu">
            {#if edit}
              <button role="menuitem" onclick={() => menu(() => (dialog = "board"))}>Schrankgröße …</button>
            {/if}
            <button role="menuitem" onclick={() => menu(() => (dialog = "sources"))}>Externe Quellen … <span class="badge">{editor.plan.sources.length}</span></button>
            {#if edit}
              <button role="menuitem" onclick={() => menu(() => editor.commit(balancePhases(editor.plan)))}>Phasen ausgleichen</button>
            {/if}
            <hr />
            {#if editor.canEdit}<button role="menuitem" onclick={() => menu(() => (dialog = "history"))}>Verlauf …</button>{/if}
            {#if editor.meta?.permission === "owner" && !editor.legacy}<button role="menuitem" onclick={() => menu(() => (dialog = "share"))}>Teilen …</button>{/if}
            <button role="menuitem" onclick={() => menu(exportJson)}>Als JSON exportieren</button>
            <button role="menuitem" onclick={() => menu(() => setTimeout(() => print(), 50))}>{viewLabel} drucken</button>
            <hr />
            <button role="menuitem" onclick={() => menu(() => (dialog = "help"))}>Hilfe</button>
          </div>
        {/if}
      </div>
    </header>

    <nav class="tabs no-print" aria-label="Ansichten">
      {#each VIEWS as v (v.id)}
        <button class:on={editor.view === v.id} aria-current={editor.view === v.id ? "page" : undefined} onclick={() => (editor.view = v.id)}>
          {v.label}{#if v.id === "check" && errors}<span class="badge error">{errors}</span>{/if}
        </button>
      {/each}
    </nav>

    {#if editor.legacy}
      <div class="banner no-print">
        <span class="grow">Dieser Plan stammt aus dem bisherigen HV-Planer und wird hier nur angezeigt. Zum Bearbeiten als Kopie im neuen Format übernehmen – das Original bleibt unverändert.</span>
        <Button variant="primary" label="Als Kopie übernehmen" onclick={adopt} />
      </div>
    {/if}
    {#if editor.saveState === "conflict"}
      <div class="banner danger no-print">
        <span class="grow">Der Plan wurde inzwischen an anderer Stelle geändert.</span>
        <Button label="Neu laden" onclick={() => editor.reload()} />
        <Button variant="danger" label="Überschreiben" onclick={() => editor.save({ overwrite: true })} />
      </div>
    {/if}

    <div class="print-only print-head">
      <h1>{editor.plan.name || "Unbenannter Plan"}</h1>
      <p>{viewLabel} · {editor.plan.board.fields} Felder · {editor.plan.board.rows} Reihen · {editor.plan.board.te} TE · Stand {formatDate(new Date().toISOString())}</p>
    </div>

    <main class="main" class:with-palette={edit && editor.view === "board"}>
      {#if edit && editor.view === "board"}
        <aside class="left card no-print" class:open={paletteOpen}>
          <div class="drawer-head">
            <h2 class="grow">Gerät hinzufügen</h2>
            <Button variant="ghost" icon="close" iconOnly label="Schließen" onclick={() => (paletteOpen = false)} />
          </div>
          <Palette onpick={() => (paletteOpen = false)} />
        </aside>
        {#if paletteOpen}<button class="scrim no-print" aria-label="Palette schließen" onclick={() => (paletteOpen = false)}></button>{/if}
      {/if}

      <section class="center">
        {#if editor.view === "board" || editor.view === "list"}
          <div class="searchbar no-print">
            <input class="input" type="search" placeholder="Suchen: Bezeichnung, Gerät, Gruppe" aria-label="Im Plan suchen" bind:value={editor.query} onkeydown={(e) => e.key === "Enter" && nextMatch()} />
            {#if editor.matches}
              <span class="hint nowrap">{editor.matches.size} Treffer</span>
              {#if editor.view === "board" && editor.matches.size}<Button icon="down" iconOnly label="Nächster Treffer (Enter)" onclick={nextMatch} />{/if}
            {/if}
          </div>
        {/if}
        <div class="content">
          {#if editor.view === "board"}
            <Board />
            {#if edit && editor.placing}
              <div class="placing no-print">
                <span class="grow truncate"><b>{editor.placing.label}</b> setzen: Reihe wählen</span>
                <Button label="Fertig" onclick={() => (editor.placing = null)} />
              </div>
            {:else if edit}
              <div class="fab no-print"><Button variant="primary" icon="plus" label="Gerät" onclick={() => (paletteOpen = true)} /></div>
            {/if}
          {:else if editor.view === "list"}
            <ListView onopen={open} />
          {:else if editor.view === "logic"}
            <LogicView onopen={open} />
          {:else if editor.view === "circuits"}
            <CircuitView onopen={open} />
          {:else if editor.view === "bom"}
            <BomView />
          {:else}
            <CheckView onopen={open} />
          {/if}
        </div>
      </section>

      <aside class="right card no-print" class:open={hasSelection}>
        <div class="sheet-close"><Button variant="ghost" icon="close" iconOnly label="Schließen" onclick={() => editor.select(null)} /></div>
        <Inspector onboard={() => (dialog = "board")} />
      </aside>
    </main>
  </div>

  <BoardDialog open={dialog === "board"} onclose={() => (dialog = null)} />
  <SourcesDialog open={dialog === "sources"} onclose={() => (dialog = null)} />
  <HistoryDialog open={dialog === "history"} onclose={() => (dialog = null)} />
  <HelpDialog open={dialog === "help"} onclose={() => (dialog = null)} />
  <ShareDialog planId={dialog === "share" ? (editor.meta?.id ?? null) : null} onclose={() => (dialog = null)} />
{/if}

<style>
  .editor {
    display: flex;
    flex-direction: column;
    height: 100dvh;
  }

  /* ---------- Kopfzeile ---------- */
  .top {
    display: flex;
    align-items: center;
    gap: var(--s1);
    padding: var(--s1) var(--s2);
    padding-top: max(var(--s1), env(safe-area-inset-top));
    background: var(--chrome);
    color: var(--chrome-text);
  }
  .name {
    flex: 1 1 0;
    min-width: 60px;
    height: 34px;
    padding: 0 var(--s2);
    border: 1px solid transparent;
    border-radius: var(--radius);
    background: transparent;
    color: var(--chrome-text);
    font-size: var(--fs-lg);
    font-weight: 650;
    text-overflow: ellipsis;
  }
  .name:hover:not(:disabled),
  .name:focus {
    border-color: var(--chrome-border);
    background: rgb(255 255 255 / 0.06);
  }
  .name::placeholder {
    color: var(--chrome-text-2);
  }
  .save {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 var(--s2);
    font-size: var(--fs-xs);
    color: var(--chrome-text-2);
    white-space: nowrap;
  }
  .save i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
  }
  .save.dirty i,
  .save.saving i {
    background: var(--warn);
  }
  .save.error i,
  .save.conflict i {
    background: var(--danger);
  }
  .save.readonly {
    padding: 2px var(--s2);
    border: 1px solid var(--chrome-border);
    border-radius: 999px;
  }
  .wide-only {
    display: none;
  }
  .menu-wrap {
    position: relative;
  }
  .backdrop,
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    border: 0;
    background: transparent;
  }
  .scrim {
    z-index: 29;
    background: rgb(10 16 24 / 0.5);
  }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + var(--s1));
    z-index: 41;
    display: grid;
    min-width: 230px;
    padding: var(--s1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .menu button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s3);
    min-height: var(--tap);
    padding: 0 var(--s3);
    border: 0;
    border-radius: 4px;
    background: none;
    text-align: left;
    cursor: pointer;
  }
  .menu button:hover {
    background: var(--surface-3);
  }
  .menu hr {
    width: 100%;
    margin: var(--s1) 0;
    border: 0;
    border-top: 1px solid var(--border);
  }

  /* ---------- Ansichten-Leiste ---------- */
  .tabs {
    display: flex;
    gap: var(--s1);
    padding: 0 var(--s2);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }
  .tabs::-webkit-scrollbar {
    display: none;
  }
  .tabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    min-height: var(--tap);
    padding: 0 var(--s3);
    border: 0;
    border-bottom: 3px solid transparent;
    background: none;
    color: var(--text-2);
    font-weight: 550;
    cursor: pointer;
  }
  .tabs button.on {
    border-bottom-color: var(--accent);
    color: var(--text);
  }

  .banner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2);
    padding: var(--s2) var(--s4);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: var(--fs-sm);
  }
  .banner.danger {
    background: var(--danger-soft);
    color: var(--danger);
  }

  /* ---------- Arbeitsfläche ---------- */
  .main {
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    min-height: 0;
    position: relative;
  }
  .center {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .searchbar {
    display: flex;
    align-items: center;
    gap: var(--s2);
    padding: var(--s2);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
  }
  .searchbar .input {
    max-width: 380px;
  }
  .nowrap {
    white-space: nowrap;
  }
  .content {
    position: relative;
    flex: 1;
    min-height: 0;
  }
  .placing,
  .fab {
    position: absolute;
    left: var(--s3);
    bottom: calc(var(--s3) + env(safe-area-inset-bottom));
  }
  .placing {
    display: flex;
    align-items: center;
    gap: var(--s3);
    max-width: calc(100% - 80px);
    padding: var(--s2) var(--s2) var(--s2) var(--s4);
    border-radius: var(--radius);
    background: var(--chrome);
    color: var(--chrome-text);
    box-shadow: var(--shadow);
  }

  /* Schmal: Palette als Schublade, Eigenschaften als Blatt von unten */
  .left {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    width: min(88vw, 340px);
    border-radius: 0;
    border-width: 0 1px 0 0;
    transform: translateX(-102%);
    transition: transform 0.18s ease;
    padding-top: env(safe-area-inset-top);
  }
  .left.open {
    transform: none;
    box-shadow: var(--shadow);
  }
  .drawer-head {
    display: flex;
    align-items: center;
    padding: var(--s2) var(--s2) var(--s2) var(--s4);
    border-bottom: 1px solid var(--border);
  }
  .right {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 20;
    display: none;
    max-height: 62dvh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border-bottom: 0;
    box-shadow: var(--shadow);
    padding-bottom: env(safe-area-inset-bottom);
    overflow: hidden;
  }
  .right.open {
    display: flex;
    flex-direction: column;
  }
  .sheet-close {
    position: absolute;
    top: var(--s2);
    right: var(--s2);
    z-index: 1;
  }
  .right :global(.inspector header) {
    padding-right: 52px;
  }

  /* Tablet: Eigenschaften als schwebende Spalte rechts */
  @media (min-width: 700px) {
    .right {
      inset: auto var(--s3) var(--s3) auto;
      width: 360px;
      max-height: min(70dvh, 640px);
      border-radius: var(--radius-lg);
      border-bottom: 1px solid var(--border);
    }
    .wide-only {
      display: inline;
    }
    .name {
      max-width: 420px;
    }
    .top {
      gap: var(--s2);
    }
    .save {
      margin-right: auto;
    }
  }
  @media (max-width: 699px) {
    .save:not(.readonly) span {
      display: none;
    }
  }

  /* Desktop: drei feste Spalten */
  @media (min-width: 1100px) {
    .main {
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: var(--s2);
      padding: var(--s2);
    }
    .main.with-palette {
      grid-template-columns: 260px minmax(0, 1fr) 340px;
    }
    .center {
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .left,
    .right,
    .right.open {
      position: static;
      display: flex;
      flex-direction: column;
      width: auto;
      max-height: none;
      min-height: 0;
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      box-shadow: none;
      transform: none;
      padding: 0;
      overflow: hidden;
    }
    .drawer-head,
    .sheet-close,
    .fab,
    .scrim {
      display: none;
    }
    .right :global(.inspector header) {
      padding-right: var(--s2);
    }
  }

  .print-head {
    margin-bottom: 6mm;
  }
  @media print {
    .editor {
      display: block;
      height: auto;
    }
    .main {
      display: block;
      padding: 0;
    }
    .center {
      display: block;
      border: 0;
    }
  }
</style>
