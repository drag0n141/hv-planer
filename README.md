# HV-Planer Server

Server-Variante des **HV-Planer** (Schaltschrank-/Verteilerdokumentation im Browser) mit

- **OIDC-Anmeldung in der Anwendung selbst** (Authorization Code + PKCE, State/Nonce)
- **SQLite-Speicher** (Node-eingebautes `node:sqlite`, keine native Abhängigkeit)
- Planliste, **Autosave**, **Versionsverlauf** mit Wiederherstellen, Konflikterkennung

Der Planer selbst (Frontend) stammt von „Marcel“ (HV-Planer V6.66). `web/` wird per
`tools/patch_frontend.py` aus den Originaldateien erzeugt; am Original ist nichts von Hand geändert.

> **Lizenz:** Der Upstream-Planer steht nur unter „Kostenlos nutzbar“. Dieses Repo nicht öffentlich
> machen und den gepatchten Planer nicht weitergeben, ohne den Autor zu fragen. Der Servercode
> (`server/`, `tools/`, `deploy/`) ist davon getrennt.

## Schnellstart (lokal, ohne OIDC)

```bash
cd server && npm ci
BASE_URL=http://localhost:8080 AUTH_DISABLED=true SESSION_SECRET=$(openssl rand -hex 32) \
OIDC_ISSUER=http://unused OIDC_CLIENT_ID=x OIDC_CLIENT_SECRET=x npm start
```
`AUTH_DISABLED=true` nur für Entwicklung – es gibt dann keine Anmeldung.

## Betrieb mit OIDC

1. Im Identity Provider einen Client anlegen, Redirect-URI: **`<BASE_URL>/auth/callback`**.
2. Env-Variablen setzen (siehe `.env.example`), Pflicht: `BASE_URL`, `SESSION_SECRET` (≥ 32 Zeichen),
   `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`.
3. Image bauen (`docker build -t hv-planer .`) und mit Volume auf `/data` starten.
   Beispiel für Kubernetes: `deploy/k8s.example.yaml`.

| Variable | Standard | Bedeutung |
|---|---|---|
| `OIDC_AUTH_METHOD` | `basic` | `basic`, `post` oder `none` (Public Client, nur PKCE) |
| `OIDC_SCOPES` | `openid profile email` | für Gruppen z. B. `… groups` ergänzen |
| `OIDC_ALLOWED_EMAILS` | – | Komma-Liste; leer = alle angemeldeten Nutzer |
| `OIDC_ALLOWED_GROUPS` | – | Komma-Liste, geprüft gegen `OIDC_GROUPS_CLAIM` (Standard `groups`) |
| `SHARE_PLANS` | `false` | `true`: alle zugelassenen Nutzer sehen/bearbeiten alle Pläne |
| `SESSION_TTL_HOURS` | `168` | Sitzungsdauer, wird bei Aktivität verlängert |
| `HISTORY_KEEP` | `50` | aufbewahrte Versionen je Plan |
| `HISTORY_MIN_INTERVAL_MINUTES` | `10` | höchstens alle X Minuten eine neue Verlaufsversion |
| `DB_PATH` | `/data/hv-planer.sqlite` (Image) | SQLite-Datei |
| `MAX_BODY_MB` | `5` | maximale Plangröße |

Ohne `OIDC_ALLOWED_EMAILS`/`OIDC_ALLOWED_GROUPS` kommt **jeder**, der sich beim IdP anmelden kann, hinein.
Beim Start gibt der Server dazu eine Warnung aus.

## Verhalten

- Plan = Feld „Projektname“. Erstes Speichern legt den Plan an, danach Autosave (~3 s nach Änderung), Strg+S speichert sofort.
- Zwei Tabs/Nutzer: optimistische Sperre; bei Konflikt fragt „Speichern“, ob überschrieben werden soll.
- „Verlauf“ in der Planliste stellt ältere Versionen wieder her (wird als neue Version gespeichert).
- „Plan speichern/laden“ heißt dann „Export/Import JSON“ und arbeitet weiter mit Dateien.
- Öffnet man den Planer per `file://` oder ohne Server, funktioniert er wie das Original.
- Abmelden beendet nur die Sitzung dieser App, nicht die beim IdP (kein RP-initiated Logout).

## Sicherheit

Signierte HttpOnly/SameSite=Lax-Cookies, CSRF-Schutz über Pflicht-Header `X-HV-Client` bei schreibenden
Requests, Open-Redirect-Schutz beim Login, parametrisierte SQL-Abfragen, Planliste per `textContent` (kein XSS).
Hinter TLS betreiben (`BASE_URL` mit `https://` aktiviert `Secure`-Cookies). Es läuft **ein** Pod (SQLite).

## Backup

SQLite im Betrieb nicht einfach kopieren: `sqlite3 /data/hv-planer.sqlite ".backup /backup/hv.sqlite"`
oder Litestream; alternativ Volume-Snapshots.

## Upstream-Update einspielen

```bash
python3 tools/patch_frontend.py <neues-upstream-verzeichnis> web
cd server && npm test
```
Passt eine Stelle nicht mehr, bricht das Skript mit „PATCH-FEHLER“ ab.

## Tests

`cd server && npm test` – API, OIDC-Ende-zu-Ende (gegen `oidc-provider`) und Frontend-Integration (jsdom).
