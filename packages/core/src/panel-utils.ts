import type { AttributeValue } from "@wetron/common/ir";

const MAX_EXPANDED_ATTR_ITEMS = 100;
const MAX_EXPANDED_ATTR_CHARS = 4096;
const MAX_EXPANDED_ATTR_ITEM_CHARS = 256;

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
  if (typeof value === "string") {
    return value.length > MAX_EXPANDED_ATTR_CHARS
      ? `${value.slice(0, MAX_EXPANDED_ATTR_CHARS)}…`
      : value;
  }

  const parts: string[] = [];
  let length = 2;
  for (const item of value) {
    if (parts.length === MAX_EXPANDED_ATTR_ITEMS) break;
    const itemText = String(item);
    const part =
      itemText.length > MAX_EXPANDED_ATTR_ITEM_CHARS
        ? `${itemText.slice(0, MAX_EXPANDED_ATTR_ITEM_CHARS)}…`
        : itemText;
    const separatorLength = parts.length === 0 ? 0 : 2;
    if (length + separatorLength + part.length > MAX_EXPANDED_ATTR_CHARS) break;
    parts.push(part);
    length += separatorLength + part.length;
  }
  const omitted = parts.length < value.length ? `, … ×${value.length}` : "";
  return `[${parts.join(", ")}${omitted}]`;
}

export function formatAttrBrief(value: AttributeValue): string {
  if (!Array.isArray(value)) {
    const s = String(value);
    return s.length > 26 ? s.slice(0, 23) + "…" : s;
  }

  if (value.length <= 4) return `[${value.join(", ")}]`;
  return `[${(value as (string | number)[]).slice(0, 3).join(", ")}, … ×${value.length}]`;
}
