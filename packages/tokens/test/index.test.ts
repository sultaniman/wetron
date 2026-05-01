import { test, expect } from 'bun:test';
import { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME, CANVAS_VARS, PANEL_VARS } from '../src/index.ts';

test('CATEGORY_THEME has all categories with light and dark', () => {
  const expected = ['input','output','conv','activation','normalization','pooling','reshape','math','reduction','merge','attention','recurrent','quantization','constant','logic','unknown'];
  expect(Object.keys(CATEGORY_THEME)).toEqual(expected);
  for (const v of Object.values(CATEGORY_THEME)) {
    expect(typeof v.light).toBe('string');
    expect(typeof v.dark).toBe('string');
  }
});

test('MINIMAP_THEME has light and dark with required fields', () => {
  expect(typeof MINIMAP_THEME.borderRadius).toBe('number');
  expect(typeof MINIMAP_THEME.light.background).toBe('string');
  expect(typeof MINIMAP_THEME.dark.background).toBe('string');
});

test('EDGE_THEME has selectedStroke and selectedStrokeWidth', () => {
  expect(typeof EDGE_THEME.selectedStroke).toBe('string');
  expect(typeof EDGE_THEME.selectedStrokeWidth).toBe('number');
});

test('CANVAS_VARS light and dark have the same 7 keys', () => {
  const keys = Object.keys(CANVAS_VARS.light);
  expect(keys).toHaveLength(7);
  expect(Object.keys(CANVAS_VARS.dark)).toEqual(keys);
  for (const k of keys) expect(k.startsWith('--')).toBe(true);
});

test('PANEL_VARS light and dark have the same 11 keys', () => {
  const keys = Object.keys(PANEL_VARS.light);
  expect(keys).toHaveLength(11);
  expect(Object.keys(PANEL_VARS.dark)).toEqual(keys);
  for (const k of keys) expect(k.startsWith('--')).toBe(true);
});
