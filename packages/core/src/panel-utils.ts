import type { AttributeValue } from "./ir.ts";

export function attrChipLabel(value: AttributeValue): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (value.length === 0) return "[]";

  return typeof value[0] === "string"
    ? "str[]"
    : Number.isInteger(value[0] as number)
      ? "int[]"
      : "float[]";
}

export function formatAttr(value: AttributeValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return `[${value.join(", ")}]`;
}

export function formatAttrBrief(value: AttributeValue): string {
  if (!Array.isArray(value)) {
    const s = String(value);
    return s.length > 26 ? s.slice(0, 23) + "…" : s;
  }

  if (value.length <= 4) return `[${value.join(", ")}]`;
  return `[${(value as (string | number)[]).slice(0, 3).join(", ")}, … ×${value.length}]`;
}
