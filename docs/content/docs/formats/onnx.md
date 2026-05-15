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
- Initializers - weight tensor shapes and dtypes in `ModelGraph.initializers`, plus raw bytes via `ModelGraph.weights.get(name)`
- Opset imports - `graph.opsets`: `ReadonlyMap<string, number>` (domain -> version; `""` = `ai.onnx`)
- Tensor shapes from `value_info` entries in the graph proto
- `If`, `Loop`, and `Scan` subgraphs are inlined with prefixed names (`<parent>/<attrName>/...`) up to a depth of 4

## ONNX-specific fields

`node.domain` is set for non-standard domains (e.g. `com.microsoft`, `ai.onnx.ml`). It is absent for standard `ai.onnx` operators.

`graph.opsets` is only set by the ONNX parser. Pass it to `NodePropertyPanel` via `opsets={graph?.opsets}` to show opset versions in the node header.

## Notes

- Initializer bytes are exposed lazily through `ModelGraph.weights` - the parser indexes them but does not decode until requested. See [Weights](../api/weights/) for `decodeWeight`, `decodeFirstN`, and `computeStats`.
- Initializers with `data_location = EXTERNAL` are not surfaced by `parseOnnx` itself. Load them separately via `loadOnnxExternalWeightsFromUrl(modelBytes, baseUrl)` from `@wetron/onnx` — see [Weights](../api/weights/#onnx-external-data-loader).
- The parser uses `protobufjs` - not a hand-rolled binary reader.
