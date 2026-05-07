# Model Format Graph Structures

How each supported format encodes its graph, what plumbing exists, why some
formats render cleanly while others render wide, and where wetron currently
folds, filters, or punts.

## TL;DR

| Format                 | Graph density                                           | Wetron's plumbing handling                                                                                  | Function-body / subgraphs                 |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| ONNX                   | Clean — initializers formally separated from nodes      | `Constant` folded into `initializers`                                                                       | `If`/`Loop`/`Scan` body **hidden**        |
| TFLite                 | Clean — weights live in `buffers[]` indexed by tensor   | None needed                                                                                                 | only `subgraphs[0]` parsed                |
| Keras (`.keras`)       | Clean — layer level; weights in a separate file         | n/a                                                                                                         | n/a                                       |
| Keras metadata (`.pb`) | Clean — wraps the same Keras config                     | n/a                                                                                                         | n/a                                       |
| TF SavedModel (`.pb`)  | **Wide by default** — every layer expands into many ops | `VarHandleOp` folded into `initializers`; `ReadVariableOp`/`AssignVariableOp`/`VarIsInitializedOp` filtered | `StatefulPartitionedCall` body **hidden** |
| ExecuTorch (`.pte`)    | Linear chain                                            | n/a                                                                                                         | only `execution_plans[0]` parsed          |
| TorchScript Mobile     | Linear chain (forced)                                   | n/a                                                                                                         | methods **concatenated**                  |

The right column is the unsolved-problem column; the rest is mostly handled.

## The trick that makes everything work: `nodes` vs `initializers`

`ModelGraph` has two separate node-like channels:

```ts
readonly nodes: readonly GraphNode[];                          // layout-visible operations
readonly initializers: ReadonlyMap<string, { shape, dtype }>;  // weights, biases, scale factors
```

The renderer applies one rule that every format depends on (`packages/core/src/transform.ts:113`):

```ts
if (graph.initializers.has(node.name)) continue;
```

Any node whose `name` appears in `initializers` is **skipped from dagre layout**.
Instead, the renderer surfaces it as a "weight pill" inside its consumer's card
(via `weightInputs` derived from each input slot looked up in `initializers`).

That single rule handles four different "what counts as a weight" representations:

- ONNX `initializer[]` — already a separate field on the proto.
- TFLite tensors with non-empty `buffers[]` — added to `initializers` at parse time.
- TF SavedModel `VarHandleOp` — added to `initializers`, kept in `nodes` so checkpoint code can still read `shared_name`.
- Folded ONNX `Constant` ops — moved from `nodes` to `initializers` at parse time.

Adding a new format? Make its weights flow through `initializers`; don't invent a parallel channel.

## Per-format details

### ONNX (`packages/onnx/src/parse.ts`)

**Wire format**: protobuf. `onnx.ModelProto` → `GraphProto` with `node[]`,
`initializer[]`, `input[]`, `output[]`.

**Why it renders cleanly**: ONNX explicitly separates trainable weights
(`initializer[]`) from operations (`node[]`). The parser feeds each into the
matching IR channel and the layout's initializer-skip rule handles the rest.

**Constant folding** (`parse.ts:154-188`): when a `Constant` op has no inputs
and exactly one consumer, its `value` tensor becomes an initializer and the op
is removed. Removes 5–15% of nodes from typical CNNs and matches Netron.

**Subgraphs are not inlined.** ONNX `If` / `Loop` / `Scan` carry their bodies
in attributes of type `GRAPH` (5) or `GRAPHS` (10). `mapAttribute` currently
returns `""` for both types (`parse.ts:113`), so the body's nodes are
invisible. Models with control flow render as opaque ops.

**Other quirks**:

- `Identity` ops are kept (could be folded; would cut a few percent more).
- Initializer raw bytes can be base64-encoded strings (after `protobufjs`
  `.toJSON()`); decode failures now emit `ParseWarning` instead of silently
  dropping the bytes.
- `uint32` initializer values stored in `uint32Data` (rather than `rawData`)
  are now decoded — they were previously missed.

### TFLite (`packages/tflite/src/parse.ts`)

**Wire format**: FlatBuffer, magic `TFL3` (or `ODLF` for LiteRT).

**Why it renders cleanly**: weights live in `buffers[]`, referenced by
`Tensor.buffer`. Tensors whose buffer is non-empty become initializers;
intermediates and inputs/outputs stay as graph values.

**Only `subgraphs[0]` is parsed** (`parse.ts:135`). A `.tflite` model can have
multiple subgraphs — typically one is the inference graph and others are the
bodies of `IF`/`WHILE` ops. Bodies are invisible; the control-flow op shows up
as a single node with hidden internals.

**Op attributes are dropped** (`parse.ts:230` — every op gets
`attributes: {}`). The TFLite `BuiltinOptions` union (`Conv2DOptions`,
`PoolingOptions`, `FusedActivation`, padding mode, axes, …) carries the
inference-relevant params and isn't surfaced. The panel can show op type and
shape but not stride/padding/activation. Known gap.

**Quantize / Dequantize stay visible** — they're real ops, not plumbing, and
quantized models often want to see where dynamic-range conversion happens.

### Keras `.keras` (`packages/keras/src/parse.ts`)

**Wire format**: ZIP archive (PK\x03\x04). `model_config.json` carries the
graph; `model_weights.h5` carries weights but is not parsed for graph display.

**Why it renders cleanly**: the JSON is layer-level. Each Keras layer maps to
one `GraphNode` — there's no "many TF ops per Keras layer" expansion at this
layer of abstraction.

**Two graph styles**:

- `Sequential` — linear chain. Output derives from the last successfully
  built node (skipping layers without names that get a `layer_name_missing`
  warning).
- `Functional` — DAG via each layer's `inbound_nodes`. Outputs are inferred
  as the layers whose outputs are never consumed by another layer.

**Decompression**: currently uses `fflate.unzipSync`. Native
`DecompressionStream` is the documented preference but would flip the parse
function from sync to async — deferred.

### Keras metadata (`packages/savedmodel/src/parse-keras-meta.ts`)

A SavedModel directory contains `keras_metadata.pb` alongside `saved_model.pb`.
The metadata file embeds the same JSON Keras config used by `.keras`. The
parser detects this case, extracts the JSON, and delegates to
`buildKerasGraph`. Same characteristics as native `.keras`.

### TF SavedModel `.pb` (`packages/savedmodel/src/parse-tf-graph.ts`)

This is where things get noisy. Every Keras layer expands into many TF ops:

- A `Conv2D` Keras layer becomes: 2 `VarHandleOp` (kernel, bias) + 2
  `ReadVariableOp` (read kernel, read bias) + `Conv2D` + `BiasAdd`. The two
  `VarHandleOp` + `ReadVariableOp` pairs sit as side branches feeding into the
  `Conv2D` op.
- A `BatchNormalization` Keras layer becomes ~10 forward-pass ops plus 4
  `VarHandleOp`/`ReadVariableOp` pairs (gamma, beta, moving_mean,
  moving_variance) — the main culprit for "linear Keras chain renders wide".
- Each variable also gets an `AssignVariableOp` (writes the initial value at
  session init) and a `VarIsInitializedOp` (init-time check).

A 16-layer `Conv → ReLU` model produces ~170 raw TF nodes, mostly plumbing.

**The fold (current behavior)**:

| Op                   | Treatment                                                                           |
| -------------------- | ----------------------------------------------------------------------------------- |
| `VarHandleOp`        | Added to `initializers` _and_ kept in `graph.nodes`. Layout skips it.               |
| `ReadVariableOp`     | Dropped. Consumers' input names rewritten to point at the underlying `VarHandleOp`. |
| `AssignVariableOp`   | Dropped — init-time only.                                                           |
| `VarIsInitializedOp` | Dropped — init-time only.                                                           |

Why keep `VarHandleOp` in `nodes` if it's invisible? Because
`attachCheckpointToGraph` walks `graph.nodes` for `VarHandleOp` to read each
variable's `shared_name` attribute. The skip-via-`initializers` rule lets it
render-invisible without actually deleting it.

**Saver-signature filter**: `tf.saved_model.save()` always emits
`__saver_save` and `__saver_restore` signatures alongside the inference
signature. They're checkpoint plumbing, not the model. The parser identifies
them by walking the graph from any node that consumes the `saver_filename`
Placeholder, then transitively excluding upstream nodes whose only remaining
consumers are already excluded. Without this filter the renderer ends up with
a duplicate-looking saver branch whose weight chips don't resolve to anything
useful.

**What's still wide**: after the fold, a 16-layer model reduces from ~170
nodes to a handful of layout-visible nodes — and those few are mostly
`StatefulPartitionedCall`. The actual `Conv2D` / `Relu` / `MatMul` ops live
inside the function body referenced by `StatefulPartitionedCall`, in
`MetaGraphDef.graphDef.library.function[]`. **Function-body inlining is not
implemented yet** and is the biggest remaining SavedModel quality gap.

**Checkpoint resolution**: variables in modern TF checkpoints use SSTable keys
like `_operations/1/_kernel/.ATTRIBUTES/VARIABLE_VALUE`, not the friendly name
like `conv1/kernel` that appears in `VarHandleOp.shared_name`. The mapping
between the two lives in the `_CHECKPOINTABLE_OBJECT_GRAPH` blob (a serialized
`TrackableObjectGraph` proto). `parse-object-graph.ts` extracts it.
`attachCheckpointToGraph` then prefers the object-graph mapping and falls back
to `<shared_name>/.ATTRIBUTES/VARIABLE_VALUE` for older / TF1 layouts.

### ExecuTorch (`packages/executorch/src/parse.ts`)

**Wire format**: FlatBuffer with magic `ET12`.

**Graph**: `Program.execution_plans[i].chains[].instructions[]`. Each
`KernelCall` instruction references an operator by index and carries a list of
`EValue` indices (mixed inputs and outputs, distinguished by a heuristic).

**Limitations**:

- Only `execution_plans[0]` is parsed. Multi-plan models (per-backend variants,
  quantization variants) lose their other plans.
- Input/output detection uses "value not yet produced → output" walking, which
  can misclassify if the model has dynamic shapes or control flow.

**Attributes**: `attributes: {}` for every op — operator parameters from the
ExecuTorch schema are not surfaced.

### TorchScript Mobile (`packages/torchscript/src/parse.ts`)

**Wire format**: FlatBuffer with magic `PTMF`, _or_ a ZIP-packaged `.pt`/`.ptl`
containing a `bytecode.pkl` blob (parsed by a hand-rolled PyTorch-bytecode
decoder).

**Graph**: each bytecode `CALL` instruction (op == 1) becomes one `GraphNode`.
Operators come from a separate operator table, named like `aten::conv2d.default`.

**Limitations**:

- When a scripted module exposes multiple methods (`forward`, `encode`,
  custom methods), the parser concatenates all their CALL instructions into a
  single linear chain. The resulting graph is topologically wrong for any
  multi-method module — methods should be separate graphs (or at least
  separate disconnected subgraphs).
- The hand-rolled bytecode decoder supports the opcodes seen in real-world
  files. `REDUCE` (0x52) and `BUILD` (0x62) are silently skipped — if either
  appears in metadata, downstream graph data is wrong.
- No tensor shape information is available in PTMF — `GraphValue.shape` is
  always `null`.

## The recurring pattern: function-body inlining

Three formats hide their actual computation inside a "function call" wrapper:

| Format        | Wrapper                      | Body location                                        |
| ------------- | ---------------------------- | ---------------------------------------------------- |
| ONNX          | `If` / `Loop` / `Scan` op    | Attribute of type `GRAPH` (5) / `GRAPHS` (10)        |
| TFLite        | `IF` / `WHILE` op            | `subgraphs[1+]`                                      |
| TF SavedModel | `StatefulPartitionedCall` op | `MetaGraphDef.graphDef.library.function[].nodeDef[]` |

None of these are inlined today. Renderable bodies require:

1. Parse the nested graph (each format encodes it differently).
2. Prefix every internal node name to avoid collisions with the outer graph.
3. Wire outer-scope inputs to the formal subgraph parameters, and route
   subgraph outputs back to the wrapper op's outputs.

A generic "inline subgraph" pass in `@wetron/core` could amortize step 2/3 if
each parser produces a `{ nodes, inputBinding, outputBinding }` triple from
its format-specific extractor.

Note that this is distinct from `subgraph-collapse-design.md`, which is about
_user-controlled_ grouping (folding many real nodes into one summary node).
That mechanism operates after the fact; function-body inlining is a parser
concern.

## Layout / topology choices that apply to every format

These come out of `transform.ts` and apply uniformly:

- **`rankdir: "TB"`** is hard-coded (`transform.ts:62`). Models that read
  better left-to-right (transformer pipelines, audio chains) can't currently
  switch direction.
- **Multi-edge handling**: when N edges share the same source/target pair
  (e.g., two slots both reading the same tensor — `Add(x, x)`,
  `MatMul(x, x.T)`), they reuse one set of dagre waypoints. Visually they
  overlap. A perturbation per slot index would fan them out.
- **Orphan nodes**: nodes with no edges still get unique x-positions from
  dagre — they don't stack at `(0, 0)`. They do sit on the same row as graph
  inputs (rank 0), which can look odd but isn't wrong.
- **`onlyRenderVisibleElements`** is enabled on the React renderer. Edge
  highlighting and search tinting still operate over the full graph; only the
  DOM-mounted set is culled.

## Implications for adding a new format

1. Make weights go through `initializers`. If your format has a "weight" that
   isn't a graph node, add an entry to `initializers` keyed by the name the
   consumer references. The skip-from-layout rule handles the rest.
2. Filter init-time / restore-time ops at parse. They have no inference role
   and only add to the layout's horizontal spread.
3. Decide what to do about subgraph bodies before the parser ships. If you
   punt, document it and assert it loudly in the panel for affected ops; don't
   render an opaque box that pretends nothing is hidden.
4. Use `ParseWarning` for any silent fallback (e.g., dtype unknown, base64
   decode failure). Silent fallbacks hide real corruption.
5. Surface op attributes that the panel can show (activation, padding, axes)
   even if some are skipped. Empty `attributes: {}` on every node is a
   downgrade from what users expect.

## Open work (in priority order)

1. **TF SavedModel function-body inlining** — read
   `MetaGraphDef.graphDef.library.function[]`, inline into the main graph at
   the corresponding `StatefulPartitionedCall` site. Biggest unlock for
   real-model rendering.
2. **ONNX subgraph inlining** — `If` / `Loop` / `Scan` body extraction with
   prefixed names.
3. **TFLite multi-subgraph** — same shape as ONNX subgraphs, indexed by
   subgraph id.
4. **TFLite `BuiltinOptions`** — surface at least `Conv2DOptions`,
   `PoolingOptions`, `FullyConnectedOptions`, `FusedActivation`.
5. **TorchScript multi-method** — emit per-method graphs (or one disconnected
   union with method boundaries explicit).
6. **rankdir as a `ModelGraphView` prop** — let consumers pick TB vs LR.
7. **Multi-edge fan-out** — perturb dagre waypoints per slot to avoid overlap.
8. **ExecuTorch multi-plan** — selector or aggregated view.
