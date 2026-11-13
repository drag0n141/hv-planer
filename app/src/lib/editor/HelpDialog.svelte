<script lang="ts">
  /** Kurzanleitung. */
  import Button from "../ui/Button.svelte";
  import Dialog from "../ui/Dialog.svelte";

  let { open, onclose }: { open: boolean; onclose: () => void } = $props();
</script>

<Dialog {open} title="Hilfe" size="lg" {onclose}>
  <div class="help">
    <section>
      <h3>Ansehen und Bearbeiten</h3>
      <p>Im Modus <b>Ansehen</b> zeigt ein Tipp auf ein Gerät, woher es gespeist wird und was es versorgt. Die Suche findet Bezeichnungen, Gerätenamen und RCD-Gruppen. Zum Ändern oben <b>Bearbeiten</b> einschalten.</p>
    </section>
    <section>
      <h3>Schrank aufbauen</h3>
      <ol>
        <li>Unter <b>Menü → Schrankgröße</b> Felder, Reihen und TE je Reihe festlegen.</li>
        <li>Gerät in der Palette wählen und auf eine Reihe klicken. TE-Geräte rasten auf halbe TE, Reihenklemmen auf 0,1 mm und an Nachbarkanten.</li>
        <li>Gerät anklicken, um Bezeichnung, technische Angabe, Status (Bestand/Neu), Breite und RCD-Gruppe zu ändern.</li>
        <li>Verschieben: mit der Maus ziehen, am Touchscreen lange drücken und ziehen. Die Pfeiltasten rücken um einen Rasterschritt.</li>
      </ol>
    </section>
    <section>
      <h3>Stromschienen und Phasen</h3>
      <p>Eine Reihe anklicken (links auf „R1“ oder in die freie Fläche), um ihre Stromschiene einzustellen: keine, 1-phasig oder 3-phasig mit Startphase. Geräte wie LS-Schalter übernehmen ihre Phase von der Schiene. Sitzt links ein RCD oder Hauptschalter, folgt die Schiene dessen tatsächlicher Phasenfolge – auch wenn sie bewusst verdreht eingespeist wird. <b>Phasen ausgleichen</b> verteilt die Startphasen reihum.</p>
    </section>
    <section>
      <h3>Verdrahtung</h3>
      <p>Externe Zuleitungen legst du unter <b>Menü → Externe Quellen</b> an. In den Eigenschaften eines Geräts wählst du je Eingang die Quelle oder verbindest alle Eingänge auf einmal. Unter „Abgänge“ lassen sich Ziele direkt anhängen. N und PE werden unabhängig vom Außenleiter geführt.</p>
    </section>
    <section>
      <h3>Auswertungen</h3>
      <p><b>Liste</b> zeigt alle Geräte nach Feld, Reihe und Position. <b>Logikplan</b> zeigt den Einspeisebaum, <b>Stromlaufplan</b> jeden Stromkreis mit L, N und PE. <b>Stückliste</b> fasst gleiche Geräte zusammen und exportiert CSV. <b>Prüfung</b> meldet offene Klemmen, ungültige Verweise und ungenutzte Abgänge. Jede Ansicht lässt sich über das Menü drucken.</p>
    </section>
    <section>
      <h3>Tastatur</h3>
      <dl>
        <dt>Strg+Z / Strg+Y</dt><dd>Rückgängig / Wiederholen</dd>
        <dt>Strg+D</dt><dd>Gerät duplizieren</dd>
        <dt>Entf</dt><dd>Gerät löschen</dd>
        <dt>← →</dt><dd>Gerät verschieben</dd>
        <dt>Strg+S</dt><dd>Sofort speichern (sonst automatisch)</dd>
        <dt>Esc</dt><dd>Platzieren beenden, Auswahl aufheben</dd>
        <dt>Strg+Mausrad</dt><dd>Zoomen; Mausrad allein verschiebt die Ansicht</dd>
      </dl>
    </section>
    <p class="hint">Der HV-Planer dokumentiert Platzbedarf und logische Zuordnung. Er prüft weder Normkonformität noch Selektivität, Kurzschlussstrom, Leitungsquerschnitte oder Abschaltbedingungen und ersetzt keine fachliche Prüfung.</p>
  </div>
  {#snippet footer()}<Button variant="primary" label="Schließen" onclick={onclose} />{/snippet}
</Dialog>

<style>
  .help {
    display: grid;
    gap: var(--s4);
    max-width: 70ch;
  }
  section {
    display: grid;
    gap: var(--s2);
  }
  ol {
    display: grid;
    gap: var(--s1);
    margin: 0;
    padding-left: 1.3em;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--s1) var(--s4);
    margin: 0;
  }
  dt {
    font-family: var(--mono);
    font-size: var(--fs-sm);
    white-space: nowrap;
  }
  dd {
    margin: 0;
  }
</style>
