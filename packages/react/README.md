# @wetron/react

React components for neural network graph visualization. Renders a `ModelGraph` as an interactive node graph using ReactFlow, with a property panel for inspecting nodes, edges, and tensors.

## Install

```bash
pnpm add @wetron/react
```

## Usage

```tsx
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import "@wetron/react/styles.css";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = await parseModel(bytes, file.name);

<ModelGraphView graph={graph} onTargetClick={setTarget} />
<NodePropertyPanel
  target={target}
  graph={graph}                       // enables weight inspection on initializers
  tensorShapes={graph.tensorShapes}
  onClose={() => setTarget(null)}
/>
```

Pass `graph` to `NodePropertyPanel` to inspect initializer tensors. Rank-2 and higher tensors open in the matrix inspector; scalars and vectors open in the distribution inspector. For models larger than 20 MiB, the user must enable `Show weights` before bytes are exposed or decoded.

Built-in inspectors appear when their inputs are supported:

- Matrix/slice: rank 2+, with explicit display axes and fixed indices.
- Distribution: histogram, percentiles, non-finite counts, linear/log scale.
- Per-axis profile: mean, standard deviation, L1/L2, maximum absolute value, zero ratio.
- Sparsity: exact or near-zero ratios and source-traceable blocks.
- Kernel gallery: rank 3–5 after selecting `OIHW`, `OHWI`, `HWIO`, or `IHWO` explicitly.
- Quantization: encoded `Q4_0` block diagnostics.
- Diagnostics: non-finite values, constant slices, and norm outliers.
- Values: the flattened virtualized value grid.

Only the selected inspector is mounted. The compatibility `WeightHeatmap` export remains available but is not part of the default composition.

### Custom weight inspectors

Pass a React node through `weightInspector` to replace the built-in visualization and values grid. The panel header, metadata, loading switch, and statistical summary remain fixed.

```tsx
import { computeWeightDistribution } from '@wetron/core/weight-distribution';
import { NodePropertyPanel, useWeightInspection } from '@wetron/react';

function TensorCount() {
  const inspection = useWeightInspection();
  if (inspection.status !== 'ready') return <div>{inspection.status}</div>;
  const distribution = computeWeightDistribution(inspection.values, 24);
  return (
    <div>
      {inspection.tensor.name}: median {distribution.percentiles.p50}
    </div>
  );
}

<NodePropertyPanel target={target} graph={graph} weightInspector={<TensorCount />} />;
```

`useWeightInspection()` reads the nearest `WeightPanel` and throws outside one. Deferred, external, and unavailable inspections expose `bytes`, `values`, and `stats` as `null`; unsupported inspections expose bytes only. The panel's `Show weights` switch controls the deferred gate.

Custom inspector selectors should mount only their active inspector when analysis is expensive. Changing tensors remounts the inspector subtree and resets its local state.

## API

```ts
function ModelGraphView(props: {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: 'light' | 'dark' | 'system'; // default: "system"
  selectedEdgeTensorName?: string | null;
  searchQuery?: string;
  onWarnings?: (warnings: readonly ParseWarning[]) => void;
  ref?: React.Ref<ModelGraphViewHandle>;
}): JSX.Element;

type ModelGraphViewHandle = {
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  getViewportElement: () => HTMLElement | null;
};

function NodePropertyPanel(props: {
  target: PanelTarget | null;
  graph?: ModelGraph; // pass to route initializer tensors to WeightPanel
  colorMode?: 'light' | 'dark' | 'system';
  opsets?: ReadonlyMap<string, number>;
  inputSources?: ReadonlyMap<string, string>;
  tensorShapes?: ReadonlyMap<string, { shape: readonly number[] | null; dtype: string | null }>;
  weightInspector?: React.ReactNode;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}): JSX.Element;

function WeightPanel(props: {
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  graph: ModelGraph;
  onBack?: () => void;
  isDark?: boolean;
  children?: React.ReactNode;
}): JSX.Element;

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

## Stylesheet

Import once in your entry point:

```ts
import '@wetron/react/styles.css';
```

## Theming

`ModelGraphView` wraps content in `<div data-theme="light|dark">`. Override any token without rebuilding:

| Variable               | Light     | Dark      |
| ---------------------- | --------- | --------- |
| `--wetron-node-bg`     | `#ffffff` | `#1e1e2e` |
| `--wetron-node-border` | `#e0e0e0` | `#333333` |
| `--wetron-panel-bg`    | `#ffffff` | `#1e1e2e` |
| `--wetron-panel-text`  | `#222222` | `#f0f0f0` |

## Peer dependencies

- `react` ≥ 18
- `react-dom` ≥ 18
- `@xyflow/react` ≥ 12
- `@phosphor-icons/react` ≥ 2
- `@base-ui/react` ≥ 1
- `@tanstack/react-virtual` ≥ 3 (used by `WeightPanel`'s values grid)
