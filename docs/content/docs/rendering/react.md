---
title: 'React'
description: 'ModelGraphView and NodePropertyPanel React components for Wetron - built on @xyflow/react with full TypeScript types and CSS custom property theming.'
lead: 'Drop-in components built on @xyflow/react.'
weight: 10
---

Import the stylesheet once in your entry point:

```ts
import '@wetron/react/styles.css';
```

## ModelGraphView

```tsx
import { ModelGraphView } from '@wetron/react';

<ModelGraphView
  graph={graph} // ModelGraph - required
  onTargetClick={setSelected} // (target: PanelTarget) => void
  colorMode="system" // "light" | "dark" | "system" (default: "system")
  onWarnings={(w) => console.warn(w)} // called when graph has parse warnings
  selectedEdgeTensorName={null} // highlights the matching edge
  searchQuery="" // dims nodes that don't match the query
/>;
```

Renders the full interactive graph. Nodes are coloured by operator category. Click a node or edge to receive a `PanelTarget` you can pass to `NodePropertyPanel`.

{{< themed-img light="images/graph-with-heatmap-light.png" dark="images/graph-with-heatmap-dark.png" alt="ModelGraphView with NodePropertyPanel open on a weight tensor" >}}

### Props

| Prop                     | Type                                          | Description                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------- |
| `graph`                  | `ModelGraph`                                  | Required. The parsed model graph.                 |
| `onTargetClick`          | `(target: PanelTarget) => void`               | Called when a node or edge is clicked.            |
| `colorMode`              | `"light" \| "dark" \| "system"`               | Theme. `"system"` follows `prefers-color-scheme`. |
| `onWarnings`             | `(warnings: readonly ParseWarning[]) => void` | Called when the graph has parse warnings.         |
| `selectedEdgeTensorName` | `string \| null`                              | Highlights the matching edge.                     |
| `searchQuery`            | `string`                                      | Dims nodes that don't match the query.            |

## NodePropertyPanel

```tsx
import { NodePropertyPanel } from '@wetron/react';

<NodePropertyPanel
  target={selected} // PanelTarget | null - null renders nothing
  graph={graph} // ModelGraph - enables the weight panel for initializer tensors
  colorMode="system"
  opsets={graph?.opsets} // ReadonlyMap<string, number> - ONNX domain versions
  tensorShapes={graph?.tensorShapes} // shape info for edge panels
  onTensorClick={(name) => {}} // called when a tensor name chip is clicked
  onBack={() => {}} // shows a back arrow when provided
  onClose={() => setSelected(null)} // shows a close button when provided
/>;
```

### Props

| Prop            | Type                                    | Description                                                                              |
| --------------- | --------------------------------------- | ---------------------------------------------------------------------------------------- |
| `target`        | `PanelTarget \| null`                   | Selected node, edge, or tensor. `null` renders nothing.                                  |
| `graph`         | `ModelGraph`                            | Required to render the weight panel for initializer tensors. Omit to disable that panel. |
| `colorMode`     | `"light" \| "dark" \| "system"`         | Theme. `"system"` follows `prefers-color-scheme`.                                        |
| `opsets`        | `ReadonlyMap<string, number>`           | Op domain -> version (ONNX only). Shown in node header.                                  |
| `inputSources`  | `ReadonlyMap<string, string>`           | Tensor name -> producing op type. Used to colour input chips.                            |
| `tensorShapes`  | `ReadonlyMap<string, { shape, dtype }>` | Shape info for edge panels.                                                              |
| `onTensorClick` | `(name: string) => void`                | Called when a tensor name chip is clicked.                                               |
| `onBack`        | `() => void`                            | Shows a back arrow when provided.                                                        |
| `onClose`       | `() => void`                            | Shows a close button when provided.                                                      |

### Weight panel

When `target` resolves to an initializer tensor (a name present in `graph.initializers`) and `graph` is supplied, the panel switches to the weight panel. It auto-enables decoding for models where `fileSizeBytes <= 20MB` and `graph.weights.kind === "available"`, and offers an explicit "Show weights" toggle for larger files. The toggle is disabled for `weights.kind === "external"`; the panel identifies whether SavedModel checkpoint files or ONNX external data are required.

The panel uses `decodeWeight` and `computeStats` from `@wetron/core` internally. The summary block above the view picker - `min`, `max`, `μ ± σ`, `zeros` - is computed over every decoded value and does not change when you switch views. See [Weights](../api/weights/) for the underlying `WeightStats`.

### Weight inspectors

Below the summary block, `DefaultWeightInspectors` renders a view picker and the selected inspector. Which views are offered depends on the tensor's rank and dtype:

| View               | `WeightInspectorName` | Offered when         | Shows                                                                             |
| ------------------ | --------------------- | -------------------- | --------------------------------------------------------------------------------- |
| matrix             | `matrix`              | rank ≥ 2             | Heatmap of a 2-D slice. Cells are block means, not individual weights.            |
| distribution       | `distribution`        | always               | Histogram of every decoded value, with percentiles and non-finite counts.         |
| per-axis profile   | `axis`                | rank ≥ 1             | One metric per index along an axis: mean, std, L1, L2, max-abs, or zero-ratio.    |
| sparsity           | `sparsity`            | always               | Where the zeros are. Structured blocks are prunable; scattered zeros are not.     |
| kernel gallery     | `kernel`              | rank 4, all dims > 0 | Each output filter's spatial kernel at one input channel, under a chosen layout.  |
| quantization       | `quantization`        | dtype `Q4_0`         | How the encoded blocks use their code space, before dequantization.               |
| diagnostics        | `diagnostics`         | rank ≥ 1             | Automated checks for non-finite, constant, and outlier slices.                    |
| values             | `values`              | always               | Raw decoded values in flattened memory order.                                     |

Tensors of rank ≥ 2 open on `matrix`; everything else opens on `distribution`.

Each inspector is also exported on its own (`MatrixInspector`, `DistributionInspector`, `AxisProfileInspector`, `SparsityInspector`, `KernelGalleryInspector`, `QuantizationInspector`, `DiagnosticsInspector`, `ValuesInspector`) and reads the decoded tensor from the surrounding weight-inspection context.

{{< themed-img-row >}}
{{< themed-img light="images/property-panel-matrix-light.png" dark="images/property-panel-matrix-dark.png" alt="Weight panel - matrix inspector, a downsampled 2-D heatmap with row and column axis pickers" >}}
{{< themed-img light="images/property-panel-distribution-light.png" dark="images/property-panel-distribution-dark.png" alt="Weight panel - distribution inspector, a histogram with linear/log count and percentile readouts" >}}
{{< /themed-img-row >}}

{{< themed-img-row >}}
{{< themed-img light="images/property-panel-axis-profile-light.png" dark="images/property-panel-axis-profile-dark.png" alt="Weight panel - per-axis profile inspector, one bar per index along the selected axis" >}}
{{< themed-img light="images/property-panel-sparsity-light.png" dark="images/property-panel-sparsity-dark.png" alt="Weight panel - sparsity inspector, zero ratio, dead slice count, and a block occupancy map" >}}
{{< /themed-img-row >}}

{{< themed-img-row >}}
{{< themed-img light="images/property-panel-kernel-gallery-light.png" dark="images/property-panel-kernel-gallery-dark.png" alt="Weight panel - kernel gallery inspector, per-filter 3x3 kernels with L2 norms under an OIHW layout" >}}
{{< themed-img light="images/property-panel-diagnostics-light.png" dark="images/property-panel-diagnostics-dark.png" alt="Weight panel - diagnostics inspector listing norm outlier and constant slice findings" >}}
{{< /themed-img-row >}}

## PanelTarget type

```ts
type PanelTarget =
  | GraphNode
  | { graphValue: GraphValue; direction: 'input' | 'output' }
  | {
      edge: {
        tensorName: string;
        from: { opType: string; name: string };
        to: Array<{ opType: string; name: string }>;
      };
    }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };
```

Use `isGraphNode(target)` from `@wetron/react` to narrow to `GraphNode`.

## ModelGraphViewHandle (ref)

Pass a `ref` to `ModelGraphView` to get imperative control:

```ts
const ref = useRef<ModelGraphViewHandle>(null);

type ModelGraphViewHandle = {
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  getViewportElement: () => HTMLElement | null;
};
```

## Peer dependencies

- `react` ≥ 18
- `react-dom` ≥ 18
- `@xyflow/react` ≥ 12
- `@phosphor-icons/react` ≥ 2
- `@base-ui/react` ≥ 1
