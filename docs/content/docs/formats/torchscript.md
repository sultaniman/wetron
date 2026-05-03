---
title: "TorchScript"
description: "TorchScript parser for Wetron — handles both ZIP-based torch.jit.save files and FlatBuffers Mobile .ptl format, synchronously."
lead: "Parses `.pt` files — ZIP-based (`torch.jit.save`) and FlatBuffers Mobile format."
weight: 40
---

```ts
import { parseTorchscript } from "@wetron/torchscript";

const graph = parseTorchscript(bytes: Uint8Array): ModelGraph
```

Synchronous.

## Format variants

### ZIP-based (`torch.jit.save`)

Detected by `PK\x03\x04` ZIP magic at offset 0. Reads `bytecode.pkl` from the archive and decodes the Python binary serialization stream (protocol 2/4) — extracts operator names and overloads as metadata. No code is executed.

Operators are extracted as `(name, overload, n)` tuples from the `operators` section of the bytecode.

### FlatBuffers Mobile (`.ptl`)

Detected by `PTMF` at bytes 4–7. Reads the Module root table, walks `methods` → IValue references → Function entries, and extracts operator calls from instruction bytecode. Opcode 0 (`OP`) indicates a call to a registered operator.

Falls back to scanning all IValues for Function type if the methods array yields nothing.

## Graph structure

Both variants produce a **linear graph**: `input → op_0 → op_1 → … → output`.

```
input
  ↓
op_0  (e.g. aten::conv2d)
  ↓
op_1  (e.g. aten::batch_norm)
  ↓
...
  ↓
output
```

## Notes

- `ModelGraph.initializers` is always empty — weight data is not parsed.
- `ModelGraph.tensorShapes` is always empty — shape inference is not performed.
- Non-fatal per-method errors are attached as `warnings` on the returned graph.
- Uses `flatbuffers` for Mobile format and `fflate` for ZIP extraction.
