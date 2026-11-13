<script lang="ts">
  import { app } from "./lib/app.svelte";
  import Button from "./lib/ui/Button.svelte";
  import FeedbackHost from "./lib/ui/FeedbackHost.svelte";
  import Admin from "./routes/Admin.svelte";
  import Editor from "./routes/Editor.svelte";
  import Plans from "./routes/Plans.svelte";

  let error = $state("");
  let ready = $state(false);
  app.load().then(
    () => (ready = true),
    (e) => (error = e.message),
  );
</script>

{#if error}
  <div class="empty stack">
    <p>{error}</p>
    <div><Button label="Erneut versuchen" onclick={() => location.reload()} /></div>
  </div>
{:else if !ready}
  <p class="empty">Lade …</p>
{:else if app.route.name === "plans"}
  <Plans />
{:else if app.route.name === "plan"}
  {#key app.route.id}<Editor id={app.route.id} />{/key}
{:else if app.route.name === "admin"}
  <Admin />
{:else}
  <div class="empty stack">
    <p>Diese Seite gibt es nicht.</p>
    <div><Button label="Zur Planliste" onclick={() => app.go("/")} /></div>
  </div>
{/if}

<FeedbackHost />
