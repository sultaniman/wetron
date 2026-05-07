---
title: "Svelte"
description: "ModelGraphView and NodePropertyPanel Svelte 5 components for Wetron - built on @xyflow/svelte with runes and CSS custom property theming."
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

### Props

| Prop                     | Type                                          | Description                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------- |
| `graph`                  | `ModelGraph`                                  | Required. The parsed model graph.                 |
| `onTargetClick`          | `(target: PanelTarget) => void`               | Called when a node or edge is clicked.            |
| `colorMode`              | `"light" \| "dark" \| "system"`               | Theme. `"system"` follows `prefers-color-scheme`. |
| `selectedEdgeTensorName` | `string \| null`                              | Highlights the matching edge.                     |
| `searchQuery`            | `string`                                      | Dims nodes that don't match the query.            |
| `onWarnings`             | `(warnings: readonly ParseWarning[]) => void` | Called when the graph has parse warnings.         |
| `bind:exportRef`         | `ExportHelpers \| null`                       | Bindable ref for imperative viewport control.     |

### ExportHelpers

```ts
type ExportHelpers = {
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  getViewportElement: () => HTMLElement | null;
};
```

## NodePropertyPanel

```svelte
<script>
  import { NodePropertyPanel } from "@wetron/svelte";
</script>

<NodePropertyPanel
  target={selected}
  colorMode="system"
  onClose={() => selected = null}
/>
```

### Props

| Prop            | Type                                    | Description                                                   |
| --------------- | --------------------------------------- | ------------------------------------------------------------- |
| `target`        | `PanelTarget \| null`                   | Selected node, edge, or tensor. `null` renders nothing.       |
| `colorMode`     | `"light" \| "dark" \| "system"`         | Theme.                                                        |
| `opsets`        | `ReadonlyMap<string, number>`           | Op domain -> version (ONNX only). Shown in node header.       |
| `inputSources`  | `ReadonlyMap<string, string>`           | Tensor name -> producing op type. Used to colour input chips. |
| `tensorShapes`  | `ReadonlyMap<string, { shape, dtype }>` | Shape info for edge panels.                                   |
| `onTensorClick` | `(name: string) => void`                | Called when a tensor name chip is clicked.                    |
| `onBack`        | `() => void`                            | Shows a back arrow when provided.                             |
| `onClose`       | `() => void`                            | Shows a close button when provided.                           |

## PanelTarget type

```ts
type PanelTarget =
  | GraphNode
  | { graphValue: GraphValue; direction: "input" | "output" }
  | {
      edge: {
        tensorName: string;
        from: { opType: string; name: string };
        to: Array<{ opType: string; name: string }>;
      };
    }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };
```

## Peer dependencies

- `svelte` ≥ 5
- `@xyflow/svelte` ≥ 1.5.2
- `phosphor-svelte` ≥ 3

## Implementation notes

- Uses Svelte 5 runes (`$state`, `$derived`, `$effect`).
- `colorMode="system"` reads `prefers-color-scheme` via a media query listener.
- Layout is computed once on mount via Dagre; re-computed when `graph` changes.
- Theme colours for node categories come from `@wetron/tokens`.
- The weight inspection panel (histogram + heatmap) is currently only available in `@wetron/react`. The Svelte `NodePropertyPanel` falls back to `TensorPanel` for initializer tensors. Decode bytes manually with `decodeWeight` / `computeStats` from `@wetron/core` if you need stats in a Svelte app today.
