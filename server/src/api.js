import express from "express";
import { requireClientHeader } from "./auth.js";

const MAX_NAME = 120;

/** Prüft die Plan-Nutzlast grob; die Fachlogik bleibt im Frontend. */
function parsePayload(body) {
  const name = String(body?.name ?? "").trim().slice(0, MAX_NAME) || "Unbenannter Plan";
  const data = body?.data;
  if (!data || typeof data !== "object" || Array.isArray(data) || !Array.isArray(data.devices)) {
    return { error: "data muss ein Planobjekt mit devices-Liste sein" };
  }
  return { name, data: JSON.stringify(data) };
}

export function createApiRouter(db, config) {
  const r = express.Router();
  r.use(express.json({ limit: config.maxBodyBytes }));
  r.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") return requireClientHeader(req, res, next);
    next();
  });

  // Nutzer merken, damit sie als Freigabe-Ziel auswählbar sind
  r.use((req, _res, next) => {
    db.upsertUser({ sub: req.user.sub, name: req.user.name, email: req.user.email });
    next();
  });

  const meta = (p, user) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    updated_at: p.updated_at,
    updated_by: p.updated_by ?? null,
    owner_name: p.owner_name ?? null,
    mine: p.owner === user.sub,
    permission: p.owner === user.sub ? "owner" : (p.share_permission ?? db.getAccess(p, user.sub)),
  });

  const RANK = { viewer: 1, editor: 2, owner: 3 };
  const NEED = { read: 1, write: 2, owner: 3 };

  /** Lädt den Plan und prüft die Berechtigung. Fremde Pläne wirken wie nicht vorhanden (404). */
  function loadPlan(req, res, need = "read") {
    const id = Number.parseInt(req.params.id, 10);
    const plan = Number.isInteger(id) ? db.getPlan(id) : null;
    const access = db.getAccess(plan, req.user.sub);
    if (!access) {
      res.status(404).json({ error: "not found" });
      return null;
    }
    if (RANK[access] < NEED[need]) {
      res.status(403).json({ error: "forbidden" });
      return null;
    }
    plan.access = access;
    return plan;
  }

  r.get("/me", (req, res) => {
    res.json({ sub: req.user.sub, name: req.user.name, email: req.user.email });
  });

  // Auswählbare Nutzer für Freigaben (alle, die sich schon angemeldet haben, außer man selbst)
  r.get("/users", (req, res) => {
    res.json(db.searchUsers(req.user.sub, req.query.q));
  });

  r.get("/plans", (req, res) => {
    res.json(db.listPlans(req.user.sub).map((p) => meta(p, req.user)));
  });

  r.post("/plans", (req, res) => {
    const p = parsePayload(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    const created = db.createPlan({ owner: req.user.sub, ownerName: req.user.name, name: p.name, data: p.data });
    res.status(201).json(created);
  });

  r.get("/plans/:id", (req, res) => {
    const plan = loadPlan(req, res);
    if (!plan) return;
    res.json({ ...meta({ ...plan, share_permission: null }, req.user), permission: plan.access, data: JSON.parse(plan.data) });
  });

  r.put("/plans/:id", (req, res) => {
    const plan = loadPlan(req, res, "write");
    if (!plan) return;
    const p = parsePayload(req.body);
    if (p.error) return res.status(400).json({ error: p.error });
    const expected = Number(req.body?.version);
    if (!Number.isInteger(expected)) return res.status(400).json({ error: "version fehlt" });
    const result = db.updatePlan({
      id: plan.id,
      name: p.name,
      data: p.data,
      expectedVersion: expected,
      editorName: req.user.name,
    });
    if (result.status === "conflict") {
      return res.status(409).json({ error: "conflict", version: result.version, updated_at: result.updated_at });
    }
    if (result.status === "missing") return res.status(404).json({ error: "not found" });
    res.json({ id: plan.id, version: result.version, updated_at: result.updated_at });
  });

  r.delete("/plans/:id", (req, res) => {
    const plan = loadPlan(req, res, "owner");
    if (!plan) return;
    db.deletePlan(plan.id);
    res.json({ ok: true });
  });

  r.get("/plans/:id/history", (req, res) => {
    const plan = loadPlan(req, res, "write");
    if (!plan) return;
    res.json(db.listHistory(plan.id));
  });

  r.get("/plans/:id/history/:hid", (req, res) => {
    const plan = loadPlan(req, res, "write");
    if (!plan) return;
    const entry = db.getHistory(plan.id, Number.parseInt(req.params.hid, 10));
    if (!entry) return res.status(404).json({ error: "not found" });
    res.json({
      id: entry.id,
      version: entry.version,
      name: entry.name,
      saved_by: entry.saved_by,
      saved_at: entry.saved_at,
      data: JSON.parse(entry.data),
    });
  });

  // ----- Freigaben (Betrachter / Bearbeiter), nur der Besitzer verwaltet sie -----
  r.get("/plans/:id/shares", (req, res) => {
    const plan = loadPlan(req, res, "owner");
    if (!plan) return;
    res.json(db.listShares(plan.id));
  });

  r.put("/plans/:id/shares/:sub", (req, res) => {
    const plan = loadPlan(req, res, "owner");
    if (!plan) return;
    const sub = String(req.params.sub);
    const permission = req.body?.permission;
    if (!["viewer", "editor"].includes(permission)) return res.status(400).json({ error: "permission muss viewer oder editor sein" });
    if (sub === plan.owner) return res.status(400).json({ error: "Der Besitzer hat bereits vollen Zugriff." });
    if (!db.getUser(sub)) return res.status(404).json({ error: "Nutzer unbekannt" });
    db.setShare(plan.id, sub, permission);
    res.json(db.listShares(plan.id));
  });

  // Besitzer entzieht eine Freigabe; Empfänger können sich selbst entfernen („Verlassen“)
  r.delete("/plans/:id/shares/:sub", (req, res) => {
    const plan = loadPlan(req, res, "read");
    if (!plan) return;
    const sub = String(req.params.sub);
    if (plan.access !== "owner" && sub !== req.user.sub) return res.status(403).json({ error: "forbidden" });
    if (!db.removeShare(plan.id, sub)) return res.status(404).json({ error: "not found" });
    res.json({ ok: true });
  });

  // Unbekannte API-Pfade: JSON statt HTML
  r.use((_req, res) => res.status(404).json({ error: "not found" }));
  return r;
}
