---
title: "Svelte"
description: "ModelGraphView and NodePropertyPanel Svelte 5 components for Wetron - built on @xyflow/svelte with runes and CSS custom property theming."
lead: "Drop-in components built on @xyflow/svelte."
weight: 20
---

## ModelGraphView

```svelte
<script>
  import { ModelGraphView } from '@wetron/svelte';
</script>

<ModelGraphView {graph} onTargetClick={(t) => (selected = t)} colorMode="system" />
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
  import { NodePropertyPanel } from '@wetron/svelte';
</script>

<NodePropertyPanel target={selected} colorMode="system" onClose={() => (selected = null)} />
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

## WeightPanel

`NodePropertyPanel` renders `WeightPanel` when `target` names an initializer and `graph` is supplied. The inspector set, the rank and dtype rules that decide which views are offered, and the summary block are the same as [React](react/#weight-inspectors) - matrix, distribution, per-axis profile, sparsity, kernel gallery, quantization, diagnostics, and a virtualized values grid.

Render `WeightPanel` directly to choose which inspectors appear:

```svelte
<script>
  import { WeightPanel, MatrixInspector, SparsityInspector } from '@wetron/svelte';
  import RowNorms from './row-norms.svelte';
</script>

<WeightPanel target={{ name: 'conv1.weight', shape: [64, 3, 7, 7], dtype: 'float32' }} {graph}>
  <MatrixInspector />
  <SparsityInspector />
  <RowNorms />
</WeightPanel>
```

The children snippet replaces `DefaultWeightInspectors`, and the view picker goes with it. The summary block above the picker stays either way. Omit the snippet for the stock picker and all eight views.

### Props

| Prop       | Type                                                                        | Description                                                      |
| ---------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `target`   | `{ name: string; shape: readonly number[] \| null; dtype: string \| null }` | Required. The tensor to decode.                                  |
| `graph`    | `ModelGraph`                                                                | Required. Supplies the weight bytes and the tensor memory order. |
| `onBack`   | `() => void`                                                                | Shows a back arrow when provided.                                |
| `isDark`   | `boolean`                                                                   | Theme for inspector colours. Default `false`.                    |
| `children` | `Snippet`                                                                   | Replaces `DefaultWeightInspectors`.                              |

`DefaultWeightInspectors` exposes `bind:selected` to drive the picker from your own state.

### Writing an inspector

`getWeightInspection()` returns the decoded tensor of the enclosing `WeightPanel`. Call it during component initialization, like any other Svelte context read; it throws outside a `WeightPanel`.

```svelte
<script lang="ts">
  import { getWeightInspection } from '@wetron/svelte';

  const context = getWeightInspection();
  const ready = $derived(context.current.status === 'ready' ? context.current : null);
</script>

{#if ready}
  <p>{ready.tensor.name}: {ready.numeric.length} values, max {ready.stats.max}</p>
{/if}
```

`context.current` and `context.isDark` are getters, so read them inside `$derived` to track changes as the reader switches tensors or themes.

Check `status` before reading the tensor. `values`, `numeric`, and `stats` are `null` in every state except `"ready"`, and each other state means the panel is already showing its own placeholder: `deferred` (the "Show weights" toggle is off), `external` (the checkpoint or external data file has not been attached), `unsupported` (the dtype has no decoder), `unavailable` (no bytes under that name). Rendering nothing is the right response to all four.

`context.current` is [`WeightInspectionData`](../api/weights/#weightinspectiondata). Every stock inspector reads it the same way and takes no props.

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
- Pass `graph` to `NodePropertyPanel` so it can tell initializers from live tensors and open the [weight panel](#weightpanel).
