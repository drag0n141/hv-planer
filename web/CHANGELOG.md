# Changelog

## V6.66
- Externe Quellen als eigenständiges Datenmodell `externalSources[]` ergänzt.
- Negative IDs als separater Namensraum für Quellen.
- L1/L2/L3/N/PE als verknüpfbare Source-Ports.
- Quellenverwaltung und Migration von `projectFeed`.
- Single- und Multi-Input-Auswahl um externe Quellen erweitert.

# Changelog

## V6.65
- Neue Projekteigenschaft `projectFeed` für die vorgelagerte Einspeisung des Verteilers.
- Eingabefeld in der Projektkonfiguration.
- Darstellung als Einspeisungsleiste im Board, Logikplan und Stromlaufplan.
- Save/Load, Undo/Redo und Reset um `projectFeed` erweitert.
- Rückwärtskompatibel zu bestehenden Projektdateien.


## V6.64
- Stromlaufplan: 1-polige und 3-polige LS beginnen nun auf derselben vertikalen Höhe.
- Zuführungen und senkrechte 3P-Abgänge wurden passend nachgezogen.
- Reine Layoutkorrektur; Phasen-, RCD-, N-/PE- und Verdrahtungslogik unverändert.


## V6.63
- History-Snapshots mit Undo/Redo und Tastaturkürzeln ergänzt.
- `installStatus` (`existing`/`new`) und `insertStatus` eingeführt; Rückwärtsmigration auf Bestand.
- Grüne NEU-Kennzeichnung in Board, Detailansicht und Elementliste.
- BOM-Filter `nur Neu` ergänzt.
- Drag-Snap-Guide ergänzt.
- Konservativer Plausibilitätscheck für offene Klemmen, ungültige Referenzen und ungenutzte Schutzgeräte-Abgänge.
- Keine Änderung an der Phasen-/RCD-/Stromlaufplan-Engine.

## V6.62

- UI: neuer Button `Hilfe / Anleitung` und scrollbarer Hilfedialog.
- Dokumentation: `ANLEITUNG.md` ergänzt.
- Metadaten: Versionsstrings in `index.html`, About-Dialog und Footer vereinheitlicht.
- Keine Änderungen an Platzierungs-, Phasen-, RCD- oder Verdrahtungslogik.

# V6.61

- Button `#viewScaleReset` neben dem Zoom-Slider ergänzt.
- Reset setzt ausschließlich `state.viewScale=100` und ruft `applyBoardViewScale()` auf.
- Projektformat auf 6.61 aktualisiert.

# V6.60

- `autoJump` als UI-/Projektzustand ergänzt.
- `scrollSelectedRowIntoView()` und `scrollSelectedDeviceIntoView()` respektieren `state.autoJump`.
- Checkbox `#autoJump` in der Konfigurationszeile ergänzt.
- Save/Load/Reset um `autoJump` erweitert; Legacy-Projekte defaulten auf `true`.


## V6.59
- Maximale Ansichtsgröße von 140 % auf 250 % erhöht.
- `viewScale`-Clamp und Slidergrenze auf 250 % erweitert.
- Projektformat auf 6.59 aktualisiert; bestehende gespeicherte Zoomwerte bleiben kompatibel.


## V6.58
- Globalen UI-Schalter `phaseRail` / „Leiterfolge anzeigen“ entfernt.
- `showPhaseRail` aus neu gespeicherten Projektdateien entfernt; alter Wert bleibt beim Import unschädlich und wird ignoriert.
- Phase-Strip im Reihenrenderer hinter die Geräteschiene verschoben.
- Phase-Strip wird nun allein aus `rowRailMode()` gesteuert; `none` erzeugt weiterhin einen unsichtbaren Platzhalter für identische Reihenhöhen.
- CSS-Abstand des Phase-Strips von `margin-bottom` auf `margin-top` umgestellt.

## V6.57

- Persistente UI-Eigenschaft `viewScale` (60–140 %, 5-%-Raster) ergänzt.
- Neue Range-Steuerung `viewScale` / `viewScaleValue` in der Konfigurationsleiste.
- Planbereich wird über CSS `zoom` gemeinsam skaliert; Klick-/Drop-Koordinaten nutzen dafür `screenPxPerMM()`.
- `phase-strip.placeholder` reserviert bei Reihen ohne Stromschiene die gleiche Höhe wie bei Reihen mit Leiterfolge.
- `.board` auf `align-items:stretch` umgestellt, sodass gleich konfigurierte Felder dieselbe Außenhöhe besitzen.
- Projektformat auf 6.57 aktualisiert; Laden älterer Projekte fällt auf 100 % Ansichtsgröße zurück.

## V6.56

- CSS: `.file-btn` erhält explizit `color: var(--text)`, damit „Plan laden“ auf weißem Button sichtbar bleibt.
- Versionsanzeige und Release-Link auf V6.56 aktualisiert.

## V6.55
- Dynamische Canvas-Breite für RCD-Stromlaufblätter eingeführt.
- Breitenberechnung berücksichtigt Standardspalten, breite 3P-Spalten und die Spaltenabstände.
- RCD-Stromlaufblätter nutzen `width:max-content` und eine per CSS-Variable gesetzte Canvas-Breite.
- Verhindert Abschneiden umfangreicher Gruppen am rechten Rand.

## V6.54
- Stromlaufplan: Term3 erhält eine breit skalierte Symbolvariante mit getrennten L/N/PE-Anschlusspunkten über den drei Segmenten.
- Einphasige Abgänge: Phase auf L-Segment, N-Tap auf N-Segment, neuer PE-Tap auf PE-Segment.
- 3P-Abgänge: Polachsen des breiten LS-Symbols und der geraden Leiter auf die L-Segmente der drei Zielklemmen ausgerichtet.
- Drei getrennte N-Taps vom RCD-N-Ausgang sowie drei PE-Taps von der horizontalen PE-Potentiallinie ergänzt.
- PE-Bus im RCD-Stromlaufblatt als durchgehender vorgelagerter Potentialpfad positioniert.

# Changelog

## V6.53
- Breites 3P-LS-Symbol für den Stromlaufplan eingeführt.
- Drei feste Anschlussachsen L1/L2/L3 durch den gesamten 3P-Zweig.
- Horizontale Fächer- und Treppenleitungen im 3P-Zweig entfernt.
- Eingangsleitungen des 3P-LS ebenfalls auf die drei Polachsen gelegt.
- Keine Änderung an der logischen Verdrahtung oder Phasenzuordnung.

## V6.53

- Stromlaufplan: Polpositionen des 3P-LS mit den drei gezeichneten LS-Polen synchronisiert.
- L1/L2/L3 treten zunächst parallel aus dem Schaltzeichen aus.
- Auffächerung zu den drei Zielklemmen beginnt erst unterhalb des Geräts.
- Keine Änderung an der elektrischen/logischen Verdrahtung.

## V6.51

- Stromlaufplan: feste Anschlusspositionen für die drei Abgänge eines 3-poligen LS.
- 3P-Leiter werden erst unterhalb des Geräts zu den Zielklemmen aufgefächert.
- Nachgelagerte Klemmenpositionen beeinflussen die grafischen Geräteanschlüsse nicht mehr.
- Keine Änderung an Verdrahtungs-, RCD-, Phasen- oder Stromschienenlogik.

## V6.50
- Neue persistente Reihen-Eigenschaft `rowRailModes` (`none`, `1P`, `3P`).
- Phasenermittlung `phaseForRailSlot()` berücksichtigt jetzt explizit den Stromschienenmodus.
- Ohne Stromschiene liefert die automatische Eingangsermittlung keine künstliche Außenleiterphase mehr.
- Reihen-UI um Stromschienen-Dropdown ergänzt; Phasenstart ist bei „Keine“ deaktiviert.
- Legacy-Migration setzt 3P nur für Reihen mit 4-poligem RCD.
- Projekt-Speicherformat auf V6.50 erweitert.

## V6.49
- Automatische logische N-Zuordnung für `term3` und `termN` über die wirksame RCD-Gruppe ergänzt.
- Eigenschaften zeigen den automatisch zugeordneten RCD als N-Quelle an.
- Stromlaufplan-N-Leitungen der Endklemmen auf den N-Abgang hinter dem RCD umgestellt.
- Bestehende Phasen-, HLAK-, SPD- und LS-Logik unverändert.

# Changelog

## V6.48
- Stromlaufplan-Topologie RCD → nachgeordnete LS optisch korrigiert.
- RCD-Ausgangsbündel L1/L2/L3/N ergänzt.
- Zentrale, RCD-unabhängige SPD-Darstellung ergänzt.
- SPD-Quellzuordnungen werden im Stromlaufplan ausgewiesen.


## V6.47
- `circuitSymbolSvg()` neu aufgebaut.
- IEC/DIN-nahe Symbole für LS 1P/3P, RCD 2P/4P, D02 1P/3P, Hauptschalter und I-0-II.
- Funktionssymbole für Treppenlicht/Stromstoß, Schütz, Relais, Zeitrelais, HLAK, Zähler, Netzteile und Smart-/Steuergeräte ergänzt.
- Reihenklemmen-Symbole vereinfacht und PE/N optisch eindeutig gehalten.
- Bestehende Stromlaufplan-Topologie und Phasenlogik unverändert.

## V6.46
- Speichern fragt jetzt nach einem frei editierbaren Dateinamen.
- Projektname wird nur noch als Dateinamensvorschlag verwendet.
- `.json` wird bei Bedarf automatisch ergänzt; unzulässige Dateinamen-Zeichen werden bereinigt.
- Speicherversion auf 6.46 aktualisiert.

## V6.45

- Projektname als persistentes Projektfeld ergänzt.
- Projektname in Druck-/Dokumentationsüberschriften integriert.
- Benutzerdefinierte Platzhalter auf 0,5–5 TE begrenzt und Verbreiterung mit automatischem Rechtsverschieben kollidierender Geräte ergänzt.
- Speicherversion auf 6.45 aktualisiert.

## V6.44

- Benutzerdefinierte Geräte erhalten `−0,5` / `+0,5`-Schaltflächen.
- Platzhalterbreite von 0,5 bis 12 TE in 0,5-TE-Schritten.
- Gemeinsame Breitenprüfung für Eingabefeld und Schaltflächen.

## V6.43
- SPD-Komponente von einem einfachen Platzhalter zu einem 4-poligen Typ-2-Überspannungsschutz erweitert.
- Eingänge L1/L2/L3/N sowie PE ergänzt; keine seriellen Ausgänge (`parallelProtection`).
- Neue Darstellungsrolle `colorRole: "surge"` ergänzt.
- Rote SPD-Darstellung in Hauptplan, Detailansicht, Logikplan und Stromlaufplan ergänzt.
- Eigenes reduziertes SPD-Symbol für den Stromlaufplan ergänzt.

## V6.42
- `passthroughByConductor` für 5P-HLAK ergänzt.
- `sourcePorts()` propagiert die reale Eingangsphase eines Leiters auf dessen HLAK-Ausgänge (z. B. L2 -> L2.1/L2.2/L2.3).
- Dadurch funktioniert die Phasenverfolgung HLAK -> RCD -> Stromschiene über die gesamte Kette.

## V6.42
- Fehler in der Phasenfortschreibung bei HLAK→RCD-Verbindungen behoben.
- Legacy-Migration für falsch gruppierte 5P-HLAK-Abgänge ergänzt; N.x dient als eindeutiger Gruppenschlüssel.
- Absichtliche Außenleiter-Permutationen innerhalb eines Abgangssatzes werden nicht verändert.

## V6.39

- HLAK 5P: Ausgangsanzeige nach realen Abgangssätzen gruppiert.
- Komfortfunktion zum vollständigen Zuordnen eines Abgangs auf 4-polige Geräte ergänzt.
- Vermeidet die Fehlbedienung L1.1/L1.2/L1.3 → L1/L2/L3 desselben RCD.
- Korrekte Phasenquelle hinter dem RCD bleibt dadurch erhalten.


## V6.38
- Grundsätzliche Breitenlogik korrigiert: `widthMM` gilt jetzt für alle Bauteile, nicht nur Reihenklemmen.
- 100-mm- und 88,8-mm-HLAK werden maßstäblich korrekt dargestellt und platziert.
- mm-basierte Darstellung/Positionierung/BOM auch für Shelly- und andere Sonderbreiten korrigiert.
- Eigenschaftsfeld für mm-Breiten auf bis zu 300 mm erweitert.

# HV-Planer – Changelog

## V6.37
- Kompakte Hauptleitungs-Abzweigklemme 5P mit 88,8 mm Breite ergänzt.
- Logik analog zur 100-mm-Variante: L1/L2/L3/N/PE, jeweils 1 Eingang → 3 Abgänge.
- Standard- und Kompaktbauform stehen parallel im Komponenten-Katalog zur Verfügung.

## V6.36
- Neue herstellerneutrale Hauptleitungs-Abzweigklemme 5P ergänzt.
- Breite auf 100 mm festgelegt.
- Leiter L1/L2/L3/N/PE jeweils mit 1 Eingang und 3 logischen Abgängen modelliert.

## V6.35
- Oberfläche auf den Stand vor dem ABB-UI-Experiment zurückgesetzt.
- V6.33/V6.34 als verworfene UI-Experimente behandelt.
- Basis entspricht funktional V6.32; Release-Dokumentation bleibt erhalten.


Fortlaufende technische Versionshistorie. Die kurze, nutzerorientierte Zusammenfassung der jeweils aktuellen Version steht in `RELEASE-NOTES.md`.

## V6.32

- Dokumentationsstruktur für Releases eingeführt.
- `RELEASE-NOTES.md` als kurze Nutzerübersicht hinzugefügt.
- `CHANGELOG.md` als fortlaufende technische Versionshistorie hinzugefügt.
- Link auf die Release-Notes in der About-Seite ergänzt.

## V6.31

- Neozed / D02 1P auf 1,5 TE korrigiert.
- Neozed / D02 3P auf 4,5 TE korrigiert.
- Eigenschaftenfeld für TE-Breite auf 0,5-TE-Schritte erweitert.
- Löschen ausgewählter Bauteile per Entf-Taste ergänzt.
- Logische Verweise werden beim Löschen bereinigt.

## V6.30

- Darstellung des 3-poligen LS im Logikplan korrigiert: Der gemeinsame 3P-Block kann die Höhe seiner drei Abgangsklemmen ausfüllen.

## V6.29

- 3-poliger LS im Logikplan als gemeinsame Einheit für L1/L2/L3 weiterentwickelt.

## V6.28

- Logikplan gruppiert den 3×B16 als ein gemeinsames Gerät mit drei getrennten Abgängen.

## V6.27

- Stromlaufplan-Darstellung des 3×B16 als gemeinsame 3-polige Einheit verbessert.

## V6.26

- Phasenfarben über einem 4-poligen RCD folgen jetzt der tatsächlich eingespeisten Phase.

## V6.25

- Farbtabelle hinter dem RCD auf die reale, durchgereichte Phasenbelegung umgestellt.

## V6.24

- Außenleiter am Eingang eines 4-poligen RCD können bewusst permutiert werden; N bleibt strikt N.
- RCD-Ausgänge übernehmen die tatsächlich eingespeiste Phase.

## V6.23

- Schienenstart von der RCD-Klemmenbezeichnung getrennt.
- Reale Abgangsschienenfolge und automatische Phasenverteilung erweitert.

## V6.22

- Komponentenbibliothek um mehrere Shelly-Geräte und ein Zeitrelais erweitert.

## V6.21

- 1-poliges Neozed-/D02-Modul ergänzt.

## V6.20

- Netzteile in 1, 2, 3 und 4 TE ergänzt.

## V6.19

- Frei wählbarer Phasen-/Schienenstart je Reihe eingeführt.
- Automatischer Phasenausgleich ergänzt.

## V6.18

- Komponentenpalette in auf- und zuklappbare Kategorien gegliedert.

## V6.17

- 3-phasigen Energiezähler auf drei Außenleiter-Eingänge und drei Ausgänge ohne N umgestellt.

## V6.16

- About-Seite mit Projektinformationen und freiwilliger PayPal-Kaffeekasse ergänzt.

## V6.15

- Detailansicht der Hutschiene auf die reale TE-Breite der gewählten Reihe begrenzt.

## V6.14

- Größere Darstellung für WQHD ergänzt.

## V6.13

- Darstellung für FHD vergrößert.

## V6.12

- Elementliste unter die grafische Verteileransicht verschoben.

## V6.11

- Herstellerneutrale Komponentenbibliothek nach `components.js` ausgelagert.