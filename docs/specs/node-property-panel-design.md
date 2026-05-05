# Node Property Panel Design

## Goal

Add a `NodePropertyPanel` React component to `@wetron/react` that displays the properties of a clicked node - either an operation node (`GraphNode`) or an IO node (`GraphValue`) - with Phosphor Icons and type-annotated rows.

## Architecture

**New file:**

- `packages/react/src/NodePropertyPanel.tsx` - the component

**Modified files:**

- `packages/core/src/transform.ts` - add `graphValue?: GraphValue` to `GraphNodeData`
- `packages/react/src/ModelGraphView.tsx` - replace `onNodeClick` with `onTargetClick`
- `packages/react/src/index.ts` - export `NodePropertyPanel`
- `packages/react/package.json` - add `@phosphor-icons/react` peer + dev dep
- `apps/demo/src/App.tsx` - wire up panel alongside graph

**Dependency:** `@phosphor-icons/react@^2.1.10` (already installed at workspace root; needs adding to react package deps).

---

## Component API

```tsx
import type { GraphNode, GraphValue } from "@wetron/core/ir";

type PanelTarget = GraphNode | GraphValue;

// Discriminator: GraphNode has 'opType', GraphValue does not
function isGraphNode(t: PanelTarget): t is GraphNode {
  return "opType" in t;
}

export function NodePropertyPanel({ target }: { target: PanelTarget | null }) {
  if (!target) return null;
  return isGraphNode(target) ? <OpPanel node={target} /> : <IoPanel value={target} />;
}
```

Consumer usage:

```tsx
const [selected, setSelected] = useState<GraphNode | GraphValue | null>(null);

<ModelGraphView graph={graph} onTargetClick={setSelected} />
<NodePropertyPanel target={selected} />
```

---

## ModelGraphView changes

Replace `onNodeClick?: (node: GraphNode) => void` with `onTargetClick?: (target: GraphNode | GraphValue) => void`.

IO node clicks are currently swallowed. To fix: add `graphValue?: GraphValue` to `GraphNodeData` in `transform.ts`, populated for `ioNode` rows. The click handler checks `node.data.graphNode` (ops) or `node.data.graphValue` (IO), calls `onTargetClick` with whichever is present.

---

## NodePropertyPanel layout

Each row is a flex container: `key (flex:1) | value (monospace, right-aligned) | type chip (fixed min-width)`.

### Op node (`GraphNode`)

**Header**

- Phosphor `Cpu` icon in a blue rounded square (`#e8f0fe`)
- `opType` bold 13px
- `name` gray monospace 9px below

**Inputs section** - Phosphor `ArrowCircleDown` icon + "Inputs" label
Each input name row: `name | shape·dtype if known | chip`

- Live tensor -> green chip `tensor`
- Initializer (name present in outputs-of-prior-nodes) -> red chip `init`
- Missing optional -> gray chip `optional`

**Outputs section** - Phosphor `ArrowCircleUp` icon + "Outputs" label
Same row structure as inputs.

**Attributes section** - Phosphor `SlidersHorizontal` icon + "Attributes" label
Each attribute row: `key | formatted value | type chip`

### IO node (`GraphValue`)

**Header**

- Phosphor `ArrowFatDown` (graph input) or `ArrowFatUp` (graph output) icon
- Determined by whether the value appears in `graph.inputs` or `graph.outputs` - but since the panel only receives the `GraphValue`, the panel infers direction from a `direction: 'input' | 'output'` prop passed by the caller (added to the `IoPanel` signature).

Actually - the panel receives `GraphValue` only, with no graph context. The caller knows whether it's an input or output. To keep the API simple: extend `ModelGraphView`'s `onTargetClick` to pass `{ value: GraphValue, direction: 'input' | 'output' }` for IO nodes.

**Revised API:**

```tsx
type PanelTarget = GraphNode | { graphValue: GraphValue; direction: "input" | "output" };

function isGraphNode(t: PanelTarget): t is GraphNode {
  return "opType" in t;
}
```

IO panel shows: name (bold), shape as `[d₀ × d₁ × …]`, dtype.

---

## Type chips

Attribute value type detection:

| JS type check                                   | Chip label | Background / text   |
| ----------------------------------------------- | ---------- | ------------------- |
| `typeof v === 'string'`                         | `str`      | `#e8f5e9 / #388e3c` |
| `typeof v === 'boolean'`                        | `bool`     | `#fce4ec / #c2185b` |
| `typeof v === 'number' && Number.isInteger(v)`  | `int`      | `#f3e5f5 / #9c27b0` |
| `typeof v === 'number' && !Number.isInteger(v)` | `float`    | `#e1f5fe / #0288d1` |
| `Array.isArray(v) && typeof v[0] === 'string'`  | `str[ ]`   | `#e8f5e9 / #388e3c` |
| `Array.isArray(v) && Number.isInteger(v[0])`    | `int[ ]`   | `#fff3e0 / #e8a000` |
| `Array.isArray(v) && !Number.isInteger(v[0])`   | `float[ ]` | `#fff3e0 / #e8a000` |
| empty array                                     | `[ ]`      | `#f5f5f5 / #aaa`    |

Input/output chips (not attribute types):

| Condition        | Chip label | Background / text   |
| ---------------- | ---------- | ------------------- |
| live tensor      | `tensor`   | `#e6f4ea / #34a853` |
| initializer      | `init`     | `#fce8e6 / #ea4335` |
| missing optional | `optional` | `#f5f5f5 / #aaa`    |

---

## Phosphor Icons used

| Location                 | Icon name           |
| ------------------------ | ------------------- |
| Op node header           | `Cpu`               |
| Graph input header       | `ArrowFatDown`      |
| Graph output header      | `ArrowFatUp`        |
| Inputs section label     | `ArrowCircleDown`   |
| Outputs section label    | `ArrowCircleUp`     |
| Attributes section label | `SlidersHorizontal` |

All at `size={12}` weight `"regular"` inside section labels; `size={15}` in headers.

---

## Initializer detection

An input is an initializer if its name appears as an output of a node whose `opType` would mark it as a weight - but the ONNX IR doesn't carry initializer metadata in `GraphNode`. Instead: inputs with names not found as any node's output and not in `graph.inputs` are initializers. This lookup is done inside the panel by inspecting `graph.nodes` - but `NodePropertyPanel` does not receive the full `ModelGraph`.

**Simplified approach:** do not distinguish `init` vs `tensor` at the panel level. All input connections get the `tensor` chip. The `init` distinction requires graph context that the panel doesn't have. This keeps the API clean and avoids prop-drilling. The chip colour key only uses `tensor`, `optional`, and the attribute type chips.

---

## Testing

- `packages/react/test/NodePropertyPanel.test.tsx` using `@testing-library/react` + happy-dom
- Test cases:
  - `null` target renders nothing
  - Op node renders opType in header, inputs, outputs, attributes with correct chips
  - IO node renders name, shape, dtype
  - Array attribute renders `int[ ]` chip; string attribute renders `str` chip

---

## Demo app wiring

`apps/demo/src/App.tsx`:

- Add `selectedTarget` state: `useState<PanelTarget | null>(null)`
- Replace `onNodeClick` prop with `onTargetClick={setSelectedTarget}`
- Render `<NodePropertyPanel target={selectedTarget} />` in a fixed-width right panel alongside the graph
- Layout: `display: flex`, graph takes remaining width, panel fixed `280px`, panel scrolls if content overflows
