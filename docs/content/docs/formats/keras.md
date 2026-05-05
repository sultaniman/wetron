---
title: "Keras"
description: "Keras 3 model parser for Wetron - parses .keras ZIP archives containing config.json for Sequential and Functional model topologies."
lead: "Parses `.keras` ZIP archives containing a `config.json`."
weight: 30
---

```ts
import { parseKeras } from "@wetron/keras";

const graph = parseKeras(bytes); // synchronous, returns ModelGraph
```

## What is parsed

- `config.json` from inside the `.keras` ZIP archive - contains the full layer graph
- Supported `class_name` values: `Sequential`, `Functional`
- `InputLayer` entries -> `ModelGraph.inputs` (excluded from `nodes`)
- Layer `class_name` -> node `opType`
- Layer `config` fields -> node `attributes` (`name`, `dtype`, `trainable` filtered out)
- Edges resolved from `inbound_nodes[].args[].keras_history` for Functional models; chained sequentially for Sequential models

## Keras 3 tensor references

Keras 3 serializes tensor references as `{ class_name: "__keras_tensor__", config: { keras_history: [...] } }`. The parser handles both this form and the older `{ keras_history: [...] }` shorthand.

## Notes

- Uses `fflate` for ZIP decompression.
- `ModelGraph.initializers` is always empty - weight data lives in separate `.weights.h5` files which are not parsed.
- `ModelGraph.tensorShapes` is populated from `InputLayer` batch shapes only (`null` batch dimension -> `-1`).
- Multi-input merge layers (e.g. `Concatenate`) correctly receive multiple `inputs` entries from the `args` array in `inbound_nodes`.
- Throws `ParseError` if `config.json` is missing, invalid JSON, or uses an unsupported model class.
