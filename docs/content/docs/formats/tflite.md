---
title: "TFLite"
description: "TensorFlow Lite model parser for Wetron — parses .tflite FlatBuffers files synchronously, including built-in ops, custom ops, and dtype mapping."
lead: "Parses `.tflite` FlatBuffers files synchronously using the flatbuffers npm package."
weight: 20
---

```ts
import { parseTflite } from "@wetron/tflite";

const graph = parseTflite(bytes: Uint8Array): ModelGraph
```

Synchronous — no `await` needed.

## What is parsed

- All subgraphs flattened into a single graph (multi-subgraph models are concatenated)
- Op types from the built-in `BuiltinOperator` enum; custom ops use their `custom_code` string
- Tensor shapes and dtypes for all tensors
- Graph inputs and outputs from the primary subgraph

## Detection

Detects both:
- `TFL3` at offset 4 (standard TFLite)
- `ODLF` at offset 4 (LiteRT / ODLF variant)

## Dtype mapping

| TFLite enum | dtype string |
|---|---|
| 0 | `float32` |
| 1 | `int32` |
| 2 | `uint8` |
| 3 | `int64` |
| 4 | `string` |
| 5 | `bool` |
| 6 | `int16` |
| 7 | `complex64` |
| 8 | `int8` |
| 9 | `float16` |
| 10 | `float64` |
| 11 | `complex128` |
| 16 | `uint32` |
| 17 | `uint64` |
| 256 | `bfloat16` |

## Notes

- Initializer buffers (weight data) are skipped — only shape and dtype are recorded in `ModelGraph.initializers`.
- Synchronous because FlatBuffers decoding requires no async I/O.
