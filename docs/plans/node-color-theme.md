# Node Color Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-category color themes and B·3 node layout to `@wetron/react` and `@wetron/svelte`.

**Architecture:** A pure `opCategory(opType)` function in `@wetron/core` maps op names to 14 categories. Each renderer package has its own `theme.ts` with `CATEGORY_THEME` tokens (icon + light/dark hex). Nodes read a `colorMode` context provided by `ModelGraphView` to pick light/dark colors and render the B·3 layout: pill (left) + icon (right) header row, muted name below.

**Tech Stack:** TypeScript, React 18, @xyflow/react 12, Svelte 5, @xyflow/svelte 1, bun:test, @testing-library/react.

---

## File Map

| File                                         | Action                                                   |
| -------------------------------------------- | -------------------------------------------------------- |
| `packages/core/src/categories.ts`            | Create — `OpCategory` type + `opCategory()`              |
| `packages/core/src/index.ts`                 | Modify — export `OpCategory`, `opCategory`               |
| `packages/core/test/categories.test.ts`      | Create — unit tests                                      |
| `packages/react/src/theme.ts`                | Create — `CategoryTheme` + `CATEGORY_THEME`              |
| `packages/react/src/ColorModeContext.ts`     | Create — React context + `resolveColorMode()`            |
| `packages/react/src/nodes/GraphNode.tsx`     | Modify — B·3 layout                                      |
| `packages/react/src/nodes/IoNode.tsx`        | Modify — B·3 IO layout                                   |
| `packages/react/src/ModelGraphView.tsx`      | Modify — `colorMode` prop + context + defaultEdgeOptions |
| `packages/react/test/GraphNode.test.tsx`     | Create — render tests                                    |
| `packages/svelte/src/theme.ts`               | Create — same tokens as react/theme.ts                   |
| `packages/svelte/src/ColorModeContext.ts`    | Create — Svelte context helpers                          |
| `packages/svelte/src/nodes/GraphNode.svelte` | Modify — B·3 layout                                      |
| `packages/svelte/src/nodes/IoNode.svelte`    | Modify — B·3 IO layout                                   |
| `packages/svelte/src/ModelGraphView.svelte`  | Modify — `colorMode` prop + setContext                   |

---

### Task 1: `packages/core/src/categories.ts`

**Files:**

- Create: `packages/core/src/categories.ts`
- Create: `packages/core/test/categories.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/categories.test.ts
import { test, expect } from "bun:test";
import { opCategory } from "../src/categories.ts";

test("Conv maps to conv", () => expect(opCategory("Conv")).toBe("conv"));
test("ConvTranspose maps to conv", () => expect(opCategory("ConvTranspose")).toBe("conv"));
test("Gemm maps to conv", () => expect(opCategory("Gemm")).toBe("conv"));
test("MatMul maps to conv", () => expect(opCategory("MatMul")).toBe("conv"));
test("Relu maps to activation", () => expect(opCategory("Relu")).toBe("activation"));
test("Sigmoid maps to activation", () => expect(opCategory("Sigmoid")).toBe("activation"));
test("Gelu maps to activation", () => expect(opCategory("Gelu")).toBe("activation"));
test("BatchNormalization maps to normalization", () =>
  expect(opCategory("BatchNormalization")).toBe("normalization"));
test("LayerNormalization maps to normalization", () =>
  expect(opCategory("LayerNormalization")).toBe("normalization"));
test("MaxPool maps to pooling", () => expect(opCategory("MaxPool")).toBe("pooling"));
test("GlobalAveragePool maps to pooling", () =>
  expect(opCategory("GlobalAveragePool")).toBe("pooling"));
test("Reshape maps to reshape", () => expect(opCategory("Reshape")).toBe("reshape"));
test("Transpose maps to reshape", () => expect(opCategory("Transpose")).toBe("reshape"));
test("Add maps to math", () => expect(opCategory("Add")).toBe("math"));
test("Mul maps to math", () => expect(opCategory("Mul")).toBe("math"));
test("ReduceMean maps to reduction", () => expect(opCategory("ReduceMean")).toBe("reduction"));
test("ArgMax maps to reduction", () => expect(opCategory("ArgMax")).toBe("reduction"));
test("Concat maps to merge", () => expect(opCategory("Concat")).toBe("merge"));
test("Gather maps to merge", () => expect(opCategory("Gather")).toBe("merge"));
test("MultiHeadAttention maps to attention", () =>
  expect(opCategory("MultiHeadAttention")).toBe("attention"));
test("LSTM maps to recurrent", () => expect(opCategory("LSTM")).toBe("recurrent"));
test("GRU maps to recurrent", () => expect(opCategory("GRU")).toBe("recurrent"));
test("QuantizeLinear maps to quantization", () =>
  expect(opCategory("QuantizeLinear")).toBe("quantization"));
test("unknown op maps to unknown", () => expect(opCategory("SomeWeirdOp")).toBe("unknown"));
test("Input maps to input", () => expect(opCategory("Input")).toBe("input"));
test("Output maps to output", () => expect(opCategory("Output")).toBe("output"));
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test packages/core/test/categories.test.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement `categories.ts`**

```ts
// packages/core/src/categories.ts
export type OpCategory =
  | "input"
  | "output"
  | "conv"
  | "activation"
  | "normalization"
  | "pooling"
  | "reshape"
  | "math"
  | "reduction"
  | "merge"
  | "attention"
  | "recurrent"
  | "quantization"
  | "unknown";

const CATEGORY_MAP: Record<string, OpCategory> = {
  // IO
  Input: "input",
  Output: "output",
  // Conv / Linear
  Conv: "conv",
  ConvTranspose: "conv",
  DepthwiseConv: "conv",
  Gemm: "conv",
  MatMul: "conv",
  Linear: "conv",
  QLinearConv: "conv",
  QLinearMatMul: "conv",
  // Activation
  Relu: "activation",
  Relu6: "activation",
  Sigmoid: "activation",
  Tanh: "activation",
  Softmax: "activation",
  LogSoftmax: "activation",
  Gelu: "activation",
  Silu: "activation",
  Elu: "activation",
  LeakyRelu: "activation",
  Selu: "activation",
  Mish: "activation",
  HardSwish: "activation",
  HardSigmoid: "activation",
  PRelu: "activation",
  // Normalization
  BatchNormalization: "normalization",
  LayerNormalization: "normalization",
  GroupNormalization: "normalization",
  InstanceNormalization: "normalization",
  LpNormalization: "normalization",
  MeanVarianceNormalization: "normalization",
  // Pooling
  MaxPool: "pooling",
  AveragePool: "pooling",
  GlobalAveragePool: "pooling",
  GlobalMaxPool: "pooling",
  LpPool: "pooling",
  MaxUnpool: "pooling",
  RoiAlign: "pooling",
  // Shape / Reshape
  Reshape: "reshape",
  Flatten: "reshape",
  Squeeze: "reshape",
  Unsqueeze: "reshape",
  Transpose: "reshape",
  Expand: "reshape",
  Resize: "reshape",
  Upsample: "reshape",
  SpaceToDepth: "reshape",
  DepthToSpace: "reshape",
  PixelShuffle: "reshape",
  Pad: "reshape",
  // Element-wise Math
  Add: "math",
  Sub: "math",
  Mul: "math",
  Div: "math",
  Pow: "math",
  Sqrt: "math",
  Exp: "math",
  Log: "math",
  Abs: "math",
  Neg: "math",
  Ceil: "math",
  Floor: "math",
  Round: "math",
  Sign: "math",
  Reciprocal: "math",
  Max: "math",
  Min: "math",
  Mod: "math",
  Clip: "math",
  // Reduction
  ReduceMean: "reduction",
  ReduceSum: "reduction",
  ReduceMax: "reduction",
  ReduceMin: "reduction",
  ReduceProd: "reduction",
  ReduceL1: "reduction",
  ReduceL2: "reduction",
  ArgMax: "reduction",
  ArgMin: "reduction",
  CumSum: "reduction",
  // Merge / Split
  Concat: "merge",
  Split: "merge",
  Gather: "merge",
  GatherElements: "merge",
  GatherND: "merge",
  Slice: "merge",
  Tile: "merge",
  ScatterElements: "merge",
  ScatterND: "merge",
  Where: "merge",
  NonZero: "merge",
  TopK: "merge",
  // Attention
  MultiHeadAttention: "attention",
  Attention: "attention",
  EmbedLayerNormalization: "attention",
  SkipLayerNormalization: "attention",
  BiasGelu: "attention",
  // Recurrent
  LSTM: "recurrent",
  GRU: "recurrent",
  RNN: "recurrent",
  UnidirectionalSequenceLSTM: "recurrent",
  BidirectionalSequenceLSTM: "recurrent",
  BidirectionalSequenceRNN: "recurrent",
  // Quantization
  QuantizeLinear: "quantization",
  DequantizeLinear: "quantization",
  DynamicQuantizeLinear: "quantization",
};

export function opCategory(opType: string): OpCategory {
  return CATEGORY_MAP[opType] ?? "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test packages/core/test/categories.test.ts
```

Expected: all 26 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/categories.ts packages/core/test/categories.test.ts
git commit -m "feat(core): add opCategory() with 14-category op mapping"
```

---

### Task 2: Export from `packages/core/src/index.ts`

**Files:**

- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add exports**

Add to the top of `packages/core/src/index.ts`:

```ts
export { opCategory } from "./categories.ts";
export type { OpCategory } from "./categories.ts";
```

Final file:

```ts
export { opCategory } from "./categories.ts";
export type { OpCategory } from "./categories.ts";
export { ParseError } from "./ir.ts";
export type { ModelGraph, GraphNode, GraphValue, AttributeValue } from "./ir.ts";
export { detectFormat } from "./detect.ts";
export type { Format } from "./detect.ts";
export { modelGraphToFlow } from "./transform.ts";
export type { FlowNode, FlowEdge, GraphNodeData } from "./transform.ts";

import { detectFormat } from "./detect.ts";
import type { ModelGraph } from "./ir.ts";
import { ParseError } from "./ir.ts";

export async function parseModel(bytes: Uint8Array, filename?: string): Promise<ModelGraph> {
  const format = detectFormat(bytes, filename);
  if (format === "onnx") {
    const { parseOnnx } = await import("@wetron/onnx");
    return parseOnnx(bytes);
  }
  if (format === "tflite") {
    const { parseTflite } = await import("@wetron/tflite");
    return parseTflite(bytes);
  }
  throw new ParseError("unknown", `Cannot detect format${filename ? ` for "${filename}"` : ""}`);
}
```

- [ ] **Step 2: Run core tests**

```bash
bun test packages/core
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/index.ts
git commit -m "feat(core): export opCategory and OpCategory from index"
```

---

### Task 3: `packages/react/src/theme.ts`

**Files:**

- Create: `packages/react/src/theme.ts`

- [ ] **Step 1: Create theme.ts**

```ts
// packages/react/src/theme.ts
import type { OpCategory } from "@wetron/core";

export type { OpCategory };

export type CategoryTheme = {
  icon: string;
  light: string;
  dark: string;
};

export const CATEGORY_THEME: Record<OpCategory, CategoryTheme> = {
  input: { icon: "↓", light: "#2e7d32", dark: "#4caf50" },
  output: { icon: "↑", light: "#1565c0", dark: "#42a5f5" },
  conv: { icon: "⊛", light: "#3949ab", dark: "#7986cb" },
  activation: { icon: "ƒ", light: "#d84315", dark: "#ff7043" },
  normalization: { icon: "μ", light: "#00695c", dark: "#26a69a" },
  pooling: { icon: "⊟", light: "#6a1b9a", dark: "#ab47bc" },
  reshape: { icon: "⇄", light: "#4e342e", dark: "#a1887f" },
  math: { icon: "⊕", light: "#ad1457", dark: "#f06292" },
  reduction: { icon: "Σ", light: "#1565c0", dark: "#64b5f6" },
  merge: { icon: "‖", light: "#e65100", dark: "#ffa726" },
  attention: { icon: "⊙", light: "#00695c", dark: "#4db6ac" },
  recurrent: { icon: "↺", light: "#558b2f", dark: "#aed581" },
  quantization: { icon: "Q", light: "#795548", dark: "#bcaaa4" },
  unknown: { icon: "?", light: "#757575", dark: "#9e9e9e" },
};
```

Note: spec uses italic `_f_` for activation — the Unicode italic small f is `ƒ` (U+0192), which renders well in monospace.

- [ ] **Step 2: Run react tests to confirm nothing broke**

```bash
bun test packages/react
```

Expected: all existing tests pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/theme.ts
git commit -m "feat(react): add CATEGORY_THEME with 14 op categories"
```

---

### Task 4: `packages/react/src/ColorModeContext.ts`

**Files:**

- Create: `packages/react/src/ColorModeContext.ts`

- [ ] **Step 1: Create context file**

```ts
// packages/react/src/ColorModeContext.ts
import { createContext, useContext } from "react";

export type ColorMode = "light" | "dark" | "system";

export const ColorModeContext = createContext<ColorMode>("system");

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function useColorMode(): "light" | "dark" {
  return resolveColorMode(useContext(ColorModeContext));
}
```

- [ ] **Step 2: Run react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/ColorModeContext.ts
git commit -m "feat(react): add ColorModeContext and resolveColorMode helper"
```

---

### Task 5: `packages/react/src/nodes/GraphNode.tsx` + tests

**Files:**

- Modify: `packages/react/src/nodes/GraphNode.tsx`
- Create: `packages/react/test/GraphNode.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/react/test/GraphNode.test.tsx
// @happy-dom
import { test, expect, describe, afterEach } from "bun:test";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";
import { GraphNodeComponent } from "../src/nodes/GraphNode.tsx";
import { ColorModeContext } from "../src/ColorModeContext.ts";
import type { GraphNodeData } from "@wetron/core/transform";
import type { Node } from "@xyflow/react";

afterEach(cleanup);

function makeProps(opType: string, name = ""): { data: GraphNodeData } {
  return {
    data: {
      opType,
      name,
      inputs: [],
      outputs: [],
      attributes: {},
    } as GraphNodeData,
  };
}

function renderWithMode(
  opType: string,
  name = "",
  colorMode: "light" | "dark" | "system" = "light",
) {
  // GraphNodeComponent expects NodeProps — we pass a minimal compatible object
  const props = makeProps(opType, name) as unknown as Parameters<typeof GraphNodeComponent>[0];
  return render(
    React.createElement(
      ColorModeContext.Provider,
      { value: colorMode },
      React.createElement(GraphNodeComponent, props),
    ),
  );
}

describe("GraphNodeComponent", () => {
  test("Conv renders ⊛ icon", () => {
    renderWithMode("Conv", "conv1");
    expect(screen.getByText("⊛")).toBeDefined();
  });

  test("Relu renders ƒ icon", () => {
    renderWithMode("Relu");
    expect(screen.getByText("ƒ")).toBeDefined();
  });

  test("unknown op renders ? icon", () => {
    renderWithMode("SomeWeirdOp");
    expect(screen.getByText("?")).toBeDefined();
  });

  test("opType is shown in pill", () => {
    renderWithMode("MaxPool");
    expect(screen.getByText("MaxPool")).toBeDefined();
  });

  test("node name is shown below header", () => {
    renderWithMode("Conv", "/some/path/conv");
    expect(screen.getByText("/some/path/conv")).toBeDefined();
  });

  test("does not render name row when name is empty", () => {
    const { container } = renderWithMode("Conv", "");
    // only one text element: the pill
    const texts = Array.from(container.querySelectorAll("[data-nodename]"));
    expect(texts.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun test packages/react/test/GraphNode.test.tsx
```

Expected: FAIL — icon characters not found in DOM.

- [ ] **Step 3: Update `GraphNode.tsx`**

```tsx
// packages/react/src/nodes/GraphNode.tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { opCategory } from "@wetron/core";
import { CATEGORY_THEME } from "../theme.ts";
import { useColorMode } from "../ColorModeContext.ts";

export function GraphNodeComponent({ data }: NodeProps<Node<GraphNodeData>>) {
  const isDark = useColorMode() === "dark";
  const cat = opCategory(data.opType);
  const theme = CATEGORY_THEME[cat];
  const color = isDark ? theme.dark : theme.light;
  const bg = isDark ? "#1e1e2e" : "#fff";
  const border = isDark ? "#333" : "#e0e0e0";
  const nameMuted = isDark ? "#4a4a5a" : "#999";

  return (
    <div
      data-nodetype="graphNode"
      style={{
        padding: "10px 12px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        minWidth: 180,
      }}
    >
      <Handle type="target" position={Position.Top} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 600,
            background: color + "20",
            color,
            borderRadius: 5,
            padding: "2px 6px",
          }}
        >
          {data.opType}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 14, color: color + "B3" }}>
          {theme.icon}
        </span>
      </div>
      {data.name && (
        <div
          data-nodename
          style={{
            fontSize: 10,
            color: nameMuted,
            marginTop: 4,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {data.name}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun test packages/react/test/GraphNode.test.tsx
```

Expected: all 6 tests pass.

- [ ] **Step 5: Run full react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/nodes/GraphNode.tsx packages/react/test/GraphNode.test.tsx
git commit -m "feat(react): update GraphNode to B·3 layout with category theming"
```

---

### Task 6: `packages/react/src/nodes/IoNode.tsx`

**Files:**

- Modify: `packages/react/src/nodes/IoNode.tsx`

No separate test file — IoNode is already covered by ModelGraphView.test.tsx; we'll check icons render.

- [ ] **Step 1: Update `IoNode.tsx`**

```tsx
// packages/react/src/nodes/IoNode.tsx
import React from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "@wetron/core/transform";
import { CATEGORY_THEME } from "../theme.ts";
import { useColorMode } from "../ColorModeContext.ts";

export function IoNodeComponent({ data }: NodeProps<Node<GraphNodeData>>) {
  const isInput = data.opType === "Input";
  const isDark = useColorMode() === "dark";
  const theme = isInput ? CATEGORY_THEME.input : CATEGORY_THEME.output;
  const color = isDark ? theme.dark : theme.light;
  const bg = isDark ? "#1e1e2e" : "#fff";
  const border = isDark ? "#333" : "#e0e0e0";
  const nameMuted = isDark ? "#4a4a5a" : "#999";

  return (
    <div
      data-nodetype="ioNode"
      style={{
        padding: "10px 12px",
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        minWidth: 180,
      }}
    >
      {!isInput && <Handle type="target" position={Position.Top} />}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 11,
            fontWeight: 600,
            background: color + "20",
            color,
            borderRadius: 5,
            padding: "2px 6px",
          }}
        >
          {data.name}
        </span>
        <span style={{ fontFamily: "monospace", fontSize: 14, color: color + "B3" }}>
          {theme.icon}
        </span>
      </div>
      {(data.shape || data.dtype) && (
        <div style={{ fontSize: 10, color: nameMuted, marginTop: 4 }}>
          {data.shape && <span>[{data.shape.join(" × ")}]</span>}
          {data.shape && data.dtype && <span> </span>}
          {data.dtype && <span>{data.dtype}</span>}
        </div>
      )}
      {isInput && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
```

- [ ] **Step 2: Run react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/nodes/IoNode.tsx
git commit -m "feat(react): update IoNode to B·3 layout with category theming"
```

---

### Task 7: `packages/react/src/ModelGraphView.tsx`

**Files:**

- Modify: `packages/react/src/ModelGraphView.tsx`

- [ ] **Step 1: Update `ModelGraphView.tsx`**

```tsx
// packages/react/src/ModelGraphView.tsx
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

  React.useEffect(() => {
    fitView();
  }, [graph, fitView]);

  return (
    <ReactFlow
      nodes={nodes as Node<GraphNodeData>[]}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodeClick={handleNodeClick}
      defaultEdgeOptions={{ type: "straight" }}
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

- [ ] **Step 2: Run react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/ModelGraphView.tsx
git commit -m "feat(react): add colorMode prop to ModelGraphView with context provider"
```

---

### Task 8: `packages/react/src/index.ts` — export ColorMode type

**Files:**

- Modify: `packages/react/src/index.ts`

- [ ] **Step 1: Check current exports and add ColorMode**

Read current `packages/react/src/index.ts`, then add:

```ts
export type { ColorMode } from "./ColorModeContext.ts";
```

- [ ] **Step 2: Run react tests**

```bash
bun test packages/react
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add packages/react/src/index.ts
git commit -m "feat(react): export ColorMode type from index"
```

---

### Task 9: `packages/svelte/src/theme.ts`

**Files:**

- Create: `packages/svelte/src/theme.ts`

- [ ] **Step 1: Create svelte theme.ts**

Identical color tokens as react/theme.ts. Imports `OpCategory` from `@wetron/core`.

```ts
// packages/svelte/src/theme.ts
import type { OpCategory } from "@wetron/core";

export type { OpCategory };

export type CategoryTheme = {
  icon: string;
  light: string;
  dark: string;
};

export const CATEGORY_THEME: Record<OpCategory, CategoryTheme> = {
  input: { icon: "↓", light: "#2e7d32", dark: "#4caf50" },
  output: { icon: "↑", light: "#1565c0", dark: "#42a5f5" },
  conv: { icon: "⊛", light: "#3949ab", dark: "#7986cb" },
  activation: { icon: "ƒ", light: "#d84315", dark: "#ff7043" },
  normalization: { icon: "μ", light: "#00695c", dark: "#26a69a" },
  pooling: { icon: "⊟", light: "#6a1b9a", dark: "#ab47bc" },
  reshape: { icon: "⇄", light: "#4e342e", dark: "#a1887f" },
  math: { icon: "⊕", light: "#ad1457", dark: "#f06292" },
  reduction: { icon: "Σ", light: "#1565c0", dark: "#64b5f6" },
  merge: { icon: "‖", light: "#e65100", dark: "#ffa726" },
  attention: { icon: "⊙", light: "#00695c", dark: "#4db6ac" },
  recurrent: { icon: "↺", light: "#558b2f", dark: "#aed581" },
  quantization: { icon: "Q", light: "#795548", dark: "#bcaaa4" },
  unknown: { icon: "?", light: "#757575", dark: "#9e9e9e" },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/theme.ts
git commit -m "feat(svelte): add CATEGORY_THEME with 14 op categories"
```

---

### Task 10: `packages/svelte/src/ColorModeContext.ts`

**Files:**

- Create: `packages/svelte/src/ColorModeContext.ts`

- [ ] **Step 1: Create Svelte context helpers**

```ts
// packages/svelte/src/ColorModeContext.ts
import { getContext, setContext } from "svelte";

export type ColorMode = "light" | "dark" | "system";

const KEY = Symbol("colorMode");

export function provideColorMode(mode: ColorMode) {
  setContext(KEY, mode);
}

export function consumeColorMode(): "light" | "dark" {
  const mode = getContext<ColorMode>(KEY) ?? "system";
  return resolveColorMode(mode);
}

export function resolveColorMode(mode: ColorMode): "light" | "dark" {
  if (mode !== "system") return mode;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/ColorModeContext.ts
git commit -m "feat(svelte): add ColorModeContext helpers"
```

---

### Task 11: `packages/svelte/src/nodes/GraphNode.svelte`

**Files:**

- Modify: `packages/svelte/src/nodes/GraphNode.svelte`

- [ ] **Step 1: Update `GraphNode.svelte`**

```svelte
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { GraphNodeData } from '@wetron/core/transform';
  import { opCategory } from '@wetron/core';
  import { CATEGORY_THEME } from '../theme.ts';
  import { consumeColorMode } from '../ColorModeContext.ts';

  let { data }: { data: GraphNodeData } = $props();

  const isDark = $derived(consumeColorMode() === 'dark');
  const cat = $derived(opCategory(data.opType));
  const theme = $derived(CATEGORY_THEME[cat]);
  const color = $derived(isDark ? theme.dark : theme.light);
  const bg = $derived(isDark ? '#1e1e2e' : '#fff');
  const border = $derived(isDark ? '#333' : '#e0e0e0');
  const nameMuted = $derived(isDark ? '#4a4a5a' : '#999');
</script>

<div
  class="graph-node"
  data-nodetype="graphNode"
  style:background={bg}
  style:border="1px solid {border}"
>
  <Handle type="target" position={Position.Top} />
  <div class="header">
    <span
      class="pill"
      style:background={color + '20'}
      style:color={color}
    >{data.opType}</span>
    <span class="icon" style:color={color + 'B3'}>{theme.icon}</span>
  </div>
  {#if data.name}
    <div class="node-name" style:color={nameMuted}>{data.name}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .graph-node {
    padding: 10px 12px;
    border-radius: 8px;
    min-width: 180px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pill {
    font-family: monospace;
    font-size: 11px;
    font-weight: 600;
    border-radius: 5px;
    padding: 2px 6px;
  }
  .icon {
    font-family: monospace;
    font-size: 14px;
  }
  .node-name {
    font-size: 10px;
    margin-top: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/nodes/GraphNode.svelte
git commit -m "feat(svelte): update GraphNode to B·3 layout with category theming"
```

---

### Task 12: `packages/svelte/src/nodes/IoNode.svelte`

**Files:**

- Modify: `packages/svelte/src/nodes/IoNode.svelte`

- [ ] **Step 1: Update `IoNode.svelte`**

```svelte
<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { GraphNodeData } from '@wetron/core/transform';
  import { CATEGORY_THEME } from '../theme.ts';
  import { consumeColorMode } from '../ColorModeContext.ts';

  let { data }: { data: GraphNodeData } = $props();

  const isInput = $derived(data.opType === 'Input');
  const isDark = $derived(consumeColorMode() === 'dark');
  const theme = $derived(isInput ? CATEGORY_THEME.input : CATEGORY_THEME.output);
  const color = $derived(isDark ? theme.dark : theme.light);
  const bg = $derived(isDark ? '#1e1e2e' : '#fff');
  const border = $derived(isDark ? '#333' : '#e0e0e0');
  const nameMuted = $derived(isDark ? '#4a4a5a' : '#999');
</script>

<div
  class="io-node"
  data-nodetype="ioNode"
  style:background={bg}
  style:border="1px solid {border}"
>
  {#if !isInput}
    <Handle type="target" position={Position.Top} />
  {/if}
  <div class="header">
    <span
      class="pill"
      style:background={color + '20'}
      style:color={color}
    >{data.name}</span>
    <span class="icon" style:color={color + 'B3'}>{theme.icon}</span>
  </div>
  {#if data.shape || data.dtype}
    <div class="meta" style:color={nameMuted}>
      {#if data.shape}[{data.shape.join(' × ')}]{/if}
      {#if data.shape && data.dtype}{' '}{/if}
      {#if data.dtype}{data.dtype}{/if}
    </div>
  {/if}
  {#if isInput}
    <Handle type="source" position={Position.Bottom} />
  {/if}
</div>

<style>
  .io-node {
    padding: 10px 12px;
    border-radius: 8px;
    min-width: 180px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .pill {
    font-family: monospace;
    font-size: 11px;
    font-weight: 600;
    border-radius: 5px;
    padding: 2px 6px;
  }
  .icon {
    font-family: monospace;
    font-size: 14px;
  }
  .meta {
    font-size: 10px;
    margin-top: 4px;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add packages/svelte/src/nodes/IoNode.svelte
git commit -m "feat(svelte): update IoNode to B·3 layout with category theming"
```

---

### Task 13: `packages/svelte/src/ModelGraphView.svelte`

**Files:**

- Modify: `packages/svelte/src/ModelGraphView.svelte`

- [ ] **Step 1: Update `ModelGraphView.svelte`**

```svelte
<script lang="ts">
  import { SvelteFlow, MiniMap, Controls, Background } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import { modelGraphToFlow } from '@wetron/core/transform';
  import type { ModelGraph, GraphNode } from '@wetron/core/ir';
  import type { GraphNodeData } from '@wetron/core/transform';
  import GraphNodeComponent from './nodes/GraphNode.svelte';
  import IoNodeComponent from './nodes/IoNode.svelte';
  import { provideColorMode, type ColorMode } from './ColorModeContext.ts';

  interface Props {
    graph: ModelGraph;
    onNodeClick?: (node: GraphNode) => void;
    colorMode?: ColorMode;
  }

  let { graph, onNodeClick, colorMode = 'system' }: Props = $props();

  provideColorMode(colorMode);

  const nodeTypes = {
    graphNode: GraphNodeComponent,
    ioNode: IoNodeComponent,
  };

  let flowData = $derived(modelGraphToFlow(graph));

  function handleNodeClick({ node }: { node: { data: GraphNodeData }; event: MouseEvent | TouchEvent }) {
    const gn = node.data.graphNode;
    if (gn && onNodeClick) onNodeClick(gn);
  }
</script>

<div style="width: 100%; height: 100%;">
  <SvelteFlow
    nodes={flowData.nodes}
    edges={flowData.edges}
    {nodeTypes}
    fitView
    onnodeclick={handleNodeClick}
  >
    <MiniMap />
    <Controls />
    <Background />
  </SvelteFlow>
</div>
```

- [ ] **Step 2: Run all tests**

```bash
bun test
```

Expected: all packages pass.

- [ ] **Step 3: Commit**

```bash
git add packages/svelte/src/ModelGraphView.svelte packages/svelte/src/index.ts
git commit -m "feat(svelte): add colorMode prop to ModelGraphView with context"
```

---

## Final verification

```bash
bun test
```

All tests in all packages should pass.
