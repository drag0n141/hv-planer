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

# ---------- styles.css ----------
css = (src / "styles.css").read_text(encoding="utf-8").rstrip("\n") + "\n" + (frag / "server.css").read_text(encoding="utf-8")

dst.mkdir(parents=True, exist_ok=True)
(dst / "app.js").write_text(body, encoding="utf-8")
(dst / "index.html").write_text(html, encoding="utf-8")
(dst / "styles.css").write_text(css, encoding="utf-8")
for name in ["components.js", "ANLEITUNG.md", "CHANGELOG.md", "README.md", "RELEASE-NOTES.md"]:
    shutil.copyfile(src / name, dst / name)
print("web/ erzeugt:", dst)
