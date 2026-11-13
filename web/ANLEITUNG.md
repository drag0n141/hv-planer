# HV-Planer V6.66 – Anleitung

Der HV-Planer ist eine herstellerunabhängige, lokal im Browser laufende Planungshilfe für Verteilungen. Er unterstützt die mechanische Belegung, logische Verschaltung, Dokumentation, Stücklistenerstellung sowie eine automatisch erzeugte Logik- und Stromlaufplanansicht.

## Externe Quellen

Über **Quellen** können beliebig viele vorgelagerte Einspeisungen definiert werden. Eine Quelle ist ein rein logischer Ursprung außerhalb des aktuell gezeichneten Verteilers und belegt keine TE.

Beispiele:
- `HAK / EVU`
- `Zählerschrank · D02 40 A`
- `PV-Unterverteilung`
- eine zweite unabhängige Zuleitung

Jede Quelle stellt L1, L2, L3, N und PE zur Verfügung. Diese Potentiale können wie Geräteausgänge mit Eingängen im Verteiler verknüpft werden. Dadurch lassen sich auch mehrere externe Zuleitungen innerhalb eines Schrankes logisch zusammenführen. Ein realer Schrank-zu-Schrank-Bezug ist dafür nicht erforderlich.


> **Wichtig:** Der HV-Planer führt keine automatische Norm-, Selektivitäts-, Kurzschlussstrom-, Leitungsdimensionierungs- oder Ausführungsprüfung durch. Er dokumentiert die geplante logische Struktur. Die reale Ausführung muss anhand der geltenden Regeln, Herstellerangaben und fachlichen Prüfung erfolgen.

## 1. Schnellstart

1. Oben einen **Projektname** eintragen.
2. **Felder**, **Reihen je Feld** und **TE je Feld/Reihe** festlegen.
3. Links in der Gerätepalette ein Gerät anklicken.
4. Im gewünschten Feld auf der gewünschten Hutschiene platzieren.
5. Gerät anklicken und rechts die Eigenschaften bearbeiten.
6. Pro Reihe die gewünschte **Stromschiene** einstellen.
7. Logische Eingänge und Ausgänge zuordnen.
8. Zum Abschluss **Elementliste**, **Stückliste**, **Logikplan** und **Stromlaufplan** prüfen.
9. Projekt als JSON speichern.

## 2. Oberfläche

Die Oberfläche besteht im Wesentlichen aus vier Bereichen:

- **Kopfbereich:** Speichern, Laden, Auswertungen, Hilfe und Grundeinstellungen.
- **Gerätepalette links:** verfügbare Schutz-, Schalt-, Mess-, Klemmen- und Sonderkomponenten.
- **Planungsfläche in der Mitte:** Felder und Hutschienen mit den platzierten Geräten.
- **Eigenschaften rechts:** Bearbeitung des aktuell ausgewählten Geräts sowie Auswertung.

Unter der Planungsfläche befindet sich außerdem die **Elementliste** und die **Detailansicht Hutschiene**.

## 3. Projektgröße festlegen

### Felder
Legt fest, wie viele Verteilerfelder nebeneinander dargestellt werden.

### Reihen je Feld
Legt die Anzahl der Hutschienen je Feld fest. Felder mit gleicher Konfiguration werden gleich groß dargestellt, unabhängig von ihrer Belegung.

### TE je Feld/Reihe
Legt die nutzbare Teilungseinheiten-Breite einer Reihe fest. Typische Werte sind 12, 18 oder 24 TE.

## 4. Ansichtsgröße

Mit dem Regler **Ansichtsgröße** wird ausschließlich die Darstellung vergrößert oder verkleinert.

- Bereich: **60 % bis 250 %**
- Schrittweite: **5 %**
- Der Button **100 %** setzt die Darstellung sofort auf Normalgröße zurück.

Die Skalierung ändert keine TE-Werte, Gerätepositionen oder Verdrahtungen.

### Zur Auswahl springen
Ist **Zur Auswahl springen** aktiviert, scrollt die Oberfläche nach einer Auswahl bzw. Platzierung zum betroffenen Element oder dessen Bereich.

Beim Arbeiten mit starker Vergrößerung kann diese Funktion deaktiviert werden. Dann bleibt die aktuelle Bildschirmposition erhalten und mehrere Geräte lassen sich nacheinander setzen, ohne dass die Ansicht ständig springt.

## 5. Geräte platzieren

1. Gerät in der Palette auswählen.
2. Auf eine freie Position in einer Reihe klicken.
3. Das Gerät wird dort eingesetzt, sofern ausreichend Platz vorhanden ist.

Normale DIN-Geräte orientieren sich an TE. Reihenklemmen und bestimmte Komponenten können mit mm-Breiten arbeiten.

## 6. Geräte auswählen und bearbeiten

Ein Klick auf ein Gerät in der Planung oder auf die entsprechende Zeile der Elementliste wählt es aus.

Je nach Gerät stehen rechts unter anderem folgende Eigenschaften zur Verfügung:

- **Bezeichnung**
- **Technische Angabe**
- **Breite in TE** oder **Breite in mm**
- **RCD-Gruppe**
- **Phase**
- **Eingang von**
- **Ausgang zu**

Zusätzlich können Geräte dupliziert oder gelöscht werden.

### Benutzerdefiniertes Gerät
Das benutzerdefinierte Gerät dient als Platzhalter für Komponenten, die nicht als eigener Typ in der Bibliothek vorhanden sind. Seine Breite kann in **0,5-TE-Schritten** angepasst werden.

## 7. Stromschienen je Reihe

Jede Reihe besitzt eine eigene Einstellung für die Stromschiene:

- **Keine** – die Reihe hat keine automatisch ausgewertete Phasenschiene.
- **1-phasig** – die Reihe wird einer einzelnen Phase zugeordnet.
- **3-phasig** – die Phase wird entsprechend der Schienenfolge über die Positionen verteilt.

Die Stromschiene wird grafisch **unterhalb der Geräte** dargestellt.

Diese Einstellung ist wichtig, weil nur eine tatsächlich definierte Stromschiene für die automatische Phasenzuordnung verwendet werden soll. Eine reine Hutschiene ohne Sammelschiene erzeugt daher keine künstliche Phasenbindung.

## 8. Phasen und RCD-Gruppen

### Phase
Für geeignete Geräte kann eine Phase fest vorgegeben oder automatisch bestimmt werden.

### RCD-Gruppe
Eine RCD-Gruppe verbindet logisch zusammengehörige Schutz- und Abgangsgeräte. Wird die Gruppe leer gelassen, kann der Planer vorhandene Zuordnungen automatisch verwenden.

Der Planer unterstützt auch bewusst gedrehte Phasenfolgen hinter einem RCD. Entscheidend ist die tatsächlich logisch zugeführte Phase, nicht nur die Beschriftung des physischen RCD-Anschlusses.

Beispiel:

- RCD A: 1-2-3
- RCD B: 2-3-1
- RCD C: 3-1-2

Dadurch können einphasige Abgänge über mehrere RCD-Gruppen verteilt werden.

## 9. Logische Verdrahtung

Die Verdrahtung wird über die Eigenschaften der Geräte festgelegt.

### Grundprinzip
Ein Gerät kann einen oder mehrere Eingänge besitzen und seine Leiter bzw. Phasen an nachfolgende Geräte weitergeben.

Typische Kette:

**Zuleitung → Schalter/HLAK → RCD → LS → Reihenklemme/Verbraucher**

### HLAK
Hauptleitungs-Abzweigklemmen können einen Leiter auf mehrere Abgänge verteilen. Bei mehrpoligen HLAK bleibt die Leiteridentität erhalten.

### RCD
Ein 4-poliger RCD besitzt physische Anschlüsse L1/L2/L3/N. Die tatsächlich am jeweiligen Anschluss anliegende Phase wird logisch weitergegeben. Dadurch bleibt eine bewusst verdrehte Phasenfolge erhalten.

### Leitungsschutzschalter
Einphasige LS führen einen Außenleiter weiter. Dreipolige LS werden als zusammengehörige Einheit behandelt und führen L1/L2/L3 getrennt weiter.

### Neutralleiter und Schutzleiter
N und PE werden unabhängig vom Außenleiterpfad behandelt:

- **N** wird nicht aus einem LS erzeugt, sondern aus dem zugehörigen Neutralleiterpfad, gegebenenfalls über den RCD.
- **PE** läuft unabhängig von RCD und LS über den Schutzleiterpfad.

## 10. Reihenklemmen

L/N/PE-Reihenklemmen bilden die drei Potentiale getrennt ab.

Im Stromlaufplan gilt:

- Außenleiter → LS → **L-Anschluss** der Klemme
- Neutralleiter → RCD-N bzw. N-Potential → **N-Anschluss**
- Schutzleiter → PE-Potential → **PE-Anschluss**

Dadurch bleibt im Stromlaufplan sichtbar, wo jedes Potential tatsächlich herkommt.

## 11. Detailansicht Hutschiene

Die Detailansicht zeigt die aktuell ausgewählte Reihe vergrößert.

Sie ist besonders hilfreich für:

- Reihenklemmen dicht aneinander setzen
- kleine Positionskorrekturen
- Kontrolle von mm-basierten Breiten
- Auswahl einzelner Geräte in stark belegten Reihen

## 12. Elementliste

Die Elementliste wird automatisch aus der Planung erzeugt und nach

**Feld → Reihe → Position**

sortiert.

Sie zeigt unter anderem:

- Position
- Gerät
- Phase
- Bezeichnung
- Eingang
- Ausgang

Ein Klick auf einen Listeneintrag wählt das entsprechende Gerät im Plan aus.

## 13. Stückliste

Die Stückliste fasst die verwendeten Komponenten herstellerneutral zusammen.

Ziel ist eine Mengenübersicht nach Funktion, nicht die Vorgabe eines bestimmten Herstellers oder Produktkatalogs.

Die Stückliste kann zusätzlich als **CSV** exportiert werden.

## 14. Logikplan

Der Logikplan wird automatisch aus den definierten Verbindungen erzeugt.

Er zeigt primär die funktionalen Beziehungen zwischen den Komponenten und eignet sich zur Kontrolle, ob die gewünschten Ein- und Ausgänge korrekt miteinander verknüpft wurden.

## 15. Stromlaufplan

Der Stromlaufplan wird potentialorientiert erzeugt.

Dargestellt werden getrennt:

- L1
- L2
- L3
- N
- PE

Bei dreipoligen Abgängen verlaufen die drei Außenleiter getrennt durch die drei LS-Pole. N und PE werden separat geführt.

Der Stromlaufplan eignet sich besonders als digitale Dokumentation der geplanten logischen Verdrahtung.

## 16. Bestand aufnehmen

Der HV-Planer eignet sich ausdrücklich auch zur Dokumentation vorhandener Verteilungen.

Eine sinnvolle Arbeitsweise ist:

1. Foto bzw. vorhandene Belegung aufnehmen.
2. Feldanzahl, Reihen und TE nachbilden.
3. Vorhandene Komponenten möglichst positionsgetreu eintragen.
4. Benutzerdefinierte Geräte verwenden, wenn ein exakter Gerätetyp fehlt.
5. Stromschienen nur dort aktivieren, wo tatsächlich eine entsprechende Schiene vorhanden ist.
6. Vorhandene Verdrahtung logisch zuordnen.
7. Freie Plätze und Reserven beurteilen.
8. Erweiterung planen.
9. Stromlaufplan und Stückliste kontrollieren.

So lässt sich vermeiden, eine Erweiterung nur nach Gefühl zu dimensionieren.

## 17. Projekt speichern

Mit **Plan speichern** wird eine JSON-Datei erzeugt. Der Projektname dient als Grundlage für den Dateinamen und kann beim Speichern angepasst werden.

Gespeichert werden unter anderem:

- Projektname
- Feld-/Reihenkonfiguration
- Geräte und Positionen
- Beschriftungen
- Breiten
- Phasen
- RCD-Gruppen
- logische Verdrahtungen
- Stromschienen-Einstellungen
- Ansichtsgröße
- Einstellung „Zur Auswahl springen“

## 18. Projekt laden

Über **Plan laden** kann eine zuvor gespeicherte JSON-Datei wieder geöffnet werden.

Ältere Projekte werden soweit möglich migriert. Bei sehr alten Projektständen empfiehlt es sich, insbesondere Phasen- und Verdrahtungszuordnungen nach dem Laden kurz zu kontrollieren.

## 19. Empfohlener Arbeitsablauf

Für neue oder bestehende Anlagen hat sich folgende Reihenfolge bewährt:

1. **Geometrie anlegen** – Felder, Reihen, TE.
2. **Vorhandene bzw. geplante Geräte setzen.**
3. **Stromschienen je Reihe definieren.**
4. **Bezeichnungen und technische Angaben ergänzen.**
5. **RCD-Gruppen und Phasen prüfen.**
6. **Logische Verdrahtung festlegen.**
7. **Elementliste kontrollieren.**
8. **Logikplan prüfen.**
9. **Stromlaufplan prüfen.**
10. **Stückliste erzeugen.**
11. **Projektdatei speichern und gemeinsam mit der restlichen Dokumentation ablegen.**

## 20. Grenzen des HV-Planers

Der HV-Planer ersetzt keine elektrotechnische Ausführungsplanung oder Prüfung. Insbesondere werden nicht automatisch geprüft:

- Normkonformität
- Selektivität
- Kurzschlussstrom
- Abschaltbedingungen
- Leitungsquerschnitte
- Spannungsfall
- Erwärmung
- Herstellerfreigaben
- zulässige Klemmenbelegung
- Netzform oder Schutzkonzept

Der Schwerpunkt liegt auf **Platzbedarf, Übersicht, logischer Zuordnung und nachvollziehbarer Dokumentation**.


## Bestand / Neu, Undo und Plausibilitätscheck

Über **Einfügen als** wird festgelegt, ob neu gesetzte Elemente zunächst als **Bestand** oder **Neu** markiert werden. Der Status kann anschließend in den Eigenschaften geändert werden. Neu markierte Geräte erhalten einen grünen Rand bzw. Marker. In der Stückliste kann mit **nur Neu** ausschließlich der geplante Zukauf angezeigt und exportiert werden.

**Rückgängig / Wiederholen** steht über die Toolbar sowie Strg+Z / Strg+Y (alternativ Strg+Umschalt+Z) zur Verfügung. Strg+D dupliziert das ausgewählte Gerät.

Der **Plausibilitätscheck** weist auf offene Klemmen, ungültige Verweise und ungenutzte Abgänge hin. Er bewertet ausschließlich das logische Modell und ersetzt keine Norm-, Schutz- oder Ausführungsprüfung.
