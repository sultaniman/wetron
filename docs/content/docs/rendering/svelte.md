---
title: "Svelte"
description: "ModelGraphView and NodePropertyPanel Svelte 5 components for Wetron — built on @xyflow/svelte with runes and CSS custom property theming."
lead: "Drop-in components built on @xyflow/svelte."
weight: 20
---

## ModelGraphView

```svelte
<script>
  import { ModelGraphView } from "@wetron/svelte";
</script>

<ModelGraphView
  graph={graph}
  onTargetClick={(t) => selected = t}
  colorMode="system"
/>
```

## NodePropertyPanel

```svelte
<script>
  import { NodePropertyPanel } from "@wetron/svelte";
</script>

<NodePropertyPanel
  target={selected}
  colorMode="system"
/>
```

## Types

```ts
type ColorMode = "light" | "dark" | "system";

type PanelTarget =
  | GraphNode
  | { edge: { tensorName: string; sourceOpType: string; shape: readonly number[] | null; dtype: string | null } }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };
```

## Peer dependencies

- `svelte` ≥ 5
- `@xyflow/svelte` ≥ 1.5
- `phosphor-svelte` ≥ 3

## Implementation notes

- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`).
- `colorMode="system"` reads `prefers-color-scheme` via a media query listener.
- Layout is computed once on mount via Dagre; re-computed when `graph` changes.
- Theme colours for node categories come from `@wetron/tokens`.
