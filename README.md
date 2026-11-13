# HV-Planer Server

Server edition of **HV-Planer** (browser-based fuse box / distribution board documentation) with

- **OIDC login built into the application** (Authorization Code + PKCE, state, nonce)
- **SQLite storage** (Node's built-in `node:sqlite`, no native dependencies)
- plan list, **autosave**, **version history** with restore, and conflict detection

The planner itself (frontend) is HV-Planer V6.66 by its upstream author. `web/` is generated from the
unmodified upstream files by `tools/patch_frontend.py`; nothing in the upstream code is edited by hand.

> **License:** the upstream planner is only published as "free to use". Do not redistribute the patched
> planner without asking the upstream author. The server code (`server/`, `tools/`, `deploy/`) is separate from that.

## Quick start (local, no OIDC)

```bash
cd server && npm ci
APP_URL=http://localhost:8080 AUTH_DISABLED=true npm start
```

`AUTH_DISABLED=true` is for development only – there is no login at all in that mode.

## Running with OIDC

1. Create a client in your identity provider with the redirect URI **`<APP_URL>/api/auth/oidc/callback`**.
   Without a client secret the client is treated as a public client (PKCE only).
2. Set the environment variables (see `.env.example`). Required: `APP_URL`, `SESSION_SECRET` (≥ 32 chars),
   `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`.
3. Build the image (`docker build -t hv-planer .`) and run it with a volume on `/data`.
   A Kubernetes example is in `deploy/k8s.example.yaml`.

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | – | Public URL of the app, no trailing slash |
| `SESSION_SECRET` | – | Signs session cookies, at least 32 characters |
| `OIDC_ISSUER_URL` | – | Issuer URL (discovery via `/.well-known/openid-configuration`) |
| `OIDC_CLIENT_ID` | – | Client ID |
| `OIDC_CLIENT_SECRET` | – | Empty = public client; otherwise `client_secret_post` |
| `OIDC_PROVIDER_NAME` | `OIDC Provider` | Label of the login button |
| `OIDC_SCOPES` | `openid email profile` | Requested scopes |
| `SHARE_PLANS` | `false` | `true`: all signed-in users see and edit all plans |
| `SESSION_TTL_HOURS` | `168` | Session lifetime, renewed on activity |
| `HISTORY_KEEP` | `50` | Versions kept per plan |
| `HISTORY_MIN_INTERVAL_MINUTES` | `10` | At most one history version per interval |
| `DB_PATH` | `/data/hv-planer.sqlite` (image) | SQLite file |
| `MAX_BODY_MB` | `5` | Maximum plan size |
| `PORT` | `8080` | Listen port |

Who may sign in is controlled by the identity provider (e.g. by assigning the application to users or groups there); the app accepts every user the provider authenticates.

## Login flow

1. `/login` starts `GET /api/auth/oidc/initiate` and redirects to the provider (Authorization Code + PKCE S256,
   state, nonce). State and PKCE verifier are kept server-side in memory; a short-lived cookie additionally
   binds the flow to the browser that started it.
2. The provider calls `GET /api/auth/oidc/callback`. The server redeems the code.
3. The browser is redirected to `/login?code=…` with a **one-time exchange code** (valid for 60 s). The login
   page redeems it via `POST /api/auth/oidc/exchange` and receives the session (HttpOnly cookie).
4. `GET /api/auth/oidc/config` publicly returns `enabled` and `providerName`; `POST /api/auth/logout` ends the session.

The provider must return the `sub` and `email` claims. State is held in memory, so run a single instance;
a restart only aborts logins that are in progress.

## Behavior

- The plan name is the "Projektname" field. The first save creates the plan; afterwards autosave runs ~3 s after
  a change. Ctrl+S saves immediately.
- Two tabs or users: optimistic locking. On conflict, "Save" asks whether to overwrite.
- "Verlauf" (history) in the plan list restores older versions (saved as a new version).
- "Plan speichern/laden" becomes "Export/Import JSON" and keeps working with files.
- Opened via `file://` or without the server, the planner behaves like the original.
- Logging out ends this app's session only, not the session at the identity provider.

## Security

Signed HttpOnly / SameSite=Lax cookies, CSRF protection through a required `X-HV-Client` header on state-changing
requests, open-redirect protection on login, parameterized SQL, plan list rendered via `textContent` (no XSS).
Run behind TLS (an `https://` `APP_URL` enables `Secure` cookies). Run exactly **one** instance (SQLite, in-memory login state).

## Backup

Do not simply copy a live SQLite file: use `sqlite3 /data/hv-planer.sqlite ".backup /backup/hv.sqlite"`,
Litestream, or volume snapshots.

## Updating to a new upstream version

```bash
python3 tools/patch_frontend.py <new-upstream-dir> web
cd server && npm test
```

If an anchor no longer matches, the script aborts with `PATCH-FEHLER` instead of producing a wrong build.

## Tests

`cd server && npm test` – API, end-to-end OIDC login (against `oidc-provider`) and frontend integration (jsdom).
