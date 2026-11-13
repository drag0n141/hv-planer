/** Zugriff auf die Server-API. Bei abgelaufener Sitzung geht es zur Anmeldung und danach zurück. */
import type { CatalogEntry, DeviceDef } from "./domain/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: any = null,
  ) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: "same-origin",
      headers: { "X-HV-Client": "1", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Server nicht erreichbar.");
  }
  if (res.status === 401) {
    location.assign(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, "Sitzung abgelaufen.");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, messageFor(res.status, json), json);
  return json as T;
}

function messageFor(status: number, json: any): string {
  if (status === 403) return json?.error === "forbidden" ? "Dafür fehlt dir die Berechtigung." : (json?.error ?? "Nicht erlaubt.");
  if (status === 404) return "Nicht gefunden.";
  if (status === 409) return "Der Plan wurde inzwischen an anderer Stelle geändert.";
  if (status === 413) return "Der Plan ist zu groß.";
  return json?.error ?? `Fehler ${status}`;
}

export interface Me {
  sub: string;
  name: string;
  email: string;
  admin: boolean;
}

export type Permission = "owner" | "editor" | "viewer";

export interface PlanMeta {
  id: number;
  name: string;
  version: number;
  schema: number;
  updated_at: string;
  updated_by: string | null;
  owner_name: string | null;
  mine: boolean;
  permission: Permission;
}

export interface Share {
  sub: string;
  name: string;
  email: string;
  permission: "viewer" | "editor";
}

export interface HistoryEntry {
  id: number;
  version: number;
  name: string;
  saved_by: string | null;
  saved_at: string;
}

export interface Saved {
  id: number;
  version: number;
  updated_at: string;
}

const enc = encodeURIComponent;

export const api = {
  me: () => req<Me>("GET", "/me"),
  logout: () => req<{ ok: true }>("POST", "/auth/logout"),

  plans: () => req<PlanMeta[]>("GET", "/plans?format=all"),
  plan: (id: number) => req<PlanMeta & { data: any }>("GET", `/plans/${id}`),
  createPlan: (name: string, data: unknown) => req<Saved>("POST", "/plans", { name, data }),
  savePlan: (id: number, name: string, data: unknown, version: number) => req<Saved>("PUT", `/plans/${id}`, { name, data, version }),
  deletePlan: (id: number) => req<{ ok: true }>("DELETE", `/plans/${id}`),

  history: (id: number) => req<HistoryEntry[]>("GET", `/plans/${id}/history`),
  historyEntry: (id: number, hid: number) => req<HistoryEntry & { data: any }>("GET", `/plans/${id}/history/${hid}`),

  users: (q: string) => req<{ sub: string; name: string; email: string }[]>("GET", `/users?q=${enc(q)}`),
  shares: (id: number) => req<Share[]>("GET", `/plans/${id}/shares`),
  setShare: (id: number, sub: string, permission: Share["permission"]) => req<Share[]>("PUT", `/plans/${id}/shares/${enc(sub)}`, { permission }),
  removeShare: (id: number, sub: string) => req<{ ok: true }>("DELETE", `/plans/${id}/shares/${enc(sub)}`),

  catalog: () => req<CatalogEntry[]>("GET", "/catalog"),
  createDef: (def: Omit<DeviceDef, "id"> & { hidden?: boolean }) => req<CatalogEntry>("POST", "/catalog", def),
  updateDef: (id: string, def: Partial<DeviceDef> & { hidden: boolean }) => req<CatalogEntry>("PUT", `/catalog/${enc(id)}`, def),
  deleteDef: (id: string) => req<{ ok: true }>("DELETE", `/catalog/${enc(id)}`),
};

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileName = (name: string) => (name.trim() || "plan").replace(/[^\p{L}\p{N} ._-]+/gu, "_").slice(0, 80);
