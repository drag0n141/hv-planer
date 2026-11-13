import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

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
`;

/**
 * Öffnet (und legt bei Bedarf an) die SQLite-Datenbank.
 * Alle Schreibzugriffe laufen über kurze, sofort gesperrte Transaktionen.
 */
export function openDb(dbPath, { historyKeep = 50, historyMinIntervalMs = 600_000 } = {}) {
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);

  const q = {
    insert: db.prepare(
      `INSERT INTO plans (owner, owner_name, name, data, version, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)`
    ),
    get: db.prepare("SELECT * FROM plans WHERE id = ?"),
    list: db.prepare(
      `SELECT id, name, version, owner, owner_name, updated_at, updated_by
         FROM plans WHERE (? = 1 OR owner = ?) ORDER BY updated_at DESC, id DESC`
    ),
    update: db.prepare(
      `UPDATE plans SET name = ?, data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE id = ?`
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
  };

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

  return {
    raw: db,
    close: () => db.close(),

    createPlan({ owner, ownerName, name, data }) {
      const now = new Date().toISOString();
      const r = q.insert.run(owner, ownerName ?? null, name, data, now, now, ownerName ?? null);
      return { id: Number(r.lastInsertRowid), version: 1, updated_at: now };
    },

    getPlan: (id) => q.get.get(id) ?? null,

    listPlans: (owner, all) => q.list.all(all ? 1 : 0, owner),

    /**
     * Speichert mit optimistischer Sperre. Liefert
     *  - {status:"ok", version, updated_at}
     *  - {status:"conflict", version, updated_at}
     *  - {status:"missing"}
     * In den Verlauf wandert der VORHERIGE Stand, aber höchstens alle
     * historyMinIntervalMs, damit Autosave den Verlauf nicht flutet.
     */
    updatePlan({ id, name, data, expectedVersion, editorName }) {
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
        q.update.run(name, data, now, editorName ?? null, id);
        return { status: "ok", version: row.version + 1, updated_at: now };
      });
    },

    deletePlan: (id) => q.del.run(id).changes > 0,

    listHistory: (id) => q.listHistory.all(id),
    getHistory: (planId, historyId) => q.getHistory.get(historyId, planId) ?? null,
  };
}
