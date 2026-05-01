# Styling Drift Prevention Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `@wetron/tokens` as the single source of truth for all shared color and CSS variable values, eliminating duplication between `@wetron/react` and `@wetron/svelte`.

**Architecture:** A new `packages/tokens/` workspace package exports typed TS dictionaries for `CATEGORY_THEME`, `MINIMAP_THEME`, `EDGE_THEME`, `CANVAS_VARS`, and `PANEL_VARS`. React imports the tokens and re-exports them; its CSS files keep their static `--panel-*` rules but their values must match tokens. Svelte imports the tokens and applies `CANVAS_VARS`/`PANEL_VARS` via inline `style` attribute on wrapper elements, making its sub-components inherit the vars via CSS cascade and removing all hardcoded dark-mode overrides.

**Tech Stack:** TypeScript, Bun workspaces, CSS custom properties, Svelte 5 runes

---

## File Map

**Created:**
- `packages/tokens/src/index.ts` — all design token dictionaries
- `packages/tokens/package.json`
- `packages/tokens/tsconfig.json`
- `packages/tokens/test/index.test.ts`

**Modified:**
- `packages/react/package.json` — add `@wetron/tokens` dependency
- `packages/react/src/theme.ts` — import+re-export CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME from tokens
- `packages/react/src/node-property-panel/node-property-panel.module.css` — rename `--wp-*` → `--panel-*` (11 vars)
- `packages/svelte/package.json` — add `@wetron/tokens` dependency
- `packages/svelte/src/theme.ts` — import CATEGORY_THEME as CATEGORY_COLORS from tokens, spread + add icon field
- `packages/svelte/src/model-graph-view.svelte` — remove `--xy-*` from `:global()` CSS, apply via inline style from CANVAS_VARS; use MINIMAP_THEME + EDGE_THEME
- `packages/svelte/src/node-property-panel/node-property-panel.svelte` — apply PANEL_VARS via inline style
- `packages/svelte/src/node-property-panel/op-panel.svelte` — remove local CATEGORY_THEME, import from tokens; use `--panel-*` vars
- `packages/svelte/src/node-property-panel/edge-panel.svelte` — use `--panel-*` vars
- `packages/svelte/src/node-property-panel/tensor-panel.svelte` — use `--panel-*` vars
- `packages/svelte/src/node-property-panel/io-panel.svelte` — use `--panel-*` vars
- `packages/svelte/src/node-property-panel/section-label.svelte` — use `--panel-label`
- `packages/svelte/src/node-property-panel/row.svelte` — use `--panel-*` vars
- `packages/svelte/src/node-property-panel/attr-row.svelte` — use `--panel-*` vars
- `packages/svelte/src/node-property-panel/chip.svelte` — use `--panel-chip-*` base vars
- `packages/svelte/src/node-property-panel/close-button.svelte` — use `--panel-*` vars

---

## Task 1: Create `@wetron/tokens` package

**Files:**
- Create: `packages/tokens/src/index.ts`
- Create: `packages/tokens/package.json`
- Create: `packages/tokens/tsconfig.json`
- Create: `packages/tokens/test/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/tokens/test/index.test.ts
import { test, expect } from 'bun:test';
import { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME, CANVAS_VARS, PANEL_VARS } from '../src/index.ts';

test('CATEGORY_THEME has all 14 categories with light and dark', () => {
  const expected = ['input','output','conv','activation','normalization','pooling','reshape','math','reduction','merge','attention','recurrent','quantization','unknown'];
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
});

test('PANEL_VARS light and dark have the same 11 keys', () => {
  const keys = Object.keys(PANEL_VARS.light);
  expect(keys).toHaveLength(11);
  expect(Object.keys(PANEL_VARS.dark)).toEqual(keys);
});
```

- [ ] **Step 2: Create package scaffold so the test can run**

```json
// packages/tokens/package.json
{
  "name": "@wetron/tokens",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*"
  }
}
```

```json
// packages/tokens/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Run the test — expect import failure**

```bash
bun test packages/tokens
```

Expected: error like `Cannot find module '../src/index.ts'`

- [ ] **Step 4: Create `packages/tokens/src/index.ts`**

```ts
import type { OpCategory } from '@wetron/core';

export type CategoryColors = { readonly light: string; readonly dark: string };

export const CATEGORY_THEME: Record<OpCategory, CategoryColors> = {
  input:         { light: '#2e7d32', dark: '#4caf50' },
  output:        { light: '#1565c0', dark: '#42a5f5' },
  conv:          { light: '#3949ab', dark: '#7986cb' },
  activation:    { light: '#d84315', dark: '#ff7043' },
  normalization: { light: '#00695c', dark: '#26a69a' },
  pooling:       { light: '#6a1b9a', dark: '#ab47bc' },
  reshape:       { light: '#4e342e', dark: '#a1887f' },
  math:          { light: '#ad1457', dark: '#f06292' },
  reduction:     { light: '#1565c0', dark: '#64b5f6' },
  merge:         { light: '#e65100', dark: '#ffa726' },
  attention:     { light: '#00695c', dark: '#4db6ac' },
  recurrent:     { light: '#558b2f', dark: '#aed581' },
  quantization:  { light: '#795548', dark: '#bcaaa4' },
  unknown:       { light: '#757575', dark: '#9e9e9e' },
} as const;

export const MINIMAP_THEME = {
  borderRadius: 8,
  light: {
    background: 'rgba(240, 240, 248, 0.92)',
    nodeColor:  'rgba(60, 60, 100, 0.4)',
    maskColor:  'rgba(30, 30, 80, 0.07)',
  },
  dark: {
    background: 'rgba(18, 18, 32, 0.55)',
    nodeColor:  'rgba(180, 180, 220, 0.5)',
    maskColor:  'rgba(255, 255, 255, 0.08)',
  },
} as const;

export const EDGE_THEME = {
  selectedStroke:      '#e53935',
  selectedStrokeWidth: 2,
} as const;

// Keys are CSS custom property names — consumers can apply via style attribute or setProperty.
export const CANVAS_VARS = {
  light: {
    '--xy-background-color-default':                      '#f8f8fc',
    '--xy-controls-button-background-color-default':      '#ffffff',
    '--xy-controls-button-background-color-hover-default':'#f0f0f8',
    '--xy-controls-button-color-default':                 '#555',
    '--xy-controls-button-color-hover-default':           '#333',
    '--xy-controls-button-border-color-default':          '#e0e0e0',
    '--xy-controls-box-shadow-default':                   'none',
  },
  dark: {
    '--xy-background-color-default':                      '#13131f',
    '--xy-controls-button-background-color-default':      '#1e1e2e',
    '--xy-controls-button-background-color-hover-default':'#252538',
    '--xy-controls-button-color-default':                 '#7a7a9a',
    '--xy-controls-button-color-hover-default':           '#a0a0c0',
    '--xy-controls-button-border-color-default':          '#2a2a3a',
    '--xy-controls-box-shadow-default':                   'none',
  },
} as const;

// Keys use the --panel-* prefix.
export const PANEL_VARS = {
  light: {
    '--panel-bg':             '#fff',
    '--panel-border':         '#e0e0e0',
    '--panel-text':           '#222',
    '--panel-header-border':  '#eee',
    '--panel-section-border': '#f0f0f0',
    '--panel-label':          '#555',
    '--panel-value':          '#333',
    '--panel-subtitle':       '#aaa',
    '--panel-chip-bg':        '#f0f0f0',
    '--panel-chip-color':     '#888',
    '--panel-close-hover':    '#f0f0f0',
  },
  dark: {
    '--panel-bg':             '#1e1e2e',
    '--panel-border':         '#2a2a3a',
    '--panel-text':           '#f0f0f0',
    '--panel-header-border':  '#2a2a3a',
    '--panel-section-border': '#282840',
    '--panel-label':          '#a0a0c0',
    '--panel-value':          '#e0e0f0',
    '--panel-subtitle':       '#6a6a8a',
    '--panel-chip-bg':        '#262646',
    '--panel-chip-color':     '#a0a0c0',
    '--panel-close-hover':    '#2a2a3a',
  },
} as const;
```

- [ ] **Step 5: Run `bun install` to wire the workspace, then run tests**

```bash
bun install && bun test packages/tokens
```

Expected: all 5 tests pass

- [ ] **Step 6: Commit**

```bash
git add packages/tokens/package.json packages/tokens/tsconfig.json packages/tokens/src/index.ts packages/tokens/test/index.test.ts
git commit -m "feat(@wetron/tokens): add design tokens package"
```

---

## Task 2: Wire React theme.ts to tokens

**Files:**
- Modify: `packages/react/package.json`
- Modify: `packages/react/src/theme.ts`

- [ ] **Step 1: Add `@wetron/tokens` to React's dependencies**

In `packages/react/package.json`, add to `"dependencies"`:
```json
"@wetron/tokens": "workspace:*"
```

- [ ] **Step 2: Replace `react/src/theme.ts`**

```ts
// packages/react/src/theme.ts
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  ArrowDown, ArrowUp, FrameCorners,
  ArrowsMerge, Eye, ArrowCounterClockwise, Faders, Question,
  Aperture, Function, PlusMinus, StackMinus,
} from '@phosphor-icons/react';
import type { OpCategory } from '@wetron/core';

export type { OpCategory };
export { CATEGORY_THEME, MINIMAP_THEME, EDGE_THEME } from '@wetron/tokens';

export type CategoryTheme = {
  light: string;
  dark: string;
};

export type IconEntry =
  | { kind: 'component'; Component: PhosphorIcon }
  | { kind: 'glyph'; char: string };

export const CATEGORY_ICON: Record<OpCategory, IconEntry> = {
  input:         { kind: 'component', Component: ArrowDown },
  output:        { kind: 'component', Component: ArrowUp },
  conv:          { kind: 'component', Component: Aperture },
  activation:    { kind: 'component', Component: Function },
  normalization: { kind: 'glyph', char: 'μ' },
  pooling:       { kind: 'component', Component: StackMinus },
  reshape:       { kind: 'component', Component: FrameCorners },
  math:          { kind: 'component', Component: PlusMinus },
  reduction:     { kind: 'glyph', char: 'Σ' },
  merge:         { kind: 'component', Component: ArrowsMerge },
  attention:     { kind: 'component', Component: Eye },
  recurrent:     { kind: 'component', Component: ArrowCounterClockwise },
  quantization:  { kind: 'component', Component: Faders },
  unknown:       { kind: 'component', Component: Question },
};
```

- [ ] **Step 3: Run `bun install` and tests**

```bash
bun install && bun test packages/react
```

Expected: all existing tests pass

- [ ] **Step 4: Commit**

```bash
git add packages/react/package.json packages/react/src/theme.ts
git commit -m "feat(@wetron/react): source design tokens from @wetron/tokens"
```

---

## Task 3: Rename `--wp-*` → `--panel-*` in React CSS

**Files:**
- Modify: `packages/react/src/node-property-panel/node-property-panel.module.css`

- [ ] **Step 1: Replace all `--wp-` occurrences with `--panel-` in the CSS module**

Use search-and-replace across the entire file. Every occurrence of `--wp-` becomes `--panel-`. There are 11 variable names × 2 locations each (definition + usage) = ~22 occurrences.

The affected lines are:
- Line 3–13: variable definitions under `.panel { ... }` — rename keys
- Line 27–38: dark theme overrides under `.panel[data-theme="dark"]` — rename keys
- Every `var(--wp-*)` reference throughout the file — rename to `var(--panel-*)`

Final result: no `--wp-` appears anywhere in the file.

- [ ] **Step 2: Run tests and verify build**

```bash
bun test packages/react
```

Expected: all tests pass (CSS module consumers reference class names, not var names, so no TS changes needed)

- [ ] **Step 3: Verify visually using the demo app**

```bash
cd apps/demo && bunx vite
```

Open the demo, open the node property panel. Check: panel background, borders, text, chips, and close button all look correct in both light and dark modes.

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/node-property-panel/node-property-panel.module.css
git commit -m "refactor(@wetron/react): rename --wp-* CSS vars to --panel-*"
```

---

## Task 4: Wire Svelte theme.ts to tokens

**Files:**
- Modify: `packages/svelte/package.json`
- Modify: `packages/svelte/src/theme.ts`

- [ ] **Step 1: Add `@wetron/tokens` to Svelte's dependencies**

In `packages/svelte/package.json`, add to `"dependencies"`:
```json
"@wetron/tokens": "workspace:*"
```

- [ ] **Step 2: Replace `svelte/src/theme.ts`**

```ts
// packages/svelte/src/theme.ts
import type { OpCategory } from '@wetron/core';
import { CATEGORY_THEME as CATEGORY_COLORS } from '@wetron/tokens';

export type { OpCategory };

export type CategoryTheme = {
  icon: string;
  light: string;
  dark: string;
};

export const CATEGORY_THEME: Record<OpCategory, CategoryTheme> = {
  input:         { ...CATEGORY_COLORS.input,         icon: '↓' },
  output:        { ...CATEGORY_COLORS.output,        icon: '↑' },
  conv:          { ...CATEGORY_COLORS.conv,          icon: '⊛' },
  activation:    { ...CATEGORY_COLORS.activation,    icon: 'ƒ' },
  normalization: { ...CATEGORY_COLORS.normalization, icon: 'μ' },
  pooling:       { ...CATEGORY_COLORS.pooling,       icon: '⊟' },
  reshape:       { ...CATEGORY_COLORS.reshape,       icon: '⇄' },
  math:          { ...CATEGORY_COLORS.math,          icon: '±' },
  reduction:     { ...CATEGORY_COLORS.reduction,     icon: 'Σ' },
  merge:         { ...CATEGORY_COLORS.merge,         icon: '‖' },
  attention:     { ...CATEGORY_COLORS.attention,     icon: '⊙' },
  recurrent:     { ...CATEGORY_COLORS.recurrent,     icon: '↺' },
  quantization:  { ...CATEGORY_COLORS.quantization,  icon: 'Q' },
  unknown:       { ...CATEGORY_COLORS.unknown,       icon: '?' },
};
```

- [ ] **Step 3: Run `bun install`**

```bash
bun install
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add packages/svelte/package.json packages/svelte/src/theme.ts
git commit -m "feat(@wetron/svelte): source category colors from @wetron/tokens"
```

---

## Task 5: Wire canvas, minimap, and edge tokens into Svelte model-graph-view

**Files:**
- Modify: `packages/svelte/src/model-graph-view.svelte`

- [ ] **Step 1: Add imports at the top of the script block**

After the existing imports in `<script lang="ts">`, add:

```ts
import { CANVAS_VARS, MINIMAP_THEME, EDGE_THEME } from '@wetron/tokens';
```

- [ ] **Step 2: Replace hardcoded minimap props with token references**

Find these lines:
```svelte
<MiniMap
  style={`background: ${isDark ? 'rgba(18,18,32,0.55)' : 'rgba(240,240,248,0.92)'}; border-radius: 8px; border: none; overflow: hidden;`}
  nodeColor={isDark ? 'rgba(180,180,220,0.5)' : 'rgba(60,60,100,0.4)'}
  maskColor={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(30,30,80,0.07)'}
/>
```

Replace with:
```svelte
<MiniMap
  style={`background: ${isDark ? MINIMAP_THEME.dark.background : MINIMAP_THEME.light.background}; border-radius: ${MINIMAP_THEME.borderRadius}px; border: none; overflow: hidden;`}
  nodeColor={isDark ? MINIMAP_THEME.dark.nodeColor : MINIMAP_THEME.light.nodeColor}
  maskColor={isDark ? MINIMAP_THEME.dark.maskColor : MINIMAP_THEME.light.maskColor}
/>
```

- [ ] **Step 3: Replace hardcoded edge selection color with EDGE_THEME**

Find this line:
```ts
? 'stroke: #e53935; stroke-width: 2; opacity: 1;'
```

Replace with:
```ts
? `stroke: ${EDGE_THEME.selectedStroke}; stroke-width: ${EDGE_THEME.selectedStrokeWidth}; opacity: 1;`
```

- [ ] **Step 4: Apply CANVAS_VARS via inline style on the wrapper element**

Find:
```svelte
<div class="wetron-graph" data-theme={isDark ? 'dark' : 'light'}>
```

Replace with:
```svelte
<div
  class="wetron-graph"
  data-theme={isDark ? 'dark' : 'light'}
  style={Object.entries(CANVAS_VARS[isDark ? 'dark' : 'light']).map(([k, v]) => `${k}:${v}`).join(';')}
>
```

- [ ] **Step 5: Remove the `--xy-*` var blocks from the `<style>` block**

Remove these two entire rule blocks (they are now handled by the inline style):

```css
/* Remove this entire block: */
:global(.wetron-graph[data-theme="dark"]) {
  --xy-background-color-default: #13131f;
  --xy-controls-button-background-color-default: #1e1e2e;
  --xy-controls-button-background-color-hover-default: #252538;
  --xy-controls-button-color-default: #7a7a9a;
  --xy-controls-button-color-hover-default: #a0a0c0;
  --xy-controls-button-border-color-default: #2a2a3a;
  --xy-controls-box-shadow-default: none;
}

/* Remove this entire block: */
:global(.wetron-graph[data-theme="light"]) {
  --xy-background-color-default: #f8f8fc;
  --xy-controls-button-background-color-default: #ffffff;
  --xy-controls-button-background-color-hover-default: #f0f0f8;
  --xy-controls-button-color-default: #555;
  --xy-controls-button-color-hover-default: #333;
  --xy-controls-button-border-color-default: #e0e0e0;
  --xy-controls-box-shadow-default: none;
}
```

Keep all other `:global()` rules (handle dimensions, controls layout, direct `.svelte-flow__controls-button` property overrides, node reset).

- [ ] **Step 6: Verify the demo**

```bash
cd apps/demo-svelte && bunx vite
```

Confirm canvas background, controls buttons (hover included), handles, minimap, and edge selection still render correctly in both light and dark modes.

- [ ] **Step 7: Commit**

```bash
git add packages/svelte/src/model-graph-view.svelte
git commit -m "feat(@wetron/svelte): source canvas/minimap/edge tokens from @wetron/tokens"
```

---

## Task 6: Apply panel vars in Svelte panel wrapper

**Files:**
- Modify: `packages/svelte/src/node-property-panel/node-property-panel.svelte`

- [ ] **Step 1: Add PANEL_VARS import to the script block**

Add to the imports:
```ts
import { PANEL_VARS } from '@wetron/tokens';
```

- [ ] **Step 2: Apply vars via inline style on the `.panel` element**

Find:
```svelte
<div class="panel" data-theme={theme}>
```

Replace with:
```svelte
<div
  class="panel"
  data-theme={theme}
  style={Object.entries(PANEL_VARS[isDark ? 'dark' : 'light']).map(([k, v]) => `${k}:${v}`).join(';')}
>
```

- [ ] **Step 3: Replace hardcoded colors in the `<style>` block with CSS var references**

Replace the entire `<style>` block with:

```css
<style>
  .panel {
    position: relative;
    background: var(--panel-bg);
    border-radius: 8px;
    overflow: hidden;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    border: 1px solid var(--panel-border);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.10);
    color: var(--panel-text);
  }
</style>
```

The dark mode overrides are removed — the vars now carry both modes, switched by the inline style.

- [ ] **Step 4: Commit**

```bash
git add packages/svelte/src/node-property-panel/node-property-panel.svelte
git commit -m "feat(@wetron/svelte): apply --panel-* CSS vars from PANEL_VARS"
```

---

## Task 7: Update Svelte panel sub-components to inherit `--panel-*` vars

**Files:**
- Modify: `packages/svelte/src/node-property-panel/op-panel.svelte`
- Modify: `packages/svelte/src/node-property-panel/edge-panel.svelte`
- Modify: `packages/svelte/src/node-property-panel/tensor-panel.svelte`
- Modify: `packages/svelte/src/node-property-panel/io-panel.svelte`
- Modify: `packages/svelte/src/node-property-panel/section-label.svelte`
- Modify: `packages/svelte/src/node-property-panel/row.svelte`
- Modify: `packages/svelte/src/node-property-panel/attr-row.svelte`
- Modify: `packages/svelte/src/node-property-panel/chip.svelte`
- Modify: `packages/svelte/src/node-property-panel/close-button.svelte`

The pattern for all sub-components: replace hardcoded hex values with `var(--panel-*)` references, and remove every `:global([data-theme="dark"])` override that is now redundant.

**Color-to-var mapping:**
| Hardcoded light | Hardcoded dark | CSS var |
|---|---|---|
| `#555` | `#a0a0c0` | `var(--panel-label)` |
| `#333` | `#e0e0f0` | `var(--panel-value)` |
| `#aaa` | `#6a6a8a` | `var(--panel-subtitle)` |
| `#eee` | `#2a2a3a` | `var(--panel-header-border)` |
| `#f0f0f0` (border) | `#282840` | `var(--panel-section-border)` |
| `#f0f0f0` (bg) | `#262646` | `var(--panel-chip-bg)` |
| `#888` | `#a0a0c0` | `var(--panel-chip-color)` |
| `#f0f0f0` (hover) | `#2a2a3a` | `var(--panel-close-hover)` |
| `#222` | `#f0f0f0` | `var(--panel-text)` |

**Out of scope** (keep as-is): icon box colors (`[data-kind="tensor"]` etc.) and chip type colors (`[data-type="str"]` etc.) — these remain as structural hardcoded CSS since they can't cleanly map to a generic var.

- [ ] **Step 1: Update `section-label.svelte`**

Replace the `<style>` block with:
```css
<style>
  .sectionLabel {
    font-size: 10px;
    font-weight: 500;
    color: var(--panel-label);
    margin-bottom: 5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }
</style>
```

- [ ] **Step 2: Update `close-button.svelte`**

Replace the `<style>` block with:
```css
<style>
  .closeButton {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 24px;
    height: 24px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--panel-subtitle);
    padding: 0;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .closeButton:hover {
    background: var(--panel-close-hover);
    color: var(--panel-text);
  }
</style>
```

- [ ] **Step 3: Update `row.svelte`**

Replace the `<style>` block with:
```css
<style>
  .row {
    display: flex;
    align-items: center;
    padding: 3px 0;
    margin: 1px 0;
    gap: 5px;
    cursor: default;
  }
  .clickable { cursor: pointer; }
  .clickable:hover {
    background: color-mix(in oklch, var(--panel-label) 5%, transparent);
    margin: 1px -14px;
    padding-left: 14px;
    padding-right: 14px;
  }
  .label {
    color: var(--panel-label);
    font-size: 10px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    font-family: monospace;
    font-size: 9px;
    color: var(--panel-value);
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .caret {
    flex-shrink: 0;
    opacity: 0.4;
    color: var(--panel-label);
    display: flex;
    align-items: center;
  }
</style>
```

- [ ] **Step 4: Update `attr-row.svelte`**

Replace the `<style>` block with:
```css
<style>
  .row {
    display: flex;
    align-items: center;
    padding: 3px 0;
    margin: 1px 0;
    gap: 5px;
    cursor: default;
  }
  .label {
    color: var(--panel-label);
    font-size: 10px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .value {
    font-family: monospace;
    font-size: 9px;
    color: var(--panel-value);
    text-align: right;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .expandBtn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 9px;
    padding: 1px 4px;
    color: var(--panel-label);
    border-radius: 3px;
    flex-shrink: 0;
    font-family: monospace;
    line-height: 1;
  }
  .expandBtn:hover {
    background: var(--panel-chip-bg);
    color: var(--panel-text);
  }
  .valueExpanded {
    font-family: monospace;
    font-size: 9px;
    color: var(--panel-value);
    margin: 2px 0 4px;
    padding: 5px 8px;
    background: var(--panel-chip-bg);
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-all;
    line-height: 1.6;
  }
</style>
```

- [ ] **Step 5: Update `chip.svelte` base colors only**

In the `<style>` block, change only the `.chip` base rule and remove the base dark override. Keep all type-specific color rules unchanged.

Find and replace only these two rules:

```css
/* Remove: */
:global([data-theme="dark"]) .chip { background: #262646; color: #a0a0c0; }

/* Change: */
.chip {
  font-size: 8px;
  padding: 1px 5px;
  border-radius: 10px;
  white-space: nowrap;
  text-align: center;
  display: inline-block;
  background: var(--panel-chip-bg);   /* was: #f0f0f0 */
  color: var(--panel-chip-color);     /* was: #888 */
}
```

All type-specific rules (`.chip[data-type="str"]` etc.) remain exactly as-is.

- [ ] **Step 6: Update `op-panel.svelte` — remove local CATEGORY_THEME and fix style**

**Script block changes:**

Remove only the local `CATEGORY_THEME` constant (lines 12–27). Keep `GLYPH_CATS` and all icon rendering logic unchanged.

Add this import at the top of the script block:
```ts
import { CATEGORY_THEME } from '@wetron/tokens';
```

The existing usage `const color = $derived(isDark ? CATEGORY_THEME[cat].dark : CATEGORY_THEME[cat].light)` continues to work — tokens exports `{ light: string; dark: string }` per category.

**Style block changes** — replace the `.header`, `.section`, and `.nodeSubtitle` rules and remove their dark overrides:

```css
<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section {
    padding: 9px 14px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast { padding: 9px 14px; }
  .iconBox {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: var(--icon-box-bg, transparent);
    color: var(--icon-box-color, inherit);
  }
  .glyphIcon { font-family: monospace; font-size: 15px; }
  .titleWrap { min-width: 0; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 7: Update `edge-panel.svelte` styles**

Replace the `.header`, `.section`, and `.nodeSubtitle` rules (same pattern as op-panel). Keep `iconBox[data-kind="edge"]` rules unchanged.

```css
<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section {
    padding: 9px 14px;
    border-bottom: 1px solid var(--panel-section-border);
  }
  .sectionLast { padding: 9px 14px; }
  .iconBox {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="edge"] { background: #f3e5f5; color: #9c27b0; }
  :global([data-theme="dark"]) .iconBox[data-kind="edge"] { background: color-mix(in oklch, #ce93d8 12%, #1e1e2e); color: #ce93d8; }
  .titleWrap { min-width: 0; flex: 1; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 8: Update `tensor-panel.svelte` styles**

Same pattern. Keep `iconBox[data-kind="tensor"]` rules unchanged.

```css
<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sectionLast { padding: 9px 14px; }
  .iconBox {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="tensor"] { background: #e6f4ea; color: #34a853; }
  :global([data-theme="dark"]) .iconBox[data-kind="tensor"] { background: color-mix(in oklch, #4caf50 12%, #1e1e2e); color: #4caf50; }
  .titleWrap { min-width: 0; flex: 1; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 9: Update `io-panel.svelte` styles**

Same pattern. Keep `iconBox[data-kind="input"]` and `iconBox[data-kind="output"]` rules unchanged.

```css
<style>
  .header {
    padding: 12px 38px 10px 14px;
    border-bottom: 1px solid var(--panel-header-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .sectionLast { padding: 9px 14px; }
  .iconBox {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .iconBox[data-kind="input"]  { background: #e6f4ea; color: #2e7d32; }
  .iconBox[data-kind="output"] { background: #e8f0fe; color: #1565c0; }
  :global([data-theme="dark"]) .iconBox[data-kind="input"]  { background: color-mix(in oklch, #4caf50 12%, #1e1e2e); color: #4caf50; }
  :global([data-theme="dark"]) .iconBox[data-kind="output"] { background: color-mix(in oklch, #42a5f5 12%, #1e1e2e); color: #42a5f5; }
  .titleWrap { min-width: 0; overflow: hidden; }
  .nodeTitle { font-weight: 700; font-size: 13px; }
  .nodeSubtitle {
    font-size: 10px;
    color: var(--panel-subtitle);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 10: Verify visually using the Svelte demo**

```bash
cd apps/demo-svelte && bunx vite
```

Open the panel for an op node, an edge, a tensor, and an IO node. In both light and dark modes, confirm:
- Panel background, borders, and text colors match the React demo
- Section dividers render correctly
- Chips show correct base colors (type-specific colors should be unaffected)
- Close button hover works
- Row clickable hover shows correct tint

- [ ] **Step 11: Run all tests**

```bash
bun test
```

Expected: all tests pass

- [ ] **Step 12: Commit**

```bash
git add \
  packages/svelte/src/node-property-panel/op-panel.svelte \
  packages/svelte/src/node-property-panel/edge-panel.svelte \
  packages/svelte/src/node-property-panel/tensor-panel.svelte \
  packages/svelte/src/node-property-panel/io-panel.svelte \
  packages/svelte/src/node-property-panel/section-label.svelte \
  packages/svelte/src/node-property-panel/row.svelte \
  packages/svelte/src/node-property-panel/attr-row.svelte \
  packages/svelte/src/node-property-panel/chip.svelte \
  packages/svelte/src/node-property-panel/close-button.svelte
git commit -m "refactor(@wetron/svelte): replace hardcoded panel colors with --panel-* CSS vars"
```
