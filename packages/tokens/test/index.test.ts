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

// Sync check: keep CATEGORY_THEME (single source of truth) in lockstep with the
// duplicated CSS variable definitions in the renderer packages. Drift here is
// silent at runtime because the same names exist in both files; the test fails
// loudly if anyone edits one site without the other.

// Walk the source as a flat list of `{...}` blocks (no nesting in these files),
// return the value of `varName` from the first block whose preceding selector
// text contains `selectorMarker` and whose body contains the var.
// Strips CSS / JS comments first so braces inside comments don't confuse parsing.
function extractCssVar(src: string, varName: string, selectorMarker: string): string | null {
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  let i = 0;
  while (i < stripped.length) {
    const open = stripped.indexOf("{", i);
    if (open < 0) return null;
    const close = stripped.indexOf("}", open);
    if (close < 0) return null;
    const selector = stripped.slice(i, open);
    const body = stripped.slice(open + 1, close);
    if (selector.includes(selectorMarker)) {
      const m = body.match(new RegExp(`${varName.replace(/-/g, "\\-")}\\s*:\\s*([^;]+);`));
      if (m) return m[1].trim();
    }
    i = close + 1;
  }
  return null;
}

test("react CSS --wetron-category-* matches CATEGORY_THEME", () => {
  const css = readFileSync(
    resolve(import.meta.dir, "../../react/src/model-graph-view/model-graph-view.css"),
    "utf-8",
  );
  // Light theme is in `.wetron-root`/`:where(...)` selector without [data-theme="dark"].
  // Dark theme is in `[data-theme="dark"]` block.
  for (const [cat, colors] of Object.entries(CATEGORY_THEME)) {
    const lightVar =
      extractCssVar(css, `--wetron-category-${cat}`, `data-theme="light"`) ??
      extractCssVar(css, `--wetron-category-${cat}`, `wetron-root`);
    const darkVar = extractCssVar(css, `--wetron-category-${cat}`, `data-theme="dark"`);
    expect(lightVar?.toLowerCase()).toBe(colors.light.toLowerCase());
    expect(darkVar?.toLowerCase()).toBe(colors.dark.toLowerCase());
  }
});

test("svelte component --wetron-category-* matches CATEGORY_THEME", () => {
  const src = readFileSync(
    resolve(import.meta.dir, "../../svelte/src/model-graph-view.svelte"),
    "utf-8",
  );
  for (const [cat, colors] of Object.entries(CATEGORY_THEME)) {
    const lightVar = extractCssVar(src, `--wetron-category-${cat}`, `data-theme="light"`);
    const darkVar = extractCssVar(src, `--wetron-category-${cat}`, `data-theme="dark"`);
    expect(lightVar?.toLowerCase()).toBe(colors.light.toLowerCase());
    expect(darkVar?.toLowerCase()).toBe(colors.dark.toLowerCase());
  }
});
