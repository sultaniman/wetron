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
import "@wetron/react/styles.css";

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
  colorMode?: "light" | "dark" | "system";
  opsets?: ReadonlyMap<string, number>;
  inputSources?: ReadonlyMap<string, string>;
  tensorShapes?: ReadonlyMap<string, { shape: readonly number[] | null; dtype: string | null }>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}): JSX.Element;

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

Use `isGraphNode(target)` from `@wetron/react` to narrow to `GraphNode`.

````

## Stylesheet

Import once in your entry point:

```ts
import "@wetron/react/styles.css";
````

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
