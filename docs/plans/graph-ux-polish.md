# Graph UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fan-out connection properties, edge highlighting, panel close button, weight shapes on node cards, and misc polish to match netron UX.

**Architecture:** Core IR gains `initializers` map (shape/dtype metadata only, no float values); `transform.ts` populates `weightInputs` per node and adds node names to edge data; the renderer uses a controlled `selectedEdgeTensorName` prop for edge highlighting; the panel gets fan-out `EdgeTarget` shape and a close button.

**Tech Stack:** Bun workspaces, TypeScript, ReactFlow (`@xyflow/react`), protobufjs (ONNX), flatbuffers (TFLite), `@testing-library/react`, bun:test.

**Spec:** `docs/specs/2026-04-30-graph-ux-polish-design.md`

---

## File Map

| File                                                | Change                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/core/src/ir.ts`                           | Add `initializers` to `ModelGraph`                                                          |
| `packages/core/src/op-inputs.ts`                    | **New** - `opInputLabels(opType)`                                                           |
| `packages/core/src/transform.ts`                    | `FlowEdge.data` node names; `GraphNodeData.weightInputs`                                    |
| `packages/core/src/index.ts`                        | Export `opInputLabels`                                                                      |
| `packages/core/test/transform.test.ts`              | Update `SIMPLE_GRAPH`; add edge name + weightInputs tests                                   |
| `packages/onnx/src/parse.ts`                        | Populate `initializers` from protobuf                                                       |
| `packages/onnx/test/parse.test.ts`                  | Add initializer tests                                                                       |
| `packages/tflite/src/parse.ts`                      | Populate `initializers` from buffer presence                                                |
| `packages/tflite/test/parse.test.ts`                | Add initializer tests                                                                       |
| `packages/react/src/node-property-panel.tsx`        | Fan-out `EdgeTarget`; `EdgePanel` update; `onClose`; empty input filter                     |
| `packages/react/src/node-property-panel.module.css` | `.closeButton` styles; `.panel` position                                                    |
| `packages/react/test/node-property-panel.test.tsx`  | Update `mockEdgeTarget`; add fan-out + close tests                                          |
| `packages/react/src/theme.ts`                       | Add `EDGE_THEME`                                                                            |
| `packages/react/src/model-graph-view.tsx`           | `selectedEdgeTensorName` prop; edge highlighting; fan-out click; watermark                  |
| `packages/react/src/nodes/graph-node.tsx`           | Replace name text with weight rows                                                          |
| `packages/react/src/nodes/node.module.css`          | `.weightRow`, `.weightLabel`, `.weightShape`                                                |
| `packages/react/test/graph-node.test.tsx`           | Remove name tests; add weight row tests                                                     |
| `apps/demo/src/App.tsx`                             | `selectedEdgeTensorName` state; `handleClose`; `handleBack` fix; `handleTargetClick` update |

---

## Task 1: Core data model - IR, op-inputs, transform

**Files:**

- Modify: `packages/core/src/ir.ts`
- Create: `packages/core/src/op-inputs.ts`
- Modify: `packages/core/src/transform.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/test/transform.test.ts`

- [ ] **Step 1: Update `SIMPLE_GRAPH` fixture to include `initializers`**

In `packages/core/test/transform.test.ts`, add `initializers: new Map()` to `SIMPLE_GRAPH` and add a second graph `GRAPH_WITH_WEIGHTS` used for weight tests:

```ts
const SIMPLE_GRAPH: ModelGraph = {
  name: "test",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 1000], dtype: "float32" }],
  nodes: [
    { name: "conv1", opType: "Conv", inputs: ["x"], outputs: ["h"], attributes: {} },
    { name: "relu1", opType: "Relu", inputs: ["h"], outputs: ["y"], attributes: {} },
  ],
  initializers: new Map(),
};

const GRAPH_WITH_WEIGHTS: ModelGraph = {
  name: "weighted",
  inputs: [{ name: "x", shape: [1, 3, 224, 224], dtype: "float32" }],
  outputs: [{ name: "y", shape: [1, 64], dtype: "float32" }],
  nodes: [
    {
      name: "conv1",
      opType: "Conv",
      inputs: ["x", "weight", "bias"],
      outputs: ["h"],
      attributes: {},
    },
    { name: "relu1", opType: "Relu", inputs: ["h"], outputs: ["y"], attributes: {} },
  ],
  initializers: new Map([
    ["weight", { shape: [64, 3, 3, 3], dtype: "float32" }],
    ["bias", { shape: [64], dtype: "float32" }],
  ]),
};
```

- [ ] **Step 2: Write failing tests for new edge fields and weightInputs**

Append to `packages/core/test/transform.test.ts`:

```ts
test("edges carry sourceNodeName and targetNodeName", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const convToRelu = edges.find((e) => e.data.tensorName === "h");
  expect(convToRelu).toBeDefined();
  expect(convToRelu!.data.sourceNodeName).toBe("conv1");
  expect(convToRelu!.data.targetNodeName).toBe("relu1");
});

test("Conv node with initializers gets weightInputs with labels and shapes", () => {
  const { nodes } = modelGraphToFlow(GRAPH_WITH_WEIGHTS);
  const conv = nodes.find((n) => n.data.opType === "Conv");
  expect(conv?.data.weightInputs).toBeDefined();
  expect(conv?.data.weightInputs?.length).toBe(2);
  expect(conv?.data.weightInputs?.[0].label).toBe("W");
  expect(conv?.data.weightInputs?.[0].shape).toEqual([64, 3, 3, 3]);
  expect(conv?.data.weightInputs?.[1].label).toBe("B");
  expect(conv?.data.weightInputs?.[1].shape).toEqual([64]);
});

test("Relu node with no label table entry has undefined weightInputs", () => {
  const { nodes } = modelGraphToFlow(GRAPH_WITH_WEIGHTS);
  const relu = nodes.find((n) => n.data.opType === "Relu");
  expect(relu?.data.weightInputs).toBeUndefined();
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
bun test packages/core/test/transform.test.ts
```

Expected: FAIL - `data.sourceNodeName` is undefined, `data.weightInputs` is undefined, TypeScript errors on `initializers` missing from `SIMPLE_GRAPH`.

- [ ] **Step 4: Add `initializers` to `ModelGraph` in `ir.ts`**

`packages/core/src/ir.ts` - add one field to the interface:

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

- [ ] **Step 5: Create `packages/core/src/op-inputs.ts`**

```ts
const OP_INPUT_LABELS: Record<string, readonly string[]> = {
  Conv: ["X", "W", "B"],
  ConvTranspose: ["X", "W", "B"],
  Gemm: ["A", "B", "C"],
  MatMul: ["A", "B"],
  BatchNormalization: ["X", "scale", "B", "mean", "var"],
  LayerNormalization: ["X", "Scale", "B"],
  GroupNormalization: ["X", "scale", "bias"],
  InstanceNormalization: ["input", "scale", "B"],
  LSTM: ["X", "W", "R", "B", "sequence_lens", "initial_h", "initial_c", "P"],
  GRU: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
  RNN: ["X", "W", "R", "B", "sequence_lens", "initial_h"],
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

- [ ] **Step 6: Update `packages/core/src/transform.ts`**

Add `import { opInputLabels } from './op-inputs.ts';` at the top.

Update `FlowEdge` type - add `sourceNodeName` and `targetNodeName` to `data`:

```ts
export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: "default";
  data: {
    readonly tensorName: string;
    readonly sourceOpType: string;
    readonly sourceNodeName: string;
    readonly targetOpType: string;
    readonly targetNodeName: string;
  };
};
```

Add `weightInputs` to `GraphNodeData`:

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
    slot: number;
    label: string;
    name: string;
    shape: readonly number[];
    dtype: string;
  }[];
};
```

Inside `modelGraphToFlow`, add `nodeIdToName` alongside `nodeIdToOpType`:

```ts
const nodeIdToName = new Map<string, string>();
```

Populate it in all three loops (input IO, graph nodes, output IO):

```ts
// In the inputs loop:
nodeIdToName.set(id, gv.name);

// In the graph nodes loop:
nodeIdToName.set(id, node.name);

// In the outputs loop:
nodeIdToName.set(id, gv.name);
```

When building `FlowNode` for graph nodes, compute `weightInputs`:

```ts
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

Pass `weightInputs` into the `data` object for graph nodes:

```ts
data: {
  opType: node.opType, name: node.name,
  inputs: node.inputs, outputs: node.outputs,
  attributes: node.attributes, graphNode: node,
  weightInputs: weightInputs?.length ? weightInputs : undefined,
},
```

Update edge construction to include node names:

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

- [ ] **Step 7: Export `opInputLabels` from `packages/core/src/index.ts`**

Add to the exports at the top of `index.ts`:

```ts
export { opInputLabels } from "./op-inputs.ts";
```

- [ ] **Step 8: Run tests to confirm they pass**

```bash
bun test packages/core
```

Expected: All tests pass. If any other test files have `ModelGraph` literals missing `initializers`, add `initializers: new Map()` to them now.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/ir.ts packages/core/src/op-inputs.ts packages/core/src/transform.ts packages/core/src/index.ts packages/core/test/transform.test.ts
git commit -m "feat(core): add ModelGraph.initializers, op-inputs labels, FlowEdge node names, GraphNodeData weightInputs"
```

---

## Task 2: ONNX parser - populate initializers

**Files:**

- Modify: `packages/onnx/src/parse.ts`
- Modify: `packages/onnx/test/parse.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/onnx/test/parse.test.ts`:

```ts
test("graph.initializers is a Map with weight entries", async () => {
  const graph = await parseOnnx(await loadModel());
  expect(graph.initializers).toBeInstanceOf(Map);
  expect(graph.initializers.size).toBeGreaterThan(0);
});

test("initializer entries have non-empty shape and dtype", async () => {
  const graph = await parseOnnx(await loadModel());
  for (const [, init] of graph.initializers) {
    expect(Array.isArray(init.shape)).toBe(true);
    expect(init.shape.length).toBeGreaterThan(0);
    expect(typeof init.dtype).toBe("string");
    expect(init.dtype.length).toBeGreaterThan(0);
  }
});

test("initializer names do not appear in graph.inputs", async () => {
  const graph = await parseOnnx(await loadModel());
  const inputNames = new Set(graph.inputs.map((i) => i.name));
  for (const name of graph.initializers.keys()) {
    expect(inputNames.has(name)).toBe(false);
  }
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test packages/onnx
```

Expected: FAIL - `graph.initializers` is undefined (not yet a property of the returned object).

- [ ] **Step 3: Update `parseOnnx` in `packages/onnx/src/parse.ts`**

Replace the existing two-line initializer block:

```ts
const initializerNames = new Set(
  ((graph["initializer"] as Array<Record<string, unknown>> | null) ?? []).map((i) =>
    String(i["name"] ?? ""),
  ),
);
```

With:

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

Update the return statement to include `initializers`:

```ts
return {
  name: String(graph["name"] ?? ""),
  inputs: filteredInputs.map(mapValueInfo),
  outputs: rawOutputs.map(mapValueInfo),
  nodes,
  initializers,
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test packages/onnx
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/onnx/src/parse.ts packages/onnx/test/parse.test.ts
git commit -m "feat(onnx): populate ModelGraph.initializers from protobuf initializer shapes"
```

---

## Task 3: TFLite parser - populate initializers

**Files:**

- Modify: `packages/tflite/src/parse.ts`
- Modify: `packages/tflite/test/parse.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/tflite/test/parse.test.ts`:

```ts
test("graph.initializers is a Map with weight entries", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  expect(graph.initializers).toBeInstanceOf(Map);
  expect(graph.initializers.size).toBeGreaterThan(0);
});

test("graph input tensors are not in initializers", async () => {
  const bytes = await loadModel();
  const graph = parseTflite(bytes);
  for (const input of graph.inputs) {
    expect(graph.initializers.has(input.name)).toBe(false);
  }
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test packages/tflite
```

Expected: FAIL - `graph.initializers` is undefined.

- [ ] **Step 3: Update `parseTflite` in `packages/tflite/src/parse.ts`**

In `parseTflite`, after building `inputIdxs` and `outputIdxs` but **before** the operator loop, add a pre-pass to read buffer presence and identify initializer tensors.

The TFLite `Model` FlatBuffers field indices: `buffers` is field index 4.
The `Buffer` table field indices: `data` is field index 0.
The `Tensor` table field indices: `buffer` (buffer index) is field index 2.

Add the following block right after the `outputIdxs` loop and before the operator loop:

```ts
// Identify constant tensors (initializers) via buffer presence.
// Model field 4 = buffers; Buffer field 0 = data; Tensor field 2 = buffer index.
const numBuffers = vecLen(bb, model, 4);
const bufferHasData: boolean[] = [];
for (let i = 0; i < numBuffers; i++) {
  const buf = vecTable(bb, model, 4, i);
  bufferHasData.push(vecLen(bb, buf, 0) > 0);
}
const inputIdxSet = new Set(inputIdxs);
const outputIdxSet = new Set(outputIdxs);
const initializers = new Map<string, { shape: readonly number[]; dtype: string }>();
for (let i = 0; i < numTensors; i++) {
  const tensorTable = vecTable(bb, subgraph, 0, i);
  const bufIdx = uint32_(bb, tensorTable, 2, 0);
  if (bufIdx > 0 && bufferHasData[bufIdx] && !inputIdxSet.has(i) && !outputIdxSet.has(i)) {
    const t = tensors[i];
    initializers.set(t.name, { shape: t.shape as readonly number[], dtype: t.dtype });
  }
}
```

Update the return statement:

```ts
return {
  name: string_(bb, subgraph, 4) ?? "",
  inputs: inputIdxs.map(toGraphValue),
  outputs: outputIdxs.map(toGraphValue),
  nodes,
  initializers,
};
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
bun test packages/tflite
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add packages/tflite/src/parse.ts packages/tflite/test/parse.test.ts
git commit -m "feat(tflite): populate ModelGraph.initializers from constant tensor buffer presence"
```

---

## Task 4: Panel changes - fan-out EdgeTarget, EdgePanel, close button, empty inputs

**Files:**

- Modify: `packages/react/src/node-property-panel.tsx`
- Modify: `packages/react/src/node-property-panel.module.css`
- Modify: `packages/react/test/node-property-panel.test.tsx`

- [ ] **Step 1: Update `mockEdgeTarget` and write failing tests**

In `packages/react/test/node-property-panel.test.tsx`:

Replace `mockEdgeTarget`:

```ts
const mockEdgeTarget = {
  edge: {
    tensorName: "h",
    from: { opType: "Conv", name: "conv_0" },
    to: [{ opType: "Relu", name: "relu_0" }],
  },
};
```

Replace the existing `EdgePanel` describe block with:

```ts
describe("EdgePanel", () => {
  test("renders tensor name, from opType+name, and to entries", () => {
    render(React.createElement(NodePropertyPanel, { target: mockEdgeTarget }));
    expect(screen.getByText("h")).toBeDefined();
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("conv_0")).toBeDefined();
    expect(screen.getByText("Relu")).toBeDefined();
    expect(screen.getByText("relu_0")).toBeDefined();
  });

  test("renders multiple to entries for fan-out", () => {
    const fanOut = {
      edge: {
        tensorName: "concat_out",
        from: { opType: "Concat", name: "concat_1" },
        to: [
          { opType: "Conv", name: "conv_a" },
          { opType: "Conv", name: "conv_b" },
        ],
      },
    };
    render(React.createElement(NodePropertyPanel, { target: fanOut }));
    expect(screen.getByText("conv_a")).toBeDefined();
    expect(screen.getByText("conv_b")).toBeDefined();
  });
});
```

Add a new `describe('onClose', ...)` block:

```ts
describe("onClose", () => {
  test("renders close button when onClose prop provided", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp, onClose: () => {} }));
    expect(screen.getByLabelText("Close")).toBeDefined();
  });

  test("fires onClose when close button is clicked", () => {
    let closed = false;
    render(
      React.createElement(NodePropertyPanel, {
        target: mockOp,
        onClose: () => {
          closed = true;
        },
      }),
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(closed).toBe(true);
  });

  test("does not render close button when onClose is absent", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.queryByLabelText("Close")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
bun test packages/react/test/node-property-panel.test.tsx
```

Expected: FAIL - `conv_0` and `relu_0` not found; close button tests fail.

- [ ] **Step 3: Update `PanelTarget` type and `EdgePanel` in `node-property-panel.tsx`**

Update `PanelTarget`:

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

Add a local `EdgeData` type above `EdgePanel`:

```ts
type EdgeData = {
  tensorName: string;
  from: { opType: string; name: string };
  to: Array<{ opType: string; name: string }>;
};
```

Replace the `EdgePanel` component:

```tsx
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

- [ ] **Step 4: Add `onClose` prop and × button**

Update `NodePropertyPanel` signature:

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
      {isGraphNode(target) ? (
        <OpPanel node={target} onTensorClick={onTensorClick} onBack={onBack} />
      ) : isEdgeTarget(target) ? (
        <EdgePanel edge={target.edge} onBack={onBack} />
      ) : isTensorTarget(target) ? (
        <TensorPanel tensor={target.tensor} onBack={onBack} />
      ) : (
        <IoPanel graphValue={target.graphValue} direction={target.direction} onBack={onBack} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Filter empty inputs in `OpPanel`**

In `OpPanel`, change `node.inputs.map(...)` to `node.inputs.filter(name => name !== '').map(...)`:

```tsx
{
  node.inputs.filter((name) => name !== "").length > 0 && (
    <div className={css.section}>
      <SectionLabel icon={<ArrowCircleDown size={12} />} title="Inputs" />
      {node.inputs
        .filter((name) => name !== "")
        .map((name, i) => (
          <Row
            key={i}
            label={name}
            value=""
            chip="tensor"
            onClick={onTensorClick ? () => onTensorClick(name) : undefined}
          />
        ))}
    </div>
  );
}
```

- [ ] **Step 6: Add CSS for close button**

In `packages/react/src/node-property-panel.module.css`, ensure `.panel` has `position: relative` and add:

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

- [ ] **Step 7: Run tests to confirm they pass**

```bash
bun test packages/react/test/node-property-panel.test.tsx
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add packages/react/src/node-property-panel.tsx packages/react/src/node-property-panel.module.css packages/react/test/node-property-panel.test.tsx
git commit -m "feat(react): fan-out EdgePanel, onClose button, filter empty op inputs"
```

---

## Task 5: Edge highlighting and ModelGraphView updates

**Files:**

- Modify: `packages/react/src/theme.ts`
- Modify: `packages/react/src/model-graph-view.tsx`

- [ ] **Step 1: Add `EDGE_THEME` to `theme.ts`**

In `packages/react/src/theme.ts`, append after `MINIMAP_THEME`:

```ts
export const EDGE_THEME = {
  selectedStroke: "#e53935",
  selectedStrokeWidth: 2,
} as const;
```

- [ ] **Step 2: Update `model-graph-view.tsx`**

Add `EDGE_THEME` to the import from `./theme.ts`.

Update the `Props` type to add `selectedEdgeTensorName`:

```ts
type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: ColorMode;
  selectedEdgeTensorName?: string | null;
};
```

Update `Inner` to accept and use `selectedEdgeTensorName`:

```ts
function Inner({ graph, onTargetClick, selectedEdgeTensorName }: Omit<Props, 'colorMode'>) {
```

Add a local type alias above `handleEdgeClick`:

```ts
type FlowEdgeData = {
  tensorName: string;
  sourceOpType: string;
  sourceNodeName: string;
  targetOpType: string;
  targetNodeName: string;
};
```

Replace `handleEdgeClick` with fan-out aggregation:

```ts
const handleEdgeClick = useCallback(
  (_event: React.MouseEvent, edge: Edge) => {
    if (!onTargetClick || !edge.data) return;
    const d = edge.data as FlowEdgeData;
    const sameEdges = layoutEdges.filter(
      (e) => (e.data as FlowEdgeData | undefined)?.tensorName === d.tensorName,
    );
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

Replace the existing `edges` (currently from the `useMemo` of `modelGraphToFlow`) with a derived memo that applies highlighting. The current code has:

```ts
const { nodes, edges } = useMemo(() => modelGraphToFlow(graph), [graph]);
```

Change to:

```ts
const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => modelGraphToFlow(graph), [graph]);

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

Update the `fitView` effect to use `layoutNodes` instead of `nodes`:

```ts
React.useEffect(() => {
  const TARGET = 12;
  if (layoutNodes.length <= TARGET) {
    fitView({ maxZoom: 1, padding: 0.15 });
  } else {
    const topNodes = [...layoutNodes]
      .sort((a, b) => a.position.y - b.position.y)
      .slice(0, TARGET)
      .map((n) => ({ id: n.id }));
    fitView({ nodes: topNodes, maxZoom: 1, padding: 0.15 });
  }
}, [graph, fitView, layoutNodes]);
```

Add `proOptions={{ hideAttribution: true }}` to `<ReactFlow>`.

Pass `selectedEdgeTensorName` through from `ModelGraphView` to `Inner`:

```ts
export function ModelGraphView({ colorMode = 'system', ...rest }: Props) {
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ReactFlowProvider>
        <div style={{ width: '100%', height: '100%' }}>
          <Inner {...rest} />
        </div>
      </ReactFlowProvider>
    </ColorModeContext.Provider>
  );
}
```

- [ ] **Step 3: Run all react tests**

```bash
bun test packages/react
```

Expected: All pass (existing model-graph-view test renders nodes as before).

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/theme.ts packages/react/src/model-graph-view.tsx
git commit -m "feat(react): edge highlighting via selectedEdgeTensorName, fan-out handleEdgeClick, remove ReactFlow watermark"
```

---

## Task 6: Node card weight rows

**Files:**

- Modify: `packages/react/src/nodes/graph-node.tsx`
- Modify: `packages/react/src/nodes/node.module.css`
- Modify: `packages/react/test/graph-node.test.tsx`

- [ ] **Step 1: Write new graph-node tests and remove stale ones**

In `packages/react/test/graph-node.test.tsx`:

Remove these two tests (they test the name display which is being replaced):

- `test('node name is shown below header', ...)`
- `test('does not render name row when name is empty', ...)`

Add a helper and two new tests inside the `describe('GraphNodeComponent', ...)` block:

```ts
function makeWeightData(opType: string): GraphNodeData {
  return {
    opType,
    name: "some/path/conv",
    inputs: ["x", "weight", "bias"],
    outputs: ["out"],
    attributes: {},
    weightInputs: [
      { slot: 1, label: "W", name: "weight", shape: [64, 3, 3, 3], dtype: "float32" },
      { slot: 2, label: "B", name: "bias", shape: [64], dtype: "float32" },
    ],
  } as GraphNodeData;
}

test("renders weight label and shape when weightInputs provided", () => {
  const props = { data: makeWeightData("Conv") } as unknown as Parameters<
    typeof GraphNodeComponent
  >[0];
  render(
    React.createElement(
      ReactFlowProvider,
      null,
      React.createElement(
        ColorModeContext.Provider,
        { value: "light" as const },
        React.createElement(GraphNodeComponent, props),
      ),
    ),
  );
  expect(screen.getByText("W")).toBeDefined();
  expect(screen.getByText("〈64×3×3×3〉")).toBeDefined();
  expect(screen.getByText("B")).toBeDefined();
  expect(screen.getByText("〈64〉")).toBeDefined();
});

test("renders no weight content when weightInputs is undefined", () => {
  const { container } = renderNode("Relu");
  expect(container.textContent).not.toContain("〈");
});
```

- [ ] **Step 2: Run tests to confirm new tests fail**

```bash
bun test packages/react/test/graph-node.test.tsx
```

Expected: FAIL - `W`, `〈64×3×3×3〉` etc. not found.

- [ ] **Step 3: Update `graph-node.tsx` to render weight rows**

In `packages/react/src/nodes/graph-node.tsx`, replace the children passed to `NodeCard` from `{data.name || null}` to:

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

Import `css` from `'./node.module.css'` if not already imported (check the file - it imports from `'../theme.ts'` etc., add `import css from './node.module.css';` if missing).

- [ ] **Step 4: Add CSS classes to `node.module.css`**

Append to `packages/react/src/nodes/node.module.css`:

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

- [ ] **Step 5: Run tests to confirm they pass**

```bash
bun test packages/react/test/graph-node.test.tsx
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/nodes/graph-node.tsx packages/react/src/nodes/node.module.css packages/react/test/graph-node.test.tsx
git commit -m "feat(react): show weight shapes on node cards, remove full path name from cards"
```

---

## Task 7: App.tsx wiring

**Files:**

- Modify: `apps/demo/src/App.tsx`

- [ ] **Step 1: Add `selectedEdgeTensorName` state and `handleClose`**

In `apps/demo/src/App.tsx`, add a new state variable alongside `selected`:

```tsx
const [selectedEdgeTensorName, setSelectedEdgeTensorName] = useState<string | null>(null);
```

Add `handleClose`:

```tsx
const handleClose = useCallback(() => {
  setSelected(null);
  setSelectedEdgeTensorName(null);
  setHistory([]);
}, []);
```

- [ ] **Step 2: Fix `handleTargetClick` to set `selectedEdgeTensorName`**

Replace the existing `handleTargetClick`:

```tsx
const handleTargetClick = useCallback((target: PanelTarget) => {
  setHistory([]);
  setSelected(target);
  setSelectedEdgeTensorName("edge" in target ? target.edge.tensorName : null);
}, []);
```

- [ ] **Step 3: Fix `handleBack` to avoid nested setState**

Replace the existing `handleBack`:

```tsx
const handleBack = useCallback(() => {
  const prev = history[history.length - 1];
  if (prev !== undefined) {
    setSelected(prev);
    setSelectedEdgeTensorName("edge" in prev ? prev.edge.tensorName : null);
  }
  setHistory((h) => h.slice(0, -1));
}, [history]);
```

- [ ] **Step 4: Wire `selectedEdgeTensorName` into `ModelGraphView` and `onClose` into panel**

Update the `ModelGraphView` JSX:

```tsx
<ModelGraphView
  graph={state.graph}
  onTargetClick={handleTargetClick}
  selectedEdgeTensorName={selectedEdgeTensorName}
/>
```

Update the `NodePropertyPanel` JSX:

```tsx
<NodePropertyPanel
  target={selected}
  onTensorClick={handleTensorClick}
  onBack={history.length > 0 ? handleBack : undefined}
  onClose={handleClose}
/>
```

Also reset `selectedEdgeTensorName` in `loadFile` when a new model is loaded:

```tsx
const loadFile = useCallback(async (file: File) => {
  setState({ status: "loading", name: file.name });
  setSelected(null);
  setHistory([]);
  setSelectedEdgeTensorName(null); // add this line
  // ... rest unchanged
}, []);
```

- [ ] **Step 5: Run full test suite**

```bash
bun test
```

Expected: 94+ pass, 2 pre-existing failures in `netron-main/` only.

- [ ] **Step 6: Commit**

```bash
git add apps/demo/src/App.tsx
git commit -m "feat(demo): wire selectedEdgeTensorName, handleClose, fix handleBack nested setState"
```

---

## Self-Review Checklist

- [x] `ModelGraph.initializers` in IR -> Task 1
- [x] `op-inputs.ts` with `opInputLabels` -> Task 1
- [x] `FlowEdge.data` sourceNodeName/targetNodeName -> Task 1
- [x] `GraphNodeData.weightInputs` -> Task 1
- [x] ONNX parser populates initializers -> Task 2
- [x] TFLite parser populates initializers -> Task 3
- [x] `PanelTarget` EdgeTarget fan-out shape -> Task 4
- [x] `EdgePanel` renders from.name and all to[] entries -> Task 4
- [x] `onClose` prop + × button -> Task 4
- [x] Empty input filtering -> Task 4
- [x] `EDGE_THEME` in theme.ts -> Task 5
- [x] `selectedEdgeTensorName` prop on ModelGraphView -> Task 5
- [x] Fan-out aggregation in `handleEdgeClick` -> Task 5
- [x] `proOptions={{ hideAttribution: true }}` -> Task 5
- [x] Weight rows on node cards -> Task 6
- [x] Node name removed from cards -> Task 6
- [x] App.tsx state wiring -> Task 7
- [x] `handleBack` nested setState fixed -> Task 7
