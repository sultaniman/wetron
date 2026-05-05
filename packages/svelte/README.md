# @wetron/svelte

Svelte components for neural network graph visualization. Renders a `ModelGraph` as an interactive node graph using SvelteFlow, with a property panel for inspecting nodes, edges, and tensors.

## Install

```bash
bun add @wetron/svelte
```

## Usage

```svelte
<script>
  import { parseModel } from "@wetron/core";
  import { ModelGraphView, NodePropertyPanel } from "@wetron/svelte";

  let graph = $state(null);
  let target = $state(null);

  async function handleFile(e) {
    const bytes = new Uint8Array(await e.target.files[0].arrayBuffer());
    graph = await parseModel(bytes, e.target.files[0].name);
  }
</script>

<ModelGraphView {graph} onTargetClick={(t) => (target = t)} />
<NodePropertyPanel {target} onClose={() => (target = null)} />
```

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
  colorMode={"light" | "dark" | "system"}
  opsets={ReadonlyMap<string, number>}
  inputSources={ReadonlyMap<string, string>}
  tensorShapes={ReadonlyMap<string, { shape, dtype }>}
  onTensorClick={(name: string) => void}
  onBack={() => void}
  onClose={() => void}
/>
```

### PanelTarget

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
