# Interactive Properties & Edge Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add smoothstep edges with arrowheads, pan-on-scroll, edge-click → CONNECTION PROPERTIES panel, and tensor drill-down from the node panel.

**Architecture:** Extend `FlowEdge` in `@wetron/core` with a `data` field carrying tensor metadata. Extend `PanelTarget` in `@wetron/react` with two new union cases (`edge` and `tensor`). Wire `onEdgeClick` in `ModelGraphView` and `onTensorClick` in `NodePropertyPanel`, with `App.tsx` resolving tensor lookup from the graph.

**Tech Stack:** Bun, TypeScript, React 18, `@xyflow/react`, `@phosphor-icons/react`, `bun:test`, `@testing-library/react`

---

## File Map

| File                                             | Change                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/transform.ts`                 | Add `data` field to `FlowEdge` type; populate `tensorName`/`sourceOpType`/`targetOpType`; change edge `type` to `'smoothstep'`                              |
| `packages/core/test/transform.test.ts`           | Add tests for `FlowEdge.data` shape                                                                                                                         |
| `packages/react/src/ModelGraphView.tsx`          | Add `MarkerType` arrowhead via `defaultEdgeOptions`; add `panOnScroll`/zoom config; wire `onEdgeClick`                                                      |
| `packages/react/src/NodePropertyPanel.tsx`       | Extend `PanelTarget`; add `isEdgeTarget`/`isTensorTarget` guards; add `onTensorClick` prop; add `EdgePanel`/`TensorPanel`; make input/output rows clickable |
| `packages/react/test/NodePropertyPanel.test.tsx` | Add tests for edge target, tensor target, and `onTensorClick` callback                                                                                      |
| `apps/demo/src/App.tsx`                          | Add `handleTensorClick` that resolves name → shape/dtype from graph; pass `onTensorClick` to `NodePropertyPanel`                                            |

---

## Task 1: Extend FlowEdge with edge data in transform.ts

**Files:**

- Modify: `packages/core/src/transform.ts`
- Modify: `packages/core/test/transform.test.ts`

- [ ] **Step 1: Write failing tests for FlowEdge data**

Add to `packages/core/test/transform.test.ts`:

```ts
test("edges carry tensorName matching the connecting tensor", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  // x → conv1
  const e0 = edges.find((e) => e.source === "input::x");
  expect(e0).toBeDefined();
  expect(e0!.data.tensorName).toBe("x");
});

test("edges carry sourceOpType and targetOpType", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  const convToRelu = edges.find((e) => e.data.tensorName === "h");
  expect(convToRelu).toBeDefined();
  expect(convToRelu!.data.sourceOpType).toBe("Conv");
  expect(convToRelu!.data.targetOpType).toBe("Relu");
});

test("edges have type smoothstep", () => {
  const { edges } = modelGraphToFlow(SIMPLE_GRAPH);
  for (const e of edges) {
    expect(e.type).toBe("smoothstep");
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/core/test/transform.test.ts
```

Expected: 3 failures — `e0!.data` is undefined, type is `'default'`.

- [ ] **Step 3: Update FlowEdge type and modelGraphToFlow in transform.ts**

Replace the full contents of `packages/core/src/transform.ts`:

```ts
import * as Dagre from "dagre";
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";

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
};

export type FlowNode = {
  id: string;
  type: "graphNode" | "ioNode";
  position: { x: number; y: number };
  data: GraphNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
  data: {
    tensorName: string;
    sourceOpType: string;
    targetOpType: string;
  };
};

export function modelGraphToFlow(graph: ModelGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 60, align: "UL" });

  const flowNodes: FlowNode[] = [];
  const flowEdges: FlowEdge[] = [];
  const outputToNodeId = new Map<string, string>();
  const nodeIdToOpType = new Map<string, string>();

  for (const gv of graph.inputs) {
    const id = `input::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: {
        opType: "Input",
        name: gv.name,
        inputs: [],
        outputs: [gv.name],
        attributes: {},
        shape: gv.shape,
        dtype: gv.dtype,
        graphValue: gv,
      },
    });
    g.setNode(id, { width: 200, height: 80 });
    outputToNodeId.set(gv.name, id);
    nodeIdToOpType.set(id, "Input");
  }

  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const id = `node::${node.name || `${node.opType}_${i}`}`;
    flowNodes.push({
      id,
      type: "graphNode",
      position: { x: 0, y: 0 },
      data: {
        opType: node.opType,
        name: node.name,
        inputs: node.inputs,
        outputs: node.outputs,
        attributes: node.attributes,
        graphNode: node,
      },
    });
    g.setNode(id, { width: 200, height: 80 });
    for (const out of node.outputs) outputToNodeId.set(out, id);
    nodeIdToOpType.set(id, node.opType);
  }

  for (const gv of graph.outputs) {
    const id = `output::${gv.name}`;
    flowNodes.push({
      id,
      type: "ioNode",
      position: { x: 0, y: 0 },
      data: {
        opType: "Output",
        name: gv.name,
        inputs: [gv.name],
        outputs: [],
        attributes: {},
        shape: gv.shape,
        dtype: gv.dtype,
        graphValue: gv,
      },
    });
    g.setNode(id, { width: 200, height: 80 });
    nodeIdToOpType.set(id, "Output");
  }

  for (const fn of flowNodes) {
    if (fn.type === "ioNode" && fn.data.opType === "Input") continue;
    for (const inputName of fn.data.inputs) {
      const srcId = outputToNodeId.get(inputName);
      if (srcId) {
        const edgeId = `${srcId}=>${fn.id}`;
        flowEdges.push({
          id: edgeId,
          source: srcId,
          target: fn.id,
          type: "smoothstep",
          data: {
            tensorName: inputName,
            sourceOpType: nodeIdToOpType.get(srcId) ?? "",
            targetOpType: fn.data.opType,
          },
        });
        if (!g.hasEdge(srcId, fn.id)) g.setEdge(srcId, fn.id);
      }
    }
  }

  Dagre.layout(g);

  for (const fn of flowNodes) {
    const pos = g.node(fn.id);
    if (pos) fn.position = { x: pos.x - 100, y: pos.y - 40 };
  }

  return { nodes: flowNodes, edges: flowEdges };
}
```

- [ ] **Step 4: Run all core tests**

```bash
bun test packages/core
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transform.ts packages/core/test/transform.test.ts
git commit -m "feat(core): add edge data (tensorName, opTypes) and smoothstep type"
```

---

## Task 2: Update ModelGraphView — arrowheads, pan/zoom, edge click

**Files:**

- Modify: `packages/react/src/ModelGraphView.tsx`

- [ ] **Step 1: Replace the full contents of ModelGraphView.tsx**

```tsx
import React, { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";
import { GraphNodeComponent } from "./nodes/GraphNode.tsx";
import { IoNodeComponent } from "./nodes/IoNode.tsx";
import { type PanelTarget } from "./NodePropertyPanel.tsx";
import { ColorModeContext, type ColorMode } from "./ColorModeContext.ts";

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent as NodeTypes[string],
  ioNode: IoNodeComponent as NodeTypes[string],
};

type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
  colorMode?: ColorMode;
};

function Inner({ graph, onTargetClick }: Omit<Props, "colorMode">) {
  const { fitView } = useReactFlow();
  const { nodes, edges } = modelGraphToFlow(graph);

  const handleNodeClick = useCallback<NodeMouseHandler<Node<GraphNodeData>>>(
    (_event, node) => {
      if (!onTargetClick) return;
      if (node.data.graphNode) {
        onTargetClick(node.data.graphNode);
      } else if (node.data.graphValue) {
        onTargetClick({
          graphValue: node.data.graphValue,
          direction: node.data.opType === "Input" ? "input" : "output",
        });
      }
    },
    [onTargetClick],
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      if (!onTargetClick || !edge.data) return;
      const d = edge.data as { tensorName: string; sourceOpType: string; targetOpType: string };
      onTargetClick({ edge: d });
    },
    [onTargetClick],
  );

  React.useEffect(() => {
    fitView();
  }, [graph, fitView]);

  return (
    <ReactFlow
      nodes={nodes as Node<GraphNodeData>[]}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      onEdgeClick={handleEdgeClick}
      defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
      panOnScroll
      zoomOnScroll={false}
      zoomActivationKeyCode="Meta"
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}

export function ModelGraphView({ colorMode = "system", ...rest }: Props) {
  return (
    <ColorModeContext.Provider value={colorMode}>
      <ReactFlowProvider>
        <div style={{ width: "100%", height: "100%" }}>
          <Inner {...rest} />
        </div>
      </ReactFlowProvider>
    </ColorModeContext.Provider>
  );
}
```

- [ ] **Step 2: Run react package tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/ModelGraphView.tsx
git commit -m "feat(react): smoothstep edges, arrowheads, pan-on-scroll, meta+scroll zoom, edge click handler"
```

---

## Task 3: Extend NodePropertyPanel — new panel views and tensor click

**Files:**

- Modify: `packages/react/src/NodePropertyPanel.tsx`
- Modify: `packages/react/test/NodePropertyPanel.test.tsx`

- [ ] **Step 1: Write failing tests**

Add to `packages/react/test/NodePropertyPanel.test.tsx` (after the existing `afterEach(cleanup)`):

```tsx
import { fireEvent } from "@testing-library/react";

// -- Edge target --
const mockEdgeTarget = {
  edge: { tensorName: "h", sourceOpType: "Conv", targetOpType: "Relu" },
};

// -- Tensor target --
const mockTensorTarget = {
  tensor: { name: "data", shape: [1, 3, 224, 224] as readonly number[], dtype: "float32" },
};

const mockTensorNoShape = {
  tensor: { name: "intermediate", shape: null, dtype: null },
};
```

Then add a new `describe` block at the end of the file:

```tsx
describe("EdgePanel", () => {
  test("renders tensor name, source opType, target opType", () => {
    render(React.createElement(NodePropertyPanel, { target: mockEdgeTarget }));
    expect(screen.getByText("h")).toBeDefined();
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("Relu")).toBeDefined();
  });
});

describe("TensorPanel", () => {
  test("renders name, shape, dtype when all present", () => {
    render(React.createElement(NodePropertyPanel, { target: mockTensorTarget }));
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("[1 × 3 × 224 × 224]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
  });

  test("renders name only when shape and dtype are null", () => {
    render(React.createElement(NodePropertyPanel, { target: mockTensorNoShape }));
    expect(screen.getByText("intermediate")).toBeDefined();
    expect(screen.queryByText("shape")).toBeNull();
    expect(screen.queryByText("dtype")).toBeNull();
  });
});

describe("onTensorClick", () => {
  test("calls onTensorClick with input tensor name when input row clicked", () => {
    let clicked = "";
    render(
      React.createElement(NodePropertyPanel, {
        target: mockOp,
        onTensorClick: (name: string) => {
          clicked = name;
        },
      }),
    );
    fireEvent.click(screen.getByText("data"));
    expect(clicked).toBe("data");
  });

  test("does not throw when onTensorClick is not provided", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(() => fireEvent.click(screen.getByText("data"))).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun test packages/react/test/NodePropertyPanel.test.tsx
```

Expected: failures — `mockEdgeTarget` renders nothing, `onTensorClick` not wired.

- [ ] **Step 3: Replace the full contents of NodePropertyPanel.tsx**

```tsx
import React from "react";
import {
  Cpu,
  ArrowCircleDown,
  ArrowCircleUp,
  SlidersHorizontal,
  ArrowFatDown,
  ArrowFatUp,
  ArrowsLeftRight,
  Cube,
} from "@phosphor-icons/react";
import type { GraphNode, GraphValue, AttributeValue } from "@wetron/core/ir";

export type PanelTarget =
  | GraphNode
  | { graphValue: GraphValue; direction: "input" | "output" }
  | { edge: { tensorName: string; sourceOpType: string; targetOpType: string } }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };

export function isGraphNode(t: PanelTarget): t is GraphNode {
  return "opType" in t;
}

function isEdgeTarget(
  t: PanelTarget,
): t is { edge: { tensorName: string; sourceOpType: string; targetOpType: string } } {
  return "edge" in t;
}

function isTensorTarget(
  t: PanelTarget,
): t is { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } } {
  return "tensor" in t;
}

type ChipDef = { bg: string; fg: string };

const CHIPS: Record<string, ChipDef> = {
  str: { bg: "#e8f5e9", fg: "#388e3c" },
  "str[]": { bg: "#e8f5e9", fg: "#388e3c" },
  bool: { bg: "#fce4ec", fg: "#c2185b" },
  int: { bg: "#f3e5f5", fg: "#9c27b0" },
  float: { bg: "#e1f5fe", fg: "#0288d1" },
  "int[]": { bg: "#fff3e0", fg: "#e8a000" },
  "float[]": { bg: "#fff3e0", fg: "#e8a000" },
  "[]": { bg: "#f5f5f5", fg: "#aaa" },
  tensor: { bg: "#e6f4ea", fg: "#34a853" },
  optional: { bg: "#f5f5f5", fg: "#aaa" },
};

function attrChipLabel(value: AttributeValue): string {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (value.length === 0) return "[]";
  return typeof value[0] === "string"
    ? "str[]"
    : Number.isInteger(value[0] as number)
      ? "int[]"
      : "float[]";
}

function formatAttr(value: AttributeValue): string {
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return `[${value.join(", ")}]`;
}

function Chip({ label }: { label: string }) {
  const c = CHIPS[label] ?? { bg: "#f5f5f5", fg: "#aaa" };
  return (
    <span
      style={{
        fontSize: 8,
        background: c.bg,
        color: c.fg,
        padding: "1px 6px",
        borderRadius: 10,
        whiteSpace: "nowrap",
        minWidth: 44,
        textAlign: "center",
        display: "inline-block",
      }}
    >
      {label}
    </span>
  );
}

function Row({
  label,
  value,
  chip,
  onClick,
}: {
  label: string;
  value: string;
  chip: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "3px 0",
        borderBottom: "1px solid #f8f8f8",
        gap: 6,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={onClick}
    >
      <span
        style={{
          color: "#555",
          fontSize: 10,
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {value && (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "#333",
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
      )}
      <Chip label={chip} />
    </div>
  );
}

function SectionLabel({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 700,
        color: "#aaa",
        textTransform: "uppercase",
        letterSpacing: ".7px",
        marginBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {icon}
      {title}
    </div>
  );
}

const HEADER: React.CSSProperties = {
  padding: "12px 14px 10px",
  borderBottom: "1px solid #eee",
  display: "flex",
  alignItems: "center",
  gap: 8,
};
const SECTION: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid #f0f0f0",
};
const ICON_BOX: React.CSSProperties = {
  width: 28,
  height: 28,
  background: "#e8f0fe",
  borderRadius: 6,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

function OpPanel({
  node,
  onTensorClick,
}: {
  node: GraphNode;
  onTensorClick?: (name: string) => void;
}) {
  const attrEntries = Object.entries(node.attributes);
  return (
    <>
      <div style={HEADER}>
        <div style={ICON_BOX}>
          <Cpu size={15} color="#4285f4" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{node.opType}</div>
          {node.name && (
            <div style={{ fontSize: 9, color: "#aaa", fontFamily: "monospace" }}>{node.name}</div>
          )}
        </div>
      </div>

      {node.inputs.length > 0 && (
        <div style={SECTION}>
          <SectionLabel icon={<ArrowCircleDown size={12} />} title="Inputs" />
          {node.inputs.map((name, i) => (
            <Row
              key={i}
              label={name || `input_${i}`}
              value=""
              chip={name ? "tensor" : "optional"}
              onClick={name && onTensorClick ? () => onTensorClick(name) : undefined}
            />
          ))}
        </div>
      )}

      {node.outputs.length > 0 && (
        <div style={SECTION}>
          <SectionLabel icon={<ArrowCircleUp size={12} />} title="Outputs" />
          {node.outputs.map((name, i) => (
            <Row
              key={i}
              label={name || `output_${i}`}
              value=""
              chip="tensor"
              onClick={name && onTensorClick ? () => onTensorClick(name) : undefined}
            />
          ))}
        </div>
      )}

      {attrEntries.length > 0 && (
        <div style={{ ...SECTION, borderBottom: "none" }}>
          <SectionLabel icon={<SlidersHorizontal size={12} />} title="Attributes" />
          {attrEntries.map(([key, val]) => (
            <Row key={key} label={key} value={formatAttr(val)} chip={attrChipLabel(val)} />
          ))}
        </div>
      )}
    </>
  );
}

function IoPanel({
  graphValue,
  direction,
}: {
  graphValue: GraphValue;
  direction: "input" | "output";
}) {
  const isInput = direction === "input";
  const color = isInput ? "#34a853" : "#4285f4";
  const iconBg = isInput ? "#e6f4ea" : "#e8f0fe";
  return (
    <>
      <div style={HEADER}>
        <div style={{ ...ICON_BOX, background: iconBg }}>
          {isInput ? (
            <ArrowFatDown size={15} color={color} />
          ) : (
            <ArrowFatUp size={15} color={color} />
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{graphValue.name}</div>
          <div style={{ fontSize: 9, color: "#aaa" }}>{direction}</div>
        </div>
      </div>
      <div style={{ ...SECTION, borderBottom: "none" }}>
        {graphValue.shape !== null && (
          <Row label="shape" value={`[${graphValue.shape.join(" × ")}]`} chip="int[]" />
        )}
        {graphValue.dtype !== null && graphValue.dtype !== undefined && (
          <Row label="dtype" value={graphValue.dtype} chip="str" />
        )}
      </div>
    </>
  );
}

function EdgePanel({
  edge,
}: {
  edge: { tensorName: string; sourceOpType: string; targetOpType: string };
}) {
  return (
    <>
      <div style={HEADER}>
        <div style={{ ...ICON_BOX, background: "#f3e5f5" }}>
          <ArrowsLeftRight size={15} color="#9c27b0" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Connection</div>
      </div>
      <div style={SECTION}>
        <Row label="name" value={edge.tensorName} chip="tensor" />
      </div>
      <div style={SECTION}>
        <SectionLabel icon={null} title="From" />
        <Row label="node" value={edge.sourceOpType} chip="str" />
      </div>
      <div style={{ ...SECTION, borderBottom: "none" }}>
        <SectionLabel icon={null} title="To" />
        <Row label="node" value={edge.targetOpType} chip="str" />
      </div>
    </>
  );
}

function TensorPanel({
  tensor,
}: {
  tensor: { name: string; shape: readonly number[] | null; dtype: string | null };
}) {
  return (
    <>
      <div style={HEADER}>
        <div style={{ ...ICON_BOX, background: "#e6f4ea" }}>
          <Cube size={15} color="#34a853" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 13 }}>Tensor</div>
      </div>
      <div style={{ ...SECTION, borderBottom: "none" }}>
        <Row label="name" value={tensor.name} chip="str" />
        {tensor.shape !== null && (
          <Row label="shape" value={`[${tensor.shape.join(" × ")}]`} chip="int[]" />
        )}
        {tensor.dtype !== null && <Row label="dtype" value={tensor.dtype} chip="str" />}
      </div>
    </>
  );
}

export function NodePropertyPanel({
  target,
  onTensorClick,
}: {
  target: PanelTarget | null;
  onTensorClick?: (name: string) => void;
}) {
  if (!target) return null;
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
        fontSize: 11,
        border: "1px solid #e0e0e0",
      }}
    >
      {isGraphNode(target) ? (
        <OpPanel node={target} onTensorClick={onTensorClick} />
      ) : isEdgeTarget(target) ? (
        <EdgePanel edge={target.edge} />
      ) : isTensorTarget(target) ? (
        <TensorPanel tensor={target.tensor} />
      ) : (
        <IoPanel graphValue={target.graphValue} direction={target.direction} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run NodePropertyPanel tests**

```bash
bun test packages/react/test/NodePropertyPanel.test.tsx
```

Expected: all pass.

- [ ] **Step 5: Run all react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/NodePropertyPanel.tsx packages/react/test/NodePropertyPanel.test.tsx
git commit -m "feat(react): add EdgePanel, TensorPanel, and onTensorClick to NodePropertyPanel"
```

---

## Task 4: Wire tensor drill-down in App.tsx

**Files:**

- Modify: `apps/demo/src/App.tsx`

- [ ] **Step 1: Replace the full contents of App.tsx**

```tsx
import React, { useState, useCallback } from "react";
import { parseModel } from "@wetron/core";
import { ModelGraphView, NodePropertyPanel } from "@wetron/react";
import type { ModelGraph } from "@wetron/core";
import type { PanelTarget } from "@wetron/react";

type State =
  | { status: "idle" }
  | { status: "loading"; name: string }
  | { status: "ready"; graph: ModelGraph; name: string }
  | { status: "error"; message: string; name: string };

export default function App() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<PanelTarget | null>(null);

  const loadFile = useCallback(async (file: File) => {
    setState({ status: "loading", name: file.name });
    setSelected(null);
    try {
      const buf = await file.arrayBuffer();
      const graph = await parseModel(new Uint8Array(buf), file.name);
      setState({ status: "ready", graph, name: file.name });
    } catch (e) {
      setState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
        name: file.name,
      });
    }
  }, []);

  const handleTensorClick = useCallback(
    (name: string) => {
      if (state.status !== "ready") return;
      const gv =
        state.graph.inputs.find((v) => v.name === name) ??
        state.graph.outputs.find((v) => v.name === name);
      setSelected({ tensor: { name, shape: gv?.shape ?? null, dtype: gv?.dtype ?? null } });
    },
    [state],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header
        style={{
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18 }}>wetron</span>
        {state.status !== "idle" && (
          <span style={{ color: "#666", fontSize: 14 }}>{state.name}</span>
        )}
        {state.status === "ready" && (
          <span style={{ color: "#888", fontSize: 13 }}>
            {state.graph.nodes.length} nodes · {state.graph.inputs.length} inputs ·{" "}
            {state.graph.outputs.length} outputs
          </span>
        )}
        <label
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            background: "#1a73e8",
            color: "#fff",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Open model
          <input
            type="file"
            accept=".onnx,.tflite"
            style={{ display: "none" }}
            onChange={onFileChange}
          />
        </label>
      </header>

      <main style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {state.status === "idle" && (
          <DropZone
            dragging={dragging}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
          />
        )}
        {state.status === "loading" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "#666",
            }}
          >
            Parsing {state.name}...
          </div>
        )}
        {state.status === "error" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: 8,
            }}
          >
            <div style={{ color: "#d93025", fontWeight: 600 }}>Failed to parse {state.name}</div>
            <div style={{ color: "#666", fontSize: 13, maxWidth: 480, textAlign: "center" }}>
              {state.message}
            </div>
          </div>
        )}
        {state.status === "ready" && (
          <div
            style={{ display: "flex", width: "100%", height: "100%" }}
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <ModelGraphView graph={state.graph} onTargetClick={setSelected} />
            </div>
            <div
              style={{
                width: 280,
                flexShrink: 0,
                overflowY: "auto",
                padding: 12,
                borderLeft: "1px solid #e0e0e0",
                background: "#fafafa",
              }}
            >
              <NodePropertyPanel target={selected} onTensorClick={handleTensorClick} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DropZone({
  dragging,
  onDrop,
  onDragOver,
  onDragLeave,
}: {
  dragging: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
}) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        gap: 12,
        border: `2px dashed ${dragging ? "#1a73e8" : "#ccc"}`,
        margin: 24,
        borderRadius: 12,
        background: dragging ? "#e8f0fe" : "#fafafa",
        transition: "all 0.15s",
      }}
    >
      <div style={{ fontSize: 40 }}>&#x2B06;</div>
      <div style={{ fontWeight: 600, color: "#333" }}>Drop a model file here</div>
      <div style={{ color: "#888", fontSize: 13 }}>Supports .onnx and .tflite</div>
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
bun test
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/demo/src/App.tsx
git commit -m "feat(demo): wire onTensorClick with graph boundary lookup"
```
