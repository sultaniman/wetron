# wetron

Parse and render neural network model graphs in the browser. Supports ONNX, TFLite, and Keras formats. Outputs an interactive node graph using React or Svelte.

Graph structure only — no weight data is read or stored.

## Packages

| Package          | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `@wetron/core`   | IR types, format detection, dtype utilities, Dagre layout |
| `@wetron/onnx`   | ONNX parser (protobufjs)                                  |
| `@wetron/tflite` | TFLite parser (flatbuffers)                               |
| `@wetron/keras`  | Keras `.keras` archive parser                             |
| `@wetron/react`  | React graph view and property panel                       |
| `@wetron/svelte` | Svelte graph view and property panel                      |
| `@wetron/tokens` | Theme constants (colors, CSS vars)                        |

## Requirements

- Bun 1.x
- Browser environment (no Node.js APIs used)

## Setup

```sh
git clone <repo>
cd wetron
bun install
```

## Run tests

```sh
bun test              # all packages
bun test packages/core  # one package
```

## Demo apps

```sh
cd apps/demo && bun dev          # React
cd apps/demo-svelte && bun dev   # Svelte
```

## Usage

### Parse a model

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

### Detect format only

```ts
import { detectFormat } from "@wetron/core";

const format = detectFormat(bytes, filename);
// "onnx" | "tflite" | "keras" | "unknown"
```

Returns `"unknown"` — never throws.

### Render with React

```tsx
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { PanelTarget, ColorMode } from "@wetron/react";

function App() {
  const [graph, setGraph] = useState<ModelGraph | null>(null);
  const [selected, setSelected] = useState<PanelTarget | null>(null);

  return (
    <>
      {graph && (
        <ModelGraphView
          graph={graph}
          onTargetClick={setSelected}
          colorMode="system"
        />
      )}
      <NodePropertyPanel target={selected} colorMode="system" />
    </>
  );
}
```

Peer dependencies: `react` 18+, `@xyflow/react` 12+, `@phosphor-icons/react` 2+.

### Render with Svelte

```svelte
<script>
  import { ModelGraphView, NodePropertyPanel } from "@wetron/svelte";
  let graph = $state(null);
  let selected = $state(null);
</script>

{#if graph}
  <ModelGraphView {graph} onTargetClick={(t) => selected = t} colorMode="system" />
{/if}
<NodePropertyPanel target={selected} colorMode="system" />
```

Peer dependencies: `svelte` 5+, `@xyflow/svelte` 1.5+, `phosphor-svelte` 3+.

### Convert graph to flow nodes manually

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

## Project layout

```
packages/
  core/       # IR types, detection, layout, unified entry
  onnx/       # ONNX parser
  tflite/     # TFLite parser
  keras/      # Keras parser
  react/      # React components
  svelte/     # Svelte components
  tokens/     # Theme constants
apps/
  demo/         # React demo (Vite)
  demo-svelte/  # Svelte demo (Vite)
test-models/    # .onnx and .tflite fixtures
docs/specs/     # Architecture and design specs
```

## Constraints

- Browser-only. All I/O uses `file.arrayBuffer()`, `fetch`, `TextDecoder`, `DataView`.
- No weight deserialization anywhere in the stack.
- No patching of `DataView.prototype` or `BigInt.prototype`.
- `detectFormat` always returns a `Format` string, never throws.

## Adding a new parser

1. Create `packages/<format>/src/parse.ts` exporting a single parse function that returns `ModelGraph`.
2. Import IR types from `@wetron/core/src/ir.ts`.
3. Import exotic dtype readers from `@wetron/core/src/dtypes.ts` — do not inline them.
4. Register the format in `@wetron/core/src/detect.ts` (magic bytes) and `@wetron/core/src/index.ts` (dynamic import).
5. Add tests in `packages/<format>/test/` using real model files from `test-models/`. Node count must match what netron shows for the same file.
