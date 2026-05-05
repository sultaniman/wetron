# wetron - Graph UX Polish Design

**Date:** 2026-04-30
**Status:** Approved
**Packages affected:** `@wetron/core`, `@wetron/onnx`, `@wetron/tflite`, `@wetron/react`, `apps/demo`

## Overview

Five improvements targeting netron UX parity:

1. **Fan-out Connection Properties** - edge click shows all consumer nodes for a tensor, not just one target
2. **Edge highlighting** - clicking an edge highlights every edge carrying the same tensor in red
3. **Panel close button** - × button to dismiss the properties panel
4. **Weight shapes on node cards** - Conv/Gemm/etc. cards show `W 〈shape〉` / `B 〈shape〉` rows; node path name removed from cards
5. **Misc polish** - remove ReactFlow watermark; hide empty ONNX optional inputs in OpPanel

---

## Data Model Changes (`@wetron/core`)

### `ModelGraph` - add `initializers`

`packages/core/src/ir.ts`:

```ts
export interface ModelGraph {
  readonly name: string;
  readonly inputs: readonly GraphValue[];
  readonly outputs: readonly GraphValue[];
  readonly nodes: readonly GraphNode[];
  readonly initializers: ReadonlyMap<
    string,
    {
      readonly shape: readonly number[];
      readonly dtype: string;
    }
  >;
}
```

All existing `ModelGraph` literals in tests gain `initializers: new Map()`.

### `op-inputs.ts` - new file

`packages/core/src/op-inputs.ts`:

```ts
const OP_INPUT_LABELS: Record<string, readonly string[]> = {
  // Convolution
  Conv: ["X", "W", "B"],
  ConvTranspose: ["X", "W", "B"],
  // Matrix multiply / linear
  Gemm: ["A", "B", "C"],
  MatMul: ["A", "B"],
  // Normalization
  BatchNormalization: ["X", "scale", "B", "mean", "var"],
  LayerNormalization: ["X", "Scale", "B"],
  GroupNormalization: ["X", "scale", "bias"],
  InstanceNormalization: ["input", "scale", "B"],
  // Recurrent
  LSTM: ["X", "W", "R", "B", "sequence_lens", "initial_h", "initial_c", "P"],
  GRU: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
  RNN: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
  // Quantized
  QLinearConv: [
    "x",
    "x_scale",
    "x_zero_point",
    "w",
    "w_scale",
    "w_zero_point",
    "y_scale",
    "y_zero_point",
    "B",
  ],
  QLinearMatMul: [
    "a",
    "a_scale",
    "a_zero_point",
    "b",
    "b_scale",
    "b_zero_point",
    "y_scale",
    "y_zero_point",
  ],
  // TFLite builtin op names
  CONV_2D: ["input", "filter", "bias"],
  DEPTHWISE_CONV_2D: ["input", "filter", "bias"],
  FULLY_CONNECTED: ["input", "weights", "bias"],
  TRANSPOSE_CONV: ["output_shape", "filter", "input", "bias"],
  BATCH_MATMUL: ["input", "filter"],
};

export function opInputLabels(opType: string): readonly string[] {
  return OP_INPUT_LABELS[opType] ?? [];
}
```

Exported from `packages/core/src/index.ts`.

### `FlowEdge.data` - add node names

`packages/core/src/transform.ts`, `FlowEdge.data` gains two fields:

```ts
data: {
  readonly tensorName: string;
  readonly sourceOpType: string;
  readonly sourceNodeName: string;   // new
  readonly targetOpType: string;
  readonly targetNodeName: string;   // new
};
```

A `nodeIdToName` map is built alongside `nodeIdToOpType`:

```ts
const nodeIdToName = new Map<string, string>();
// inputs:   nodeIdToName.set(id, gv.name)
// nodes:    nodeIdToName.set(id, node.name)
// outputs:  nodeIdToName.set(id, gv.name)
```

Edge construction becomes:

```ts
flowEdges.push({
  id: edgeId,
  source: srcId,
  target: fn.id,
  type: "default",
  data: {
    tensorName: inputName,
    sourceOpType: nodeIdToOpType.get(srcId) ?? "",
    sourceNodeName: nodeIdToName.get(srcId) ?? "",
    targetOpType: fn.data.opType,
    targetNodeName: fn.data.name,
  },
});
```

### `GraphNodeData` - add `weightInputs`

`packages/core/src/transform.ts`:

```ts
export type GraphNodeData = {
  opType: string;
  name: string;
  inputs: readonly string[];
  outputs: readonly string[];
  attributes: Readonly<Record<string, AttributeValue>>;
  graphNode?: GraphNode;
  graphValue?: GraphValue;
  shape?: readonly number[] | null;
  dtype?: string | null;
  weightInputs?: readonly {
    // new
    slot: number;
    label: string;
    name: string;
    shape: readonly number[];
    dtype: string;
  }[];
};
```

Populated in `modelGraphToFlow` when building `FlowNode` for graph nodes:

```ts
import { opInputLabels } from "./op-inputs.ts";

const labels = opInputLabels(node.opType);
const weightInputs =
  labels.length === 0
    ? undefined
    : node.inputs
        .map((name, slot) => {
          const init = graph.initializers.get(name);
          return init ? { slot, label: labels[slot] ?? `in_${slot}`, name, ...init } : null;
        })
        .filter((w): w is NonNullable<typeof w> => w !== null);
```

`weightInputs` is `undefined` when the op has no label table entry (unknown ops show no weight rows). It is `[]` when the op is known but has no initializer inputs present.

---

## Parser Changes

### ONNX (`packages/onnx/src/parse.ts`)

The parser already reads `graph['initializer']` to build `initializerNames`. Extend to extract shape and dtype:

```ts
const rawInitializers = (graph["initializer"] as Array<Record<string, unknown>> | null) ?? [];
const initializerNames = new Set(rawInitializers.map((i) => String(i["name"] ?? "")));
const initializers = new Map(
  rawInitializers.map((init) => {
    const name = String(init["name"] ?? "");
    const dims = ((init["dims"] as unknown[] | null) ?? []).map(longToNumber);
    const dtype = ONNX_DTYPE[init["dataType"] as number] ?? "unknown";
    return [name, { shape: dims as readonly number[], dtype }] as const;
  }),
);
```

`parseOnnx` returns `{ ..., initializers }`.

### TFLite (`packages/tflite/src/parse.ts`)

TFLite constant tensors are identified via buffer presence: a tensor is an initializer if its `buffer` field (FlatBuffers field index 2 on `Tensor`) references a buffer with non-empty `data` (field index 0 on `Buffer`). Buffer 0 is always the empty sentinel.

Pre-pass before the operator loop:

```ts
// Model field 4 = buffers
const numBuffers = vecLen(bb, model, 4);
const bufferHasData: boolean[] = [];
for (let i = 0; i < numBuffers; i++) {
  const buf = vecTable(bb, model, 4, i);
  bufferHasData.push(vecLen(bb, buf, 0) > 0);
}

// Tensor field 2 = buffer index
const inputIdxSet = new Set(inputIdxs);
const outputIdxSet = new Set(outputIdxs);
const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
for (let i = 0; i < numTensors; i++) {
  const bufIdx = uint32_(bb, vecTable(bb, subgraph, 0, i), 2, 0);
  if (bufIdx > 0 && bufferHasData[bufIdx] && !inputIdxSet.has(i) && !outputIdxSet.has(i)) {
    const t = tensors[i];
    initializers.set(t.name, { shape: t.shape, dtype: t.dtype });
  }
}
```

`parseTflite` returns `{ ..., initializers }`.

---

## Panel Changes (`@wetron/react`)

### `PanelTarget` - `EdgeTarget` fan-out shape

`packages/react/src/node-property-panel.tsx`:

```ts
export type PanelTarget =
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

### `EdgePanel` - render fan-out

```tsx
type EdgeData = {
  tensorName: string;
  from: { opType: string; name: string };
  to: Array<{ opType: string; name: string }>;
};

function EdgePanel({ edge, onBack }: { edge: EdgeData; onBack?: () => void }) {
  return (
    <>
      <div className={css.header}>
        {onBack && <BackButton onBack={onBack} />}
        <div className={css.iconBox} style={{ "--icon-box-bg": "#f3e5f5" } as React.CSSProperties}>
          <ArrowsLeftRight size={15} color="#9c27b0" />
        </div>
        <div className={css.nodeTitle}>Connection</div>
      </div>
      <div className={css.section}>
        <Row label="name" value={edge.tensorName} chip="tensor" />
      </div>
      <div className={css.section}>
        <SectionLabel icon={null} title="From" />
        <Row label="node" value={edge.from.opType} chip="str" />
        <Row label="name" value={edge.from.name} chip="str" />
      </div>
      <div className={css.sectionLast}>
        <SectionLabel icon={null} title="To" />
        {edge.to.map((t, i) => (
          <React.Fragment key={i}>
            <Row label="node" value={t.opType} chip="str" />
            <Row label="name" value={t.name} chip="str" />
          </React.Fragment>
        ))}
      </div>
    </>
  );
}
```

### Panel close button

`NodePropertyPanel` gains `onClose?: () => void`. A × button renders absolutely positioned in the top-right of `.panel`:

```tsx
export function NodePropertyPanel({
  target,
  onTensorClick,
  onBack,
  onClose,
}: {
  target: PanelTarget | null;
  onTensorClick?: (name: string) => void;
  onBack?: () => void;
  onClose?: () => void;
}) {
  if (!target) return null;
  return (
    <div className={css.panel}>
      {onClose && (
        <button className={css.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>
      )}
      {/* existing routing */}
    </div>
  );
}
```

CSS in `node-property-panel.module.css`:

```css
.closeButton {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: #999;
  padding: 2px 4px;
  border-radius: 4px;
}
.closeButton:hover {
  background: #f0f0f0;
  color: #333;
}
```

`.panel` in the CSS module already needs `position: relative` (add if missing).

### Empty input filtering

In `OpPanel`, filter out empty-string inputs before rendering:

```ts
{node.inputs.filter(name => name !== '').map((name, i) => (...))}
```

---

## Edge Highlighting (`@wetron/react`)

### `EDGE_THEME` in `theme.ts`

```ts
export const EDGE_THEME = {
  selectedStroke: "#e53935",
  selectedStrokeWidth: 2,
} as const;
```

### `ModelGraphView` - controlled highlight prop

`packages/react/src/model-graph-view.tsx`:

```ts
type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: ColorMode;
  selectedEdgeTensorName?: string | null; // new
};
```

Inside `Inner`, edges are derived in a `useMemo`:

```ts
const edges = useMemo(
  () =>
    layoutEdges.map((e) => ({
      ...e,
      ...(e.data?.tensorName === selectedEdgeTensorName
        ? {
            style: {
              stroke: EDGE_THEME.selectedStroke,
              strokeWidth: EDGE_THEME.selectedStrokeWidth,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_THEME.selectedStroke },
          }
        : {}),
    })),
  [layoutEdges, selectedEdgeTensorName],
);
```

### `handleEdgeClick` - fan-out aggregation

```ts
const handleEdgeClick = useCallback(
  (_event: React.MouseEvent, edge: Edge) => {
    if (!onTargetClick || !edge.data) return;
    const d = edge.data as FlowEdgeData;
    const sameEdges = layoutEdges.filter((e) => e.data?.tensorName === d.tensorName);
    const from = { opType: d.sourceOpType, name: d.sourceNodeName };
    const to = sameEdges.map((e) => ({
      opType: (e.data as FlowEdgeData).targetOpType,
      name: (e.data as FlowEdgeData).targetNodeName,
    }));
    onTargetClick({ edge: { tensorName: d.tensorName, from, to } });
  },
  [onTargetClick, layoutEdges],
);
```

`FlowEdgeData` is a local type alias for the data shape:

```ts
type FlowEdgeData = {
  tensorName: string;
  sourceOpType: string;
  sourceNodeName: string;
  targetOpType: string;
  targetNodeName: string;
};
```

### ReactFlow watermark

Add `proOptions={{ hideAttribution: true }}` to `<ReactFlow>` in `model-graph-view.tsx`.

---

## Node Card Weight Rows (`@wetron/react`)

### `graph-node.tsx`

Replace `{data.name || null}` with weight rows:

```tsx
{
  data.weightInputs && data.weightInputs.length > 0
    ? data.weightInputs.map((w, i) => (
        <div key={i} className={css.weightRow}>
          <span className={css.weightLabel}>{w.label}</span>
          <span className={css.weightShape}>〈{w.shape.join("×")}〉</span>
        </div>
      ))
    : null;
}
```

Node path name is no longer shown on the card. It remains in the properties panel header.

### `node.module.css` additions

```css
.weightRow {
  display: flex;
  gap: 4px;
  font-size: 10px;
  color: var(--node-muted);
  margin-top: 2px;
}
.weightLabel {
  font-weight: 600;
  color: var(--node-color);
  min-width: 14px;
}
.weightShape {
  opacity: 0.85;
}
```

---

## `App.tsx` Wiring

```tsx
const [selectedEdgeTensorName, setSelectedEdgeTensorName] = useState<string | null>(null);

const handleTargetClick = useCallback((target: PanelTarget) => {
  setHistory([]);
  setSelected(target);
  setSelectedEdgeTensorName('edge' in target ? target.edge.tensorName : null);
}, []);

const handleClose = useCallback(() => {
  setSelected(null);
  setSelectedEdgeTensorName(null);
  setHistory([]);
}, []);

const handleBack = useCallback(() => {
  const prev = history[history.length - 1];
  if (prev !== undefined) {
    setSelected(prev);
    setSelectedEdgeTensorName('edge' in prev ? prev.edge.tensorName : null);
  }
  setHistory(h => h.slice(0, -1));
}, [history]);

// ModelGraphView:
<ModelGraphView
  graph={state.graph}
  onTargetClick={handleTargetClick}
  selectedEdgeTensorName={selectedEdgeTensorName}
/>

// NodePropertyPanel:
<NodePropertyPanel
  target={selected}
  onTensorClick={handleTensorClick}
  onBack={history.length > 0 ? handleBack : undefined}
  onClose={handleClose}
/>
```

---

## Testing

### `packages/core/test/transform.test.ts`

- `SIMPLE_GRAPH` gains `initializers: new Map()`
- New test: Conv node with an initializer entry -> `weightInputs` populated with correct `label`, `name`, `shape`
- New test: Relu node with no initializer inputs -> `weightInputs` is `undefined` or empty
- New test: edges carry `sourceNodeName` and `targetNodeName`

### `packages/onnx/test/parse.test.ts`

- New test: `graph.initializers` is a `Map` with entries for weight tensors (Conv W and B in mnist-12)
- New test: initializer shapes are correct (not null/empty)
- New test: initializer names do NOT appear in `graph.inputs`

### `packages/tflite/test/parse.test.ts`

- New test: `graph.initializers` is populated with constant tensors from the test model
- New test: tensors that ARE graph inputs do not appear in `initializers`

### `packages/react/test/node-property-panel.test.tsx`

- Update `mockOp` to match new `EdgeTarget` shape (`from`, `to[]`)
- New test: `EdgePanel` renders `from.name` and all entries in `to[]`
- New test: `onClose` button renders when prop provided; fires callback on click
- New test: `onClose` button does not render when prop absent

### `packages/react/test/graph-node.test.tsx`

- New test: node with `weightInputs` renders weight label and shape
- New test: node without `weightInputs` renders no weight rows

---

## Out of Scope

- Positional slot labels on IO nodes
- Attribute expand/collapse (`+` toggle)
- Hover tooltips on truncated tensor names in panel
- Weight value display (requires weight deserialization - blocked by CLAUDE.md)
- Dark mode close button styling
