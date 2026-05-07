# Minimap Click Navigation

## Overview

Clicking anywhere on the minimap navigates the main viewport to that graph location with a short eased animation, matching the standard Netron interaction model.

## Behaviour

- Click a point on the minimap -> viewport centers on that graph coordinate, preserving the current zoom level.
- Transition: 300 ms duration (ReactFlow / SvelteFlow built-in easing).
- Cursor over the minimap: `crosshair` to signal click-to-navigate.

## React (`@wetron/react`)

**File:** `packages/react/src/model-graph-view/model-graph-view.tsx`

Changes to `Inner`:

1. Add `useReactFlow` to the existing `@xyflow/react` import.
2. Call `const rf = useReactFlow()` alongside the existing hooks.
3. Add to `<MiniMap>`:
   - `onClick={(_, pos) => rf.setCenter(pos.x, pos.y, { duration: 300 })}`
   - `cursor: "crosshair"` in the existing `style` object.

## Svelte (`@wetron/svelte`)

**New file:** `packages/svelte/src/minimap-nav.svelte`

A thin wrapper around `<MiniMap>` rendered inside `<SvelteFlow>` so it can call `useSvelteFlow()`. Accepts the same visual props (`style`, `nodeColor`, `maskColor`) and adds an `onclick` handler that calls `setCenter(pos.x, pos.y, { duration: 300 })`.

**File:** `packages/svelte/src/model-graph-view.svelte`

- Import `MinimapNav` from `./minimap-nav.svelte`.
- Replace `<MiniMap .../>` with `<MinimapNav .../>` (same props).

## Out of Scope

- Zoom level change on click (zoom is preserved).
- Drag-to-pan via the `pannable` prop (separate interaction).
- Any changes to edge/node click handlers or the property panel.
