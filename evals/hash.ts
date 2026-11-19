import { createHash } from "node:crypto";
export function hash(value: unknown): string {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value, (_key, item: unknown) => item && typeof item === "object" && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item)).digest("hex");
}

export function materialPayloadHash(material: { body: unknown; status: number; delayMs?: number }): string {
  return hash({ body: material.body, status: material.status, delayMs: material.delayMs ?? 0 });
}
