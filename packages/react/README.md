# @wetron/react

React components for neural network graph visualization. Renders a `ModelGraph` as an interactive node graph using ReactFlow, with a property panel for inspecting nodes, edges, and tensors.

## Install

```bash
bun add @wetron/react
```

## Usage

```tsx
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import "@wetron/react/dist/index.css";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = await parseModel(bytes, file.name);

<ModelGraphView graph={graph} onTargetClick={setTarget} />
<NodePropertyPanel target={target} tensorShapes={graph.tensorShapes} onClose={() => setTarget(null)} />
```

## API

```ts
function ModelGraphView(props: {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: "light" | "dark" | "system"; // default: "system"
}): JSX.Element;

function NodePropertyPanel(props: {
  target: PanelTarget | null;
  colorMode?: "light" | "dark" | "system";
  opsets?: ReadonlyMap<string, number>;
  tensorShapes?: ReadonlyMap<string, { shape: readonly number[] | null; dtype: string | null }>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}): JSX.Element;

type PanelTarget =
  | GraphNode
  | {
      edge: {
        tensorName: string;
        sourceOpType: string;
        shape: readonly number[] | null;
        dtype: string | null;
      };
    }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };
```

## Stylesheet

Import once in your entry point:

```ts
import "@wetron/react/dist/index.css";
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
