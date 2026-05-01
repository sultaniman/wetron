# Usage

## Parse a model

```ts
import { parseModel } from "@wetron/core";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = await parseModel(bytes, file.name);
```

`parseModel` detects the format from magic bytes and dispatches to the right parser. You can also call parsers directly:

```ts
import { parseOnnx } from "@wetron/onnx";
import { parseTflite } from "@wetron/tflite";
import { parseKeras } from "@wetron/keras";

const graph = await parseOnnx(bytes);
const graph = parseTflite(bytes); // sync
const graph = await parseKeras(bytes);
```

On failure all parsers throw `ParseError` with `format` and `context` fields.

## Detect format only

```ts
import { detectFormat } from "@wetron/core";

const format = detectFormat(bytes, filename);
// "onnx" | "tflite" | "keras" | "unknown"
```

Returns `"unknown"` — never throws.

## Render with React

```tsx
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraph, PanelTarget } from "@wetron/react";

function App() {
  const [graph, setGraph] = useState<ModelGraph | null>(null);
  const [selected, setSelected] = useState<PanelTarget | null>(null);

  async function handleFile(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    setGraph(await parseModel(bytes, file.name));
  }

  return (
    <>
      <input
        type="file"
        accept=".onnx,.tflite,.keras"
        onChange={(e) => handleFile(e.target.files![0])}
      />
      {graph && <ModelGraphView graph={graph} onTargetClick={setSelected} colorMode="system" />}
      <NodePropertyPanel target={selected} colorMode="system" />
    </>
  );
}
```

Peer dependencies: `react` 18+, `@xyflow/react` 12+, `@phosphor-icons/react` 2+.

## Render with Svelte

```svelte
<script>
  import { parseModel } from "@wetron/core";
  import { ModelGraphView, NodePropertyPanel } from "@wetron/svelte";
  let graph = $state(null);
  let selected = $state(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    const bytes = new Uint8Array(await file.arrayBuffer());
    graph = await parseModel(bytes, file.name);
  }
</script>

<input type="file" accept=".onnx,.tflite,.keras" on:change={handleFile} />
{#if graph}
  <ModelGraphView {graph} onTargetClick={(t) => selected = t} colorMode="system" />
{/if}
<NodePropertyPanel target={selected} colorMode="system" />
```

Peer dependencies: `svelte` 5+, `@xyflow/svelte` 1.5+, `phosphor-svelte` 3+.

## Convert graph to flow nodes manually

```ts
import { modelGraphToFlow } from "@wetron/core";

const { nodes, edges } = modelGraphToFlow(graph);
// nodes: FlowNode[] — pass directly to ReactFlow / SvelteFlow
// edges: FlowEdge[]
```

## Core types

```ts
type ModelGraph = {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
  readonly initializers: ReadonlyMap<string, { shape: readonly number[]; dtype: string }>;
  readonly tensorShapes: ReadonlyMap<
    string,
    { shape: readonly number[] | null; dtype: string | null }
  >;
};

type GraphNode = {
  readonly name: string;
  readonly opType: string;
  readonly inputs: readonly string[];
  readonly outputs: readonly string[];
  readonly attributes: Readonly<Record<string, AttributeValue>>;
};

type GraphValue = {
  readonly name: string;
  readonly shape: readonly number[] | null;
  readonly dtype: string | null;
};

type AttributeValue = string | number | boolean | readonly number[] | readonly string[];
```
