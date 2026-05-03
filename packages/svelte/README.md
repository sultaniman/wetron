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

```svelte
<ModelGraphView
  graph={ModelGraph}
  onTargetClick={(target: PanelTarget) => void}
  colorMode={"light" | "dark" | "system"}
/>

<NodePropertyPanel
  target={PanelTarget | null}
  colorMode={"light" | "dark" | "system"}
/>
```

## Peer dependencies

- `svelte` ≥ 5
- `@xyflow/svelte` ≥ 1.5.2
- `phosphor-svelte` ≥ 3
