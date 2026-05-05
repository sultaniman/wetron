# Subgraph Collapse Design

## Problem

Large models (ResNet, BERT, GPT variants) have deeply repetitive structures - transformer
blocks, residual units, encoder/decoder stacks - that repeat tens or hundreds of times.
Displaying every node at once makes the graph unreadable and slow. Users want to fold a
named group of nodes into a single summary node, explore one expanded at a time, and
restore the full view when done.

## Scope

- Collapse/expand named subgraphs in both React and Svelte renderers
- Subgraph boundaries defined by the consumer (not inferred automatically)
- Collapsed node shows name, op count, and category color
- Edges crossing the boundary are preserved (re-routed to the collapsed node)
- No IR changes to `ModelGraph` - grouping is a view-only concept

## Data model

```ts
// Passed as a prop alongside graph
type SubgraphGroup = {
  readonly name: string; // display label
  readonly nodeNames: ReadonlySet<string>; // GraphNode.name values
};
```

Consumer decides grouping (e.g. by regex on name prefix, by explicit list). The library
does not infer groups automatically - that stays in user-land.

## Transform layer changes (`@wetron/core/transform.ts`)

`modelGraphToFlow` gains an optional second parameter:

```ts
modelGraphToFlow(graph, { collapsed?: ReadonlySet<string> })
```

where `collapsed` is the set of group names currently folded. For each collapsed group:

1. Remove all constituent `FlowNode` entries
2. Insert one `groupNode` (new node type) with:
   - `data.groupName`, `data.nodeCount`, `data.dominantCategory` (majority opCategory)
   - `position` = centroid of the constituent nodes' dagre positions
   - `initialWidth` / `initialHeight` = fixed compact size (220 × 48)
3. Redirect edges: any edge whose source or target was a constituent node gets its endpoint
   rewritten to the group node id
4. Deduplicate edges that collapse to the same (source, target) pair

Dagre is re-run on the reduced graph so layout is clean, not a hole in the middle.

## New node component

`GroupNodeComponent` (React) / `group-node.svelte` (Svelte):

- Same card shell as `GraphNodeComponent` but body shows `{nodeCount} ops`
- Category color uses `dominantCategory`
- Click opens a property panel entry (or fires `onTargetClick` with a new `groupTarget` union member)
- A small expand icon/button on the card fires `onExpandGroup(groupName)` - separate from node click

## Renderer prop additions

```ts
// React
groups?: readonly SubgraphGroup[];
collapsedGroups?: ReadonlySet<string>;
onExpandGroup?: (name: string) => void;
onCollapseGroup?: (name: string) => void;

// Svelte (same, lowercase event names)
groups?: readonly SubgraphGroup[];
collapsedGroups?: ReadonlySet<string>;
onexpandgroup?: (name: string) => void;
oncollapsegroup?: (name: string) => void;
```

State (which groups are currently collapsed) is owned by the consumer - the renderer is
fully controlled. This keeps the library stateless and makes serialisation trivial.

## IR union extension

`PanelTarget` gains a new member so clicking a collapsed node opens a summary panel:

```ts
| { group: { name: string; nodeCount: number; dominantCategory: OpCategory } }
```

## Layout strategy

Run dagre twice:

1. Once on the full graph (all nodes) to get stable positions - cache this result
2. Overlay the collapsed view: remove constituent nodes, add group node at centroid,
   re-run a second dagre pass on the reduced set to clean up spacing

The two-pass approach avoids positions jumping wildly when a group is collapsed/expanded.

## Open questions (decide before implementing)

1. **Auto-grouping heuristic** - should the library offer `inferGroups(graph): SubgraphGroup[]`
   based on name-prefix clustering? Useful default for transformer models.
2. **Nested collapse** - can a group contain other groups? Start with flat-only for v1.
3. **Panel content for a collapsed group** - list of op types inside, or full node list?
4. **Keyboard shortcut** - `Space` to expand/collapse focused group node?

## Effort

~3-4 days. Transform layer changes are the bulk; renderer changes are straightforward
once the data model is settled.
