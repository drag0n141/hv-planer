import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { BUILTIN_CATALOG } from "./catalog-builtin.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS plans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  owner      TEXT    NOT NULL,
  owner_name TEXT,
  name       TEXT    NOT NULL,
  data       TEXT    NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL,
  updated_by TEXT
);
CREATE INDEX IF NOT EXISTS plans_owner ON plans(owner);

CREATE TABLE IF NOT EXISTS plan_history (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id  INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version  INTEGER NOT NULL,
  name     TEXT    NOT NULL,
  data     TEXT    NOT NULL,
  saved_by TEXT,
  saved_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS plan_history_plan ON plan_history(plan_id, id);

CREATE TABLE IF NOT EXISTS users (
  sub        TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL DEFAULT '',
  last_seen  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plan_shares (
  plan_id    INTEGER NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  user_sub   TEXT    NOT NULL,
  permission TEXT    NOT NULL CHECK (permission IN ('viewer', 'editor')),
  created_at TEXT    NOT NULL,
  PRIMARY KEY (plan_id, user_sub)
);
CREATE INDEX IF NOT EXISTS plan_shares_user ON plan_shares(user_sub);

CREATE TABLE IF NOT EXISTS catalog (
  id         TEXT PRIMARY KEY,
  builtin    INTEGER NOT NULL DEFAULT 0,
  hidden     INTEGER NOT NULL DEFAULT 0,
  sort       INTEGER NOT NULL DEFAULT 0,
  def        TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);
`;

/** Planformat: 1 = bisheriger HV-Planer (V6), 2 = neue Oberfläche. */
export const planSchema = (data) => (data?.schema === 2 ? 2 : 1);

/**
 * Öffnet (und legt bei Bedarf an) die SQLite-Datenbank.
 * Alle Schreibzugriffe laufen über kurze, sofort gesperrte Transaktionen.
 */
export function openDb(dbPath, { historyKeep = 50, historyMinIntervalMs = 600_000 } = {}) {
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  // Nachträglich ergänzte Spalte (Datenbanken aus Version 1.x)
  if (!db.prepare("PRAGMA table_info(plans)").all().some((c) => c.name === "schema")) {
    db.exec("ALTER TABLE plans ADD COLUMN schema INTEGER NOT NULL DEFAULT 1");
  }

  const q = {
    insert: db.prepare(
      `INSERT INTO plans (owner, owner_name, name, data, schema, version, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`
    ),
    get: db.prepare("SELECT * FROM plans WHERE id = ?"),
    list: db.prepare(
      `SELECT p.id, p.name, p.version, p.schema, p.owner, p.owner_name, p.updated_at, p.updated_by, s.permission AS share_permission
         FROM plans p LEFT JOIN plan_shares s ON s.plan_id = p.id AND s.user_sub = ?
        WHERE p.owner = ? OR s.user_sub IS NOT NULL
        ORDER BY p.updated_at DESC, p.id DESC`
    ),
    sharePermission: db.prepare("SELECT permission FROM plan_shares WHERE plan_id = ? AND user_sub = ?"),
    listShares: db.prepare(
      `SELECT s.user_sub AS sub, COALESCE(u.name, s.user_sub) AS name, COALESCE(u.email, '') AS email, s.permission, s.created_at
         FROM plan_shares s LEFT JOIN users u ON u.sub = s.user_sub
        WHERE s.plan_id = ? ORDER BY name COLLATE NOCASE`
    ),
    upsertShare: db.prepare(
      `INSERT INTO plan_shares (plan_id, user_sub, permission, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(plan_id, user_sub) DO UPDATE SET permission = excluded.permission`
    ),
    delShare: db.prepare("DELETE FROM plan_shares WHERE plan_id = ? AND user_sub = ?"),
    getUser: db.prepare("SELECT sub, name, email FROM users WHERE sub = ?"),
    upsertUser: db.prepare(
      `INSERT INTO users (sub, name, email, last_seen) VALUES (?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET name = excluded.name, email = excluded.email, last_seen = excluded.last_seen
       WHERE users.name <> excluded.name OR users.email <> excluded.email OR users.last_seen < ?`
    ),
    searchUsers: db.prepare(
      `SELECT sub, name, email FROM users
        WHERE sub <> ? AND (name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\')
        ORDER BY name COLLATE NOCASE LIMIT 20`
    ),
    update: db.prepare(
      `UPDATE plans SET name = ?, data = ?, schema = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?`
    ),
    del: db.prepare("DELETE FROM plans WHERE id = ?"),
    lastHistory: db.prepare("SELECT saved_at FROM plan_history WHERE plan_id = ? ORDER BY id DESC LIMIT 1"),
    addHistory: db.prepare(
      `INSERT INTO plan_history (plan_id, version, name, data, saved_by, saved_at) VALUES (?, ?, ?, ?, ?, ?)`
    ),
    pruneHistory: db.prepare(
      `DELETE FROM plan_history WHERE plan_id = ? AND id NOT IN
         (SELECT id FROM plan_history WHERE plan_id = ? ORDER BY id DESC LIMIT ?)`
    ),
    listHistory: db.prepare(
      `SELECT id, version, name, saved_by, saved_at FROM plan_history WHERE plan_id = ? ORDER BY id DESC`
    ),
    getHistory: db.prepare("SELECT * FROM plan_history WHERE id = ? AND plan_id = ?"),
    catalogAll: db.prepare("SELECT * FROM catalog ORDER BY builtin DESC, sort, id"),
    catalogGet: db.prepare("SELECT * FROM catalog WHERE id = ?"),
    catalogUpsertBuiltin: db.prepare(
      `INSERT INTO catalog (id, builtin, hidden, sort, def, updated_at) VALUES (?, 1, 0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET builtin = 1, sort = excluded.sort, def = excluded.def,
         updated_at = CASE WHEN catalog.def = excluded.def THEN catalog.updated_at ELSE excluded.updated_at END`
    ),
    catalogInsert: db.prepare("INSERT INTO catalog (id, builtin, hidden, sort, def, updated_at) VALUES (?, 0, ?, 0, ?, ?)"),
    catalogUpdate: db.prepare("UPDATE catalog SET def = ?, hidden = ?, updated_at = ? WHERE id = ? AND builtin = 0"),
    catalogHide: db.prepare("UPDATE catalog SET hidden = ?, updated_at = ? WHERE id = ?"),
    catalogDelete: db.prepare("DELETE FROM catalog WHERE id = ? AND builtin = 0"),
  };

  const entry = (row) => row && { ...JSON.parse(row.def), id: row.id, builtin: row.builtin === 1, hidden: row.hidden === 1 };

  function tx(fn) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const r = fn();
      db.exec("COMMIT");
      return r;
    } catch (e) {
      try {
        db.exec("ROLLBACK");
      } catch {
        /* Transaktion war bereits beendet */
      }
      throw e;
    }
  }

  // Eingebauten Grundkatalog abgleichen: neue und geänderte Einträge übernehmen,
  // entfallene entfernen. "Ausgeblendet" und eigene Geräte bleiben unberührt.
  tx(() => {
    const now = new Date().toISOString();
    const ids = new Set();
    BUILTIN_CATALOG.forEach((def, i) => {
      const { id, ...rest } = def;
      ids.add(id);
      q.catalogUpsertBuiltin.run(id, i, JSON.stringify(rest), now);
    });
    for (const row of q.catalogAll.all()) {
      if (row.builtin === 1 && !ids.has(row.id)) db.prepare("DELETE FROM catalog WHERE id = ?").run(row.id);
    }
  });

  return {
    raw: db,
    close: () => db.close(),

    // ----- Gerätekatalog -----
    listCatalog: () => q.catalogAll.all().map(entry),
    getCatalogEntry: (id) => entry(q.catalogGet.get(id)) ?? null,
    createCatalogEntry(id, def, hidden = false) {
      q.catalogInsert.run(id, hidden ? 1 : 0, JSON.stringify(def), new Date().toISOString());
      return entry(q.catalogGet.get(id));
    },
    /** Nur eigene Geräte; eingebaute lassen sich lediglich ausblenden. */
    updateCatalogEntry(id, def, hidden) {
      q.catalogUpdate.run(JSON.stringify(def), hidden ? 1 : 0, new Date().toISOString(), id);
      return entry(q.catalogGet.get(id));
    },
    setCatalogHidden(id, hidden) {
      q.catalogHide.run(hidden ? 1 : 0, new Date().toISOString(), id);
      return entry(q.catalogGet.get(id));
    },
    deleteCatalogEntry: (id) => q.catalogDelete.run(id).changes > 0,

    createPlan({ owner, ownerName, name, data, schema = 1 }) {
      const now = new Date().toISOString();
      const r = q.insert.run(owner, ownerName ?? null, name, data, schema, now, now, ownerName ?? null);
      return { id: Number(r.lastInsertRowid), version: 1, updated_at: now };
    },

    getPlan: (id) => q.get.get(id) ?? null,

    /** Eigene Pläne plus Pläne, die mit dem Nutzer geteilt wurden. */
    listPlans: (sub) => q.list.all(sub, sub),

    /** 'owner' | 'editor' | 'viewer' | null */
    getAccess(plan, sub) {
      if (!plan) return null;
      if (plan.owner === sub) return "owner";
      return q.sharePermission.get(plan.id, sub)?.permission ?? null;
    },

    /** Merkt sich angemeldete Nutzer, damit man Pläne mit ihnen teilen kann. */
    upsertUser({ sub, name, email }) {
      const now = new Date();
      const staleBefore = new Date(now.getTime() - 3600_000).toISOString(); // höchstens stündlich schreiben
      q.upsertUser.run(sub, name, email ?? "", now.toISOString(), staleBefore);
    },

    getUser: (sub) => q.getUser.get(sub) ?? null,

    searchUsers(exceptSub, term = "") {
      const esc = String(term).trim().replace(/[\\%_]/g, (c) => "\\" + c);
      const like = `%${esc}%`;
      return q.searchUsers.all(exceptSub, like, like);
    },

    listShares: (planId) => q.listShares.all(planId),
    setShare: (planId, sub, permission) => q.upsertShare.run(planId, sub, permission, new Date().toISOString()),
    removeShare: (planId, sub) => q.delShare.run(planId, sub).changes > 0,

    /**
     * Speichert mit optimistischer Sperre. Liefert
     *  - {status:"ok", version, updated_at}
     *  - {status:"conflict", version, updated_at}
     *  - {status:"missing"}
     * In den Verlauf wandert der VORHERIGE Stand, aber höchstens alle
     * historyMinIntervalMs, damit Autosave den Verlauf nicht flutet.
     */
    updatePlan({ id, name, data, schema = 1, expectedVersion, editorName }) {
      return tx(() => {
        const row = q.get.get(id);
        if (!row) return { status: "missing" };
        if (row.version !== expectedVersion) {
          return { status: "conflict", version: row.version, updated_at: row.updated_at };
        }
        if (row.data === data && row.name === name) {
          return { status: "ok", version: row.version, updated_at: row.updated_at };
        }
        const now = new Date().toISOString();
        const last = q.lastHistory.get(id);
        const ref = Date.parse(last ? last.saved_at : row.created_at);
        if (Date.now() - ref >= historyMinIntervalMs) {
          q.addHistory.run(id, row.version, row.name, row.data, row.updated_by ?? null, row.updated_at);
          q.pruneHistory.run(id, id, historyKeep);
        }
        q.update.run(name, data, schema, now, editorName ?? null, id);
        return { status: "ok", version: row.version + 1, updated_at: now };
      });
    },

    deletePlan: (id) => q.del.run(id).changes > 0,

    listHistory: (id) => q.listHistory.all(id),
    getHistory: (planId, historyId) => q.getHistory.get(historyId, planId) ?? null,
  };
}
