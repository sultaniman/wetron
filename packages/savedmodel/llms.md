# @wetron/savedmodel

TensorFlow SavedModel `.pb` parser. Reads both `saved_model.pb` (TF op graph) and `keras_metadata.pb` (Keras layer graph) files and returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## API

```ts
function parseSavedModel(bytes: Uint8Array): ModelGraph; // synchronous
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input, unrecognised format, or missing graph data.

## Format variants

**`saved_model.pb`** — TF op graph:

- First byte `0x08` (protobuf field 1 varint — schema version)
- Decodes a `SavedModel` proto → first `MetaGraph` → `GraphDef`
- Each `NodeDef` becomes a graph node; `op` field is the `opType`
- `Placeholder` nodes become `ModelGraph.inputs`; nodes whose outputs are never consumed become `ModelGraph.outputs`
- Node attributes are extracted from the `attr` map — supported types: `s` (string), `i` (int), `f` (float), `b` (bool)
- Control dependencies (inputs starting with `^`) are ignored
- Port suffixes (`:0`, `:1`) are stripped from input tensor names

**`keras_metadata.pb`** — Keras layer graph:

- First byte `0x0a` (protobuf field 1 length-delimited — model config JSON string)
- Reads field 1 as a JSON string, parses it as a `KerasModelConfig`
- Delegates to `buildKerasGraph` from `@wetron/keras` — supports `Sequential` and `Functional` model classes

## Implementation notes

- Uses `protobufjs/light` with a pre-generated `tf-descriptor.json` bundled in `src/`.
- Format is detected by `.pb` filename extension in `detectFormat` — checked before the `0x08` ONNX byte check to avoid false positives.
- `ModelGraph.initializers` is always empty — variable checkpoints are separate files, not parsed.
- `ModelGraph.tensorShapes` is always empty for TF op graphs — shape inference is not performed.
- Non-fatal per-node attribute errors surface as `warnings` on the returned `ModelGraph`.
- Only the first `MetaGraph` is parsed (most SavedModels have one; multi-metagraph files are rare).
