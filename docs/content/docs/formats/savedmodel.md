---
title: "SavedModel"
description: "TF SavedModel parser for Wetron — reads saved_model.pb GraphDef files and keras_metadata.pb Keras layer graphs."
lead: "Parses `.pb` files — TF SavedModel GraphDef and Keras metadata variants."
weight: 50
---

```ts
import { parseSavedModel } from "@wetron/savedmodel";

const graph = parseSavedModel(bytes); // synchronous, returns ModelGraph
```

Or use the unified entry point — `.pb` files are routed here automatically:

```ts
import { parseModel } from "@wetron/core";

const graph = await parseModel(bytes, "model.pb");
```

## Format variants

### keras_metadata.pb

Detected by first byte `0x0a` (protobuf field 1, length-delimited). Contains a Keras layer graph serialized as JSON inside the protobuf.

- Supported topologies: `Sequential`, `Functional`
- `InputLayer` entries → `ModelGraph.inputs` (excluded from `nodes`)
- Layer `class_name` → node `opType`
- Layer config fields → node `attributes`
- Edges resolved from `inbound_nodes` for Functional; chained for Sequential

### saved_model.pb

Detected by first byte `0x08` (protobuf field 1, varint — schema version). Contains a TensorFlow GraphDef with raw TF ops.

- `Placeholder` nodes → `ModelGraph.inputs`
- All other ops → `ModelGraph.nodes`
- Output nodes inferred as nodes whose outputs are never consumed as inputs
- `Const` nodes appear as `constant`-category nodes

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
- `ModelGraph.initializers` is always empty — weight data is not parsed.
- Control dependencies (inputs prefixed with `^`) are ignored.
- Port suffixes (`:0`, `:1`) are stripped from input tensor names.
- Non-fatal per-node errors are attached as `warnings` on the returned graph.
- Throws `ParseError` if the file is too short or has unrecognized first byte.
