#!/usr/bin/env python3
"""Erzeugt web/ aus den unveränderten HV-Planer-Dateien (Upstream) und bindet die Server-API an.

Aufruf:  python3 tools/patch_frontend.py <upstream-verzeichnis> <ziel-verzeichnis>

Jede Ersetzung muss genau einmal passen, sonst bricht das Skript ab. Ändert Upstream
den Code an diesen Stellen, schlägt der Patch laut fehl, statt still etwas Falsches zu bauen.
"""
import re, shutil, sys
from pathlib import Path

if len(sys.argv) != 3:
    sys.exit(__doc__)
src, dst = Path(sys.argv[1]), Path(sys.argv[2])
frag = Path(__file__).resolve().parent / "frontend"

def sub(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit(f"PATCH-FEHLER: '{label}' passt {n}x (erwartet 1x). Upstream geändert?")
    return text.replace(old, new)

# ---------- app.js ----------
js = (src / "app.js").read_text(encoding="utf-8")

# 1) Payload als Funktion, damit Export und Server dieselben Daten nutzen
m = re.search(r'    const payload=(\{version:"6\.66".*?nextId:state\.nextId\});\n', js)
if not m or js.count(m.group(0)) != 1:
    sys.exit("PATCH-FEHLER: Payload-Zeile nicht gefunden")
js = js.replace(m.group(0), "    const payload=buildPayload();\n")
js = sub(js, "  els.saveBtn.onclick=()=>{\n",
         "  function buildPayload(){return " + m.group(1) + ";}\n  els.saveBtn.onclick=()=>{\n", "saveBtn")

# 2) Laden in eine wiederverwendbare Funktion auslagern
js = sub(js,
 '  els.loadInput.onchange=async()=>{\n    const file=els.loadInput.files[0];if(!file)return;\n    try{\n      const data=JSON.parse(await file.text());state.projectName=String(data.projectName||"");',
 '  function applyLoadedData(data){\n      state.projectName=String(data.projectName||"");', "load-head")
js = sub(js,
 '    }catch(e){console.error(e);alert("Die Datei konnte nicht geladen werden.")}els.loadInput.value="";\n  };',
 '  }\n  els.loadInput.onchange=async()=>{\n    const file=els.loadInput.files[0];if(!file)return;\n    try{applyLoadedData(JSON.parse(await file.text()));server.detach();}catch(e){console.error(e);alert("Die Datei konnte nicht geladen werden.")}els.loadInput.value="";\n  };', "load-tail")

# 3) Zurücksetzen löst die Verknüpfung zum Serverplan (sonst überschreibt Autosave ihn mit leerem Plan)
js = sub(js, 'els.resetBtn.onclick=()=>{if(!confirm("Aktuellen Plan wirklich löschen?"))return;pushHistory("reset");',
         'els.resetBtn.onclick=()=>{if(!confirm("Aktuellen Plan wirklich löschen?"))return;pushHistory("reset");server.detach();', "reset")

# 3b) "Zur Auswahl springen" standardmäßig aus: Beim Einfügen scrollt die Seite sonst jedes Mal zur Geräteliste
js = sub(js, 'autoJump:true,insertStatus:"existing",projectName:""', 'autoJump:false,insertStatus:"existing",projectName:""', "autoJump-default")
js = sub(js, "state.autoJump=data.autoJump!==false", "state.autoJump=data.autoJump===true", "autoJump-load")
js = sub(js, "state.autoJump=true;els.autoJump.checked=true;", "state.autoJump=false;els.autoJump.checked=false;", "autoJump-reset")

# 3c) Reihen innerhalb eines Feldes nach oben/unten tauschen
js = sub(js, "  function renderBoard(){\n", (frag / "row-move.js").read_text(encoding="utf-8") + "  function renderBoard(){\n", "row-move-fn")
js = sub(js, "        phaseSelect.onclick=ev=>ev.stopPropagation();\n        wrap.appendChild(railLabel);",
         "        phaseSelect.onclick=ev=>ev.stopPropagation();\n" + (frag / "row-move-buttons.js").read_text(encoding="utf-8") + "        wrap.appendChild(railLabel);", "row-move-buttons")

# 3d) Touch: Rails bekommen Feld/Reihe als data-Attribute, Geräte lassen sich per langem Drücken ziehen
js = sub(js, 'const rail=document.createElement("div");rail.className="rail";rail.style.width=',
         'const rail=document.createElement("div");rail.className="rail";rail.dataset.field=f;rail.dataset.row=r;rail.style.width=', "rail-data")
js = sub(js, "  function renderBoard(){\n", (frag / "touch-drag.js").read_text(encoding="utf-8") + "  function renderBoard(){\n", "touch-drag-fn")
js = sub(js, "          rail.appendChild(el);\n        });\n\n        railWrap.appendChild(rail);",
         "          attachTouchDrag(el,d);\n          rail.appendChild(el);\n        });\n\n        railWrap.appendChild(rail);", "touch-drag-call")

# 4) Server-Modul vor das abschließende })();
body = js.rstrip()
if not body.endswith("})();"):
    sys.exit("PATCH-FEHLER: app.js endet nicht mit })();")
body = body[: -len("})();")].rstrip("\n") + "\n" + (frag / "server-client.js").read_text(encoding="utf-8") + "})();\n"

# ---------- index.html ----------
html = (src / "index.html").read_text(encoding="utf-8")
html = sub(html, '      <button id="saveBtn">Plan speichern</button>\n',
           (frag / "server-bar.html").read_text(encoding="utf-8") + '      <button id="saveBtn">Plan speichern</button>\n', "html-actions")
html = sub(html, '  <div id="helpModal" class="about-modal" hidden>',
           (frag / "plans-modal.html").read_text(encoding="utf-8") + '  <div id="helpModal" class="about-modal" hidden>', "html-modal")

html = sub(html, '<input id="autoJump" type="checkbox" checked />', '<input id="autoJump" type="checkbox" />', "autoJump-checkbox")

# Upstream erlaubt nur 1-3 Felder; Schränke mit mehr Feldern sind üblich (Auswahl bis 8)
html = sub(html,
           '<option value="1">1</option><option value="2" selected>2</option><option value="3">3</option>',
           '<option value="1">1</option><option value="2" selected>2</option><option value="3">3</option>'
           '<option value="4">4</option><option value="5">5</option><option value="6">6</option>'
           '<option value="7">7</option><option value="8">8</option>', "field-count")

# ---------- styles.css ----------
css = (src / "styles.css").read_text(encoding="utf-8").rstrip("\n") + "\n" + (frag / "server.css").read_text(encoding="utf-8")

dst.mkdir(parents=True, exist_ok=True)
(dst / "app.js").write_text(body, encoding="utf-8")
(dst / "index.html").write_text(html, encoding="utf-8")
(dst / "styles.css").write_text(css, encoding="utf-8")
for name in ["components.js", "ANLEITUNG.md", "CHANGELOG.md", "README.md", "RELEASE-NOTES.md"]:
    shutil.copyfile(src / name, dst / name)
print("web/ erzeugt:", dst)
