---
title: "ONNX"
description: "ONNX model parser for Wetron - parses .onnx protobuf files using protobufjs, extracting nodes, initializers, opsets, and tensor shapes."
lead: "Parses `.onnx` protobuf files using protobufjs."
weight: 10
---

```ts
import { parseOnnx } from "@wetron/onnx";

function parseOnnx(bytes: Uint8Array): ModelGraph;
```

## What is parsed

- All graph nodes with op type, domain, inputs, outputs, and attributes
- Graph inputs and outputs with shape and dtype from `value_info`
- Initializers - weight tensor shapes and dtypes (no raw data)
- Opset imports - `graph.opsets`: `ReadonlyMap<string, number>` (domain -> version; `""` = `ai.onnx`)
- Tensor shapes from `value_info` entries in the graph proto

## ONNX-specific fields

`node.domain` is set for non-standard domains (e.g. `com.microsoft`, `ai.onnx.ml`). It is absent for standard `ai.onnx` operators.

`graph.opsets` is only set by the ONNX parser. Pass it to `NodePropertyPanel` via `opsets={graph?.opsets}` to show opset versions in the node header.

## Notes

- Weight values are not deserialised - only shapes and dtypes are recorded in `ModelGraph.initializers`.
- External data references in large ONNX models are skipped.
- The parser uses `protobufjs` - not a hand-rolled binary reader.
