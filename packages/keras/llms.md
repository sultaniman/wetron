# @wetron/keras

Keras model parser. Reads `.keras` ZIP archive files and returns a `ModelGraph` IR. Supports `Sequential` and `Functional` model classes. Graph structure only — no weight tensors are deserialized.

## API

```ts
function parseKeras(bytes: Uint8Array): ModelGraph;
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input, missing `config.json`, invalid JSON, or unsupported model class.

## What gets parsed

- `config.json` inside the `.keras` ZIP archive — contains the full layer graph
- Supported `class_name` values: `Sequential`, `Functional`
- `InputLayer` entries are converted to `ModelGraph.inputs` and excluded from `ModelGraph.nodes`
- Layer `class_name` becomes the node's `opType`
- Layer `config` fields become node `attributes`, with `name`, `dtype`, and `trainable` filtered out
- Edges are resolved from `inbound_nodes[].args[].keras_history` for Functional models; chained sequentially for Sequential models

## Implementation notes

- Uses `fflate` for ZIP decompression (browser-compatible, no `DecompressionStream` needed for ZIP).
- `ModelGraph.initializers` is always an empty Map — Keras weight data lives in separate `.weights.h5` files which are not parsed.
- `ModelGraph.tensorShapes` is populated from `InputLayer` batch shapes only (`null` batch dimension → `-1`).
- Multi-input merge layers (e.g. `Concatenate`) correctly receive multiple `inputs` entries via the `args` array in `inbound_nodes`.
