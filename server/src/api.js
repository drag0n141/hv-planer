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

  // Zugriff: nur eigene Pläne, außer SHARE_PLANS=true.
  const visible = (plan, user) => plan && (config.sharePlans || plan.owner === user.sub);
  const meta = (p, user) => ({
    id: p.id,
    name: p.name,
    version: p.version,
    updated_at: p.updated_at,
    updated_by: p.updated_by ?? null,
    owner_name: p.owner_name ?? null,
    mine: p.owner === user.sub,
  });

  function loadPlan(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    const plan = Number.isInteger(id) ? db.getPlan(id) : null;
    if (!visible(plan, req.user)) {
      res.status(404).json({ error: "not found" });
      return null;
    }
    return plan;
  }

  r.get("/me", (req, res) => {
    res.json({ name: req.user.name, email: req.user.email, sharePlans: config.sharePlans });
  });

  r.get("/plans", (req, res) => {
    res.json(db.listPlans(req.user.sub, config.sharePlans).map((p) => meta(p, req.user)));
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
    res.json({ ...meta(plan, req.user), data: JSON.parse(plan.data) });
  });

  r.put("/plans/:id", (req, res) => {
    const plan = loadPlan(req, res);
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
    const plan = loadPlan(req, res);
    if (!plan) return;
    db.deletePlan(plan.id);
    res.json({ ok: true });
  });

  r.get("/plans/:id/history", (req, res) => {
    const plan = loadPlan(req, res);
    if (!plan) return;
    res.json(db.listHistory(plan.id));
  });

  r.get("/plans/:id/history/:hid", (req, res) => {
    const plan = loadPlan(req, res);
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

  // Unbekannte API-Pfade: JSON statt HTML
  r.use((_req, res) => res.status(404).json({ error: "not found" }));
  return r;
}
