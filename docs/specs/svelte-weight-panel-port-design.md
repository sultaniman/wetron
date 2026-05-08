# Svelte Weight Panel Port

Status: proposed.

Bring `@wetron/svelte` to functional parity with `@wetron/react` for weight inspection. React ships `WeightPanel`, `WeightHistogram`, `WeightHeatmap`, and `VirtualValues`; Svelte currently falls back to `TensorPanel` for every tensor target, so Svelte consumers cannot view stats, histograms, heatmaps, or numeric values for initialised tensors.

## Goals

- Render the same weight-inspection UI on both renderers from the same input (`{ tensor }` panel target + `ModelGraph`).
- Reuse format / colormap helpers across renderers — they're framework-agnostic and shouldn't be duplicated.
- Preserve the existing Svelte component organization (one component per file, scoped `<style>` blocks, `phosphor-svelte` icons).
- Add a real test setup for `@wetron/svelte` covering the new components.

## Non-goals

- Reworking React WeightPanel internals — port behaviour as-is.
- Replacing `@base-ui/react` Tabs / ScrollArea on the React side.
- Changing the public `ModelGraph` shape or weight decode pipeline.

## Pre-work: hoist shared helpers into `@wetron/core`

`packages/react/src/node-property-panel/format-val.ts` and `heatmap-color.ts` are pure TypeScript — no React imports. The Svelte port needs them verbatim, so duplicating would create immediate drift.

Move both files to `packages/core/src/`:

- `packages/core/src/format-val.ts`
- `packages/core/src/heatmap-color.ts`

Add subpath exports in `packages/core/package.json`:

```jsonc
"./format-val": { "source": "./src/format-val.ts", "types": "./dist/format-val.d.ts", "import": "./dist/format-val.js" },
"./heatmap-color": { "source": "./src/heatmap-color.ts", "types": "./dist/heatmap-color.d.ts", "import": "./dist/heatmap-color.js" }
```

Update the two-pass core build only if needed (these are leaf modules with no dynamic imports — they ship in the first pass). Update React imports:

- `weight-panel.tsx` → `@wetron/core/format-val`
- `weight-viz.tsx` → `@wetron/core/format-val`, `@wetron/core/heatmap-color`
- `virtual-values.tsx` (no change — does not import either)
- React tests for `format-val` and `heatmap-color` move with the source to `packages/core/test/`.

## Svelte component structure

New files under `packages/svelte/src/node-property-panel/`:

```
weight-panel.svelte        # main panel (mirrors weight-panel.tsx)
weight-histogram.svelte    # split out of weight-viz.tsx
weight-heatmap.svelte      # split out of weight-viz.tsx
virtual-values.svelte      # virtualized numeric grid
```

Why split `weight-viz.svelte` into two files: Svelte components are one-per-file by convention; the React file co-locates two components only because that's the React idiom.

CSS lives in scoped `<style>` blocks per component, mirroring the rest of `packages/svelte/src/node-property-panel/`. No CSS modules.

## Component contracts

### `weight-panel.svelte`

```ts
type Props = {
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  graph: ModelGraph;
  onBack?: () => void;
  isDark?: boolean;
};
```

State:

- `showWeights = $state(graph.fileSizeBytes <= SIZE_THRESHOLD && graph.weights !== undefined)`
- `viz = $state<'dist' | 'heat'>('dist')`
- `loaded = $derived(...)` — runs `decodeWeight` + `computeStats` when `showWeights` is true and weights are present. Uses `$derived` not `$derived.by` because the inputs are simple props.
- `$effect` to auto-enable `showWeights` on the no-weights → weights-loaded transition (mirrors the `prevHadWeights` ref pattern in React, but Svelte's `$effect` with a tracking variable handles it cleanly).

Tab toggle: replace `@base-ui/react` `Tabs.Root` with two `<button>` elements — the React tab list is purely visual, no roving tabindex / arrow-key behaviour to preserve.

### `weight-histogram.svelte`

```ts
type Props = { stats: WeightStats; dtype: string };
```

Direct port. `{#each stats.histogram as count, i}` over bins, set bar height via inline style.

### `weight-heatmap.svelte`

```ts
type Props = { stats: WeightStats; dtype: string; isDark: boolean };
```

Direct port. Uses `pickColormap` and `colorForCell` from `@wetron/core/heatmap-color`. `isDark` flows through unchanged because it controls computed pixel colors, not CSS.

### `virtual-values.svelte`

```ts
type Props = {
  values: Float64Array | Int32Array | BigInt64Array;
  format: (v: number) => string;
  align?: 'center' | 'right';
};
```

Port of `VirtualValues` using `@tanstack/svelte-virtual`. The Svelte equivalent of `useVirtualizer` is `createVirtualizer`, which returns a writable store. The same `count`/`estimateSize`/`overscan` configuration applies. Drop `@base-ui/react/scroll-area` — Svelte uses native overflow scrolling (the rest of the panel does the same; the React `ScrollArea` is wrapped purely for cross-browser scrollbar styling, which native CSS now handles adequately).

`ROW_HEIGHT = 16`, `COLS = 5` — same constants as React.

## Wiring into `node-property-panel.svelte`

Add `graph` prop:

```ts
let { target, graph, onTensorClick, onBack, ... }: {
  target: PanelTarget | null;
  graph?: ModelGraph;
  ...
} = $props();
```

Replace the current `{:else if isTensorTarget(target)}` branch:

```svelte
{:else if isTensorTarget(target)}
  {#if graph?.initializers.has(target.tensor.name)}
    <WeightPanel target={target.tensor} {graph} {onBack} {isDark} />
  {:else}
    <TensorPanel tensor={target.tensor} {onBack} />
  {/if}
```

`isDark` is already computed at this level — pass it through.

## Wiring into `model-graph-view.svelte`

The Svelte `ModelGraphView` already builds a `ModelGraph` internally. Thread it to `NodePropertyPanel` as a new prop. Public API impact: none — the `graph` prop on `NodePropertyPanel` is optional, so direct consumers of `NodePropertyPanel` keep working.

## Package changes

`packages/svelte/package.json`:

- Add `"@tanstack/svelte-virtual": ">=3"` to `peerDependencies`.
- Add the same to `devDependencies` for tests.

`packages/core/package.json`: add the two new subpath exports listed above.

## Test setup

`@wetron/svelte` has no test infrastructure today. Add the absolute minimum:

- `packages/svelte/test/setup.ts` — registers happy-dom (mirrors React setup).
- `packages/svelte/test/weight-panel.test.ts` — one smoke test: WeightPanel mounts with a small initialised tensor, renders the shape / dtype / size rows, and the "Show weights" toggle is present. Skip dist/heat toggle, virtual-values rendering, external-checkpoint copy — those are covered by the equivalent React tests against the same shared core helpers.
- Use `@testing-library/svelte`. Add it plus `@happy-dom/global-registrator` / `happy-dom` to root `devDependencies` if missing.
- `Justfile` `test` recipe already includes `packages/svelte`; no change.

## File-by-file change list

**Move / refactor**

- `packages/react/src/node-property-panel/format-val.ts` → `packages/core/src/format-val.ts`
- `packages/react/src/node-property-panel/heatmap-color.ts` → `packages/core/src/heatmap-color.ts`
- `packages/react/test/format-val.test.ts` → `packages/core/test/format-val.test.ts`
- `packages/react/test/heatmap-color.test.ts` → `packages/core/test/heatmap-color.test.ts`
- React imports: `weight-panel.tsx`, `weight-viz.tsx` updated to `@wetron/core/format-val` / `@wetron/core/heatmap-color`.

**New (Svelte)**

- `packages/svelte/src/node-property-panel/weight-panel.svelte`
- `packages/svelte/src/node-property-panel/weight-histogram.svelte`
- `packages/svelte/src/node-property-panel/weight-heatmap.svelte`
- `packages/svelte/src/node-property-panel/virtual-values.svelte`
- `packages/svelte/test/setup.ts`
- `packages/svelte/test/weight-panel.test.ts`

**Modify**

- `packages/svelte/src/node-property-panel/node-property-panel.svelte` — accept `graph` prop, dispatch to WeightPanel.
- `packages/svelte/src/model-graph-view.svelte` — pass `graph` to `NodePropertyPanel`.
- `packages/svelte/src/index.ts` — export `WeightPanel` to mirror `@wetron/react`.
- `packages/core/package.json` — add two subpath exports.
- `packages/svelte/package.json` — add `@tanstack/svelte-virtual` peer + dev dep.

## Open questions

1. Should `WeightHistogram` and `WeightHeatmap` be exported from `@wetron/svelte`? React doesn't export them individually — they're internal to `WeightPanel`. Default: keep them internal (Svelte mirrors React).
2. Should the React side also split `weight-viz.tsx` into two files for symmetry? Default: no — leave React unchanged, this port only adds parity, it doesn't refactor React.

## Risks

- `@tanstack/svelte-virtual`'s API differs from `@tanstack/react-virtual` in small ways (store vs hook, `getVirtualItems()` vs subscribed value). Worst case: a thin `$derived` wrapper, no architectural impact.
- Native scrollbar styling may look inconsistent with `@base-ui/react/scroll-area` on the React side. Acceptable: each renderer has its own visual idiom; the rest of the Svelte panel already uses native overflow.
- Svelte test setup is new infrastructure — first-time additions can have happy-dom / vite-plugin-svelte friction. Mitigation: use the existing React `setup.ts` as a template.
