# Model Diff Design

## Problem

ML practitioners iterate models frequently - adding layers, changing op types, tuning
hyperparameters, quantizing. Comparing two checkpoints visually is tedious: open both
in separate tabs, scroll to matching sections, mentally reconcile differences. A diff
view surfaces structural changes (added/removed/changed nodes) as a first-class visual.

## Scope

- Structural diff only: node additions, removals, op-type changes, attribute changes
- No weight diff (values), no shape diff beyond what the IR already carries
- Output is a `GraphDiff` data structure that annotates nodes/edges with change status
- Both renderers accept a `diff` prop that colours nodes by their change status
- A standalone `diffGraphs(a, b): GraphDiff` function in `@wetron/core`

## Matching algorithm

Nodes are matched by `name` first. For renamed nodes (common after quantisation), fall
back to a structural match: same `opType` + same input/output arity + same position in
topological order within a tolerance window. Unmatched nodes are added/removed.

```
exact name match       -> matched
name miss + structural -> fuzzy-matched (flagged as "moved")
no match in A          -> added
no match in B          -> removed
matched, opType diff   -> changed
matched, attr diff     -> modified
matched, identical     -> unchanged
```

## Data model

```ts
type NodeChangeKind = "added" | "removed" | "changed" | "moved" | "unchanged";

type NodeDiff = {
  readonly kind: NodeChangeKind;
  readonly nodeA?: GraphNode; // absent for "added"
  readonly nodeB?: GraphNode; // absent for "removed"
  readonly changedAttributes?: ReadonlySet<string>;
};

type GraphDiff = {
  readonly nodes: ReadonlyMap<string, NodeDiff>; // keyed by node name (B name for added)
  readonly addedCount: number;
  readonly removedCount: number;
  readonly changedCount: number;
  readonly movedCount: number;
};
```

## API

```ts
// @wetron/core
export function diffGraphs(a: ModelGraph, b: ModelGraph): GraphDiff;
```

## Renderer integration

Both renderers accept a new optional prop:

```ts
diff?: GraphDiff;
```

When present, nodes are coloured by change status instead of their category colour:

| Status    | Light bg | Dark bg | Border  |
| --------- | -------- | ------- | ------- |
| added     | #e6f4ea  | #0d2b14 | #34a853 |
| removed   | #fce8e6  | #2b0d0a | #ea4335 |
| changed   | #fff8e1  | #2b2200 | #fbbc04 |
| moved     | #e8f0fe  | #0d1a2b | #4285f4 |
| unchanged | default  | default | default |

Edges are treated as unchanged (structural edges don't carry diff info in v1).

The category icon is replaced by a diff status icon (Plus, Minus, Pencil, ArrowsClockwise)
when a diff is active.

## Display modes

Three modes selectable by the consumer via a `diffMode` prop:

| Mode      | Description                                                             |
| --------- | ----------------------------------------------------------------------- |
| `"b"`     | Show model B layout, colour nodes by diff (default)                     |
| `"a"`     | Show model A layout, colour nodes by diff                               |
| `"split"` | Side-by-side: two graph views linked by matched node highlight on hover |

`"split"` mode is out of scope for v1 - render one graph at a time.

## Panel integration

`NodePropertyPanel` gains a diff section when `diff` is provided and the selected node
has `kind !== "unchanged"`. Shows:

- For `changed`/`moved`: attribute before/after comparison table
- For `added`/`removed`: full attribute list with add/remove badge

New `PanelTarget` union member is not needed - the existing `GraphNode` target works;
the panel reads diff data from the `diff` prop.

## Open questions (decide before implementing)

1. **Fuzzy match threshold** - how many hops in topological order before we give up and
   call it added+removed? Start with ±5 nodes.
2. **Edge diff** - should added/removed edges be highlighted? Requires edge identity
   (tensorName is not stable across models). Defer to v2.
3. **Split mode** - high value for quantisation comparison; schedule for v2.
4. **GraphDiff in IR** - should `diffGraphs` live in `@wetron/core/src/diff.ts` as a
   new named export, or inline in `index.ts`? Separate file is cleaner.

## Effort

~3-4 days. Algorithm + data model are the bulk; renderer changes are a styling layer on
existing node components.
