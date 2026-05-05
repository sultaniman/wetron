---
title: "React"
description: "ModelGraphView and NodePropertyPanel React components for Wetron — built on @xyflow/react with full TypeScript types and CSS custom property theming."
lead: "Drop-in components built on @xyflow/react."
weight: 10
---

Import the stylesheet once in your entry point:

```ts
import "@wetron/react/styles.css";
```

## ModelGraphView

```tsx
import { ModelGraphView } from "@wetron/react";

<ModelGraphView
  graph={graph} // ModelGraph — required
  onTargetClick={setSelected} // (target: PanelTarget) => void
  colorMode="system" // "light" | "dark" | "system" (default: "system")
  onWarnings={(w) => console.warn(w)} // called when graph has parse warnings
  selectedEdgeTensorName={null} // highlights the matching edge
  searchQuery="" // dims nodes that don't match the query
/>;
```

Renders the full interactive graph. Nodes are coloured by operator category. Click a node or edge to receive a `PanelTarget` you can pass to `NodePropertyPanel`.

### Props

| Prop                     | Type                                          | Description                                       |
| ------------------------ | --------------------------------------------- | ------------------------------------------------- |
| `graph`                  | `ModelGraph`                                  | Required. The parsed model graph.                 |
| `onTargetClick`          | `(target: PanelTarget) => void`               | Called when a node or edge is clicked.            |
| `colorMode`              | `"light" \| "dark" \| "system"`               | Theme. `"system"` follows `prefers-color-scheme`. |
| `onWarnings`             | `(warnings: readonly ParseWarning[]) => void` | Called when the graph has parse warnings.         |
| `selectedEdgeTensorName` | `string \| null`                              | Highlights the matching edge.                     |
| `searchQuery`            | `string`                                      | Dims nodes that don't match the query.            |

## NodePropertyPanel

```tsx
import { NodePropertyPanel } from "@wetron/react";

<NodePropertyPanel
  target={selected} // PanelTarget | null — null renders nothing
  colorMode="system"
  opsets={graph?.opsets} // ReadonlyMap<string, number> — ONNX domain versions
  tensorShapes={graph?.tensorShapes} // shape info for edge panels
  onTensorClick={(name) => {}} // called when a tensor name chip is clicked
  onBack={() => {}} // shows a back arrow when provided
  onClose={() => setSelected(null)} // shows a close button when provided
/>;
```

### Props

| Prop            | Type                                    | Description                                                  |
| --------------- | --------------------------------------- | ------------------------------------------------------------ |
| `target`        | `PanelTarget \| null`                   | Selected node, edge, or tensor. `null` renders nothing.      |
| `colorMode`     | `"light" \| "dark" \| "system"`         | Theme. `"system"` follows `prefers-color-scheme`.            |
| `opsets`        | `ReadonlyMap<string, number>`           | Op domain → version (ONNX only). Shown in node header.       |
| `inputSources`  | `ReadonlyMap<string, string>`           | Tensor name → producing op type. Used to colour input chips. |
| `tensorShapes`  | `ReadonlyMap<string, { shape, dtype }>` | Shape info for edge panels.                                  |
| `onTensorClick` | `(name: string) => void`                | Called when a tensor name chip is clicked.                   |
| `onBack`        | `() => void`                            | Shows a back arrow when provided.                            |
| `onClose`       | `() => void`                            | Shows a close button when provided.                          |

## PanelTarget type

```ts
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

## ModelGraphViewHandle (ref)

Pass a `ref` to `ModelGraphView` to get imperative control:

```ts
const ref = useRef<ModelGraphViewHandle>(null);

type ModelGraphViewHandle = {
  fitAll: () => Promise<void>;
  getViewport: () => { x: number; y: number; zoom: number };
  setViewport: (vp: { x: number; y: number; zoom: number }) => void;
  getNodesBounds: () => { x: number; y: number; width: number; height: number };
  getViewportElement: () => HTMLElement | null;
};
```

## Peer dependencies

- `react` ≥ 18
- `react-dom` ≥ 18
- `@xyflow/react` ≥ 12
- `@phosphor-icons/react` ≥ 2
- `@base-ui/react` ≥ 1
