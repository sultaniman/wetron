# @wetron/savedmodel

TF SavedModel parser for wetron. Reads `.pb` files in two formats:

- **`saved_model.pb`** — TensorFlow SavedModel GraphDef (raw TF ops)
- **`keras_metadata.pb`** — Keras layer metadata protobuf

Returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## Install

```bash
bun add @wetron/savedmodel
```

Included automatically when you install `@wetron/core`.

## API

```ts
import { parseSavedModel } from "@wetron/savedmodel";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseSavedModel(bytes); // synchronous, returns ModelGraph
```

Throws `ParseError` from `@wetron/core/ir` if the file is too short or has unrecognized `.pb` content.

## Format detection

The first byte determines which variant is parsed:

| First byte | Format                             |
| ---------- | ---------------------------------- |
| `0x0a`     | `keras_metadata.pb` (Keras layers) |
| `0x08`     | `saved_model.pb` (TF GraphDef)     |

`parseModel` from `@wetron/core` routes `.pb` files here automatically based on filename.

## What gets parsed

### keras_metadata.pb

- Layer graph from the embedded `keras_metadata` JSON
- Supported topologies: `Sequential`, `Functional`
- `InputLayer` entries → `ModelGraph.inputs`
- Layer `class_name` → node `opType`
- Layer config fields → node `attributes`

### saved_model.pb

- First `MetaGraphDef` → `GraphDef` nodes
- `Placeholder` nodes → `ModelGraph.inputs`
- All other ops → `ModelGraph.nodes`
- Output nodes inferred as nodes whose outputs are never consumed as inputs

## Notes

- `ModelGraph.initializers` is always empty — weight data is not parsed.
- `Const` nodes (weight constants) appear as graph nodes with category `constant`.
- Control dependencies (inputs prefixed with `^`) are ignored.
- Port suffixes (`:0`, `:1`) are stripped from input tensor names.
- Non-fatal per-node errors are attached as `warnings` on the returned graph.
