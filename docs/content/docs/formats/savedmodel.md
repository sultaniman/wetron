---
title: "SavedModel"
description: "TF SavedModel parser for Wetron - reads saved_model.pb GraphDef files and keras_metadata.pb Keras layer graphs."
lead: "Parses `.pb` files - TF SavedModel GraphDef and Keras metadata variants."
weight: 60
---

```ts
import { parseSavedModel } from "@wetron/savedmodel";

const graph = parseSavedModel(bytes); // synchronous, returns ModelGraph
```

Or use the unified entry point - `.pb` files are routed here automatically:

```ts
import { parseModel } from "@wetron/core";

const graph = await parseModel(bytes, "model.pb");
```

## Format variants

### keras_metadata.pb

Detected by first byte `0x0a` (protobuf field 1, length-delimited). Contains a Keras layer graph serialized as JSON inside the protobuf.

- Supported topologies: `Sequential`, `Functional`
- `InputLayer` entries -> `ModelGraph.inputs` (excluded from `nodes`)
- Layer `class_name` -> node `opType`
- Layer config fields -> node `attributes`
- Edges resolved from `inbound_nodes` for Functional; chained for Sequential

### saved_model.pb

Detected by first byte `0x08` (protobuf field 1, varint - schema version). Contains a TensorFlow GraphDef with raw TF ops.

- `Placeholder` nodes -> `ModelGraph.inputs`
- All other ops -> `ModelGraph.nodes`
- Output nodes inferred as nodes whose outputs are never consumed as inputs
- `Const` node tensor shape and dtype are folded into `ModelGraph.initializers`; consumers see them as initializer edges in the rendered graph
- `StatefulPartitionedCall` and `PartitionedCall` function bodies are inlined from the `library.function` table; body node names are prefixed with the call-site name to avoid collisions
- `VarHandleOp` nodes mark variables backed by an external checkpoint - the parser sets `ModelGraph.hasExternalWeights = true` so a host app knows to load them via `loadSavedModelWeights`

## Graph structure (saved_model.pb)

```
Placeholder (input)
  ↓
Conv2D ← Const (weight)
  ↓
BiasAdd ← Const (bias)
  ↓
Relu
  ↓
...
  ↓
Softmax (output)
```

## Notes

- `parseModel` detects `.pb` by filename extension; the first-byte check then selects the variant.
- `ModelGraph.weights` is not populated by `parseSavedModel` itself. For TF2 models, load the checkpoint pair (`variables.index` + `variables.data-00000-of-00001`) with `loadSavedModelWeights` and call `attachCheckpointToGraph` to produce a graph with `weights` re-keyed by node name. See [Weights](../api/weights/).
- Control dependencies (inputs prefixed with `^`) are ignored.
- Port suffixes (`:0`, `:1`) are stripped from input tensor names. As a
  consequence, multi-output ops (`Split`, `TopK`, …) cannot be fully
  disambiguated - every consumer of `split:0`, `split:1` is recorded as a
  consumer of `split`. Connectivity is preserved; per-port labelling is not.
- Each node is recorded with a single output named after the node itself.
  Multi-output TF ops are visualised as if they had one fan-out.
- Non-fatal per-node errors are attached as `warnings` on the returned graph.
- Throws `ParseError` if the file is too short or has unrecognized first byte.
