# Interactive Properties & Edge Routing

**Date:** 2026-04-30  
**Status:** Approved  
**Packages affected:** `@wetron/core`, `@wetron/react`

## Overview

Three improvements to the graph viewer:

1. **Edge routing** — smoothstep edges with arrowheads, top/bottom handles, pan-on-scroll, Meta+scroll zoom, visible zoom controls
2. **Edge click** → CONNECTION PROPERTIES panel showing the tensor name and source/target op types
3. **Tensor drill-down** → clicking an input/output row in the node panel replaces the panel with TENSOR PROPERTIES

## Scope

### In scope

- Smoothstep edge routing with arrowhead markers
- ReactFlow pan/zoom config: `panOnScroll`, `zoomActivationKeyCode: 'Meta'`, `<Controls />`
- Node handle positions: source = Bottom, target = Top
- `FlowEdge.data` carrying `tensorName`, `sourceOpType`, `targetOpType`
- Two new `PanelTarget` union cases: `EdgeTarget` and `TensorTarget`
- `onEdgeClick` handler in `ModelGraphView`
- Clickable input/output rows in `NodePropertyPanel` via `onTensorClick` callback
- `App.tsx` resolves tensor name → shape/dtype from `graph.inputs`/`graph.outputs`

### Out of scope

- Inline edge labels (tensor shapes on graph lines) — future feature
- Weight tensor metrics (min/max/mean/std) — requires weight deserialization
- Tensor value display
- Navigation history / back button in panel

## Data Model (`@wetron/core`)

### `FlowEdge` — add `data`

```ts
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
```

`transform.ts` populates `data` when building edges. `sourceOpType` and `targetOpType` come from the node map already built during graph traversal.

`markerEnd` is NOT set in core — `@wetron/core` must not import from `@xyflow/react`. The arrowhead is applied in the renderer via ReactFlow's `defaultEdgeOptions` prop.

## Panel Targets (`@wetron/react`)

### Extended `PanelTarget`

```ts
export type PanelTarget =
  | GraphNode
  | { graphValue: GraphValue; direction: "input" | "output" }
  | { edge: { tensorName: string; sourceOpType: string; targetOpType: string } }
  | { tensor: { name: string; shape: readonly number[] | null; dtype: string | null } };
```

### Panel rendering by target type

| Target           | Panel title               | Fields shown                                                    |
| ---------------- | ------------------------- | --------------------------------------------------------------- |
| `GraphNode`      | NODE PROPERTIES           | type, name, inputs (clickable), outputs (clickable), attributes |
| `{ graphValue }` | INPUT / OUTPUT PROPERTIES | name, shape, dtype                                              |
| `{ edge }`       | CONNECTION PROPERTIES     | name, FROM node (opType), TO node (opType)                      |
| `{ tensor }`     | TENSOR PROPERTIES         | name, shape (if known), dtype (if known)                        |

For `TensorTarget`, shape and dtype are only available when the tensor name matches a `GraphValue` in `graph.inputs` or `graph.outputs`. Intermediate tensor names show name only.

## Edge Routing

### ReactFlow config in `ModelGraphView`

```tsx
<ReactFlow
  panOnScroll
  zoomOnScroll={false}
  zoomActivationKeyCode="Meta"
  // existing props...
>
  <Controls />
</ReactFlow>
```

### Edge type and marker

`transform.ts` sets `type: 'smoothstep'` on each edge.

`ModelGraphView.tsx` sets `defaultEdgeOptions` on the ReactFlow instance so all edges get arrowheads without core importing renderer types:

```tsx
<ReactFlow
  defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
  // ...
>
```

### Handle positions

In `GraphNode` and `IONode` node components:

- Source `<Handle>`: `position={Position.Bottom}`
- Target `<Handle>`: `position={Position.Top}`

## Component Interface Changes

### `ModelGraphView`

New prop: `onEdgeClick` wired from ReactFlow's `onEdgeClick` event → calls `onTargetClick({ edge: { tensorName, sourceOpType, targetOpType } })`.

### `NodePropertyPanel`

New optional prop: `onTensorClick?: (name: string) => void`

Input and output name rows render as clickable elements (button or div with role=button). When clicked, `onTensorClick(name)` is called.

### `App.tsx`

`onTensorClick` handler:

1. Receives tensor name string
2. Looks up name in `graph.inputs` and `graph.outputs`
3. If found: sets `selected` to `{ tensor: { name, shape: gv.shape, dtype: gv.dtype } }`
4. If not found: sets `selected` to `{ tensor: { name, shape: null, dtype: null } }`

## Testing

- `transform.ts`: verify `FlowEdge.data` is populated correctly (tensorName matches connecting tensor name, opTypes match source/target nodes)
- `NodePropertyPanel`: verify `onTensorClick` fires with correct name when input/output row is clicked
- `ModelGraphView`: verify `onEdgeClick` fires `onTargetClick` with edge target
- Panel rendering: verify correct title and fields for each `PanelTarget` variant
- Existing tests must continue to pass
