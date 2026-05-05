# CSS Isolation + Node Color Theming - Design Spec

## Problem

When `@wetron/react` (or `@wetron/svelte`) is embedded in a consumer app that ships a CSS reset or Tailwind Preflight, three classes of breakage occur:

1. **Font bleed** - a global `* { font-family: ...; font-size: 16px; line-height: 1.6 }` makes node cards ~35% taller, breaking Dagre layout because node height constants in `transform.ts` are fixed.
2. **Border erasure** - Tailwind Preflight sets `border-width: 0` on `*`; if wetron's CSS loads first, node card borders disappear.
3. **Color wash** - a global `* { color: #111 !important }` or high-specificity consumer rule overrides `--node-color` on text spans, making all nodes look identical.

Additionally, there is no way for consumers to customize per-category node colors without touching wetron's internals.

## Goals

- Node cards render correctly regardless of what CSS the consumer app applies globally.
- Consumers can override any of the 16 category colors via standard CSS custom properties.
- Both `@wetron/react` and `@wetron/svelte` benefit from the same changes.
- Zero new public props or API surface.

## Architecture

### Strategy A - Defensive properties on `.card`

Add explicit resets for the properties that global resets commonly override. CSS Module class names (`.card_<hash>`) have specificity `(0,1,0)`, which beats unqualified `*` and element selectors.

**File:** `packages/react/src/nodes/node-card/node-card.module.css`

```css
.card {
  /* existing styles unchanged */
  font-family: monospace;
  font-size: 13px;
  line-height: 1;
  text-align: left;
  letter-spacing: normal;
  word-spacing: normal;
  border-style: solid;
}
```

This does not protect against `!important` in consumer styles - that is addressed by Strategy B.

### Strategy B - `all: revert` on the ModelGraphView root wrapper

The inner `<div data-theme="...">` in `ModelGraphView` becomes a CSS isolation boundary. `all: revert` resets all inherited CSS properties to browser defaults. Per the CSS spec, `all` excludes custom properties (`--*`), so wetron's `--wetron-node-*` and ReactFlow's `--xy-*` variables set on this element are preserved.

After `all: revert`, a minimal base stylesheet re-establishes the wetron environment.

**File:** `packages/react/src/model-graph-view/model-graph-view.css`

```css
.wetron-root {
  all: revert;
  font-family: system-ui, sans-serif;
  font-size: 14px;
  box-sizing: border-box;
}
```

`model-graph-view.css` is imported as a plain side-effect (not a CSS Module), so the class is referenced as a string.

**File:** `packages/react/src/model-graph-view/model-graph-view.tsx`

```tsx
<div
  className="wetron-root"
  data-theme={isDark ? "dark" : "light"}
  style={cssVars}
  ...
>
```

### Strategy C - Per-category CSS custom property API

Category colors are moved from pure JS (`CATEGORY_THEME` object -> hex string -> inline `--node-color`) to CSS custom properties. The JS `CATEGORY_THEME` object is retained as a reference for the fallback values only.

**File:** `packages/react/src/model-graph-view/model-graph-view.css`

Add all 16 categories under each `[data-theme]` block:

```css
[data-theme="light"] {
  --wetron-category-input: #2e7d32;
  --wetron-category-output: #1565c0;
  --wetron-category-conv: #3949ab;
  --wetron-category-activation: #c0392b;
  --wetron-category-normalization: #00695c;
  --wetron-category-pooling: #6a1b9a;
  --wetron-category-reshape: #546e7a;
  --wetron-category-math: #7b1fa2;
  --wetron-category-reduction: #0277bd;
  --wetron-category-merge: #5c6bc0;
  --wetron-category-attention: #00695c;
  --wetron-category-recurrent: #558b2f;
  --wetron-category-quantization: #795548;
  --wetron-category-constant: #0277bd;
  --wetron-category-logic: #00838f;
  --wetron-category-unknown: #757575;
}

[data-theme="dark"] {
  --wetron-category-input: #4caf50;
  --wetron-category-output: #42a5f5;
  --wetron-category-conv: #7986cb;
  --wetron-category-activation: #ef5350;
  --wetron-category-normalization: #26a69a;
  --wetron-category-pooling: #ab47bc;
  --wetron-category-reshape: #90a4ae;
  --wetron-category-math: #ce93d8;
  --wetron-category-reduction: #64b5f6;
  --wetron-category-merge: #9fa8da;
  --wetron-category-attention: #4db6ac;
  --wetron-category-recurrent: #aed581;
  --wetron-category-quantization: #bcaaa4;
  --wetron-category-constant: #4fc3f7;
  --wetron-category-logic: #4dd0e1;
  --wetron-category-unknown: #9e9e9e;
}
```

**File:** `packages/react/src/nodes/graph-node.tsx` (and `io-node.tsx`)

```ts
// before
const color = CATEGORY_THEME[cat][isDark ? "dark" : "light"];

// after
const color = `var(--wetron-category-${cat})`;
```

`NodeCard` receives `color` as a `string` and sets `--node-color: <value>` as an inline style. Passing `var(--wetron-category-conv)` as an inline style value is valid CSS; the browser resolves the var() chain when computing `color: var(--node-color)` on descendant elements.

**Consumer override pattern:**

```css
/* Target the wetron container's [data-theme] child */
.my-graph-wrapper [data-theme="light"] {
  --wetron-category-conv: #ff6b35;
  --wetron-category-activation: #e67e22;
}
.my-graph-wrapper [data-theme="dark"] {
  --wetron-category-conv: #ff8c60;
  --wetron-category-activation: #f39c12;
}
```

## Svelte Parity

`@wetron/svelte` contains parallel CSS (`packages/svelte/src/`) and node components. The same three strategies apply:

- Strategy A: same defensive properties on `.card` in svelte node-card styles
- Strategy B: same `all: revert` wrapper class on the SvelteFlow container
- Strategy C: same `--wetron-category-*` vars in the svelte model-graph-view styles; same `var(--wetron-category-${cat})` expression in the category color lookup

## Files Touched

| File                                                       | Change                                                |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `packages/react/src/nodes/node-card/node-card.module.css`  | Strategy A: 6 defensive properties                    |
| `packages/react/src/model-graph-view/model-graph-view.tsx` | Strategy B: add `.wetronRoot` class to inner wrapper  |
| `packages/react/src/model-graph-view/model-graph-view.css` | Strategies B + C: `.wetron-root` rule + category vars |
| `packages/react/src/nodes/graph-node.tsx`                  | Strategy C: color -> `var(--wetron-category-${cat})`  |
| `packages/react/src/nodes/io-node.tsx`                     | Strategy C: same change                               |
| `packages/svelte/src/...`                                  | Mirror of all three strategies                        |

## Testing

- Existing `node-card` render tests cover that cards render without throwing; extend to assert `data-theme` attribute is present on the root wrapper.
- No new integration test for CSS isolation (would require a real browser + consumer reset injection - out of scope for unit test suite).
- Verify category custom properties: test that `graph-node.tsx` produces `var(--wetron-category-conv)` as the color value for a `conv` node, not a hex string.

## Non-goals

- `categoryColors` prop on `ModelGraphView` - the CSS custom property approach covers the same use case without a new API.
- Protecting against `!important` overrides on individual text nodes - Strategy B handles container-level resets; element-level `!important` in consumer styles is out of scope.
- Dark mode auto-detection - theme is always controlled via the `isDark` prop; no `prefers-color-scheme` detection inside the library.
