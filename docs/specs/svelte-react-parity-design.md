# Svelte/React Renderer Parity

Status: proposed.

Close the remaining feature gap between `@wetron/svelte` and `@wetron/react` so the two renderers expose the same UX. This is a precondition for `@wetron/embed` (see `embed-design.md`), which wraps `@wetron/svelte` in a custom element and must not regress UX relative to the React demo.

The earlier weight-panel port (`svelte-weight-panel-port-design.md`) shipped; weight inspection, virtual values, histogram, and heatmap are at parity. What remains is three behavior gaps and one cosmetic.

## Goals

- `@wetron/svelte` supports layout direction (`TB` / `LR`) via the same `rankdir` prop the React renderer exposes.
- `@wetron/svelte`'s `ExportHelpers` ref includes the sub-graph navigation methods the React `ModelGraphViewHandle` exposes.
- `@wetron/svelte`'s `NodePropertyPanel` / `OpPanel` exposes the "Open sub-graph" affordance via an `onOpenSubGraph` callback prop, matching React.
- Scope-chrome back button uses a Phosphor icon, matching React.

## Non-goals

- No new features that don't already exist in `@wetron/react`. This spec is parity, not divergence.
- No public-API additions on the React side.
- No internal refactor of `@wetron/svelte` beyond what the gaps require.
- No additional test infrastructure beyond what `svelte-weight-panel-port-design.md` already added.

## Gap 1 - `rankdir` prop on `ModelGraphView`

React reference: `packages/react/src/model-graph-view/model-graph-view.tsx:76`, `:80`, `:98`.

The type already lives in core: `LayoutDirection = "TB" | "LR"` at `packages/core/src/transform.ts:65`. `modelGraphToFlow(options.rankdir)` is already plumbed at `packages/core/src/transform.ts:69-74`. Nothing to change in core.

Svelte side - `packages/svelte/src/model-graph-view.svelte:24-32`:

```svelte
<script lang="ts">
  import type { LayoutDirection } from "@wetron/core/transform";

  let {
    graph,
    colorMode = "system",
    rankdir = "TB" as LayoutDirection,
    // ...existing props
  }: {
    graph: ModelGraph;
    colorMode?: ColorMode;
    rankdir?: LayoutDirection;
    // ...
  } = $props();
</script>
```

Thread `rankdir` into wherever the Svelte view calls `modelGraphToFlow` (or its equivalent layout step). Default is `"TB"`; `"LR"` produces the left-to-right layout.

## Gap 2 - sub-graph navigation on the `ExportHelpers` ref

React reference: `packages/react/src/model-graph-view/model-graph-view.tsx:53-66` (`ModelGraphViewHandle` includes `navigateInto`, `navigateBack`).

Svelte side - `packages/svelte/src/export-helper.svelte:4-10`:

```ts
export type ExportHelpers = {
  fitAll: () => void;
  getViewport: () => Viewport;
  setViewport: (v: Viewport) => void;
  getNodesBounds: () => Bounds;
  getViewportElement: () => HTMLElement | null;
  navigateInto: (subGraph: ModelGraph) => void;
  navigateBack: () => void;
};
```

Implementation - the methods proxy to the `SubGraphNav` context already used internally by `model-graph-view.svelte`. Inside `export-helper.svelte`'s mount logic, read the context and bind it once:

```svelte
<script lang="ts">
  import { getSubGraphNavContext } from "./model-graph-view/nav-context";

  const nav = getSubGraphNavContext();

  // ...existing fitAll/getViewport/setViewport assignments...
  exportRef.navigateInto = (subGraph) => nav.navigateInto(subGraph);
  exportRef.navigateBack = () => nav.navigateBack();
</script>
```

If `SubGraphNav` is not yet bindable via context outside `ModelGraphView`, expose a context getter (`getSubGraphNavContext`) from `nav-context.ts` mirroring the React `useSubGraphNav` hook.

## Gap 3 - `onOpenSubGraph` callback on `NodePropertyPanel` / `OpPanel`

React reference:

- `packages/react/src/node-property-panel/node-property-panel.tsx:40` (prop declaration)
- `packages/react/src/node-property-panel/op-panel/op-panel.tsx:79-90` (button render)

Svelte changes:

1. `packages/svelte/src/node-property-panel/node-property-panel.svelte:15-25` - add `onOpenSubGraph?: (subGraph: ModelGraph) => void` to the props interface, forward to `OpPanel`.

2. `packages/svelte/src/node-property-panel/op-panel.svelte` - accept the callback, render the "Open sub-graph" button when `node.subGraph && onOpenSubGraph`:

   ```svelte
   {#if node.subGraph && onOpenSubGraph}
     <button class="open-subgraph" onclick={() => onOpenSubGraph(node.subGraph)}>
       Open sub-graph
     </button>
   {/if}
   ```

   Style block adapted from React `op-panel.module.css`'s `.openSubGraph` rule; keep visual parity (Phosphor `ArrowRight` icon, same padding/typography).

3. `packages/svelte/src/model-graph-view.svelte` - if the view internally drives sub-graph navigation through the same `SubGraphNav` context, wire `onOpenSubGraph` to call `nav.navigateInto`. Otherwise add a thin internal handler that does so. Public props on `ModelGraphView` unchanged - consumers of `NodePropertyPanel` directly gain the new prop; consumers using `ModelGraphView` see no API change.

## Gap 4 - scope-chrome back button icon

React: `packages/react/src/model-graph-view/scope-chrome.tsx:15` uses Phosphor `ArrowLeftIcon`.

Svelte: `packages/svelte/src/model-graph-view/scope-chrome.svelte:12` uses Unicode "←".

Swap the Unicode glyph for `phosphor-svelte/ArrowLeft`:

```svelte
<script>
  import ArrowLeft from "phosphor-svelte/lib/ArrowLeft";
</script>

<button class="back" onclick={onBack}>
  <ArrowLeft size={14} weight="bold" />
  Back
</button>
```

Same import pattern as the existing Phosphor usage in `category-icon.svelte`.

## Test surface

Three additions to `packages/svelte/test/`:

- `model-graph-view.test.ts` - mount with `rankdir="LR"`, assert the laid-out node coordinates are wider than tall (a proxy for horizontal flow direction).
- `export-helper.test.ts` - mount, capture the `ExportHelpers` ref, assert `navigateInto` and `navigateBack` exist and are functions. No need to exercise the full nav flow; that's covered by React tests against the shared `SubGraphNav` core.
- `op-panel.test.ts` - mount `OpPanel` with a node carrying a `subGraph` and an `onOpenSubGraph` spy; click the rendered button; assert the spy fires with the correct sub-graph.

No new test infrastructure; reuse the setup from `svelte-weight-panel-port-design.md`.

## File-by-file change list

**Modify**

- `packages/svelte/src/model-graph-view.svelte` - add `rankdir` prop, thread to layout call.
- `packages/svelte/src/export-helper.svelte` - extend `ExportHelpers` type, bind `navigateInto`/`navigateBack` from `SubGraphNav` context.
- `packages/svelte/src/model-graph-view/nav-context.ts` - export `getSubGraphNavContext` if not already accessible outside `ModelGraphView`.
- `packages/svelte/src/node-property-panel/node-property-panel.svelte` - add `onOpenSubGraph` prop, forward to `OpPanel`.
- `packages/svelte/src/node-property-panel/op-panel.svelte` - accept and render "Open sub-graph" button.
- `packages/svelte/src/model-graph-view/scope-chrome.svelte` - swap Unicode arrow for `phosphor-svelte/ArrowLeft`.

**New**

- `packages/svelte/test/model-graph-view.test.ts`
- `packages/svelte/test/export-helper.test.ts`
- `packages/svelte/test/op-panel.test.ts`

## Risks

- `SubGraphNav` context plumbing in Svelte may not be reachable from `ExportHelper` if the context is currently scoped under `ModelGraphView`'s sub-tree. Mitigation: hoist the context provider one level so `ExportHelper` (which lives at the same level) can read it. Falls back to passing a callback prop pair (`onNavigateInto`/`onNavigateBack`) if context restructuring proves invasive - same observable behavior on the ref.
- `LayoutDirection` is `"TB" | "LR"` only; if the underlying Dagre layout misbehaves on `"LR"` with sub-graphs (sub-graph drilling re-runs layout), surface as a follow-up bug, not a blocker for parity.
