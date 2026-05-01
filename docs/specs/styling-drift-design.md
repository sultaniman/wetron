# Styling Drift Prevention — Design Spec

**Date:** 2026-05-01
**Status:** Approved

## Problem

Color token values and CSS variable values are hand-copied between `packages/react/` and `packages/svelte/`. When one package is updated (e.g. tuning a dark-mode color), the other must be manually kept in sync. There is no enforcement. Recent commits like `fix(@wetron/svelte): match React canvas/controls/handle/edge styles exactly` are the symptom.

The drift risk sits in two layers:

1. **Design tokens in `theme.ts`** — `CATEGORY_THEME`, `MINIMAP_THEME`, `EDGE_THEME` are defined separately in each package with the same values.
2. **CSS custom property values** — canvas/controls vars (`--xy-*`) and panel vars (`--panel-*`, currently `--wp-*`) are hardcoded in React's `.css` files and mirrored in Svelte's embedded `<style>` blocks.

## Solution

A new `packages/tokens/` package (`@wetron/tokens`) becomes the single source of truth for all color and CSS variable values. Initial values are sourced from React's existing files — React is authoritative.

---

## Package: `@wetron/tokens`

**Location:** `packages/tokens/`
**Package name:** `@wetron/tokens`
**Dependencies:** `@wetron/core` (for `OpCategory` type only)

### File structure

```
packages/tokens/
  src/
    index.ts
  package.json
  tsconfig.json
```

### Exports (`src/index.ts`)

```ts
// 14-category node color palette
CATEGORY_THEME: Record<OpCategory, { light: string; dark: string }>;

// Minimap rendering values
MINIMAP_THEME: {
  borderRadius: number;
  light: {
    background: string;
    nodeColor: string;
    maskColor: string;
  }
  dark: {
    background: string;
    nodeColor: string;
    maskColor: string;
  }
}

// Edge highlight styling
EDGE_THEME: {
  selectedStroke: string;
  selectedStrokeWidth: number;
}

// XY Flow canvas and controls CSS var values
// Keys are exact CSS custom property names (e.g. '--xy-background-color-default')
CANVAS_VARS: {
  light: Record<string, string>;
  dark: Record<string, string>;
}

// Node property panel CSS var values
// Keys use the --panel-* prefix (renamed from --wp-*)
PANEL_VARS: {
  light: Record<string, string>;
  dark: Record<string, string>;
}
```

`CANVAS_VARS` and `PANEL_VARS` use CSS custom property names as keys so consumers can apply them directly (e.g. `Object.entries(vars).forEach(([k, v]) => el.style.setProperty(k, v))`).

---

## React package changes

### `packages/react/src/theme.ts`

- Import `CATEGORY_THEME`, `MINIMAP_THEME`, `EDGE_THEME` from `@wetron/tokens`
- Remove local definitions of those three exports
- `CATEGORY_ICON` stays local (React-specific Phosphor icon components)
- Re-export `CATEGORY_THEME`, `MINIMAP_THEME`, and `EDGE_THEME` so downstream consumers importing from `@wetron/react` are unaffected

### `packages/react/src/model-graph-view/model-graph-view.css`

- No structural changes
- Values must match `CANVAS_VARS` in `@wetron/tokens` — they are the rendered form of those tokens

### `packages/react/src/node-property-panel/node-property-panel.module.css`

- Rename every `--wp-*` custom property to `--panel-*` (11 variables)
- No other changes — values must match `PANEL_VARS` in `@wetron/tokens`

---

## Svelte package changes

### `packages/svelte/src/theme.ts`

- Import `CATEGORY_THEME`, `MINIMAP_THEME`, `EDGE_THEME` from `@wetron/tokens`
- Remove local definitions
- Keep Svelte-specific icon entry (`icon: string` Unicode glyph field)

### `packages/svelte/src/model-graph-view.svelte`

- Remove hardcoded canvas/controls color values from the `:global()` `<style>` block
- On the root wrapper element, apply `CANVAS_VARS[isDark ? 'dark' : 'light']` via Svelte `style:` bindings or a reactive `style` attribute spread
- Non-color structural rules (handle dimensions, controls layout, node reset) stay in `<style>`

### Panel components

- All `--wp-*` references renamed to `--panel-*`
- Hardcoded `--panel-*` color values replaced with Svelte `style:` bindings using `PANEL_VARS[isDark ? 'dark' : 'light']` on the panel root element
- Sub-components that inherit vars via CSS cascade are unaffected — only the root element needs the bindings

---

## CSS variable rename: `--wp-*` → `--panel-*`

| Old name              | New name                 |
| --------------------- | ------------------------ |
| `--wp-bg`             | `--panel-bg`             |
| `--wp-border`         | `--panel-border`         |
| `--wp-text`           | `--panel-text`           |
| `--wp-header-border`  | `--panel-header-border`  |
| `--wp-section-border` | `--panel-section-border` |
| `--wp-label`          | `--panel-label`          |
| `--wp-value`          | `--panel-value`          |
| `--wp-subtitle`       | `--panel-subtitle`       |
| `--wp-chip-bg`        | `--panel-chip-bg`        |
| `--wp-chip-color`     | `--panel-chip-color`     |
| `--wp-close-hover`    | `--panel-close-hover`    |

---

## Out of scope

- **Chip type colors** (`chip[data-type="str"]` etc.) — values are structurally tied to CSS attribute selectors; extracting to a TS dict would require generating CSS rules at runtime. Deferred.
- **Icon box colors** — same reason as chip type colors. Deferred.

---

## Source of truth going forward

`@wetron/tokens` is the source of truth for all values it covers. When changing a color:

1. Update the value in `@wetron/tokens/src/index.ts`
2. Update the matching value in React's `.css` files (which cannot import TS)
3. Svelte automatically reflects the change via its `style:` bindings

React's `.css` files are kept as structural CSS but their color values must stay in sync with the tokens. This one manual step remains for React's static CSS; it is acceptable because these files change infrequently and the values are visible in a single place.

---

## What this fixes

| Drift source                   | Before                                       | After                                             |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------- |
| `CATEGORY_THEME` colors        | Duplicated in 2 `theme.ts` files             | Single source in `@wetron/tokens`                 |
| `MINIMAP_THEME` / `EDGE_THEME` | Duplicated                                   | Single source in `@wetron/tokens`                 |
| Canvas/controls vars           | Duplicated in React CSS + Svelte style block | React CSS authoritative; Svelte reads from tokens |
| Panel vars                     | Duplicated in React CSS + Svelte components  | React CSS authoritative; Svelte reads from tokens |
| `--wp-*` naming                | Opaque shorthand                             | Renamed to `--panel-*`                            |
