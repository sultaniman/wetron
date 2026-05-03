# @wetron/onnx

ONNX model parser. Reads `.onnx` files via protobufjs and returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## API

```ts
async function parseOnnx(bytes: Uint8Array): Promise<ModelGraph>;
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input.

## ONNX dtype mapping

| ONNX enum | dtype string |
| --------- | ------------ |
| 1         | `float32`    |
| 2         | `uint8`      |
| 3         | `int8`       |
| 4         | `uint16`     |
| 5         | `int16`      |
| 6         | `int32`      |
| 7         | `int64`      |
| 8         | `string`     |
| 9         | `bool`       |
| 10        | `float16`    |
| 11        | `float64`    |
| 12        | `uint32`     |
| 13        | `uint64`     |
| 14        | `complex64`  |
| 15        | `complex128` |
| 16        | `bfloat16`   |

## Implementation notes

- Uses `protobufjs/light` with a pre-generated `onnx-descriptor.json` (bundled in `src/`).
- `int64`/`uint64` attribute values from protobufjs `Long` objects are converted via `bigIntToNumber` from `@wetron/core/dtypes`.
- Initializers (weight tensors) are recorded in `ModelGraph.initializers` with shape and dtype only — raw data is not read.
- `ModelGraph.tensorShapes` is populated from the graph's `value_info` field, covering intermediate activations.
- Node attributes are extracted as `AttributeValue` — `GRAPH` and `SPARSE_TENSOR` attribute types are skipped.
