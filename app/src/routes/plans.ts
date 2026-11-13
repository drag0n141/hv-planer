import { api } from "../lib/api";
import type { Plan } from "../lib/domain/types";

/** Legt einen Plan als neuen Server-Plan an und liefert dessen ID. */
export async function importAsCopy(plan: Plan): Promise<number> {
  const name = plan.name.trim() || "Unbenannter Plan";
  const created = await api.createPlan(name, { ...plan, name });
  return created.id;
}
