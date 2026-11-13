<script lang="ts">
  /** Eigenschaften der Auswahl: Gerät (mit Verdrahtung), Reihe oder Planübersicht. */
  import { app } from "../app.svelte";
  import { devicesOnRail, positionText, refreshDef, stripCatalogFields, summarize, usesTE, widthText } from "../domain/plan";
  import { PHASES, TE, isSourceId, railConfig, type Conductor, type Device, type OutputPort, type PortKind } from "../domain/types";
  import { isLineKind } from "../domain/wiring";
  import Button from "../ui/Button.svelte";
  import { editor } from "./editor.svelte";

  let { onboard }: { onboard: () => void } = $props();

  const w = $derived(editor.wiring);
  const d = $derived(editor.selectedDevice);
  const def = $derived(d ? w.def(d) : null);
  const edit = $derived(editor.editing && editor.canEdit);
  const rail = $derived(editor.selection?.kind === "rail" ? editor.selection : null);
  const summary = $derived(summarize(editor.plan, w));

  const groups = $derived([...new Set(editor.plan.devices.map((x) => x.group).filter(Boolean))].sort());

  const nodeText = (id: string) => {
    const dev = w.devices.get(id);
    return dev ? `${w.nodeLabel(id)} (F${dev.field + 1} R${dev.row + 1})` : w.nodeLabel(id);
  };
  const fits = (input: PortKind, output: PortKind) => input === "ctrl" || (isLineKind(input) ? isLineKind(output) : input === output);
  const potText = (c: Conductor | null) => c ?? "?";

  /** Mögliche Quellen für einen Eingang, gruppiert nach Gerät bzw. externer Quelle. */
  function sourcesFor(dev: Device, kind: PortKind) {
    const nodes = [...editor.plan.sources.map((s) => s.id), ...w.ordered().filter((x) => x.id !== dev.id).map((x) => x.id)];
    const out: { id: string; label: string; ports: { port: OutputPort; full: boolean; pot: Conductor | null }[] }[] = [];
    for (const id of nodes) {
      const ports = w
        .outputsOf(id)
        .filter((p) => fits(kind, p.kind))
        .map((port) => ({
          port,
          pot: w.outputPotential(id, port.id),
          full: port.max != null && w.consumers(id, port.id).filter((c) => !c.implicit && c.device.id !== dev.id).length >= port.max,
        }));
      if (ports.length) out.push({ id, label: nodeText(id), ports });
    }
    return out;
  }

  /** Geräte mit Ausgängen, für "alle Eingänge verbinden". */
  const feeders = $derived(d ? [...editor.plan.sources.map((s) => s.id), ...w.ordered().filter((x) => x.id !== d.id && w.def(x).outputs.length).map((x) => x.id)] : []);

  /** Freie, passende Eingänge anderer Geräte als Ziel für einen Ausgang. */
  function targetsFor(dev: Device, port: OutputPort) {
    const out: { id: string; label: string; inputs: { id: string; label: string }[] }[] = [];
    for (const t of w.ordered()) {
      if (t.id === dev.id) continue;
      const inputs = w
        .def(t)
        .inputs.filter((p) => fits(p.kind, port.kind) && !t.inputs[p.id])
        .map((p) => ({ id: p.id, label: p.label }));
      if (inputs.length) out.push({ id: t.id, label: nodeText(t.id), inputs });
    }
    return out;
  }

  const split = (v: string) => {
    const i = v.indexOf("|");
    return [v.slice(0, i), v.slice(i + 1)] as const;
  };

  function setInput(dev: Device, inputId: string, value: string) {
    if (!value) return editor.connect(dev.id, inputId, null);
    const [from, port] = split(value);
    editor.connect(dev.id, inputId, { from, port });
  }

  function addTarget(dev: Device, port: OutputPort, select: HTMLSelectElement) {
    if (!select.value) return;
    const [target, input] = split(select.value);
    editor.connect(target, input, { from: dev.id, port: port.id });
    select.value = "";
  }

  const catalogDef = $derived(d ? app.catalog.find((e) => e.id === d.def) : undefined);
  const outdated = $derived(!!catalogDef && !!def && JSON.stringify(stripCatalogFields(catalogDef)) !== JSON.stringify(def));

  const chain = $derived(d ? w.chain(d).slice(1).reverse() : []);
  const children = $derived(d ? w.children(d.id) : []);
  /** Farbpunkt nur, wenn genau ein Außenleiter anliegt (sonst z. B. "3P"). */
  const phaseClass = $derived.by(() => {
    if (!d) return "";
    const all = w.phasesOf(d);
    const lines = all.filter((c) => c !== "N" && c !== "PE");
    return lines.length === 1 ? `c-${lines[0]}` : lines.length === 0 && all.length === 1 ? `c-${all[0]}` : "plain";
  });
  const showPhase = $derived(!!def && (def.inputs.some((p) => p.kind === "L") || def.outputs.some((p) => p.kind === "L" && !p.from)));

  function widthInput(dev: Device, value: string) {
    const n = Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return;
    editor.resize(dev.id, usesTE(def!) ? Math.round(n * 2) / 2 * TE : n);
  }
</script>

<div class="inspector">
  {#if d && def}
    <header>
      <div class="grow">
        <h2 class="truncate">{d.label || def.label}</h2>
        <p class="muted truncate">{d.label ? `${def.label} · ` : ""}{positionText(d, def)} · {widthText(d.width, def)}</p>
      </div>
      {#if edit}
        <Button variant="ghost" icon="copy" iconOnly label="Duplizieren (Strg+D)" onclick={() => editor.duplicateSelected()} />
        <Button variant="ghost" icon="trash" iconOnly label="Löschen (Entf)" onclick={() => editor.removeSelected()} />
      {/if}
    </header>

    <div class="body">
      <div class="facts">
        <span class="cond {phaseClass}">{w.phaseText(d)}</span>
        {#if d.status === "new"}<span class="badge new">Neu</span>{/if}
        {#if d.group}<span class="badge">Gruppe {d.group}</span>{/if}
      </div>

      {#if edit}
        <section class="stack">
          <label class="field"><span>Bezeichnung</span>
            <input class="input" value={d.label} placeholder={def.label} oninput={(e) => editor.patch(d.id, { label: e.currentTarget.value }, "label")} />
          </label>
          <label class="field"><span>Technische Angabe</span>
            <input class="input" value={d.tech} oninput={(e) => editor.patch(d.id, { tech: e.currentTarget.value }, "tech")} />
          </label>
          <div class="grid-2">
            <label class="field"><span>Status</span>
              <select class="select" value={d.status} onchange={(e) => editor.patch(d.id, { status: e.currentTarget.value as Device["status"] })}>
                <option value="existing">Bestand</option>
                <option value="new">Neu</option>
              </select>
            </label>
            <label class="field"><span>RCD-Gruppe</span>
              <input class="input" value={d.group} list="hv-groups" placeholder="–" oninput={(e) => editor.patch(d.id, { group: e.currentTarget.value.trim() }, "group")} />
            </label>
            {#if def.resizable}
              <label class="field"><span>Breite ({usesTE(def) ? "TE" : "mm"})</span>
                <input class="input" type="number" inputmode="decimal" min={usesTE(def) ? 0.5 : 1} step={usesTE(def) ? 0.5 : 0.1} value={usesTE(def) ? d.width / TE : d.width} onchange={(e) => widthInput(d, e.currentTarget.value)} />
              </label>
            {/if}
            {#if showPhase}
              <label class="field"><span>Phase</span>
                <select class="select" value={d.phase} onchange={(e) => editor.patch(d.id, { phase: e.currentTarget.value as Device["phase"] })}>
                  <option value="auto">automatisch</option>
                  {#each PHASES as p}<option value={p}>{p} fest</option>{/each}
                </select>
              </label>
            {/if}
          </div>
          <label class="field"><span>Notiz</span>
            <textarea class="input note" rows="2" value={d.note ?? ""} oninput={(e) => editor.patch(d.id, { note: e.currentTarget.value }, "note")}></textarea>
          </label>
          <datalist id="hv-groups">{#each groups as g}<option value={g}></option>{/each}</datalist>
        </section>

        {#if def.inputs.length}
          <section class="stack">
            <h3>Einspeisung</h3>
            {#if def.inputs.length > 1}
              <select class="select" aria-label="Alle Eingänge verbinden mit" onchange={(e) => { if (e.currentTarget.value) editor.autoConnect(d.id, e.currentTarget.value); e.currentTarget.value = ""; }}>
                <option value="">Alle Eingänge verbinden mit …</option>
                {#each feeders as id}<option value={id}>{nodeText(id)}</option>{/each}
              </select>
            {/if}
            {#each def.inputs as p (p.id)}
              {@const link = w.link(d, p.id)}
              {@const explicit = d.inputs[p.id]}
              <label class="port">
                <span class="port-name"><b>{p.label}</b>{#if p.bank}<small>{p.bank}</small>{/if}</span>
                <select class="select" value={explicit ? `${explicit.from}|${explicit.port}` : ""} onchange={(e) => setInput(d, p.id, e.currentTarget.value)}>
                  <option value="">{link?.implicit ? `Stromschiene: ${w.nodeLabel(link.from)} · ${link.port}` : "nicht verbunden"}</option>
                  {#if explicit && !w.hasOutput(explicit.from, explicit.port)}<option value={`${explicit.from}|${explicit.port}`}>⚠ Quelle fehlt</option>{/if}
                  {#each sourcesFor(d, p.kind) as node (node.id)}
                    <optgroup label={node.label}>
                      {#each node.ports as o (o.port.id)}
                        <option value={`${node.id}|${o.port.id}`} disabled={o.full}>{node.ports.length > 1 || isSourceId(node.id) ? o.port.label : w.nodeLabel(node.id)}{o.pot && o.pot !== o.port.label ? ` (${o.pot})` : ""}{o.full ? " – belegt" : ""}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </label>
            {/each}
          </section>
        {/if}

        {#if def.outputs.length}
          <section class="stack">
            <h3>Abgänge</h3>
            {#each def.outputs as p (p.id)}
              {@const users = w.consumers(d.id, p.id)}
              {@const pot = w.outputPotential(d.id, p.id)}
              {@const free = p.max == null || users.filter((u) => !u.implicit).length < p.max}
              <div class="out">
                <div class="row">
                  <b>{p.label}</b>
                  <span class="cond c-{pot ?? ''}">{potText(pot)}</span>
                  {#if p.max != null}<span class="hint">max. {p.max}</span>{/if}
                </div>
                {#each users as u (u.device.id + u.input)}
                  <div class="row target">
                    <button class="linkish grow truncate" onclick={() => editor.selectDevice(u.device.id, { focus: true })}>{nodeText(u.device.id)}{w.def(u.device).inputs.length > 1 ? ` · ${u.input}` : ""}</button>
                    {#if u.implicit}<span class="hint">Schiene</span>{:else}
                      <Button variant="ghost" icon="close" iconOnly label="Verbindung lösen" onclick={() => editor.connect(u.device.id, u.input, null)} />
                    {/if}
                  </div>
                {/each}
                {#if free}
                  <select class="select" aria-label="Ziel hinzufügen" onchange={(e) => addTarget(d, p, e.currentTarget)}>
                    <option value="">+ Ziel verbinden …</option>
                    {#each targetsFor(d, p) as t (t.id)}
                      {#if t.inputs.length === 1}
                        <option value={`${t.id}|${t.inputs[0].id}`}>{t.label}</option>
                      {:else}
                        <optgroup label={t.label}>{#each t.inputs as i}<option value={`${t.id}|${i.id}`}>{i.label}</option>{/each}</optgroup>
                      {/if}
                    {/each}
                  </select>
                {/if}
              </div>
            {/each}
          </section>
        {/if}

        {#if outdated && catalogDef}
          <section class="notice">
            <p>Dieses Gerät wurde im Katalog geändert. Der Plan nutzt noch den alten Stand.</p>
            <Button label="Auf Katalogstand bringen" onclick={() => editor.commit(refreshDef(editor.plan, catalogDef))} />
          </section>
        {/if}
      {:else}
        <dl>
          <dt>Gerät</dt><dd>{def.label}</dd>
          {#if d.tech}<dt>Technische Angabe</dt><dd>{d.tech}</dd>{/if}
          {#if d.note}<dt>Notiz</dt><dd class="pre">{d.note}</dd>{/if}
          <dt>Gespeist von</dt>
          <dd>
            {#if chain.length}
              <ol class="chain">
                {#each chain as id}
                  <li>{#if isSourceId(id)}{w.nodeLabel(id)}{:else}<button class="linkish" onclick={() => editor.selectDevice(id, { focus: true })}>{nodeText(id)}</button>{/if}</li>
                {/each}
              </ol>
            {:else}–{/if}
          </dd>
          <dt>Versorgt</dt>
          <dd>
            {#each children as c (c.id)}
              <button class="linkish block" onclick={() => editor.selectDevice(c.id, { focus: true })}>{nodeText(c.id)}</button>
            {:else}–{/each}
          </dd>
        </dl>
      {/if}
    </div>
  {:else if rail}
    {@const cfg = railConfig(editor.plan, rail.field, rail.row)}
    {@const used = devicesOnRail(editor.plan, rail.field, rail.row).reduce((s, x) => s + x.width, 0)}
    <header>
      <div class="grow">
        <h2>Feld {rail.field + 1} · Reihe {rail.row + 1}</h2>
        <p class="muted">{(used / TE).toLocaleString("de-DE", { maximumFractionDigits: 1 })} von {editor.plan.board.te} TE belegt</p>
      </div>
      {#if edit}
        <Button variant="ghost" icon="up" iconOnly label="Reihe nach oben" disabled={rail.row === 0} onclick={() => editor.swapRows(rail.field, rail.row, rail.row - 1)} />
        <Button variant="ghost" icon="down" iconOnly label="Reihe nach unten" disabled={rail.row >= editor.plan.board.rows - 1} onclick={() => editor.swapRows(rail.field, rail.row, rail.row + 1)} />
      {/if}
    </header>
    <div class="body">
      <section class="stack">
        <label class="field"><span>Stromschiene</span>
          <select class="select" disabled={!edit} value={cfg.busbar} onchange={(e) => editor.setRail(rail.field, rail.row, { busbar: e.currentTarget.value as typeof cfg.busbar })}>
            <option value="none">Keine</option>
            <option value="1P">1-phasig</option>
            <option value="3P">3-phasig</option>
          </select>
        </label>
        {#if cfg.busbar !== "none"}
          <label class="field"><span>{cfg.busbar === "1P" ? "Phase" : "Startphase"}</span>
            <select class="select" disabled={!edit} value={cfg.start} onchange={(e) => editor.setRail(rail.field, rail.row, { start: e.currentTarget.value as typeof cfg.start })}>
              {#each PHASES as p}<option value={p}>{p}</option>{/each}
            </select>
          </label>
          <p class="hint">Geräte wie LS-Schalter übernehmen ihre Phase von der Schiene. Sitzt links ein RCD oder Hauptschalter, folgt die Schiene dessen tatsächlicher Phasenfolge.</p>
        {/if}
        <div><Button icon="search" label="Reihe vergrößern" onclick={() => editor.zoomToRail(rail.field, rail.row)} /></div>
      </section>
    </div>
  {:else}
    <header><h2 class="grow truncate">Übersicht</h2></header>
    <div class="body">
      <dl class="kv">
        <dt>Schrank</dt><dd>{editor.plan.board.fields} Felder · {editor.plan.board.rows} Reihen · {editor.plan.board.te} TE</dd>
        <dt>Geräte</dt><dd>{summary.devices}{summary.newDevices ? ` (${summary.newDevices} neu)` : ""}</dd>
        <dt>Belegt</dt><dd>{summary.usedPercent} % · frei {(summary.freeMM / TE).toLocaleString("de-DE", { maximumFractionDigits: 1 })} TE</dd>
        <dt>Abgänge je Phase</dt>
        <dd class="row wrap">{#each PHASES as p}<span class="cond c-{p}">{p}: {summary.phases[p]}</span>{/each}</dd>
      </dl>
      {#if edit}
        <Button icon="settings" label="Schrankgröße ändern" onclick={onboard} />
        <p class="hint">Gerät links wählen und auf eine Reihe setzen. Reihe anklicken, um die Stromschiene einzustellen.</p>
      {:else}
        <p class="hint">Gerät antippen, um zu sehen, woher es gespeist wird und was es versorgt.</p>
      {/if}
    </div>
  {/if}
</div>

<style>
  .inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--s1);
    padding: var(--s3) var(--s2) var(--s3) var(--s4);
    border-bottom: 1px solid var(--border);
  }
  header p {
    font-size: var(--fs-xs);
  }
  .body {
    flex: 1;
    display: grid;
    align-content: start;
    gap: var(--s4);
    padding: var(--s4);
    overflow: auto;
    overscroll-behavior: contain;
  }
  .facts {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s2);
  }
  section + section {
    padding-top: var(--s4);
    border-top: 1px solid var(--border);
  }
  .note {
    padding-block: var(--s2);
    resize: vertical;
    min-height: 56px;
  }
  .port {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    align-items: center;
    gap: var(--s2);
  }
  .port-name {
    display: grid;
    line-height: 1.2;
  }
  .port-name small {
    font-size: 11px;
    color: var(--text-3);
  }
  .out {
    display: grid;
    gap: var(--s1);
    padding: var(--s2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-2);
  }
  .target {
    padding-left: var(--s2);
    min-height: 32px;
  }
  .linkish {
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent);
    text-align: left;
    cursor: pointer;
  }
  .linkish.block {
    display: block;
    padding: 3px 0;
  }
  .linkish:hover {
    text-decoration: underline;
  }
  .notice {
    display: grid;
    gap: var(--s2);
    padding: var(--s3);
    border-radius: var(--radius);
    background: var(--warn-soft);
    color: var(--warn);
    font-size: var(--fs-sm);
  }
  dl {
    display: grid;
    gap: var(--s1);
    margin: 0;
  }
  dt {
    font-size: var(--fs-xs);
    font-weight: 600;
    color: var(--text-2);
  }
  dd {
    margin: 0 0 var(--s2);
  }
  .pre {
    white-space: pre-wrap;
  }
  .chain {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .chain li + li::before {
    content: "↓";
    display: block;
    color: var(--text-3);
    line-height: 1.1;
  }
</style>
