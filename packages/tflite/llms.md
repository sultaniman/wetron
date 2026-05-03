# @wetron/tflite

TFLite model parser. Reads `.tflite` flatbuffer files synchronously and returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## API

```ts
function parseTflite(bytes: Uint8Array): ModelGraph; // synchronous
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input.

## TFLite dtype mapping

| TFLite enum | dtype string |
| ----------- | ------------ |
| 0           | `float32`    |
| 1           | `int32`      |
| 2           | `uint8`      |
| 3           | `int64`      |
| 4           | `string`     |
| 5           | `bool`       |
| 6           | `int16`      |
| 7           | `complex64`  |
| 8           | `int8`       |
| 9           | `float16`    |
| 10          | `float64`    |
| 11          | `complex128` |
| 16          | `uint32`     |
| 17          | `uint64`     |
| 256         | `bfloat16`   |

## Implementation notes

- Uses the `flatbuffers` npm package with a pre-generated TypeScript schema in `src/`.
- Detects both TFL3 (`TFL3` at offset 4) and ODLF/LiteRT (`ODLF` at offset 4) magic bytes.
- Op names are resolved from the TFLite `BuiltinOperator` enum; custom ops use their `custom_code` string.
- Initializer buffers (weight data) are skipped — only shape and dtype are recorded in `ModelGraph.initializers`.
- Synchronous because FlatBuffers decoding requires no async I/O.
