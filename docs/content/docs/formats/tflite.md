---
title: "TFLite"
description: "TensorFlow Lite model parser for Wetron - parses .tflite FlatBuffers files synchronously, including built-in ops, custom ops, and dtype mapping."
lead: "Parses `.tflite` FlatBuffers files synchronously using the flatbuffers npm package."
weight: 20
---

```ts
import { parseTflite } from "@wetron/tflite";

const graph = parseTflite(bytes: Uint8Array): ModelGraph
```

Synchronous - no `await` needed.

## What is parsed

- The first subgraph (`subgraphs[0]`); secondary subgraphs referenced by `If` / `While` are not yet inlined
- Op types from the built-in `BuiltinOperator` enum; custom ops use their `custom_code` string
- Tensor shapes and dtypes for all tensors in the parsed subgraph
- Graph inputs and outputs from the primary subgraph
- Initializer bytes exposed via `ModelGraph.weights.get(name)` - tensors with a non-empty buffer reference

## Detection

Detects both:

- `TFL3` at offset 4 (standard TFLite)
- `ODLF` at offset 4 (LiteRT / ODLF variant)

## Dtype mapping

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

## Notes

- Initializer buffers are exposed lazily through `ModelGraph.weights`; consumers call `weights.get(name)` for raw bytes and `decodeWeight` / `computeStats` from `@wetron/core` to inspect values. See [Weights](../api/weights/).
- Synchronous because FlatBuffers decoding requires no async I/O.
