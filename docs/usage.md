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

Import the stylesheet once alongside the component:

```tsx
import "@wetron/react/dist/index.css";
```

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
      <NodePropertyPanel target={selected} colorMode="system" opsets={graph?.opsets} />
    </>
  );
}
```

Peer dependencies: `react` 18+, `@xyflow/react` 12+, `@phosphor-icons/react` 2+, `@base-ui/react` 1+.

### NodePropertyPanel props

| Prop            | Type                                    | Description                                                          |
| --------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `target`        | `PanelTarget \| null`                   | Currently selected node, edge, or tensor; `null` renders nothing     |
| `colorMode`     | `"light" \| "dark" \| "system"`         | Theme; `"system"` follows `prefers-color-scheme`                     |
| `opsets`        | `ReadonlyMap<string, number>`           | Op domain → version map (pass `graph?.opsets`); shown in node header |
| `inputSources`  | `ReadonlyMap<string, string>`           | Tensor name → producing op type; used to color input chips           |
| `tensorShapes`  | `ReadonlyMap<string, { shape, dtype }>` | Shape info for edge panels; pass `graph?.tensorShapes`               |
| `onTensorClick` | `(name: string) => void`                | Called when a tensor name in the panel is clicked                    |
| `onBack`        | `() => void`                            | Shows a back arrow in the header when provided                       |
| `onClose`       | `() => void`                            | Shows a close button when provided                                   |

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

## Theming

`ModelGraphView` wraps its content in a `<div data-theme="light|dark">`. All visual tokens are CSS custom properties defined on that element — override any of them to customise the appearance without rebuilding.

### Node card tokens

| Variable                  | Default (light) | Default (dark) | Controls                                                        |
| ------------------------- | --------------- | -------------- | --------------------------------------------------------------- |
| `--wetron-node-bg`        | `#ffffff`       | `#1e1e2e`      | Card background                                                 |
| `--wetron-node-border`    | `#e0e0e0`       | `#333333`      | Card border                                                     |
| `--wetron-node-muted`     | `#999999`       | `#7a7a9a`      | Subtitle / weight text                                          |
| `--wetron-node-tint-base` | `white`         | `#1e1e2e`      | Base for the category-tinted background on parameter-free nodes |

### Tooltip tokens

| Variable                 | Default (light) | Default (dark) | Controls           |
| ------------------------ | --------------- | -------------- | ------------------ |
| `--wetron-tooltip-bg`    | `#1e1e2e`       | `#2a2a3a`      | Tooltip background |
| `--wetron-tooltip-color` | `#e8e8f0`       | `#e8e8f0`      | Tooltip text       |

### Property panel tokens

| Variable                        | Default (light) | Default (dark) | Controls                      |
| ------------------------------- | --------------- | -------------- | ----------------------------- |
| `--wetron-panel-bg`             | `#ffffff`       | `#1e1e2e`      | Panel background              |
| `--wetron-panel-border`         | `#e0e0e0`       | `#2a2a3a`      | Panel border                  |
| `--wetron-panel-text`           | `#222222`       | `#f0f0f0`      | Primary text                  |
| `--wetron-panel-label`          | `#555555`       | `#a0a0c0`      | Row labels / section headers  |
| `--wetron-panel-value`          | `#333333`       | `#e0e0f0`      | Row values                    |
| `--wetron-panel-subtitle`       | `#aaaaaa`       | `#6a6a8a`      | Node name subtitle            |
| `--wetron-panel-chip-bg`        | `#f0f0f0`       | `#262646`      | Default chip background       |
| `--wetron-panel-chip-color`     | `#888888`       | `#a0a0c0`      | Default chip text             |
| `--wetron-panel-header-border`  | `#eeeeee`       | `#2a2a3a`      | Header bottom border          |
| `--wetron-panel-section-border` | `#f0f0f0`       | `#282840`      | Section divider               |
| `--wetron-panel-close-hover`    | `#f0f0f0`       | `#2a2a3a`      | Close button hover background |

### Example

```css
/* Override in your app's CSS — target the data-theme the graph emits */
[data-theme="light"] {
  --wetron-node-bg: #fafafa;
  --wetron-panel-bg: #f5f5f5;
  --wetron-tooltip-bg: #222;
  --wetron-tooltip-color: #fff;
}

[data-theme="dark"] {
  --wetron-node-bg: #111827;
  --wetron-node-border: #1f2937;
  --wetron-panel-bg: #111827;
}
```

Node category colours (the accent colour per op type) come from `@wetron/tokens` and are not CSS variables — customise them by passing modified `CATEGORY_THEME` values if you fork the theme layer.

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
  readonly opsets?: ReadonlyMap<string, number>; // domain → opset version (ONNX only; "" = ai.onnx)
};

type GraphNode = {
  readonly name: string;
  readonly opType: string;
  readonly domain?: string; // operator domain (ONNX only; absent = standard ai.onnx)
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
