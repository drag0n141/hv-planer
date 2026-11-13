/** App-weiter Zustand: Route, angemeldeter Nutzer, Gerätekatalog. */
import { api, type Me } from "./api";
import type { CatalogEntry } from "./domain/types";

const BASE = "/v2";

export type Route = { name: "plans" } | { name: "plan"; id: number } | { name: "admin" } | { name: "notfound" };

function parse(pathname: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "plans" };
  if (parts[0] === "p" && /^\d+$/.test(parts[1] ?? "") && parts.length === 2) return { name: "plan", id: Number(parts[1]) };
  if (parts[0] === "admin" && parts.length === 1) return { name: "admin" };
  return { name: "notfound" };
}

class App {
  route = $state<Route>(parse(location.pathname));
  me = $state<Me | null>(null);
  catalog = $state.raw<CatalogEntry[]>([]);
  /** Rückfrage vor dem Verlassen einer Seite mit ungespeicherten Änderungen. */
  guard: (() => boolean) | null = null;

  constructor() {
    addEventListener("popstate", () => (this.route = parse(location.pathname)));
  }

  go(path: string) {
    if (this.guard && !this.guard()) return;
    history.pushState(null, "", BASE + path);
    this.route = parse(location.pathname);
  }

  async load() {
    [this.me, this.catalog] = await Promise.all([api.me(), api.catalog()]);
  }

  async reloadCatalog() {
    this.catalog = await api.catalog();
  }

  /** Geräte für die Palette: sichtbare Einträge, nach Kategorie gruppiert in Katalogreihenfolge. */
  get palette(): { category: string; items: CatalogEntry[] }[] {
    const groups: { category: string; items: CatalogEntry[] }[] = [];
    for (const e of this.catalog) {
      if (e.hidden) continue;
      let g = groups.find((x) => x.category === e.category);
      if (!g) groups.push((g = { category: e.category, items: [] }));
      g.items.push(e);
    }
    return groups;
  }
}

export const app = new App();
