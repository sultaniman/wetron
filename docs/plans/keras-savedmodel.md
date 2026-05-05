# SavedModel Parser Design

## Problem

TF2 SavedModel directories (produced by `model.save()` in Keras 2.x/TF 2.x) cannot be parsed
by any existing wetron parser. The directory contains two parseable protobuf files with different
levels of abstraction:

- `keras_metadata.pb` - Keras model config as an embedded JSON string; high-level layer graph
- `saved_model.pb` - TF computation graph (GraphDef + NodeDefs); low-level TF op graph

Users drop individual `.pb` files. Both file types are detected as the new `"savedmodel"` format
and dispatched to the appropriate parser.

## Approach

New package `@wetron/savedmodel`. Exports one function `parseSavedModel(bytes)` that
auto-detects which file type it received by inspecting the first two bytes, then returns the
appropriate `ModelGraph`.

- `keras_metadata.pb` - first byte `0x0a` (field 1, wire type 2) -> Keras layer graph
- `saved_model.pb` - first two bytes `0x08 0x01` (field 1 varint = schema version 1) -> TF op graph
- Anything else -> `ParseError("savedmodel", ...)`

The two parsers produce graphs at different granularities. Switching between views is a UI
concern (the user drops the other file); the parser itself has no mode toggle.

## Package Structure

```
packages/savedmodel/
  src/
    index.ts              # export parseSavedModel
    parse.ts              # auto-detect, dispatch to sub-parsers
    parse-keras-meta.ts   # keras_metadata.pb -> Keras layer ModelGraph
    parse-tf-graph.ts     # saved_model.pb -> TF op ModelGraph
    tf.proto              # hand-authored minimal TF proto schema (committed to repo)
    tf-descriptor.json    # generated from tf.proto via protobufjs-cli (committed to repo)
  test/
    parse.test.ts
  package.json
  tsconfig.json
  tsup.config.ts
```

### Dependencies

- `@wetron/core` - IR types, `ParseError`
- `@wetron/keras` - re-uses `buildKerasGraph(config)` to avoid duplicating Functional/Sequential
  builder logic
- `protobufjs` - workspace-level dep, already present

## Changes to Existing Packages

### `@wetron/core/src/detect.ts`

1. Add `"savedmodel"` to the `Format` union type.
2. Add `.pb` filename check **before** the ONNX `0x08` byte check (both `saved_model.pb` and
   ONNX start with `0x08`; `.pb` files are never ONNX):

```ts
if (filename?.endsWith(".pb")) return "savedmodel";
if (bytes.length > 0 && bytes[0] === 0x08) return "onnx";
```

Content-based sub-detection (which `.pb` subtype) is done inside `parseSavedModel`, not here.

### `@wetron/core/src/index.ts`

Add `"savedmodel"` case to `parseModel`:

```ts
if (format === "savedmodel") {
  const { parseSavedModel } = await import("@wetron/savedmodel");
  return parseSavedModel(bytes);
}
```

### `@wetron/keras/src/parse.ts`

Export the internal model builder functions so `@wetron/savedmodel` can reuse them:

```ts
export { buildKerasGraph } from "./parse.ts";
export type { KerasModelConfig } from "./parse.ts";
```

`buildKerasGraph(config: KerasModelConfig): ModelGraph` dispatches to `buildFunctional` or
`buildSequential` based on `config.class_name`. The function was previously internal.

## Parser: keras_metadata.pb

Field 1 of the proto is the full Keras model config as a JSON string. Parse using
`protobufjs/light`'s `Reader` without a schema - scan for field tag 1, read as string:

```ts
function parseKerasMetadataPb(bytes: Uint8Array): ModelGraph {
  const reader = Reader.create(bytes);
  while (reader.pos < reader.len) {
    const tag = reader.uint32();
    if (tag >>> 3 === 1) {
      const json = reader.string();
      const config = JSON.parse(json) as KerasModelConfig;
      return buildKerasGraph(config);
    }
    reader.skipType(tag & 0x7);
  }
  throw new ParseError("savedmodel", "keras_metadata.pb: field 1 (node_metadata) not found");
}
```

The resulting `ModelGraph` uses Keras layer names as node names and `class_name` as `opType`
(e.g., `Conv2D`, `BatchNormalization`).

## Parser: saved_model.pb (TF Op Graph)

### Minimal proto descriptor

Generated once from a hand-authored `.proto` file using `protobufjs-cli`. Only the fields
needed for graph structure are included; all others are omitted:

```proto
message SavedModel {
  int64 saved_model_schema_version = 1;
  repeated MetaGraphDef meta_graphs = 2;
}
message MetaGraphDef { GraphDef graph_def = 2; }
message GraphDef { repeated NodeDef node = 1; }
message NodeDef {
  string name = 1;
  string op = 2;
  repeated string input = 3;
  map<string, AttrValue> attr = 5;
}
message AttrValue {
  oneof value {
    bytes s = 2;
    int64 i = 3;
    float f = 4;
    bool b = 5;
    int32 type = 6;
    TensorShapeProto shape = 7;
  }
}
message TensorShapeProto {
  message Dim { int64 size = 1; }
  repeated Dim dim = 2;
  bool unknown_rank = 3;
}
```

The descriptor JSON is committed to the repo (same pattern as `onnx-descriptor.json`).

### Graph construction

For each `NodeDef`:

- `name` -> `GraphNode.name`
- `op` -> `GraphNode.opType`
- `input[]` -> `GraphNode.inputs` after stripping control dependencies (`^nodeName`) and
  normalising port suffixes (`nodeName:0` -> `nodeName`)
- `attr` -> `GraphNode.attributes` (string attrs decoded with `TextDecoder`, shapes mapped to
  `number[]`)
- outputs - each node's single output is its own name (TF convention for output 0)

`tensorShapes` is populated from `AttrValue.shape` where present on nodes that expose `_output_shapes`.

Output inference: Nodes whose output tensor is never consumed as another node's input are
graph outputs - same approach as `buildFunctional` in the keras parser.

Inputs: Nodes with no inputs (typically `Placeholder` ops) become `ModelGraph.inputs`. Shape
and dtype are read from their `shape` and `dtype` attributes.

## Error Handling

All errors use `ParseError("savedmodel", context)` matching the format string.

Non-fatal issues (node missing name/op) emit `ParseWarning` entries and skip the node - same
pattern as the keras parser.

## Testing

Fixtures: copy `saved_model.pb` and `keras_metadata.pb` from the sample model into `test-models/`.

```ts
// parse.test.ts
test("keras_metadata.pb -> Keras layer graph", () => {
  const bytes = readFileSync("../../test-models/ResNet2DGE2E-keras_metadata.pb");
  const graph = parseSavedModel(new Uint8Array(bytes));
  expect(graph.name).toBe("ResNet2DGE2E");
  expect(graph.inputs[0].name).toBe("input_1");
  expect(graph.nodes.some((n) => n.opType === "Conv2D")).toBe(true);
});

test("saved_model.pb -> TF op graph", () => {
  const bytes = readFileSync("../../test-models/ResNet2DGE2E-saved_model.pb");
  const graph = parseSavedModel(new Uint8Array(bytes));
  expect(graph.nodes.length).toBeGreaterThan(0);
  expect(graph.nodes.some((n) => n.opType === "Conv2D")).toBe(true);
});

test("unknown .pb content throws ParseError", () => {
  expect(() => parseSavedModel(new Uint8Array([0x00, 0x01]))).toThrow(ParseError);
});
```

Node counts must be validated against Netron for the same files before the implementation is
considered complete.

## Build & Release Integration

Add `@wetron/savedmodel` to the Justfile build and publish recipes in dependency order
(parsers first, then savedmodel, then core index step):

```bash
# build: after parsers block, before core index step
cd packages/savedmodel && bunx tsup

# publish: after parsers, before core
cd packages/savedmodel && bun publish --access public
```

Root `package.json` build scripts updated similarly. `bump-version.ts` gets
`"packages/savedmodel"` added to its package list.

## Out of Scope

- SavedModel directory loading (multi-file drag) - browser File API limitation for now
- Weight/variable deserialization - graph structure only, per project convention
- `saved_model.pb` -> Keras layer view (Keras config is not embedded in `saved_model.pb`; users
  drop `keras_metadata.pb` for that view)
- Older TF1 frozen graph `.pb` files (different proto structure, separate effort if needed)
