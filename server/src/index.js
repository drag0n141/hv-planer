import express from "express";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createApiRouter } from "./api.js";
import { setupAuth } from "./auth.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

/** Baut die Express-App. Getrennt von start(), damit Tests sie direkt nutzen können. */
export function createApp(config, log = console) {
  const db = openDb(config.dbPath, {
    historyKeep: config.historyKeep,
    historyMinIntervalMs: config.historyMinIntervalMs,
  });
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", true);

  app.use((_req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    });
    next();
  });

  // Ohne Anmeldung erreichbar: Health-Check für Kubernetes
  app.get("/healthz", (_req, res) => {
    try {
      db.raw.prepare("SELECT 1").get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const { requireAuth } = setupAuth(app, config, log);

  // Alles Weitere erfordert eine Sitzung
  app.use(requireAuth);
  app.use("/api", createApiRouter(db, config));

  // Neue Oberfläche (Single-Page-App) unter /v2. Dateien mit Hash im Namen dürfen
  // dauerhaft gecacht werden, alle übrigen Pfade liefern die Startseite.
  const appIndex = path.join(config.appDir, "index.html");
  app.use(
    "/v2",
    express.static(config.appDir, {
      index: false,
      redirect: false,
      setHeaders(res, file) {
        res.set("Cache-Control", file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
      },
    })
  );
  app.get(/^\/v2(\/.*)?$/, (req, res) => {
    if (req.path.startsWith("/v2/assets/")) return res.status(404).type("text/plain").send("Not found");
    if (!fs.existsSync(appIndex)) {
      return res.status(503).type("text/plain").send("Die neue Oberfläche ist nicht gebaut (cd app && npm run build).");
    }
    res.set("Cache-Control", "no-cache").sendFile(appIndex);
  });
  app.use(
    express.static(config.webDir, {
      index: "index.html",
      setHeaders(res, file) {
        res.set("Cache-Control", "no-cache");
        // Anleitung & Changelog im Browser anzeigen statt herunterladen
        if (file.endsWith(".md")) res.type("text/plain; charset=utf-8");
      },
    })
  );

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) log.error?.("Fehler:", err.stack || err.message);
    if (req.path.startsWith("/api/")) {
      return res.status(status).json({ error: status === 413 ? "payload too large" : status >= 500 ? "internal error" : err.message });
    }
    res.status(status).type("text/plain").send(status >= 500 ? "Interner Fehler" : err.message);
  });

  return { app, db };
}

export function start(env = process.env) {
  const config = loadConfig(env);
  const { app, db } = createApp(config);

  if (config.authDisabled) {
    console.warn("WARNUNG: AUTH_DISABLED=true – keine Anmeldung! Nur für lokale Entwicklung verwenden.");
  }

  const server = app.listen(config.port, () => {
    console.log(`HV-Planer-Server läuft auf Port ${config.port} (Web: ${path.resolve(config.webDir)}, DB: ${config.dbPath})`);
  });
  const shutdown = () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    start();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
