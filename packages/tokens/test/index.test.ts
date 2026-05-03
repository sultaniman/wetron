import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  CATEGORY_THEME,
  MINIMAP_THEME,
  EDGE_THEME,
  CANVAS_VARS,
  PANEL_VARS,
} from "../src/index.ts";

function extractOpCategoryValues(filePath: string): string[] {
  const src = readFileSync(filePath, "utf-8");
  const m = src.match(/export type OpCategory\s*=\s*([\s\S]+?)(?=;)/);
  if (!m) throw new Error(`OpCategory not found in ${filePath}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((r) => r[1]).sort();
}

test("OpCategory in tokens matches core", () => {
  const coreValues = extractOpCategoryValues(
    resolve(import.meta.dir, "../../core/src/categories.ts"),
  );
  const tokenValues = extractOpCategoryValues(resolve(import.meta.dir, "../src/index.ts"));
  expect(tokenValues).toEqual(coreValues);
});

test("CATEGORY_THEME has a light and dark entry for every OpCategory in core", () => {
  const coreValues = extractOpCategoryValues(
    resolve(import.meta.dir, "../../core/src/categories.ts"),
  );
  expect(Object.keys(CATEGORY_THEME).sort()).toEqual(coreValues);
  for (const v of Object.values(CATEGORY_THEME)) {
    expect(typeof v.light).toBe("string");
    expect(typeof v.dark).toBe("string");
  }
});

test("MINIMAP_THEME has light and dark with required fields", () => {
  expect(typeof MINIMAP_THEME.borderRadius).toBe("number");
  expect(typeof MINIMAP_THEME.light.background).toBe("string");
  expect(typeof MINIMAP_THEME.dark.background).toBe("string");
});

test("EDGE_THEME has selectedStroke and selectedStrokeWidth", () => {
  expect(typeof EDGE_THEME.selectedStroke).toBe("string");
  expect(typeof EDGE_THEME.selectedStrokeWidth).toBe("number");
});

test("CANVAS_VARS light and dark have the same 7 keys", () => {
  const keys = Object.keys(CANVAS_VARS.light);
  expect(keys).toHaveLength(7);
  expect(Object.keys(CANVAS_VARS.dark)).toEqual(keys);
  for (const k of keys) expect(k.startsWith("--")).toBe(true);
});

test("PANEL_VARS light and dark have the same 11 keys", () => {
  const keys = Object.keys(PANEL_VARS.light);
  expect(keys).toHaveLength(11);
  expect(Object.keys(PANEL_VARS.dark)).toEqual(keys);
  for (const k of keys) expect(k.startsWith("--")).toBe(true);
});
