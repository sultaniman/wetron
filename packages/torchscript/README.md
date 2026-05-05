# @wetron/torchscript

TorchScript model parser for wetron. Reads `.pt` files (ZIP-based and FlatBuffers Mobile format) and returns a `ModelGraph` IR. Graph structure only - no weight tensors are deserialized.

## Install

```bash
bun add @wetron/torchscript
```

Included automatically when you install `@wetron/core` or `@wetron/react`.

## API

```ts
import { parseTorchscript } from "@wetron/torchscript";

const bytes = new Uint8Array(await file.arrayBuffer());
const graph = parseTorchscript(bytes); // synchronous
```

Throws `ParseError` from `@wetron/core/ir` on malformed input.

## Format variants

**ZIP-based** (`torch.jit.save`): detected by `PK\x03\x04` magic, reads `bytecode.pkl`.

**FlatBuffers Mobile** (`.ptl`): detected by `PTMF` at bytes 4-7, reads operator calls from instruction bytecode.

Both produce a linear graph: `input -> op_0 -> op_1 -> … -> output`.

## Notes

- `ModelGraph.initializers` and `tensorShapes` are always empty - weight data and shape inference are not performed.
- Non-fatal per-method errors are attached as `warnings` on the returned `ModelGraph`.
