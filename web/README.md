## Neu in V6.66 – externe logische Quellen

Ein Projekt kann jetzt beliebig viele externe Quellen tragen, z. B. `HAK / EVU`, `Zählerschrank · D02 40 A` oder eine zweite unabhängige Zuleitung. Die Quellen belegen keine TE und lassen sich über L1/L2/L3/N/PE direkt mit Geräteeingängen verknüpfen. Es wird bewusst kein physischer Bezug zwischen zwei Schränken modelliert.

# HV-Planer V6.35

## V6.35 – Rückkehr zur bewährten Oberfläche

- Ab jetzt enthält jede Version eine **`RELEASE-NOTES.md`** mit den wichtigsten Änderungen für Nutzer.
- Zusätzlich führt **`CHANGELOG.md`** die technische Versionshistorie fort.
- In der **About-Seite** sind beide Dokumente direkt verlinkt.

Die Änderungen aus V6.31 bleiben vollständig enthalten: korrigierte Neozed-Breiten, 0,5-TE-Schritte und Löschen per Entf-Taste.


Lokaler Verteiler-/Hutschienenplaner. Kein Apache/Node nötig.

## Neu in V6.13 – Komponentenbibliothek ausgelagert

Die herstellerneutrale Elementbibliothek liegt jetzt separat in **`components.js`**.
Der Planer selbst bleibt die Engine; Bauteildaten sind davon getrennt.

Ausgelagert sind unter anderem:
- Typ / ID
- Anzeigename und technische Kurzbeschreibung
- Breite in TE oder mm
- Standard-Phasenverhalten
- Kennzeichnung als Reihenklemme / Neutralleiter
- Eingangsports
- Ausgangsports einschließlich Phase und maximaler Belegung
- Kennzeichnung 4-poliger Geräte mit N

Dadurch lassen sich neue Standardkomponenten deutlich einfacher ergänzen. Für ein
einfaches neues Gerät genügt in vielen Fällen ein zusätzlicher Eintrag in
`components.js`; die Palette und Stückliste übernehmen es automatisch.

**Warum `components.js` statt `components.json`?** Der HV-Planer soll weiterhin
ohne Apache/Node direkt per Doppelklick funktionieren. Viele Browser blockieren
bei `file://` das Nachladen einer JSON-Datei per `fetch()`. Die Bibliothek ist
daher als reine Datendatei in JavaScript ausgeführt und bewusst JSON-ähnlich
gehalten.


## Neu in V4

### Reihenklemmen in echter mm-Breite
Reihenklemmen 1P / 2P / 3P werden jetzt mit **5,2 mm** Standardbreite dargestellt.
Das passt z. B. zur Phoenix PTI 2,5-PE/L/NT.

- Standardgeräte: TE-Raster (1 TE = 18 mm)
- Reihenklemmen: 0,1-mm-Raster
- Klemmenbreite in den Eigenschaften änderbar
- Positionsanzeige von Klemmen in mm
- V3/V3.1-Pläne werden beim Laden migriert

### Druckansicht
Button **„Liste drucken“** druckt nur die Elementliste im A4-Querformat.

Spalten:
- Position
- Gerät
- Phase
- Bezeichnung
- Eingang von
- Ausgang zu

## Hinweis
Planungshilfe/Dokumentation, keine automatische Normprüfung.


## Fix in V4.1 – Phasenvererbung über die logische Verdrahtung

Bei Geräten mit `Phase = automatisch` wird jetzt zuerst die Phase des logisch vorgeschalteten Geräts ausgewertet.

Beispiele:
- B13 auf L1 → Treppenhausrelais übernimmt L1
- Treppenhausrelais L1 → Treppenhausautomat übernimmt L1
- Treppenhausautomat L1 → Reihenklemme übernimmt L1

Sonderfall 4-poliger RCD / 3-phasige Quelle:
- ein 1-poliger LS hinter einer 3P-Quelle übernimmt weiterhin seine Phase aus der Position auf der Phasenschiene
- ein 3-poliges Folgegerät bleibt 3P

Damit entstehen aus der logischen Verbindung keine falschen Phasenangaben.


## Neu in V4.2 – Mehrfachausgänge für 3-polige LS

Ein **LS 3P / 3×B16A** stellt jetzt drei getrennte logische Ausgänge bereit:

- L1
- L2
- L3

Beim Zuordnen eines nachgelagerten Elements erscheint der 3-polige LS daher dreimal in der Eingangsauswahl, jeweils mit dem konkreten Ausgang.

Beispiel:
- Herd 3×B16A → L1 → Reihenklemme 1
- Herd 3×B16A → L2 → Reihenklemme 2
- Herd 3×B16A → L3 → Reihenklemme 3

Die Phase des Zielgeräts wird bei `Phase = automatisch` direkt aus dem gewählten Ausgang übernommen.

Bestehende Pläne bleiben kompatibel; ältere Verbindungen erhalten automatisch den generischen Ausgang `OUT`.


## Neu in V4.3 – RCD-/N-Gruppenvererbung

Die RCD-Gruppe wird jetzt entlang der logischen Verdrahtung automatisch rückwärts ermittelt.

Beispiel:
- RCD A → B13 → Treppenhausautomat → Reihenklemme
- alle nachgelagerten Elemente gehören automatisch zu **RCD-Gruppe A**

Damit ist auch der Neutralleiter logisch derselben RCD-/N-Gruppe zugeordnet.

Regel:
- Feld **RCD-Gruppe leer** = automatisch aus der Einspeisekette übernehmen
- manuell eingetragene Gruppe = bewusster Override

Wenn ein Stromkreis später von RCD A auf RCD B umgehängt wird, folgt die automatisch ermittelte Gruppe der neuen Einspeisekette.


## Fix in V4.4 – Phasenvererbung an Reihenklemmen

Reihenklemmen übernehmen jetzt bei vorhandener logischer Verbindung automatisch die Phase des vorgeschalteten Elements.

Beispiele:
- B13 auf L1 → Reihenklemme = L1
- Treppenhausautomat auf L1 → Reihenklemme = L1
- 3×B16 Ausgang L1 → Reihenklemme = L1
- 3×B16 Ausgang L2 → Reihenklemme = L2
- 3×B16 Ausgang L3 → Reihenklemme = L3

Neue Reihenklemmen stehen standardmäßig auf `Phase = automatisch`.
Beim Laden älterer Pläne werden verbundene Reihenklemmen mit `Phase = none` automatisch auf `automatisch` migriert.


## Fix in V4.5 – Ausgänge können nicht mehr doppelt belegt werden

Schutz-/Schaltgeräte mit einem einzelnen Abgang können jetzt nur noch einmal logisch weitergeführt werden.

Beispiele:
- LS 1P: OUT maximal 1 Ziel
- Treppenlichtautomat: OUT maximal 1 Ziel
- Relais/Schütz/Shelly: OUT maximal 1 Ziel
- LS 3P: L1, L2 und L3 jeweils maximal 1 Ziel

Verteiler-/Einspeisegeräte wie RCD, Hauptschalter, Umschalter, HLAK und D02 dürfen weiterhin mehrere nachgelagerte Elemente versorgen.

Bereits belegte Ausgänge werden in der Eingangsauswahl mit **„(belegt)“** angezeigt und sind nicht erneut auswählbar.

Beim Laden älterer Pläne mit Doppelbelegung bleibt die erste Verbindung erhalten; weitere doppelte Verbindungen werden automatisch gelöst.


## Neu in V4.6 – Detailansicht der Hutschiene

Unterhalb der Elementliste gibt es jetzt eine vergrößerte Ansicht der Hutschiene des aktuell ausgewählten Geräts.

- ausgewähltes Gerät bestimmt automatisch Feld + Reihe
- deutlich größere Darstellung
- Geräte können dort per Drag & Drop verschoben werden
- Reihenklemmen bewegen sich im 0,1-mm-Raster
- Reihenklemmen rasten magnetisch an den Kanten benachbarter Elemente ein
- dadurch können Klemmen exakt "press" aneinander gesetzt werden

Die normale Verteileransicht bleibt unverändert erhalten.


## Neu in V5 – automatisch erzeugter Stromlaufplan

Über den Button **„Stromlaufplan“** wird aus den vorhandenen logischen Verbindungen eine separate Planansicht erzeugt.

### Darstellung
- Gruppierung nach RCD A / B / C …
- RCD als Wurzel der jeweiligen Gruppe
- jeder Endstromkreis als eigener Pfad
- 1-polige LS mit L1/L2/L3
- 3-polige LS mit getrennten L1/L2/L3-Abgängen
- Zwischenkomponenten wie Relais/Treppenlichtautomat werden in der Kette angezeigt
- Reihenklemmen als Endpunkte
- N-Zugehörigkeit wird je RCD-Gruppe ausdrücklich ausgewiesen
- unvollständig bzw. nicht gruppierte Elemente werden separat dargestellt

### Drucken
Im Stromlaufplan-Fenster gibt es **„Stromlaufplan drucken“**.
Damit kann die Planansicht direkt über den Browser als PDF oder auf Papier ausgegeben werden.

Die Stromlaufplanansicht wird vollständig aus den bestehenden Planungsdaten erzeugt; es ist keine zweite Pflege der Verdrahtung notwendig.


## Neu in V5.1 – bündige Endpunkte im Stromlaufplan

Die Endpunkte eines RCD-Blocks werden jetzt automatisch auf dieselbe Spalte ausgerichtet.

Beispiel:

- RCD → LS → Reihenklemme
- RCD → LS → Treppenlichtautomat → Reihenklemme

Der zweite Pfad ist eine Stufe länger. Deshalb erhält der erste Pfad automatisch eine unsichtbare Zwischenstufe und seine Reihenklemme wird nach rechts auf dieselbe Position gezogen.

Damit stehen alle Reihenklemmen eines RCD-Blocks sauber untereinander.


## Neu in V6 – Logikplan und echter Stromlaufplan getrennt

Die bisherige grafische Verknüpfungsansicht heißt jetzt **Logikplan**.

Zusätzlich gibt es einen neuen Button **„Stromlaufplan“**.

### Stromlaufplan
Die neue Darstellung orientiert sich an klassischen potentialorientierten Installations-/Klemmenplänen:

- L1 / L2 / L3 als durchgehende Potentialschienen oben
- N als eigene blaue Potentialschiene
- PE als eigene Potentialschiene unten
- RCD als gemeinsames 4-poliges Schutzgerät
- einzelne Stromkreise senkrecht nach unten
- LS / 3-polige LS als Schutzelemente
- Zwischenkomponenten wie Treppenlichtautomat werden im Abgang dargestellt
- Reihenklemmen als Endpunkte
- RCD-/N-Gruppierung bleibt erhalten
- Browser-Druckansicht für PDF/Papier

Der Stromlaufplan wird vollständig aus den bereits gepflegten logischen Verbindungen generiert.


## Neu in V6.1 – normnahe Symbole im Stromlaufplan

Der echte Stromlaufplan verwendet jetzt reduzierte, normnahe IEC/DIN-Symbole als Inline-SVG.

Enthalten:
- RCD 2-polig
- RCD 4-polig
- LS 1-polig
- LS 3-polig
- Reihenklemme 1-polig
- Reihenklemme 2-polig
- Reihenklemme L/N/PE

Die Symbole sind:
- herstellerneutral
- skalierbar
- schwarz/weiß drucktauglich
- direkt im HTML eingebettet, daher weiterhin vollständig offline

Weitere Gerätetypen können später nach demselben Prinzip ergänzt werden.


## Neu in V6.2 – I-0-II-Inselschalter mit 8 Eingängen und 4 Ausgängen

Der 4-polige I-0-II-Umschalter ist jetzt elektrisch als echter Umschalter modelliert.

### Eingangsseite 1
- L1.1
- L2.1
- L3.1
- N1.1

### Eingangsseite 2
- L1.2
- L2.2
- L3.2
- N2

### Gemeinsame Ausgänge
- L1
- L2
- L3
- N

Im Eigenschaftenbereich des Umschalters erscheinen acht separate Eingangsauswahlen.
Die Auswahl prüft:
- passende Phase
- bereits belegte Quellausgänge
- getrennte Zuordnung beider Einspeiseseiten

Die vier Ausgangsports können wie beim 3-poligen LS separat mit nachgelagerten Geräten verbunden werden.


## Neu in V6.3 – RCD-Eingänge einzeln auswählbar

Ein 4-poliger RCD hat jetzt separate Eingänge:

- L1
- L2
- L3
- N

Damit kann der RCD z. B. direkt vom Klemmstein oder vom I-0-II-Inselschalter gespeist werden.

Die Außenleiter werden einzeln ausgewählt, sodass die Phasenzuordnung eindeutig bleibt.

Auch die Ausgänge des 4-poligen RCD sind jetzt getrennt modelliert:

- L1
- L2
- L3
- N

Dadurch können nachgelagerte LS und N-Pfade sauber und phasenrichtig zugeordnet werden.

Ein 2-poliger RCD erhält entsprechend getrennte Eingänge/Ausgänge für L und N.


## Neu in V6.4 – vier Ausgänge des I-0-II-Inselschalters

Der 4-polige I-0-II-Umschalter hat jetzt ausdrücklich vier Ausgangsports:

- L1
- L2
- L3
- N

Diese werden im Eigenschaftenbereich sichtbar aufgeführt und können von nachgelagerten Geräten gezielt als Quelle gewählt werden.

Beispiel:
- Inselschalter L1 → RCD L1
- Inselschalter L2 → RCD L2
- Inselschalter L3 → RCD L3
- Inselschalter N → RCD N

Die Ausgänge sind als gemeinsame Sammelausgänge modelliert und können bei Bedarf mehrere nachgelagerte Verbindungen versorgen.


## Neu in V6.5 – Ausgänge aktiv zuordnen

Der I-0-II-Inselschalter besitzt jetzt nicht nur vier sichtbare Ausgangsports, sondern diese können direkt im Eigenschaftenbereich zugeordnet werden.

Für jeden Ausgang gibt es eine eigene Zielauswahl:

- L1
- L2
- L3
- N

Als Ziele werden freie und phasenkompatible Eingänge angeboten, z. B.:

- Inselschalter L1 → RCD A L1
- Inselschalter L2 → RCD A L2
- Inselschalter L3 → RCD A L3
- Inselschalter N → RCD A N

Bereits angelegte Verbindungen werden direkt unter dem jeweiligen Ausgang angezeigt und können dort mit `×` wieder getrennt werden.

Das funktioniert ebenfalls bei anderen Mehrport-Geräten wie RCDs.


## Neu in V6.6 – vorgelagerte Geräte im Logikplan

Der Logikplan berücksichtigt jetzt auch die Mehrfacheingänge eines RCD.

Ist ein RCD z. B. vom I-0-II-Inselschalter gespeist, wird die Kette nun als

**I-0-II-Inselschalter → RCD → LS → Reihenklemme**

dargestellt.

Die vier Verbindungen L1/L2/L3/N zwischen Inselschalter und RCD werden am Verbindungspfeil zusammengefasst angezeigt.

Das funktioniert ebenso für andere vorgelagerte Quellen, z. B. einen Klemmstein.


## Neu in V6.7 – Ausgangsziel bleibt sichtbar

Die vier Ausgänge des I-0-II-Inselschalters verhalten sich jetzt wie echte, dauerhaft belegte Anschlussziele.

Nach Auswahl eines Ziels bleibt dieses direkt im Dropdown sichtbar und springt beim Klick außerhalb des Eigenschaftenbereichs nicht mehr auf „Ziel hinzufügen“ zurück.

Für jeden Ausgang gilt jetzt genau eine direkte Verbindung:

- L1 → ein Ziel
- L2 → ein Ziel
- L3 → ein Ziel
- N → ein Ziel

Ein Ziel kann jederzeit durch Auswahl eines anderen Ziels ersetzt oder mit „frei“ wieder getrennt werden.


## Neu in V6.8 – Klemmstein, Neozed und Hauptschalter vollständig modelliert

### Klemmstein einzeln
- 1 Eingang
- 3 getrennte Abgänge
- alle drei Abgänge übernehmen die Phase des Eingangs
- Abgänge einzeln einem Ziel zuweisbar

### Hauptleitungs-Abzweigklemme 5P

- Breite: 100 mm
- Leiter: L1, L2, L3, N, PE
- Logische Belegung je Leiter: 1 Eingang → 3 Abgänge
- Herstellerneutral modelliert.
- Zusätzlich verfügbar: kompakte 5P-Variante mit 88,8 mm Breite und gleicher logischer Belegung.

### Klemmstein kombiniert
- Eingänge: L1, L2, L3
- je Phase drei getrennte Abgänge
- insgesamt 9 Ausgangsports:
  - L1.1 / L1.2 / L1.3
  - L2.1 / L2.2 / L2.3
  - L3.1 / L3.2 / L3.3

### Neozed / D02 3P
- Eingänge: L1, L2, L3
- Ausgänge: L1, L2, L3
- phasenrichtige 1:1-Zuordnung

### Hauptschalter 4P
- Eingänge: L1, L2, L3, N
- Ausgänge: L1, L2, L3, N
- jeder Leiter wird einzeln zugeordnet

Geräte mit mehreren Ausgangsports erhalten jetzt auch bei nur einem Eingang die direkte Ausgangs-Zielzuordnung im Eigenschaftenbereich.


## Neu in V6.9 – Reihenklemme N

Neue Palette-Komponente **„Reihenklemme N“**:

- feste Phase N
- 1 Eingang
- direkt mit dem N-Ausgang eines RCD verbindbar
- wird nur als phasenkompatibles N-Ziel angeboten
- eigenes N-Symbol im Stromlaufplan
- Breite 5,2 mm

Beispiel: **RCD N → Reihenklemme N**


## Bugfix V6.9.1

Die in V6.9 versehentlich verlorenen Kernfunktionen für Geräteplatzierung,
Breitenberechnung, Gerätezugriff und Gruppenlogik wurden wiederhergestellt.

Zusätzlich ist die N-Reihenklemme korrekt als 5,2-mm-Reihenklemme markiert.


## Neu in V6.9.2 – N-Klemmen blau

Die spezielle **Reihenklemme N** wird jetzt in der normalen Verteileransicht
und in der vergrößerten Hutschienen-Detailansicht blau dargestellt.

Dadurch ist die Neutralleiter-Klemmengruppe optisch sofort von den übrigen
Reihenklemmen zu unterscheiden.


## Bugfix V6.9.3

Die CSS-Regel für die blaue N-Klemme war vorhanden, aber die gerenderten
Geräteelemente bekamen die CSS-Klasse `termN` nicht. Das ist jetzt korrigiert.

Die N-Reihenklemme wird nun in Haupt- und Detailansicht sichtbar blau dargestellt.


## Bugfix V6.9.4 – automatische Phase hinter RCD

Die Phasenautomatik hinter 3-/4-poligen Geräten wurde robust gemacht.

- expliziter Ausgang L1/L2/L3/N hat immer Vorrang
- ältere Verbindungen mit `OUT` hinter einem RCD werden wieder automatisch
  anhand der Leiterfolge L1 → L2 → L3 zugeordnet
- die gleiche Phase wird auch im Logikplan verwendet

Damit funktionieren sowohl neue Port-Verbindungen als auch bereits vorhandene
Pläne aus älteren Versionen.


## Neu in V6.10 – automatische Stückliste

Über den neuen Button **„Stückliste“** wird aus dem aktuellen Verteilerplan
eine herstellerneutrale Bestellübersicht erzeugt.

Die Stückliste gruppiert automatisch nach:

- Bauteilart
- technischer Ausführung
- mechanischer Breite

Beispiel: B13A und B16A werden als getrennte Bestellpositionen geführt,
während mehrere B16A-Stromkreise zu einer gemeinsamen Menge zusammengefasst werden.

### Angezeigt werden

- Menge
- Bauteil
- Ausführung
- Breite je Stück
- Gesamtbreite
- Anzahl Bestellpositionen
- Gesamtzahl der Bauteile
- gesamte TE der Modulgeräte
- gesamte Breite der Reihenklemmen

**Reserve** wird als Planungsplatzhalter nicht als Bestellteil gezählt.

### Export

Die Stückliste kann:

- direkt gedruckt / als PDF ausgegeben werden
- als UTF-8-CSV mit Semikolon-Trennung exportiert werden

Damit lässt sich die Liste direkt in Excel oder für die Bestellvorbereitung weiterverwenden.

## V6.13 – FHD-Layout
- Elementliste unterhalb des grafischen Verteilers statt seitlich daneben.
- Grafische TE-Darstellung von 30 px auf 40 px vergrößert.
- Der obere Planbereich nutzt damit auf einem FHD-Monitor deutlich mehr Breite für den eigentlichen Verteiler.
- Bei kleineren Viewports bleibt der Plan horizontal scrollbar, statt die Elementliste in die Breite zu quetschen.

## V6.13
- Planansicht nochmals für Full-HD optimiert.
- TE-Darstellung um weitere 20 % vergrößert: 48 px je TE.
- Hutschienen und Geräte etwas höher dargestellt, Beschriftungen vergrößert.
- Elementliste bleibt unterhalb des Verteilerplans; WQHD nutzt den zusätzlichen Platz für eine bewusst große Planansicht.


## V6.23 – WQHD-Skalierung

- FHD bleibt bei 48 px je TE.
- Ab 2200 px Fensterbreite wird die Planansicht automatisch auf 56 px je TE vergrößert.
- Hutschienen, Gerätehöhen und Beschriftungen wachsen auf WQHD passend mit.
- Die Elementliste bleibt unterhalb des Plans, damit die zusätzliche Breite vollständig der grafischen Planung zugutekommt.

## V6.23 – Detail-Hutschiene auf reale Reihenbreite begrenzt

- Die vergrößerte Detailansicht der ausgewählten Reihe nutzt jetzt exakt die konfigurierte Reihenbreite.
- Bei 12 TE werden unten auch nur 12 TE Raster dargestellt; der Bereich wird auf großen Monitoren nicht mehr künstlich bis zur vollen Fensterbreite gestreckt.
- Horizontales Scrollen bleibt erhalten, falls eine sehr breite Reihe nicht in den verfügbaren Platz passt.


## V6.23
- About-Dialog ergänzt
- Projektinfo, lokaler Betrieb und Herstellerunabhängigkeit beschrieben
- freiwilliger PayPal-Kaffee-Button für @selfi24 ergänzt


## V6.23 – Energiezähler

- Energiezähler jetzt mit drei getrennten Eingängen L1/L2/L3 und drei Ausgängen L1/L2/L3.
- Kein Neutralleiteranschluss.
- Versorgung des Zählers wird aus den drei Außenleitern angenommen.


## V6.23 – Kategorien in der Komponentenpalette

- Komponenten sind jetzt nach Kategorien gruppiert.
- Kategorien lassen sich auf- und zuklappen, damit die linke Palette auch bei vielen Bauteilen kompakt bleibt.
- Schutzgeräte sind standardmäßig geöffnet.
- Kombinierter Klemmstein auf HLAK 3×1→5 mit fünf Abgängen je Phase erweitert.


## V6.23 – frei wählbare Startphase je Reihe

Jede Hutschienenreihe kann unabhängig auf keine, 1-phasige oder 3-phasige Stromschiene gesetzt werden und bei vorhandener Stromschiene mit L1, L2 oder L3 starten. Die grafische Leiterfolge wird direkt unterhalb der Geräte dargestellt. Ein globaler Schalter zum Ein-/Ausblenden ist nicht mehr nötig, da die Stromschiene pro Reihe definiert wird. Leiterfarben, Phasenpunkte, Elementliste, Statistik und logische Phasenzuordnung werden aus derselben tatsächlichen Phase abgeleitet. Der Button „Phasen automatisch ausgleichen“ setzt reihenweise das Muster L1 / L3 / L2; jede Reihe kann danach manuell angepasst werden. Die Einstellung wird im Plan gespeichert.


## V6.23 – Netzteile in mehreren TE-Breiten

- Netzteil 1 TE
- Netzteil 2 TE
- Netzteil 3 TE
- Netzteil 4 TE
- Die bestehende 2-TE-Type-ID `netzteil` bleibt für ältere gespeicherte Pläne kompatibel.


## V6.23 – Neozed / D02 Einzelmodul

Zusätzlich zum 3-poligen D02-Block gibt es jetzt ein 1-poliges Neozed-/D02-Einzelmodul mit 1 TE. Die Phase wird automatisch aus der realen Reihenfolge der gewählten Hutschiene übernommen.


## V6.23 – weitere Schalt- und Smart-Komponenten

- Zeitrelais, 1 TE, Multifunktion / 1 Wechsler (A1/A2/B1/15 → 16/18).
- Shelly 1 Gen3 mit L/N/SW/I und Relaisausgang O.
- Shelly 2PM Gen4 mit L/N, S1/S2 und O1/O2; als 2-Kanal-/Rollladenmodul gekennzeichnet.
- Shelly Pro 3EM als CT-basierter 3-Phasen-Energiezähler mit LA/LB/LC/N; CT-Anschlüsse werden bewusst nicht als frei belegbare Eingänge geführt.
- Shelly Pro 4PM mit L/N, vier Steuereingängen E1–E4 und vier Ausgängen O1–O4.
- Pro 3EM wird mit 1 TE, Pro 4PM mit 3 TE geführt; Unterputzmodule werden mit 42 mm Breite dargestellt.


## V6.23 – Phasenrotation elektrisch sauber hinter dem RCD

Der frei wählbare Phasenstart einer Reihe beschreibt jetzt ausdrücklich die Abgangsschiene hinter einem 4-poligen RCD. Die RCD-Klemmen bleiben strikt L1→L1, L2→L2, L3→L3 und N→N. Wird der Schienenstart geändert, werden bereits zugeordnete einphasige Verbraucher hinter einem 4P-RCD automatisch auf den physisch passenden RCD-Ausgang umgehängt. Falsche RCD-Ausgangsphasen werden in der Auswahl gesperrt und als „falsche Phase“ markiert. Damit bleiben Farbtabelle, reale Schienenfolge, Statistik und logische Verdrahtung konsistent.


## V6.30 – Phasenpermutation am RCD 4P

Beim 4-poligen RCD dürfen L1/L2/L3 am Eingang jetzt bewusst untereinander getauscht werden. N bleibt ausschließlich N. Die Ausgangsports des RCD übernehmen automatisch die tatsächlich eingespeiste Phase, sodass nachgelagerte LS, Farblogik und Verdrahtungsprüfung mit der realen Phasenlage weiterarbeiten.


## Fix in V6.30 – reale Phase direkt über dem RCD

Bei 4-poligen Geräten mit erlaubter Phasenpermutation folgt die Farbtabelle nun auch
direkt über den vier Geräte-TE der tatsächlich angeschlossenen Phase. Wird z. B. der
HLAK-Ausgang L3 auf die RCD-Klemme L1 geführt, erscheint der erste RCD-TE in der
L3-Farbe. Hinter dem RCD wird dieselbe reale Phasenzuordnung weitergeführt.

Der kombinierte HLAK benötigt dafür keine zusätzliche manuelle Phasenangabe: seine
Ausgänge L1.x, L2.x und L3.x tragen die Phase bereits im Komponentenmodell. Bei
einem einzelnen HLAK kann die Phase weiterhin über das vorhandene Feld „Phase“ in
den Eigenschaften festgelegt werden, falls sie nicht automatisch aus einer Quelle
kommt.


## V6.30 – 3P-Stromkreise kompakt
- LS 3P wird im Stromlaufplan als ein gemeinsames 3-poliges Schutzorgan dargestellt.
- Die drei Außenleiter laufen von dieser Einheit getrennt auf bis zu drei zugeordnete Reihenklemmen.
- Dadurch entfällt die dreifache Wiederholung desselben 3P-LS im Stromlaufplan.


## V6.30 – 3P-Gerät auf volle Abgangshöhe

Im Logikplan wird ein LS 3P weiterhin nur einmal dargestellt. Der gemeinsame 3P-Block wird nun vertikal auf die Gesamthöhe seiner drei Abgänge L1/L2/L3 gestreckt. Dadurch steht links eine große gemeinsame 3P-Einheit den drei Reihenklemmen rechts gegenüber.
