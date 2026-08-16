# @wetron/svelte

Svelte components for neural network graph visualization. Renders a `ModelGraph` as an interactive node graph using SvelteFlow, with a property panel for inspecting nodes, edges, and tensors.

## Install

```bash
pnpm add @wetron/svelte
```

## Usage

```svelte
<script>
  import { parseModel } from '@wetron/core';
  import { ModelGraphView, NodePropertyPanel } from '@wetron/svelte';

  let graph = $state(null);
  let target = $state(null);

  async function handleFile(e) {
    const bytes = new Uint8Array(await e.target.files[0].arrayBuffer());
    graph = await parseModel(bytes, e.target.files[0].name);
  }
</script>

<ModelGraphView {graph} onTargetClick={(t) => (target = t)} />
<NodePropertyPanel {target} {graph} onClose={() => (target = null)} />
```

Passing `graph` routes initializer tensors to the built-in inspectors. Rank-2 and higher tensors open in the matrix inspector; scalars and vectors open in the distribution inspector. Models larger than 20 MiB remain deferred until the user enables `Show weights`.

Built-in inspectors appear when their inputs are supported:

- Matrix/slice: rank 2+, with explicit display axes and fixed indices.
- Distribution: histogram, percentiles, non-finite counts, linear/log scale.
- Per-axis profile: mean, standard deviation, L1/L2, maximum absolute value, zero ratio.
- Sparsity: exact or near-zero ratios and source-traceable blocks.
- Kernel gallery: rank 3–5 after selecting `OIHW`, `OHWI`, `HWIO`, or `IHWO` explicitly.
- Quantization: encoded `Q4_0` block diagnostics.
- Diagnostics: non-finite values, constant slices, and norm outliers.
- Values: the flattened virtualized value grid.

Only the selected inspector is mounted. `WeightHeatmap` remains exported for compatibility but is not part of the default composition.

### Custom weight inspectors

Create an inspector component that reads the nearest `WeightPanel` context:

```svelte
<!-- TensorCount.svelte -->
<script lang="ts">
  import { getWeightInspection } from '@wetron/svelte';
  import { computeWeightDistribution } from '@wetron/core/weight-distribution';

  const context = getWeightInspection();
  const inspection = $derived(context.current);
  const distribution = $derived(
    inspection.status === 'ready' ? computeWeightDistribution(inspection.values, 24) : null,
  );
</script>

<div>
  {inspection.tensor.name}:
  {distribution ? `median ${distribution.percentiles.p50}` : inspection.status}
</div>
```

Pass it through the `weightInspector` snippet:

```svelte
<NodePropertyPanel {target} {graph}>
  {#snippet weightInspector()}
    <TensorCount />
  {/snippet}
</NodePropertyPanel>
```

`getWeightInspection()` reads the nearest `WeightPanel` and throws outside one. Its `current` getter stays reactive as loading state changes. Deferred, external, and unavailable inspections expose `bytes`, `values`, and `stats` as `null`; unsupported inspections expose bytes only. The panel's `Show weights` switch controls the deferred gate.

Custom inspector selectors should mount only their active inspector when analysis is expensive. Changing tensors remounts the inspector subtree and resets its local state.

## API

### ModelGraphView

```svelte
<ModelGraphView
  graph={ModelGraph}
  onTargetClick={(target: PanelTarget) => void}
  colorMode={"light" | "dark" | "system"}
  selectedEdgeTensorName={string | null}
  searchQuery={string}
  onWarnings={(warnings: readonly ParseWarning[]) => void}
  bind:exportRef={ExportHelpers | null}
/>
```

`bind:exportRef` gives imperative access to the graph viewport:

```ts
type ExportHelpers = {
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  getViewportElement: () => HTMLElement | null;
};
```

### NodePropertyPanel

```svelte
<NodePropertyPanel
  target={PanelTarget | null}
  graph={ModelGraph}
  colorMode={"light" | "dark" | "system"}
  opsets={ReadonlyMap<string, number>}
  inputSources={ReadonlyMap<string, string>}
  tensorShapes={ReadonlyMap<string, { shape, dtype }>}
  onTensorClick={(name: string) => void}
  onBack={() => void}
  onClose={() => void}
>
  {#snippet weightInspector()}{/* custom inspector */}{/snippet}
</NodePropertyPanel>
```

### PanelTarget

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

## Peer dependencies

- `svelte` ≥ 5
- `@xyflow/svelte` ≥ 1.5.2
- `phosphor-svelte` ≥ 3
