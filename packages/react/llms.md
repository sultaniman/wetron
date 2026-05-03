# @wetron/react

React components for neural network graph visualization. Renders a `ModelGraph` IR as an interactive node graph using ReactFlow, with a property panel for inspecting selected nodes, edges, and tensors.

## API

```ts
// Main graph view
function ModelGraphView(props: {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: ColorMode; // default: "system"
}): JSX.Element;

// Property panel — pass the target from onTargetClick
function NodePropertyPanel(props: {
  target: PanelTarget | null;
  colorMode?: ColorMode; // default: "system"
  opsets?: ReadonlyMap<string, number>; // ONNX only — domain → version
  inputSources?: ReadonlyMap<string, string>; // tensor name → producing op type
  tensorShapes?: ReadonlyMap<string, { shape: readonly number[] | null; dtype: string | null }>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}): JSX.Element;

// Type guard: check if a PanelTarget is a GraphNode
function isGraphNode(t: PanelTarget): t is GraphNode;
```

## Types

```ts
type ColorMode = "light" | "dark" | "system";

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

## Peer dependencies

- `react` ≥ 18
- `react-dom` ≥ 18
- `@xyflow/react` ≥ 12
- `@phosphor-icons/react` ≥ 2
- `@base-ui/react` ≥ 1

## CSS custom properties (theming)

`ModelGraphView` wraps content in `<div data-theme="light|dark">`. Override any token without rebuilding:

| Variable                 | Light     | Dark      | Controls               |
| ------------------------ | --------- | --------- | ---------------------- |
| `--wetron-node-bg`       | `#ffffff` | `#1e1e2e` | Card background        |
| `--wetron-node-border`   | `#e0e0e0` | `#333333` | Card border            |
| `--wetron-node-muted`    | `#999999` | `#7a7a9a` | Subtitle / weight text |
| `--wetron-panel-bg`      | `#ffffff` | `#1e1e2e` | Panel background       |
| `--wetron-panel-border`  | `#e0e0e0` | `#2a2a3a` | Panel border           |
| `--wetron-panel-text`    | `#222222` | `#f0f0f0` | Primary text           |
| `--wetron-panel-label`   | `#555555` | `#a0a0c0` | Row labels             |
| `--wetron-panel-chip-bg` | `#f0f0f0` | `#262646` | Chip background        |
| `--wetron-tooltip-bg`    | `#1e1e2e` | `#2a2a3a` | Tooltip background     |
| `--wetron-tooltip-color` | `#e8e8f0` | `#e8e8f0` | Tooltip text           |

## Implementation notes

- `ModelGraphView` calls `modelGraphToFlow` from `@wetron/core/transform` internally — consumers pass a `ModelGraph`, not raw flow nodes.
- Two custom ReactFlow node types: `graphNode` (op nodes) and `ioNode` (graph inputs/outputs).
- One custom edge type: `modelEdge`.
- `colorMode="system"` reads `prefers-color-scheme` via a media query listener.
- Theme colors for node categories come from `@wetron/tokens`.
- Layout is computed once on mount via Dagre (top-to-bottom); re-computed when `graph` prop changes.
