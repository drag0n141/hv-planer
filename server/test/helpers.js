import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../src/index.js";
import { loadConfig } from "../src/config.js";
import { sign } from "../src/session.js";

export const SECRET = "s".repeat(48);

export function makeWebDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hv-web-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>HV</title>");
  fs.writeFileSync(path.join(dir, "ANLEITUNG.md"), "# Anleitung\n");
  return dir;
}

export async function startApp(extraEnv = {}, { quiet = true } = {}) {
  const webDir = makeWebDir();
  const config = loadConfig({
    BASE_URL: "http://localhost:3000",
    OIDC_ISSUER: "http://idp.invalid",
    OIDC_CLIENT_ID: "hv",
    OIDC_CLIENT_SECRET: "secret",
    SESSION_SECRET: SECRET,
    DB_PATH: ":memory:",
    WEB_DIR: webDir,
    HISTORY_MIN_INTERVAL_MINUTES: "0",
    ...extraEnv,
  });
  const silent = quiet ? { warn() {}, error() {}, log() {} } : console;
  const { app, db } = createApp(config, silent);
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    config,
    db,
    close: () => new Promise((resolve) => server.close(() => (db.close(), resolve()))),
  };
}

export function sessionCookie(sub, name = sub, { secret = SECRET, expOffset = 3600 } = {}) {
  const token = sign(
    { t: "session", sub, name, email: `${sub}@example.com`, exp: Math.floor(Date.now() / 1000) + expOffset },
    secret
  );
  return `hv_session=${encodeURIComponent(token)}`;
}

/** Kleiner JSON-Client mit Cookie und Pflicht-Header. */
export function client(base, cookie) {
  return async (method, url, body, extraHeaders = {}) => {
    const headers = { "X-HV-Client": "1", ...extraHeaders };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(base + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    let json = null;
    try {
      json = await res.clone().json();
    } catch {
      /* kein JSON */
    }
    return { status: res.status, json, res };
  };
}

export const samplePlan = (extra = {}) => ({
  version: "6.66",
  projectName: "Test",
  fields: 2,
  rows: 5,
  te: 12,
  devices: [],
  nextId: 1,
  ...extra,
});
