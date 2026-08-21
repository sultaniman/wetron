import type { AttributeValue } from '@wetron/common/ir';

const MAX_EXPANDED_ATTR_ITEMS = 100;
const MAX_EXPANDED_ATTR_CHARS = 4096;
const MAX_EXPANDED_ATTR_ITEM_CHARS = 256;
const BRIEF_CHARS = 26;

export function attrChipLabel(value: AttributeValue): string {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'float';
  if (typeof value === 'string') return 'str';
  if (value.length === 0) return '[]';

  return typeof value[0] === 'string' ? 'str[]' : Number.isInteger(value[0] as number) ? 'int[]' : 'float[]';
}

export function formatAttr(value: AttributeValue): string {
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    return value.length > MAX_EXPANDED_ATTR_CHARS ? `${value.slice(0, MAX_EXPANDED_ATTR_CHARS)}…` : value;
  }

  const parts: string[] = [];
  let length = 2;
  for (const item of value) {
    if (parts.length === MAX_EXPANDED_ATTR_ITEMS) break;
    const itemText = String(item);
    const part =
      itemText.length > MAX_EXPANDED_ATTR_ITEM_CHARS ? `${itemText.slice(0, MAX_EXPANDED_ATTR_ITEM_CHARS)}…` : itemText;
    const separatorLength = parts.length === 0 ? 0 : 2;
    if (length + separatorLength + part.length > MAX_EXPANDED_ATTR_CHARS) break;
    parts.push(part);
    length += separatorLength + part.length;
  }
  const omitted = parts.length < value.length ? `, … ×${value.length}` : '';
  return `[${parts.join(', ')}${omitted}]`;
}

function briefItem(item: string | number): string {
  const text = String(item);
  return text.length > BRIEF_CHARS ? `${text.slice(0, BRIEF_CHARS - 3)}…` : text;
}

export function formatAttrBrief(value: AttributeValue): string {
  if (!Array.isArray(value)) {
    const s = String(value);
    return s.length > BRIEF_CHARS ? s.slice(0, BRIEF_CHARS - 3) + '…' : s;
  }

  const items = value as (string | number)[];
  if (items.length <= 4) return `[${items.map(briefItem).join(', ')}]`;
  return `[${items.slice(0, 3).map(briefItem).join(', ')}, … ×${items.length}]`;
}

/** True when the brief rendering hides something the expanded rendering would show.
 *  A short array can still need expanding when one of its items is long - GGUF
 *  chat templates and tokenizer arrays hit exactly that case. */
export function attrNeedsExpand(value: AttributeValue): boolean {
  if (!Array.isArray(value)) return String(value).length > BRIEF_CHARS;
  return value.length > 4 || (value as (string | number)[]).some((item) => String(item).length > BRIEF_CHARS);
}
