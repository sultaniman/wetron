# Node Property Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `NodePropertyPanel` React component to `@wetron/react` that displays properties of a clicked op or IO node, with Phosphor Icons and colour-coded type chips.

**Architecture:** A standalone `NodePropertyPanel` component accepts a `PanelTarget` union (`GraphNode | { graphValue: GraphValue; direction }`) and renders either an op view or an IO view. `ModelGraphView` gains an `onTargetClick` callback that fires for both node types, replacing the old `onNodeClick`. The demo app wires the two together with a 280 px right panel.

**Tech Stack:** TypeScript, React 19, `@phosphor-icons/react` ^2.1.10, `@testing-library/react`, `bun:test`, happy-dom.

---

## File map

| File                                             | Change                                                                     |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `packages/core/src/transform.ts`                 | Add `graphValue?: GraphValue` to `GraphNodeData`; populate it for IO nodes |
| `packages/react/src/NodePropertyPanel.tsx`       | **New** — `PanelTarget`, `isGraphNode`, `NodePropertyPanel`                |
| `packages/react/src/ModelGraphView.tsx`          | Replace `onNodeClick` with `onTargetClick`; wire IO clicks                 |
| `packages/react/src/index.ts`                    | Export `NodePropertyPanel` and `PanelTarget`                               |
| `packages/react/package.json`                    | Add `@phosphor-icons/react` to peer + dev deps                             |
| `packages/react/test/NodePropertyPanel.test.tsx` | **New** — component tests                                                  |
| `apps/demo/src/App.tsx`                          | Add selected state, panel layout, `onTargetClick` wiring                   |

---

## Task 1: Add `graphValue` to `GraphNodeData`

**Files:**

- Modify: `packages/core/src/transform.ts`

- [ ] **Step 1: Update the `GraphNodeData` type and import**

Open `packages/core/src/transform.ts`. The current import is:

```typescript
import type { ModelGraph, GraphNode, AttributeValue } from "./ir.ts";
```

Change it to:

```typescript
import type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";
```

Then add `graphValue?: GraphValue` to `GraphNodeData`:

```typescript
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
```

- [ ] **Step 2: Populate `graphValue` for input IO nodes**

In `modelGraphToFlow`, find the loop over `graph.inputs` (around line 37). Change the `data` object from:

```typescript
data: { opType: 'Input', name: gv.name, inputs: [], outputs: [gv.name], attributes: {}, shape: gv.shape, dtype: gv.dtype },
```

to:

```typescript
data: { opType: 'Input', name: gv.name, inputs: [], outputs: [gv.name], attributes: {}, shape: gv.shape, dtype: gv.dtype, graphValue: gv },
```

- [ ] **Step 3: Populate `graphValue` for output IO nodes**

Find the loop over `graph.outputs` (around line 62). Change its `data` object from:

```typescript
data: { opType: 'Output', name: gv.name, inputs: [gv.name], outputs: [], attributes: {}, shape: gv.shape, dtype: gv.dtype },
```

to:

```typescript
data: { opType: 'Output', name: gv.name, inputs: [gv.name], outputs: [], attributes: {}, shape: gv.shape, dtype: gv.dtype, graphValue: gv },
```

- [ ] **Step 4: Verify tests still pass**

```bash
bun test packages/core
```

Expected: all tests pass with no changes needed.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/transform.ts
git commit -m "feat(@wetron/core): add graphValue to GraphNodeData for IO nodes"
```

---

## Task 2: Create `NodePropertyPanel`

**Files:**

- Create: `packages/react/src/NodePropertyPanel.tsx`
- Create: `packages/react/test/NodePropertyPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `packages/react/test/NodePropertyPanel.test.tsx`:

```tsx
// @happy-dom
import { test, expect, describe } from "bun:test";
import { render, screen } from "@testing-library/react";
import React from "react";
import { NodePropertyPanel } from "../src/NodePropertyPanel.tsx";
import type { GraphNode, GraphValue } from "@wetron/core/ir";

const mockOp: GraphNode = {
  name: "conv_0",
  opType: "Conv",
  inputs: ["data", "weight", ""],
  outputs: ["out"],
  attributes: {
    kernel_shape: [3, 3] as unknown as readonly number[],
    group: 1,
    auto_pad: "NOTSET",
  },
};

const mockInput: GraphValue = {
  name: "data",
  shape: [1, 3, 224, 224],
  dtype: "float32",
};

const mockOutput: GraphValue = {
  name: "predictions",
  shape: [1, 1000],
  dtype: "float32",
};

describe("NodePropertyPanel", () => {
  test("renders nothing when target is null", () => {
    const { container } = render(React.createElement(NodePropertyPanel, { target: null }));
    expect(container.firstChild).toBeNull();
  });

  test("op node: shows opType and name in header", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("Conv")).toBeDefined();
    expect(screen.getByText("conv_0")).toBeDefined();
  });

  test("op node: shows input names", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("weight")).toBeDefined();
  });

  test("op node: shows attribute keys and formatted values", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("kernel_shape")).toBeDefined();
    expect(screen.getByText("[3, 3]")).toBeDefined();
    expect(screen.getByText("auto_pad")).toBeDefined();
    expect(screen.getByText("NOTSET")).toBeDefined();
  });

  test("op node: renders int[] chip for array attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    const chips = screen.getAllByText("int[]");
    expect(chips.length).toBeGreaterThan(0);
  });

  test("op node: renders int chip for scalar integer attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("int")).toBeDefined();
  });

  test("op node: renders str chip for string attribute", () => {
    render(React.createElement(NodePropertyPanel, { target: mockOp }));
    expect(screen.getByText("str")).toBeDefined();
  });

  test("IO input node: shows name, shape, dtype", () => {
    render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: mockInput, direction: "input" },
      }),
    );
    expect(screen.getByText("data")).toBeDefined();
    expect(screen.getByText("[1 × 3 × 224 × 224]")).toBeDefined();
    expect(screen.getByText("float32")).toBeDefined();
  });

  test("IO output node: shows direction label", () => {
    render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: mockOutput, direction: "output" },
      }),
    );
    expect(screen.getByText("predictions")).toBeDefined();
    expect(screen.getByText("output")).toBeDefined();
  });

  test("IO node with null shape renders nothing for shape row", () => {
    const noShape: GraphValue = { name: "x", shape: null, dtype: null };
    const { container } = render(
      React.createElement(NodePropertyPanel, {
        target: { graphValue: noShape, direction: "input" },
      }),
    );
    expect(container.querySelector('[data-testid="shape-row"]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd packages/react && bun test test/NodePropertyPanel.test.tsx
```

Expected: `Cannot find module '../src/NodePropertyPanel.tsx'`

- [ ] **Step 3: Create `NodePropertyPanel.tsx`**

Create `packages/react/src/NodePropertyPanel.tsx`:

```tsx
import React from "react";
import {
  Cpu,
  ArrowCircleDown,
  ArrowCircleUp,
  SlidersHorizontal,
  ArrowFatDown,
  ArrowFatUp,
} from "@phosphor-icons/react";
import type { GraphNode, GraphValue, AttributeValue } from "@wetron/core/ir";

export type PanelTarget = GraphNode | { graphValue: GraphValue; direction: "input" | "output" };

export function isGraphNode(t: PanelTarget): t is GraphNode {
  return "opType" in t;
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

function Row({ label, value, chip }: { label: string; value: string; chip: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "3px 0",
        borderBottom: "1px solid #f8f8f8",
        gap: 6,
      }}
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

function OpPanel({ node }: { node: GraphNode }) {
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
            />
          ))}
        </div>
      )}

      {node.outputs.length > 0 && (
        <div style={SECTION}>
          <SectionLabel icon={<ArrowCircleUp size={12} />} title="Outputs" />
          {node.outputs.map((name, i) => (
            <Row key={i} label={name || `output_${i}`} value="" chip="tensor" />
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

export function NodePropertyPanel({ target }: { target: PanelTarget | null }) {
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
        <OpPanel node={target} />
      ) : (
        <IoPanel graphValue={target.graphValue} direction={target.direction} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd packages/react && bun test test/NodePropertyPanel.test.tsx
```

Expected: all 10 tests pass.

- [ ] **Step 5: Run type check**

```bash
cd /path/to/worktree && bunx tsc --noEmit --project packages/react/tsconfig.json
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/NodePropertyPanel.tsx packages/react/test/NodePropertyPanel.test.tsx
git commit -m "feat(@wetron/react): add NodePropertyPanel with Phosphor icons and type chips"
```

---

## Task 3: Update `ModelGraphView` to use `onTargetClick`

**Files:**

- Modify: `packages/react/src/ModelGraphView.tsx`

- [ ] **Step 1: Update imports and `Props` type**

Replace the top of `packages/react/src/ModelGraphView.tsx` with:

```tsx
import React, { useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { modelGraphToFlow, type GraphNodeData } from "@wetron/core/transform";
import type { ModelGraph } from "@wetron/core/ir";
import { GraphNodeComponent } from "./nodes/GraphNode.tsx";
import { IoNodeComponent } from "./nodes/IoNode.tsx";
import { type PanelTarget } from "./NodePropertyPanel.tsx";

const nodeTypes: NodeTypes = {
  graphNode: GraphNodeComponent as NodeTypes[string],
  ioNode: IoNodeComponent as NodeTypes[string],
};

type Props = {
  graph: ModelGraph;
  onTargetClick?: (target: PanelTarget) => void;
};
```

- [ ] **Step 2: Update `Inner` and the click handler**

Replace the `Inner` function with:

```tsx
function Inner({ graph, onTargetClick }: Props) {
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

  React.useEffect(() => {
    fitView();
  }, [graph, fitView]);

  return (
    <ReactFlow
      nodes={nodes as Node<GraphNodeData>[]}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
    >
      <MiniMap />
      <Controls />
      <Background />
    </ReactFlow>
  );
}

export function ModelGraphView(props: Props) {
  return (
    <ReactFlowProvider>
      <div style={{ width: "100%", height: "100%" }}>
        <Inner {...props} />
      </div>
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 3: Run all react tests**

```bash
cd packages/react && bun test
```

Expected: all tests pass (existing `ModelGraphView.test.tsx` doesn't pass `onTargetClick` so it still works).

- [ ] **Step 4: Commit**

```bash
git add packages/react/src/ModelGraphView.tsx
git commit -m "feat(@wetron/react): replace onNodeClick with onTargetClick for both node types"
```

---

## Task 4: Add Phosphor dep and export `NodePropertyPanel`

**Files:**

- Modify: `packages/react/package.json`
- Modify: `packages/react/src/index.ts`

- [ ] **Step 1: Add `@phosphor-icons/react` to package.json**

Open `packages/react/package.json`. Add to `devDependencies` and `peerDependencies`:

```json
{
  "name": "@wetron/react",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@wetron/core": "workspace:*"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "^20.9.0",
    "@phosphor-icons/react": "^2.1.10",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@wetron/onnx": "workspace:*",
    "@xyflow/react": "^12.10.2",
    "react": "^19.2.5",
    "react-dom": "^19.2.5"
  },
  "peerDependencies": {
    "@phosphor-icons/react": ">=2",
    "@xyflow/react": ">=12",
    "react": ">=18",
    "react-dom": ">=18"
  }
}
```

- [ ] **Step 2: Export `NodePropertyPanel` and `PanelTarget` from index**

Replace `packages/react/src/index.ts` with:

```typescript
export { ModelGraphView } from "./ModelGraphView.tsx";
export { NodePropertyPanel, isGraphNode } from "./NodePropertyPanel.tsx";
export type { PanelTarget } from "./NodePropertyPanel.tsx";
```

- [ ] **Step 3: Run type check**

```bash
bunx tsc --noEmit --project packages/react/tsconfig.json
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/react/package.json packages/react/src/index.ts
git commit -m "chore(@wetron/react): export NodePropertyPanel and add phosphor peer dep"
```

---

## Task 5: Wire up in demo app

**Files:**

- Modify: `apps/demo/src/App.tsx`

- [ ] **Step 1: Replace `apps/demo/src/App.tsx` with the wired-up version**

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
              <NodePropertyPanel target={selected} />
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

- [ ] **Step 2: Run type check on demo**

```bash
bunx tsc --noEmit --project apps/demo/tsconfig.json
```

Expected: no errors.

- [ ] **Step 3: Run full test suite**

```bash
bun test
```

Expected: 43+ tests pass, 0 fail.

- [ ] **Step 4: Commit**

```bash
git add apps/demo/src/App.tsx
git commit -m "feat(demo): wire NodePropertyPanel alongside graph view"
```
