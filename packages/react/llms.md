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

// Property panel - pass the target from onTargetClick
function NodePropertyPanel(props: {
  target: PanelTarget | null;
  graph?: ModelGraph; // pass to enable WeightPanel routing for initializers
  colorMode?: ColorMode; // default: "system"
  opsets?: ReadonlyMap<string, number>; // ONNX only - domain -> version
  inputSources?: ReadonlyMap<string, string>; // tensor name -> producing op type
  tensorShapes?: ReadonlyMap<string, { shape: readonly number[] | null; dtype: string | null }>;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}): JSX.Element;

// Standalone weight inspector - automatically rendered by NodePropertyPanel
// when a tensor target's name is in graph.initializers.
function WeightPanel(props: {
  target: { name: string; shape: readonly number[] | null; dtype: string | null };
  graph: ModelGraph;
  onBack?: () => void;
  isDark?: boolean; // controls colormap stops (light vs dark theme)
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
- `@tanstack/react-virtual` ≥ 3 (used by `WeightPanel`'s values grid)

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

### WeightPanel-only tokens

The 5-stop sequential colormap (heatmap legend bar) reads from CSS variables, so themes can re-skin it without rebuilding:

| Variable                | Light     | Dark      | Controls                          |
| ----------------------- | --------- | --------- | --------------------------------- |
| `--wetron-heat-stop-0`  | `#eff6ff` | `#bfdbfe` | colormap stop 0 (low values)      |
| `--wetron-heat-stop-1`  | `#bfdbfe` | `#93c5fd` | colormap stop 1                   |
| `--wetron-heat-stop-2`  | `#60a5fa` | `#3b82f6` | colormap stop 2 (mid)             |
| `--wetron-heat-stop-3`  | `#2563eb` | `#1d4ed8` | colormap stop 3                   |
| `--wetron-heat-stop-4`  | `#1e3a8a` | `#1e3a8a` | colormap stop 4 (high values)     |
| `--wetron-seg-bg`       | `#f1f5f9` | `rgba(255,255,255,.06)` | segmented (`dist|heat`) bg |
| `--wetron-seg-color`    | `#64748b` | `#94a3b8` | inactive tab text color           |
| `--wetron-seg-on-bg`    | `#fff`    | `rgba(255,255,255,.12)` | active tab bg                     |
| `--wetron-seg-on-color` | `#2563eb` | `#f1f5f9` | active tab text color             |

Both themes ramp pale → deep low-to-high, so the same data renders with consistent direction across modes. Tile colors are JS-computed (light vs dark stop arrays selected via `isDark` prop); the legend bar uses the matching CSS variables so the two stay in sync.

## Implementation notes

- `ModelGraphView` calls `modelGraphToFlow` from `@wetron/core/transform` internally - consumers pass a `ModelGraph`, not raw flow nodes.
- Two custom ReactFlow node types: `graphNode` (op nodes) and `ioNode` (graph inputs/outputs).
- One custom edge type: `modelEdge`.
- `colorMode="system"` reads `prefers-color-scheme` via a media query listener.
- Theme colors for node categories come from `@wetron/tokens`.
- Layout is computed once on mount via Dagre (top-to-bottom); re-computed when `graph` prop changes.

## WeightPanel routing & rendering

When `NodePropertyPanel` receives a tensor target whose name appears in `graph.initializers`, it renders `WeightPanel` instead of the default `TensorPanel`. The panel sections, top-to-bottom:

1. **Header** - icon + title + ellipsized tensor name (full name shown via overflow tooltip).
2. **Info** - `shape`, `dtype`, `size` (humanized bytes from `shape × dtype-size`).
3. **Show weights toggle** - master gate. Initial state is on for small models (`fileSizeBytes ≤ 20 MiB`) and off for large models, where an amber size note explains the gate. When off, the viz and values sections do not render and `graph.weights.get` is never called.
4. **Distribution / Heatmap** - segmented `dist | heat` switcher (base-ui `Tabs`), stat rows (`min`, `max`, `μ ± σ`, `zeros`), and the chosen visualization:
   - `dist`: 12-bar histogram, 2px minimum bar height for non-empty bins so flat tails stay visible. Each bar has a `title` tooltip with bin range and count.
   - `heat`: 16×8 heatmap of chunk means. Tile colors auto-scale to the heatmap's own `cellMin..cellMax` (not the tensor's full range) so subtle inter-cell variation is visible. Each tile has a `title` tooltip with the chunk mean and index range.
5. **Values** - virtualized 5-column grid using `@tanstack/react-virtual`. Renders only the rows visible in the 320px viewport regardless of tensor size; integer dtypes center-aligned, floats right-aligned. `ScrollArea` from `@base-ui/react` provides the styled scrollbar matching the outer panel.

Number formatting (`formatVal`) is dtype-aware:

- Integer dtypes (`int*`, `uint*`, `bool`) - plain integer (`140`).
- Float in `|v| ∈ [0.001, 1000)` - 3 decimals with leading zero stripped (`-.184`).
- Float outside that range - scientific 2 sig figs (`1.5e-4`, `2.5e+7`).
- `NaN` / `±Inf` / `0` are rendered as those literals.

The colormap uses `pickColormap(min, max)` to choose between `sequential` (any non-zero range) and `constant` (`min === max`, returns a translucent slate so the panel bg shows through). `colorForCell(value, min, max, kind, isDark)` interpolates between 5 stops; `isDark` selects between light and dark stop arrays, both ramping pale → deep low-to-high.
