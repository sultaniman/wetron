# @wetron/torchscript

TorchScript model parser. Reads `.pt` files (both ZIP-based from `torch.jit.save` and FlatBuffers Mobile format) and returns a `ModelGraph` IR. Graph structure only — no weight tensors are deserialized.

## API

```ts
function parseTorchscript(bytes: Uint8Array): ModelGraph; // synchronous
```

Throws `ParseError` (from `@wetron/core/ir`) on malformed input or unrecognised format.

## Format variants

**ZIP-based** (`torch.jit.save` / newer lite interpreter):
- Detected by `PK\x03\x04` ZIP magic at offset 0
- Reads `bytecode.pkl` from the archive
- Decodes the Python binary serialization stream (protocol 2/4) — extracts operator names and overloads only; values are not evaluated or executed
- Operators section extracted as `(name, overload, n)` tuples

**FlatBuffers Mobile** (`.ptl`):
- Detected by `PTMF` at bytes 4–7
- Reads the Module root table, walks `methods` → IValue references → Function entries
- Extracts operator calls from instruction bytecode (opcode 0 = OP = call registered operator)
- Falls back to scanning all IValues for Function type if methods array yields nothing

In both cases the result is a **linear graph** of operator calls: `input → op_0 → op_1 → … → output`.

## Implementation notes

- Uses `flatbuffers` npm package for Mobile format decoding.
- Uses `fflate` for ZIP extraction in the ZIP-based format.
- Binary serialization decoder handles protocol 2/4 opcodes covering tuples, lists, strings, ints, floats, None, and memo/put/get. Callables and objects are dropped as null — no code is executed.
- Non-fatal per-method errors are attached as `warnings` on the returned `ModelGraph`.
- `ModelGraph.initializers` is always empty — weight data is not parsed.
- `ModelGraph.tensorShapes` is always empty — shape inference is not performed.
