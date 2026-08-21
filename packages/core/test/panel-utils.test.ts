import { test, expect } from 'vitest';
import { attrNeedsExpand, formatAttr, formatAttrBrief } from '../src/panel-utils.ts';

test('formats short attributes without truncation', () => {
  expect(formatAttr([1, 2, 3])).toBe('[1, 2, 3]');
  expect(formatAttr('value')).toBe('value');
});

test('bounds expanded vocabulary arrays', () => {
  const tokens = Array.from({ length: 128_000 }, (_, index) => `token-${index}`);
  const formatted = formatAttr(tokens);

  expect(formatted.length).toBeLessThan(4096);
  expect(formatted).toContain('token-0');
  expect(formatted).toContain('… ×128000');
  expect(formatted).not.toContain('token-127999');
  expect(formatAttrBrief(tokens)).toBe('[token-0, token-1, token-2, … ×128000]');
});

test('bounds individual expanded values', () => {
  const longValue = 'x'.repeat(10_000);
  expect(formatAttr(longValue)).toHaveLength(4097);
  expect(formatAttr([longValue, 'next'])).toBe(`[${'x'.repeat(256)}…, next]`);
});

test('a short array with a long item is truncated and still offers expansion', () => {
  // GGUF chat templates arrive as one multi-KB string inside a short array.
  const template = ['x'.repeat(5000)];
  expect(formatAttrBrief(template).length).toBeLessThan(40);
  expect(attrNeedsExpand(template)).toBe(true);
  expect(formatAttr(template).length).toBeGreaterThan(200);

  // short items still render whole, and need no expander
  expect(formatAttrBrief([1, 2, 3])).toBe('[1, 2, 3]');
  expect(attrNeedsExpand([1, 2, 3])).toBe(false);
  expect(attrNeedsExpand([1, 2, 3, 4, 5])).toBe(true);
});
